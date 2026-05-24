"use client";

import { useEffect, useRef, useState } from "react";
import {
  GameSave,
  loadGame,
  newSave,
  saveGame,
  isGuest,
} from "../lib/save";
import {
  Creature,
  SPECIES,
  MOVES,
  createWild,
  damageCalc,
  gainExp,
  tryCatch,
  expYield,
  TYPE_COLORS,
} from "../lib/creatures";
import {
  MAPS,
  GameMap,
  TileType,
  getTile,
  isBlocked,
  findPortal,
  findNpc,
  findSign,
  rollEncounter,
  NpcDef,
} from "../lib/world";
import {
  Sprite,
  drawSprite,
  PLAYER_DOWN_A,
  PLAYER_DOWN_B,
  PLAYER_UP_A,
  PLAYER_LEFT_A,
  PLAYER_RIGHT_A,
  PLAYER_BACK,
  TILE_GRASS,
  TILE_TALL_GRASS,
  TILE_TREE,
  TILE_WATER,
  TILE_SAND,
  TILE_PATH,
  TILE_BUILDING,
  TILE_DOOR,
  TILE_SIGN,
  NPC_MENTOR,
  CATCH_BALL,
} from "../lib/sprites";

// ===== Rendering constants =====
const TILE_PX = 16; // logical sprite pixels per tile
const PIXEL_SCALE = 2; // canvas pixels per sprite pixel
const TILE_SIZE = TILE_PX * PIXEL_SCALE; // 32 canvas px per tile
const VIEW_TILES_X = 15;
const VIEW_TILES_Y = 11;
const CANVAS_W = VIEW_TILES_X * TILE_SIZE; // 480
const CANVAS_H = VIEW_TILES_Y * TILE_SIZE; // 352

type Facing = "up" | "down" | "left" | "right";

type Dialogue = {
  lines: string[];
  index: number;
  onDone?: () => void;
  charsShown: number;
};

type MenuKind = "pause" | "starter" | "party" | "battleMain" | "battleFight" | "battleBag" | "battleNew";

type Menu = {
  kind: MenuKind;
  options: string[];
  selected: number;
  data?: any;
};

type BattlePhase =
  | "intro"
  | "menu" // main 4-option menu
  | "fightMenu"
  | "bagMenu"
  | "playerAttack"
  | "enemyAttack"
  | "throwBall"
  | "checkCatch"
  | "victory"
  | "defeat"
  | "fled"
  | "message";

type BattleState = {
  enemy: Creature;
  enemyMaxHp: number;
  activeIdx: number;
  phase: BattlePhase;
  message: string;
  messageProgress: number; // chars shown
  messageQueue: { text: string; next?: BattlePhase; action?: () => void }[];
  selected: number;
  fightSelected: number;
  bagSelected: number;
  playerAnimX: number;
  enemyAnimX: number;
  playerShake: number;
  enemyShake: number;
  ballAnim: number; // 0-1 for capture animation
  ballOutcome?: "caught" | "broke";
  fadeIn: number;
  turnOver: boolean;
  endedAt?: number;
  enemyHpShown: number;
  playerHpShown: number;
};

type Player = {
  x: number;
  y: number;
  px: number; // pixel sub-position within current move
  py: number;
  facing: Facing;
  isMoving: boolean;
  moveProgress: number; // 0..1
  walkFrame: number; // 0 or 1
  stepsTaken: number;
};

type Mode =
  | "overworld"
  | "dialogue"
  | "menu"
  | "battle"
  | "fadeOut"
  | "fadeIn"
  | "transition";

type GameRef = {
  save: GameSave;
  mode: Mode;
  player: Player;
  cameraX: number;
  cameraY: number;
  dialogue?: Dialogue;
  menu?: Menu;
  battle?: BattleState;
  fade: number; // 0..1
  fadeTarget: number;
  fadeCallback?: () => void;
  nextMapId?: string;
  pendingTeleport?: { mapId: string; x: number; y: number; facing: Facing };
  frame: number;
  pressed: Set<string>;
  lastInput: number;
  toast?: { text: string; timer: number };
  playTimeAccum: number;
  needsSavePulse: number;
};

const STARTERS = ["cinderpaw", "aquadrip", "sprigling"];

type Props = {
  username: string;
  displayName: string;
  onLogout: () => void;
};

export function Game({ username, displayName, onLogout }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameRef | null>(null);
  const rafRef = useRef<number | null>(null);
  const [, forceRender] = useState(0);
  const [hint, setHint] = useState("Use ARROW KEYS to move · SPACE to interact · ESC for menu");
  const [savedFlash, setSavedFlash] = useState(false);

  // Initialize state once
  useEffect(() => {
    let save = loadGame(username);
    if (!save) save = newSave(username);
    const startMap = MAPS[save.position.mapId] ? save.position.mapId : "hearthwick";
    const startX = MAPS[startMap] ? Math.min(save.position.x, MAPS[startMap].tiles[0].length - 1) : 9;
    const startY = MAPS[startMap] ? Math.min(save.position.y, MAPS[startMap].tiles.length - 1) : 8;

    const initial: GameRef = {
      save,
      mode: save.party.length === 0 ? "overworld" : "overworld",
      player: {
        x: startX,
        y: startY,
        px: 0,
        py: 0,
        facing: save.position.facing,
        isMoving: false,
        moveProgress: 0,
        walkFrame: 0,
        stepsTaken: 0,
      },
      cameraX: 0,
      cameraY: 0,
      fade: 0,
      fadeTarget: 0,
      frame: 0,
      pressed: new Set(),
      lastInput: 0,
      playTimeAccum: 0,
      needsSavePulse: 0,
    };
    stateRef.current = initial;
    centerCamera(initial);
    forceRender((n) => n + 1);

    // First-time greeting
    if (save.party.length === 0) {
      setTimeout(() => {
        startDialogue(
          [
            `Hello, ${displayName}! Welcome to the Verdant Region!`,
            "Find Professor Cedar in the building to the north-east.",
            "He'll give you your first Monstro!",
          ],
        );
      }, 300);
    }

    // Auto-save every 30 seconds
    const autosave = setInterval(() => {
      if (!stateRef.current) return;
      doSave(false);
    }, 30000);

    return () => clearInterval(autosave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, displayName]);

  // Keyboard input
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const s = stateRef.current;
      if (!s) return;
      const key = normalizeKey(e.key);
      if (!key) return;
      // Prevent scroll
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Space"].includes(e.key)) {
        e.preventDefault();
      }
      if (s.pressed.has(key)) return;
      s.pressed.add(key);
      handleKeyDown(key);
    }
    function onKeyUp(e: KeyboardEvent) {
      const s = stateRef.current;
      if (!s) return;
      const key = normalizeKey(e.key);
      if (!key) return;
      s.pressed.delete(key);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    let lastT = performance.now();

    function loop(t: number) {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      const s = stateRef.current;
      if (s && ctx) {
        update(s, dt);
        render(ctx, s);
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function normalizeKey(k: string): string | null {
    const map: Record<string, string> = {
      ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      w: "up", a: "left", s: "down", d: "right",
      W: "up", A: "left", S: "down", D: "right",
      " ": "confirm", Enter: "confirm", z: "confirm", Z: "confirm",
      Escape: "menu", x: "cancel", X: "cancel", Shift: "run",
      b: "bag", B: "bag",
    };
    return map[k] || null;
  }

  function centerCamera(s: GameRef) {
    const map = MAPS[s.save.position.mapId];
    const playerCenterTileX = s.player.x;
    const playerCenterTileY = s.player.y;
    const halfX = Math.floor(VIEW_TILES_X / 2);
    const halfY = Math.floor(VIEW_TILES_Y / 2);
    let camTileX = playerCenterTileX - halfX;
    let camTileY = playerCenterTileY - halfY;
    const mapW = map.tiles[0].length;
    const mapH = map.tiles.length;
    camTileX = Math.max(0, Math.min(mapW - VIEW_TILES_X, camTileX));
    camTileY = Math.max(0, Math.min(mapH - VIEW_TILES_Y, camTileY));
    s.cameraX = camTileX * TILE_SIZE;
    s.cameraY = camTileY * TILE_SIZE;
  }

  function startDialogue(lines: string[], onDone?: () => void) {
    const s = stateRef.current;
    if (!s) return;
    s.dialogue = { lines, index: 0, onDone, charsShown: 0 };
    s.mode = "dialogue";
  }

  function startMenu(menu: Menu) {
    const s = stateRef.current;
    if (!s) return;
    s.menu = menu;
    s.mode = "menu";
  }

  function closeMenu() {
    const s = stateRef.current;
    if (!s) return;
    s.menu = undefined;
    s.mode = "overworld";
  }

  function doSave(showToast: boolean) {
    const s = stateRef.current;
    if (!s) return;
    s.save.position = { mapId: s.save.position.mapId, x: s.player.x, y: s.player.y, facing: s.player.facing };
    saveGame(s.save);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    if (showToast) {
      s.toast = { text: "Game Saved!", timer: 1.5 };
    }
  }

  function tryMove(dir: Facing) {
    const s = stateRef.current;
    if (!s || s.player.isMoving) return;
    s.player.facing = dir;
    const map = MAPS[s.save.position.mapId];
    const tx = s.player.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0);
    const ty = s.player.y + (dir === "up" ? -1 : dir === "down" ? 1 : 0);
    if (isBlocked(map, tx, ty)) return;
    s.player.isMoving = true;
    s.player.moveProgress = 0;
  }

  function handleKeyDown(key: string) {
    const s = stateRef.current;
    if (!s) return;
    s.lastInput = performance.now();

    if (s.mode === "overworld") {
      if (key === "up" || key === "down" || key === "left" || key === "right") {
        tryMove(key);
      } else if (key === "confirm") {
        interact();
      } else if (key === "menu") {
        openPauseMenu();
      }
    } else if (s.mode === "dialogue") {
      if (key === "confirm" || key === "cancel" || key === "menu") {
        advanceDialogue();
      }
    } else if (s.mode === "menu") {
      handleMenuInput(key);
    } else if (s.mode === "battle") {
      // During battle, route to menu handler when a menu is open, otherwise battle handler
      if (s.menu) handleMenuInput(key);
      else handleBattleInput(key);
    }
  }

  function interact() {
    const s = stateRef.current;
    if (!s) return;
    const dir = s.player.facing;
    const tx = s.player.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0);
    const ty = s.player.y + (dir === "up" ? -1 : dir === "down" ? 1 : 0);
    const map = MAPS[s.save.position.mapId];
    const npc = findNpc(map, tx, ty);
    if (npc) {
      runNpc(npc);
      return;
    }
    const sign = findSign(map, tx, ty);
    if (sign) {
      startDialogue(sign.text);
      return;
    }
    // Check tile player stands on for healing pad
    const here = getTile(map, s.player.x, s.player.y);
    if (here === "H") {
      // already handled on step
    }
  }

  function runNpc(npc: NpcDef) {
    const s = stateRef.current;
    if (!s) return;
    if (npc.givesStarter && !s.save.flags.hasStarter) {
      startDialogue(npc.dialogue, () => openStarterMenu());
      return;
    }
    if (npc.requiresFlag && !s.save.flags[npc.requiresFlag]) {
      startDialogue(npc.dialogue);
      return;
    }
    if (npc.altDialogue && (npc.flagAfter ? s.save.flags[npc.flagAfter] : false)) {
      startDialogue(npc.altDialogue);
      return;
    }
    startDialogue(npc.dialogue, () => {
      if (npc.flagAfter) s.save.flags[npc.flagAfter] = true;
    });
  }

  function openStarterMenu() {
    startMenu({
      kind: "starter",
      options: STARTERS.map((id) => SPECIES[id].name),
      selected: 0,
    });
  }

  function openPauseMenu() {
    const s = stateRef.current;
    if (!s) return;
    const opts = ["PARTY", "MONSTRODEX", "BAG", "SAVE", "QUIT"];
    startMenu({ kind: "pause", options: opts, selected: 0 });
  }

  function advanceDialogue() {
    const s = stateRef.current;
    if (!s || !s.dialogue) return;
    const d = s.dialogue;
    const fullLen = d.lines[d.index].length;
    if (d.charsShown < fullLen) {
      d.charsShown = fullLen;
      return;
    }
    d.index += 1;
    d.charsShown = 0;
    if (d.index >= d.lines.length) {
      const cb = d.onDone;
      s.dialogue = undefined;
      s.mode = "overworld";
      if (cb) cb();
    }
  }

  function handleMenuInput(key: string) {
    const s = stateRef.current;
    if (!s || !s.menu) return;
    const m = s.menu;
    if (key === "up") {
      m.selected = (m.selected - 1 + m.options.length) % m.options.length;
    } else if (key === "down") {
      m.selected = (m.selected + 1) % m.options.length;
    } else if (key === "left" && (m.kind === "battleMain" || m.kind === "battleFight")) {
      // grid nav: 2 cols
      m.selected = m.selected % 2 === 1 ? m.selected - 1 : (m.selected + 1) % m.options.length;
    } else if (key === "right" && (m.kind === "battleMain" || m.kind === "battleFight")) {
      m.selected = m.selected % 2 === 0 ? Math.min(m.options.length - 1, m.selected + 1) : m.selected - 1;
    } else if (key === "confirm") {
      handleMenuConfirm();
    } else if (key === "cancel" || key === "menu") {
      handleMenuCancel();
    }
  }

  function handleMenuCancel() {
    const s = stateRef.current;
    if (!s || !s.menu) return;
    if (s.menu.kind === "pause") closeMenu();
    else if (s.menu.kind === "party") closeMenu();
    else if (s.menu.kind === "battleFight") {
      if (s.battle) {
        s.battle.phase = "menu";
        s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
      }
    }
  }

  function handleMenuConfirm() {
    const s = stateRef.current;
    if (!s || !s.menu) return;
    const m = s.menu;
    if (m.kind === "starter") {
      const speciesId = STARTERS[m.selected];
      const creature = createWild(speciesId, 5);
      s.save.party = [creature];
      s.save.flags.hasStarter = true;
      if (!s.save.monstroCaught.includes(speciesId)) s.save.monstroCaught.push(speciesId);
      if (!s.save.monstroSeen.includes(speciesId)) s.save.monstroSeen.push(speciesId);
      closeMenu();
      startDialogue([
        `${displayName} received ${SPECIES[speciesId].name}!`,
        "Head south through the path to explore Route 1.",
        "Press ESC to open your menu and save at any time.",
      ]);
      doSave(false);
    } else if (m.kind === "pause") {
      const choice = m.options[m.selected];
      if (choice === "SAVE") {
        doSave(true);
        closeMenu();
      } else if (choice === "PARTY") {
        if (s.save.party.length === 0) {
          startDialogue(["You have no Monstro yet."]);
          closeMenu();
        } else {
          startMenu({ kind: "party", options: s.save.party.map((c) => `${SPECIES[c.speciesId].name} Lv${c.level}`), selected: 0 });
        }
      } else if (choice === "BAG") {
        startDialogue([
          `Catch Capsules: ${s.save.bag.capsules}`,
          `Potions: ${s.save.bag.potions}`,
          `Coins: ${s.save.money}`,
        ]);
        closeMenu();
      } else if (choice === "MONSTRODEX") {
        const total = Object.keys(SPECIES).length;
        const seen = s.save.monstroSeen.length;
        const caught = s.save.monstroCaught.length;
        const caughtList = s.save.monstroCaught.map((id) => `· ${SPECIES[id].name} (${SPECIES[id].types.join("/")})`);
        startDialogue([
          `MONSTRODEX — Verdant Region`,
          `Seen: ${seen}/${total}  ·  Caught: ${caught}/${total}`,
          ...(caughtList.length ? caughtList : ["No Monstro caught yet. Throw a Catch Capsule!"]),
        ]);
        closeMenu();
      } else if (choice === "QUIT") {
        doSave(false);
        onLogout();
      }
    } else if (m.kind === "party") {
      const c = s.save.party[m.selected];
      const sp = SPECIES[c.speciesId];
      const lines = [
        `${sp.name} · Lv${c.level}`,
        `Type: ${sp.types.join(" / ")}`,
        `HP: ${c.currentHp}/${c.maxHp}`,
        `ATK ${c.atk}  DEF ${c.def}  SPD ${c.spd}`,
        `Moves: ${c.moves.map((mv) => MOVES[mv.moveId].name).join(", ")}`,
      ];
      startDialogue(lines);
      closeMenu();
    } else if (m.kind === "battleMain") {
      const choice = m.options[m.selected];
      if (choice === "FIGHT") openFightMenu();
      else if (choice === "BAG") openBattleBag();
      else if (choice === "PARTY") {
        startDialogue([
          "You only have one active Monstro for now.",
          "Switching support coming soon!",
        ]);
        s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
      } else if (choice === "RUN") {
        runFromBattle();
      }
    } else if (m.kind === "battleFight") {
      const c = s.save.party[s.battle!.activeIdx];
      const move = c.moves[m.selected];
      if (move.pp <= 0) {
        battleMessage("No PP left for that move!", "fightMenu");
        return;
      }
      s.menu = undefined;
      doPlayerAttack(m.selected);
    } else if (m.kind === "battleBag") {
      if (m.selected === 0) {
        // Catch Capsule
        if (s.save.bag.capsules <= 0) {
          battleMessage("No Catch Capsules left!", "bagMenu");
          return;
        }
        s.menu = undefined;
        throwCapsule();
      } else if (m.selected === 1) {
        // Potion
        if (s.save.bag.potions <= 0) {
          battleMessage("No Potions left!", "bagMenu");
          return;
        }
        const c = s.save.party[s.battle!.activeIdx];
        if (c.currentHp >= c.maxHp) {
          battleMessage("HP is already full!", "bagMenu");
          return;
        }
        s.save.bag.potions -= 1;
        const heal = 30;
        c.currentHp = Math.min(c.maxHp, c.currentHp + heal);
        s.menu = undefined;
        battleMessage(`${SPECIES[c.speciesId].name} recovered ${heal} HP!`, "enemyAttack");
      } else if (m.selected === 2) {
        // Cancel
        s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
      }
    }
  }

  function openFightMenu() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const c = s.save.party[s.battle.activeIdx];
    s.menu = {
      kind: "battleFight",
      options: c.moves.map((m) => MOVES[m.moveId].name),
      selected: 0,
    };
    s.battle.phase = "fightMenu";
  }

  function openBattleBag() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    s.menu = {
      kind: "battleBag",
      options: [
        `Catch Capsule x${s.save.bag.capsules}`,
        `Potion x${s.save.bag.potions}`,
        `Cancel`,
      ],
      selected: 0,
    };
    s.battle.phase = "bagMenu";
  }

  function handleBattleInput(key: string) {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    if (b.phase === "intro" || b.phase === "playerAttack" || b.phase === "enemyAttack" || b.phase === "throwBall" || b.phase === "checkCatch") {
      // Allow skipping text
      if ((key === "confirm" || key === "cancel") && b.messageProgress < b.message.length) {
        b.messageProgress = b.message.length;
        return;
      }
      if (key === "confirm" || key === "cancel") {
        if (b.messageQueue.length > 0) {
          const next = b.messageQueue.shift()!;
          b.message = next.text;
          b.messageProgress = 0;
          if (next.action) next.action();
          if (next.next) b.phase = next.next;
        } else {
          advanceBattlePhase();
        }
      }
    } else if (b.phase === "victory" || b.phase === "defeat" || b.phase === "fled") {
      if (key === "confirm" || key === "cancel") {
        if (b.messageProgress < b.message.length) { b.messageProgress = b.message.length; return; }
        if (b.messageQueue.length > 0) {
          const next = b.messageQueue.shift()!;
          b.message = next.text;
          b.messageProgress = 0;
          if (next.action) next.action();
        } else {
          finishBattle();
        }
      }
    }
  }

  function battleMessage(text: string, nextPhase?: BattlePhase, action?: () => void) {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    s.battle.message = text;
    s.battle.messageProgress = 0;
    if (action) action();
    if (nextPhase) s.battle.phase = nextPhase;
  }

  function queueBattleMessages(list: { text: string; next?: BattlePhase; action?: () => void }[]) {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    if (list.length === 0) return;
    const first = list[0];
    s.battle.message = first.text;
    s.battle.messageProgress = 0;
    if (first.action) first.action();
    if (first.next) s.battle.phase = first.next;
    s.battle.messageQueue = list.slice(1);
  }

  function advanceBattlePhase() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    if (b.phase === "intro") {
      b.phase = "menu";
      s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
    } else if (b.phase === "playerAttack") {
      // After player attack message, check if enemy fainted, else enemy attacks
      if (b.enemy.currentHp <= 0) {
        onEnemyFainted();
      } else {
        doEnemyAttack();
      }
    } else if (b.phase === "enemyAttack") {
      if (s.save.party[b.activeIdx].currentHp <= 0) {
        onPlayerFainted();
      } else {
        b.phase = "menu";
        s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
      }
    } else if (b.phase === "throwBall") {
      // After "you throw a capsule" message, do the catch check
      resolveCatch();
    } else if (b.phase === "checkCatch") {
      if (b.ballOutcome === "caught") {
        catchSucceed();
      } else {
        // It broke out, enemy turn next
        battleMessage("Oh no! It broke free!", "enemyAttack");
        s.menu = undefined;
        setTimeout(() => doEnemyAttack(), 800);
      }
    }
  }

  function doPlayerAttack(moveIdx: number) {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    const c = s.save.party[b.activeIdx];
    const moveSlot = c.moves[moveIdx];
    const move = MOVES[moveSlot.moveId];
    moveSlot.pp = Math.max(0, moveSlot.pp - 1);
    b.playerAnimX = 1; // trigger animation
    if (Math.random() * 100 > move.accuracy) {
      battleMessage(`${SPECIES[c.speciesId].name} used ${move.name}! It missed!`, "playerAttack");
      return;
    }
    const res = damageCalc(c, b.enemy, move);
    b.enemy.currentHp = Math.max(0, b.enemy.currentHp - res.dmg);
    b.enemyShake = 0.5;
    const msgs: { text: string; next?: BattlePhase; action?: () => void }[] = [
      { text: `${SPECIES[c.speciesId].name} used ${move.name}!`, next: "playerAttack" },
    ];
    if (res.crit && res.dmg > 0) msgs.push({ text: "A critical hit!" });
    if (res.eff === 0) msgs.push({ text: "It had no effect..." });
    else if (res.eff >= 2) msgs.push({ text: "It's super effective!" });
    else if (res.eff > 0 && res.eff < 1) msgs.push({ text: "It's not very effective..." });
    queueBattleMessages(msgs);
  }

  function doEnemyAttack() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    b.phase = "enemyAttack";
    if (b.enemy.moves.length === 0) {
      battleMessage(`${SPECIES[b.enemy.speciesId].name} did nothing!`, "enemyAttack");
      return;
    }
    const moveSlot = b.enemy.moves[Math.floor(Math.random() * b.enemy.moves.length)];
    const move = MOVES[moveSlot.moveId];
    const target = s.save.party[b.activeIdx];
    b.enemyAnimX = 1;
    if (Math.random() * 100 > move.accuracy) {
      battleMessage(`Wild ${SPECIES[b.enemy.speciesId].name} used ${move.name}! It missed!`, "enemyAttack");
      return;
    }
    const res = damageCalc(b.enemy, target, move);
    target.currentHp = Math.max(0, target.currentHp - res.dmg);
    b.playerShake = 0.5;
    const msgs: { text: string; next?: BattlePhase; action?: () => void }[] = [
      { text: `Wild ${SPECIES[b.enemy.speciesId].name} used ${move.name}!`, next: "enemyAttack" },
    ];
    if (res.crit && res.dmg > 0) msgs.push({ text: "A critical hit!" });
    if (res.eff === 0) msgs.push({ text: "It had no effect..." });
    else if (res.eff >= 2) msgs.push({ text: "It's super effective!" });
    else if (res.eff > 0 && res.eff < 1) msgs.push({ text: "It's not very effective..." });
    queueBattleMessages(msgs);
  }

  function onEnemyFainted() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    const c = s.save.party[b.activeIdx];
    const enemySpecies = SPECIES[b.enemy.speciesId];
    const xp = expYield(enemySpecies, b.enemy.level);
    const result = gainExp(c, xp);
    const msgs: { text: string; next?: BattlePhase; action?: () => void }[] = [
      { text: `Wild ${enemySpecies.name} fainted!` , next: "victory" },
      { text: `${SPECIES[c.speciesId].name} gained ${xp} EXP!` },
    ];
    if (result.leveledUp) {
      msgs.push({ text: `${SPECIES[c.speciesId].name} grew to Lv${c.level}!` });
      for (const mvName of result.newMoves) {
        msgs.push({ text: `${SPECIES[c.speciesId].name} learned ${mvName}!` });
      }
    }
    queueBattleMessages(msgs);
  }

  function onPlayerFainted() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    const c = s.save.party[b.activeIdx];
    // Find next non-fainted
    const nextIdx = s.save.party.findIndex((p, i) => i !== b.activeIdx && p.currentHp > 0);
    if (nextIdx >= 0) {
      b.activeIdx = nextIdx;
      battleMessage(`${SPECIES[c.speciesId].name} fainted! Go, ${SPECIES[s.save.party[nextIdx].speciesId].name}!`, "menu");
      setTimeout(() => {
        if (s.battle) {
          s.battle.phase = "menu";
          s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
        }
      }, 1000);
    } else {
      // All fainted - blackout
      queueBattleMessages([
        { text: `${SPECIES[c.speciesId].name} fainted!`, next: "defeat" },
        { text: `${displayName} blacked out...`, action: () => {} },
        { text: `You rush back to Hearthwick Town.`, action: () => {
          // Heal party and teleport
          s.save.party.forEach((p) => { p.currentHp = Math.max(1, Math.floor(p.maxHp / 2)); });
          s.save.position = { mapId: "hearthwick", x: 9, y: 8, facing: "down" };
        } },
      ]);
    }
  }

  function runFromBattle() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    const c = s.save.party[b.activeIdx];
    const escapeOdds = Math.min(1, (c.spd + 60) / Math.max(1, b.enemy.spd));
    if (Math.random() < escapeOdds) {
      s.menu = undefined;
      queueBattleMessages([{ text: "Got away safely!", next: "fled" }]);
    } else {
      s.menu = undefined;
      battleMessage("Couldn't escape!", "enemyAttack");
      setTimeout(() => doEnemyAttack(), 800);
    }
  }

  function throwCapsule() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    s.save.bag.capsules -= 1;
    b.ballAnim = 0;
    battleMessage(`${displayName} threw a Catch Capsule!`, "throwBall");
  }

  function resolveCatch() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    const caught = tryCatch(b.enemy);
    b.ballOutcome = caught ? "caught" : "broke";
    b.phase = "checkCatch";
    if (caught) {
      battleMessage(`Gotcha! Wild ${SPECIES[b.enemy.speciesId].name} was caught!`, "checkCatch");
    } else {
      battleMessage("Almost had it!", "checkCatch");
    }
  }

  function catchSucceed() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    // Add caught creature to party or storage
    if (!s.save.monstroCaught.includes(b.enemy.speciesId)) {
      s.save.monstroCaught.push(b.enemy.speciesId);
    }
    if (s.save.party.length < 6) {
      s.save.party.push({ ...b.enemy });
    } else {
      s.save.storage.push({ ...b.enemy });
    }
    queueBattleMessages([
      { text: `${SPECIES[b.enemy.speciesId].name} was added to your team!`, next: "victory" },
    ]);
  }

  function finishBattle() {
    const s = stateRef.current;
    if (!s) return;
    s.battle = undefined;
    s.menu = undefined;
    s.mode = "overworld";
  }

  function startBattle(speciesId: string, level: number) {
    const s = stateRef.current;
    if (!s) return;
    const enemy = createWild(speciesId, level);
    if (!s.save.monstroSeen.includes(speciesId)) s.save.monstroSeen.push(speciesId);
    s.battle = {
      enemy,
      enemyMaxHp: enemy.maxHp,
      activeIdx: s.save.party.findIndex((p) => p.currentHp > 0),
      phase: "intro",
      message: `A wild ${SPECIES[speciesId].name} appeared!`,
      messageProgress: 0,
      messageQueue: [],
      selected: 0,
      fightSelected: 0,
      bagSelected: 0,
      playerAnimX: 0,
      enemyAnimX: 0,
      playerShake: 0,
      enemyShake: 0,
      ballAnim: 0,
      fadeIn: 1,
      turnOver: false,
      enemyHpShown: enemy.currentHp,
      playerHpShown: s.save.party[0]?.currentHp || 0,
    };
    s.mode = "battle";
    if (s.battle.activeIdx < 0) s.battle.activeIdx = 0;
  }

  // ========== UPDATE ==========
  function update(s: GameRef, dt: number) {
    s.frame += 1;
    s.playTimeAccum += dt;
    if (s.playTimeAccum >= 1) {
      s.save.playTimeSec += Math.floor(s.playTimeAccum);
      s.playTimeAccum -= Math.floor(s.playTimeAccum);
    }

    if (s.toast) {
      s.toast.timer -= dt;
      if (s.toast.timer <= 0) s.toast = undefined;
    }

    if (s.mode === "overworld") {
      // Player movement
      if (s.player.isMoving) {
        const speed = s.pressed.has("run") ? 6 : 4; // tiles per second
        s.player.moveProgress += dt * speed;
        if (s.player.moveProgress >= 1) {
          // Finish move
          const dx = s.player.facing === "left" ? -1 : s.player.facing === "right" ? 1 : 0;
          const dy = s.player.facing === "up" ? -1 : s.player.facing === "down" ? 1 : 0;
          s.player.x += dx;
          s.player.y += dy;
          s.player.isMoving = false;
          s.player.moveProgress = 0;
          s.player.stepsTaken += 1;
          s.player.walkFrame = (s.player.walkFrame + 1) % 2;
          // Check tile effects
          const map = MAPS[s.save.position.mapId];
          const tile = getTile(map, s.player.x, s.player.y);
          // Check portal
          const portal = findPortal(map, s.player.x, s.player.y);
          if (portal) {
            doTransition(portal.toMap, portal.toX, portal.toY, s.player.facing);
            centerCamera(s);
            return;
          }
          // Tall grass encounter
          if (tile === "T") {
            const enc = rollEncounter(map);
            if (enc && s.save.party.some((c) => c.currentHp > 0)) {
              startBattle(enc.speciesId, enc.level);
              centerCamera(s);
              return;
            }
          }
          // Healing pad
          if (tile === "H") {
            healAll();
            startDialogue([
              "The healing pad restored your team!",
              "All Monstro are now at full HP.",
            ]);
          }
          // Auto-continue if still pressing direction
          centerCamera(s);
          const next: Facing | null =
            s.pressed.has("up") ? "up" :
            s.pressed.has("down") ? "down" :
            s.pressed.has("left") ? "left" :
            s.pressed.has("right") ? "right" : null;
          if (next) tryMove(next);
        }
      }
    } else if (s.mode === "dialogue" && s.dialogue) {
      // Animate text typing
      const fullLen = s.dialogue.lines[s.dialogue.index].length;
      s.dialogue.charsShown = Math.min(fullLen, s.dialogue.charsShown + dt * 60);
    } else if (s.mode === "battle" && s.battle) {
      const b = s.battle;
      // Fade in
      if (b.fadeIn > 0) {
        b.fadeIn = Math.max(0, b.fadeIn - dt * 1.2);
      }
      // Animate message text
      if (b.messageProgress < b.message.length) {
        b.messageProgress = Math.min(b.message.length, b.messageProgress + dt * 50);
      }
      // Shake
      if (b.playerShake > 0) b.playerShake = Math.max(0, b.playerShake - dt * 2);
      if (b.enemyShake > 0) b.enemyShake = Math.max(0, b.enemyShake - dt * 2);
      // Attack animation
      if (b.playerAnimX > 0) b.playerAnimX = Math.max(0, b.playerAnimX - dt * 2);
      if (b.enemyAnimX > 0) b.enemyAnimX = Math.max(0, b.enemyAnimX - dt * 2);
      // HP bar animations
      const c = s.save.party[b.activeIdx];
      if (c) {
        if (b.playerHpShown > c.currentHp) b.playerHpShown = Math.max(c.currentHp, b.playerHpShown - dt * c.maxHp * 0.8);
        else b.playerHpShown = c.currentHp;
      }
      if (b.enemyHpShown > b.enemy.currentHp) b.enemyHpShown = Math.max(b.enemy.currentHp, b.enemyHpShown - dt * b.enemyMaxHp * 0.8);
      else b.enemyHpShown = b.enemy.currentHp;

      // Ball animation
      if (b.phase === "throwBall") {
        b.ballAnim = Math.min(1, b.ballAnim + dt * 1.0);
      }
    }

    // Fade transitions
    if (s.mode === "fadeOut") {
      s.fade = Math.min(1, s.fade + dt * 2.5);
      if (s.fade >= 1 && s.pendingTeleport) {
        const pt = s.pendingTeleport;
        s.save.position.mapId = pt.mapId;
        s.player.x = pt.x;
        s.player.y = pt.y;
        s.player.facing = pt.facing;
        s.pendingTeleport = undefined;
        centerCamera(s);
        s.mode = "fadeIn";
      }
    } else if (s.mode === "fadeIn") {
      s.fade = Math.max(0, s.fade - dt * 2.5);
      if (s.fade <= 0) s.mode = "overworld";
    }
  }

  function doTransition(mapId: string, x: number, y: number, facing: Facing) {
    const s = stateRef.current;
    if (!s) return;
    s.pendingTeleport = { mapId, x, y, facing };
    s.mode = "fadeOut";
  }

  function healAll() {
    const s = stateRef.current;
    if (!s) return;
    s.save.party.forEach((c) => {
      c.currentHp = c.maxHp;
      c.moves.forEach((m) => { m.pp = m.maxPp; });
    });
  }

  // ========== RENDER ==========
  function render(ctx: CanvasRenderingContext2D, s: GameRef) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (s.mode === "battle" && s.battle) {
      renderBattle(ctx, s);
    } else {
      renderOverworld(ctx, s);
    }

    if (s.mode === "menu" && s.menu) {
      renderMenu(ctx, s);
    } else if (s.mode === "dialogue" && s.dialogue) {
      renderDialogueBox(ctx, s.dialogue);
    }

    // Fade overlay
    if (s.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${s.fade})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // Toast
    if (s.toast) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, s.toast.timer * 2)})`;
      ctx.fillRect(CANVAS_W / 2 - 80, 24, 160, 32);
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 2;
      ctx.strokeRect(CANVAS_W / 2 - 80, 24, 160, 32);
      drawText(ctx, s.toast.text, CANVAS_W / 2, 40, "#ffe066", 12, "center");
    }
  }

  function renderOverworld(ctx: CanvasRenderingContext2D, s: GameRef) {
    const map = MAPS[s.save.position.mapId];
    // Player pixel position for smooth movement
    const dx = s.player.facing === "left" ? -1 : s.player.facing === "right" ? 1 : 0;
    const dy = s.player.facing === "up" ? -1 : s.player.facing === "down" ? 1 : 0;
    const playerPxX = (s.player.x + (s.player.isMoving ? dx * s.player.moveProgress : 0)) * TILE_SIZE;
    const playerPxY = (s.player.y + (s.player.isMoving ? dy * s.player.moveProgress : 0)) * TILE_SIZE;

    // Recompute camera (smooth)
    const halfX = Math.floor(VIEW_TILES_X / 2);
    const halfY = Math.floor(VIEW_TILES_Y / 2);
    const mapW = map.tiles[0].length;
    const mapH = map.tiles.length;
    let camX = playerPxX - halfX * TILE_SIZE;
    let camY = playerPxY - halfY * TILE_SIZE;
    camX = Math.max(0, Math.min(mapW * TILE_SIZE - CANVAS_W, camX));
    camY = Math.max(0, Math.min(mapH * TILE_SIZE - CANVAS_H, camY));

    // Draw tiles
    const startTX = Math.floor(camX / TILE_SIZE);
    const startTY = Math.floor(camY / TILE_SIZE);
    for (let ty = startTY; ty <= startTY + VIEW_TILES_Y + 1; ty++) {
      for (let tx = startTX; tx <= startTX + VIEW_TILES_X + 1; tx++) {
        const t = getTile(map, tx, ty);
        if (t === null) {
          // Draw void
          ctx.fillStyle = "#000";
          ctx.fillRect(tx * TILE_SIZE - camX, ty * TILE_SIZE - camY, TILE_SIZE, TILE_SIZE);
          continue;
        }
        const px = tx * TILE_SIZE - camX;
        const py = ty * TILE_SIZE - camY;
        renderTile(ctx, t, px, py);
      }
    }

    // Draw NPCs
    for (const npc of map.npcs) {
      const px = npc.x * TILE_SIZE - camX;
      const py = npc.y * TILE_SIZE - camY;
      if (px < -TILE_SIZE || px > CANVAS_W || py < -TILE_SIZE || py > CANVAS_H) continue;
      drawSprite(ctx, NPC_MENTOR, px, py, PIXEL_SCALE);
    }

    // Draw player
    const px = playerPxX - camX;
    const py = playerPxY - camY;
    let sprite: Sprite;
    let flip = false;
    const useFrameB = s.player.isMoving && s.player.walkFrame === 1;
    if (s.player.facing === "down") sprite = useFrameB ? PLAYER_DOWN_B : PLAYER_DOWN_A;
    else if (s.player.facing === "up") sprite = PLAYER_UP_A;
    else if (s.player.facing === "left") sprite = PLAYER_LEFT_A;
    else { sprite = PLAYER_LEFT_A; flip = true; }
    drawSprite(ctx, sprite, px, py, PIXEL_SCALE, flip);

    // Map name banner (briefly when changed)
    // (simple - always show a small marker)
    drawTextBox(ctx, map.name.toUpperCase(), 8, 8, "#fff", "#000", 11);
  }

  function renderTile(ctx: CanvasRenderingContext2D, t: TileType, px: number, py: number) {
    // Base layer
    if (t === "G" || t === "T" || t === "X" || t === "N" || t === "I" || t === "H") {
      drawSprite(ctx, TILE_GRASS, px, py, PIXEL_SCALE);
    } else if (t === "P" || t === "D") {
      drawSprite(ctx, TILE_PATH, px, py, PIXEL_SCALE);
    } else if (t === "S") {
      drawSprite(ctx, TILE_SAND, px, py, PIXEL_SCALE);
    } else if (t === "W") {
      drawSprite(ctx, TILE_WATER, px, py, PIXEL_SCALE);
    } else if (t === "B") {
      drawSprite(ctx, TILE_BUILDING, px, py, PIXEL_SCALE);
    }
    // Overlay
    if (t === "T") drawSprite(ctx, TILE_TALL_GRASS, px, py, PIXEL_SCALE);
    if (t === "X") drawSprite(ctx, TILE_TREE, px, py, PIXEL_SCALE);
    if (t === "D") drawSprite(ctx, TILE_DOOR, px, py, PIXEL_SCALE);
    if (t === "I") drawSprite(ctx, TILE_SIGN, px, py, PIXEL_SCALE);
    if (t === "H") {
      // glowing pad
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
      ctx.fillStyle = `rgba(255, 100, 200, ${0.3 + pulse * 0.3})`;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = "#ff80c8";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    }
  }

  function renderDialogueBox(ctx: CanvasRenderingContext2D, d: Dialogue) {
    const boxH = 80;
    const y = CANVAS_H - boxH - 8;
    ctx.fillStyle = "rgba(20,20,40,0.95)";
    ctx.fillRect(8, y, CANVAS_W - 16, boxH);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(8, y, CANVAS_W - 16, boxH);
    ctx.strokeStyle = "#5b4a8a";
    ctx.lineWidth = 1;
    ctx.strokeRect(11, y + 3, CANVAS_W - 22, boxH - 6);

    const line = d.lines[d.index];
    const shown = line.substring(0, Math.floor(d.charsShown));
    // word-wrap
    const maxW = CANVAS_W - 32;
    const wrapped = wrapText(ctx, shown, maxW, "16px monospace");
    let ty = y + 22;
    for (const wline of wrapped) {
      drawText(ctx, wline, 20, ty, "#fff", 14, "left");
      ty += 18;
    }
    // Advance indicator
    if (d.charsShown >= line.length) {
      const blink = Math.floor(Date.now() / 400) % 2 === 0;
      if (blink) {
        ctx.fillStyle = "#ffe066";
        ctx.beginPath();
        ctx.moveTo(CANVAS_W - 28, y + boxH - 16);
        ctx.lineTo(CANVAS_W - 18, y + boxH - 16);
        ctx.lineTo(CANVAS_W - 23, y + boxH - 8);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function renderMenu(ctx: CanvasRenderingContext2D, s: GameRef) {
    if (!s.menu) return;
    const m = s.menu;
    if (m.kind === "pause" || m.kind === "starter" || m.kind === "party") {
      // Right side menu
      const w = 180;
      const itemH = 28;
      const h = m.options.length * itemH + 32;
      const x = CANVAS_W - w - 12;
      const y = 12;
      ctx.fillStyle = "rgba(20,20,40,0.95)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);
      const title = m.kind === "pause" ? "MENU" : m.kind === "starter" ? "CHOOSE A PARTNER" : "PARTY";
      drawText(ctx, title, x + w / 2, y + 16, "#ffe066", 12, "center");
      for (let i = 0; i < m.options.length; i++) {
        const oy = y + 28 + i * itemH;
        if (i === m.selected) {
          ctx.fillStyle = "rgba(255,224,102,0.2)";
          ctx.fillRect(x + 6, oy + 2, w - 12, itemH - 4);
          drawText(ctx, ">", x + 12, oy + 18, "#ffe066", 14, "left");
        }
        drawText(ctx, m.options[i], x + 28, oy + 18, "#fff", 13, "left");
      }
      // For starter selection, show preview sprite
      if (m.kind === "starter") {
        const spId = STARTERS[m.selected];
        const sp = SPECIES[spId];
        ctx.fillStyle = "rgba(20,20,40,0.95)";
        ctx.fillRect(12, 12, 200, 200);
        ctx.strokeStyle = sp.color;
        ctx.lineWidth = 3;
        ctx.strokeRect(12, 12, 200, 200);
        drawSprite(ctx, sp.sprite, 50, 30, 3);
        drawText(ctx, sp.name, 112, 152, sp.color, 16, "center");
        drawText(ctx, sp.types.join(" / ").toUpperCase(), 112, 170, "#fff", 11, "center");
        // Wrap description
        const lines = wrapText(ctx, sp.description, 184, "11px monospace");
        let dy = 188;
        for (const ln of lines.slice(0, 2)) {
          drawText(ctx, ln, 112, dy, "#b8b8d4", 11, "center");
          dy += 12;
        }
      }
    }
  }

  function renderBattle(ctx: CanvasRenderingContext2D, s: GameRef) {
    if (!s.battle) return;
    const b = s.battle;
    const c = s.save.party[b.activeIdx];
    const enemySp = SPECIES[b.enemy.speciesId];

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, "#5b8aff");
    grad.addColorStop(0.5, "#a0c8f0");
    grad.addColorStop(0.5, "#d4b87a");
    grad.addColorStop(1, "#9a7a4a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Enemy platform (oval)
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(CANVAS_W - 120, 130, 80, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Player platform
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(120, CANVAS_H - 100, 90, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Enemy sprite
    const enemyShake = b.enemyShake > 0 ? Math.sin(b.enemyShake * 30) * 4 : 0;
    const enemyOffsetX = b.enemyAnimX > 0 ? -b.enemyAnimX * 20 : 0;
    if (b.phase !== "throwBall" && b.phase !== "checkCatch" && !(b.phase === "victory" && b.ballOutcome === "caught")) {
      drawSprite(ctx, enemySp.sprite, CANVAS_W - 200 + enemyShake + enemyOffsetX, 30, 3);
    }
    // Player sprite (back)
    const playerShake = b.playerShake > 0 ? Math.sin(b.playerShake * 30) * 4 : 0;
    const playerOffsetX = b.playerAnimX > 0 ? b.playerAnimX * 20 : 0;
    drawSprite(ctx, PLAYER_BACK, 30 + playerShake + playerOffsetX, CANVAS_H - 200, 3);

    // Ball animation
    if (b.phase === "throwBall" || b.phase === "checkCatch") {
      const t = b.ballAnim;
      // Parabolic arc from player to enemy
      const startX = 80;
      const startY = CANVAS_H - 120;
      const endX = CANVAS_W - 130;
      const endY = 80;
      const bx = startX + (endX - startX) * t;
      const by = startY + (endY - startY) * t - Math.sin(t * Math.PI) * 60;
      drawSprite(ctx, CATCH_BALL, bx - 16, by - 16, 2);
      // After ball reaches enemy, shake
      if (t >= 1 && b.phase === "checkCatch") {
        const shake = Math.sin(Date.now() / 80) * 3;
        drawSprite(ctx, CATCH_BALL, endX - 16 + shake, endY - 16, 2);
      }
    }

    // Enemy HP box (top-left)
    drawBattleHpBox(ctx, 16, 16, enemySp.name, b.enemy.level, b.enemyHpShown, b.enemyMaxHp, false);
    // Player HP box (bottom-right of arena)
    drawBattleHpBox(ctx, CANVAS_W - 240, CANVAS_H - 200, SPECIES[c.speciesId].name, c.level, b.playerHpShown, c.maxHp, true);

    // Message / menu area
    if (s.menu && (s.menu.kind === "battleMain" || s.menu.kind === "battleFight" || s.menu.kind === "battleBag")) {
      renderBattleMenu(ctx, s);
    } else {
      renderBattleMessage(ctx, b);
    }

    // Fade-in
    if (b.fadeIn > 0) {
      ctx.fillStyle = `rgba(0,0,0,${b.fadeIn})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  function drawBattleHpBox(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, level: number, hp: number, maxHp: number, showHpNum: boolean) {
    const w = 224;
    const h = showHpNum ? 64 : 48;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#1a1326";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    drawText(ctx, name.toUpperCase(), x + 8, y + 16, "#1a1326", 13, "left");
    drawText(ctx, `Lv${level}`, x + w - 8, y + 16, "#1a1326", 12, "right");
    // HP bar
    drawText(ctx, "HP", x + 8, y + 34, "#d62828", 10, "left");
    const barX = x + 32;
    const barY = y + 26;
    const barW = w - 40;
    ctx.fillStyle = "#1a1326";
    ctx.fillRect(barX, barY, barW, 10);
    const ratio = Math.max(0, hp / maxHp);
    const color = ratio > 0.5 ? "#3aa838" : ratio > 0.2 ? "#ffd040" : "#d62828";
    ctx.fillStyle = color;
    ctx.fillRect(barX + 1, barY + 1, (barW - 2) * ratio, 8);
    if (showHpNum) {
      drawText(ctx, `${Math.ceil(hp)}/${maxHp}`, x + w - 8, y + 52, "#1a1326", 12, "right");
    }
  }

  function renderBattleMessage(ctx: CanvasRenderingContext2D, b: BattleState) {
    const boxY = CANVAS_H - 88;
    ctx.fillStyle = "rgba(20,20,40,0.95)";
    ctx.fillRect(8, boxY, CANVAS_W - 16, 80);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(8, boxY, CANVAS_W - 16, 80);
    const shown = b.message.substring(0, Math.floor(b.messageProgress));
    const lines = wrapText(ctx, shown, CANVAS_W - 32, "14px monospace");
    let ty = boxY + 24;
    for (const ln of lines) {
      drawText(ctx, ln, 20, ty, "#fff", 13, "left");
      ty += 18;
    }
  }

  function renderBattleMenu(ctx: CanvasRenderingContext2D, s: GameRef) {
    if (!s.menu || !s.battle) return;
    const m = s.menu;
    const boxY = CANVAS_H - 88;
    ctx.fillStyle = "rgba(20,20,40,0.95)";
    ctx.fillRect(8, boxY, CANVAS_W - 16, 80);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(8, boxY, CANVAS_W - 16, 80);

    if (m.kind === "battleMain") {
      // 2x2 grid
      const labels = m.options;
      for (let i = 0; i < labels.length; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 24 + col * 220;
        const y = boxY + 16 + row * 32;
        if (i === m.selected) {
          ctx.fillStyle = "rgba(255,224,102,0.2)";
          ctx.fillRect(x - 6, y - 14, 200, 26);
          drawText(ctx, ">", x - 6, y + 2, "#ffe066", 14, "left");
        }
        drawText(ctx, labels[i], x + 16, y + 2, "#fff", 14, "left");
      }
    } else if (m.kind === "battleFight") {
      const c = s.save.party[s.battle.activeIdx];
      for (let i = 0; i < m.options.length; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 24 + col * 220;
        const y = boxY + 16 + row * 32;
        if (i === m.selected) {
          ctx.fillStyle = "rgba(255,224,102,0.2)";
          ctx.fillRect(x - 6, y - 14, 200, 26);
          drawText(ctx, ">", x - 6, y + 2, "#ffe066", 14, "left");
        }
        drawText(ctx, m.options[i], x + 16, y + 2, "#fff", 14, "left");
      }
      // PP / type indicator on right
      const sel = c.moves[m.selected];
      if (sel) {
        const mv = MOVES[sel.moveId];
        ctx.fillStyle = TYPE_COLORS[mv.type];
        ctx.fillRect(CANVAS_W - 100, boxY - 28, 92, 24);
        ctx.strokeStyle = "#1a1326";
        ctx.lineWidth = 2;
        ctx.strokeRect(CANVAS_W - 100, boxY - 28, 92, 24);
        drawText(ctx, mv.type.toUpperCase(), CANVAS_W - 54, boxY - 12, "#1a1326", 11, "center");
        drawText(ctx, `PP ${sel.pp}/${sel.maxPp}`, CANVAS_W - 8, boxY - 38, "#fff", 12, "right");
      }
    } else if (m.kind === "battleBag") {
      for (let i = 0; i < m.options.length; i++) {
        const x = 24;
        const y = boxY + 16 + i * 22;
        if (i === m.selected) {
          ctx.fillStyle = "rgba(255,224,102,0.2)";
          ctx.fillRect(x - 6, y - 14, CANVAS_W - 48, 22);
          drawText(ctx, ">", x - 6, y + 2, "#ffe066", 14, "left");
        }
        drawText(ctx, m.options[i], x + 16, y + 2, "#fff", 13, "left");
      }
    }
  }

  function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number = 12, align: "left" | "center" | "right" = "left") {
    ctx.font = `bold ${size}px "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    // Text shadow
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawTextBox(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fg: string, bg: string, size: number = 12) {
    ctx.font = `bold ${size}px "Courier New", monospace`;
    const w = ctx.measureText(text).width + 16;
    const h = size + 10;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    drawText(ctx, text, x + 8, y + size + 2, fg, size, "left");
  }

  function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): string[] {
    ctx.font = font;
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const test = current ? current + " " + w : w;
      if (ctx.measureText(test).width > maxWidth) {
        if (current) lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  return (
    <div className="game-wrapper">
      <div className="game-toolbar">
        <span className="toolbar-btn" style={{ cursor: "default" }}>
          {displayName}{isGuest(username) ? " (Guest)" : ""}
        </span>
        <button className="toolbar-btn" onClick={() => doSave(true)}>
          {savedFlash ? "✓ Saved" : "Save"}
        </button>
        <button className="toolbar-btn" onClick={onLogout}>Logout</button>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="game-canvas"
        style={{ width: "min(96vw, 960px)", height: "auto" }}
      />
      <div className="hint">{hint}</div>
    </div>
  );
}
