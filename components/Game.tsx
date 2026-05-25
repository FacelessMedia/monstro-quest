"use client";

import { useEffect, useRef, useState } from "react";
import {
  GameSave,
  loadGame,
  newSave,
  saveGame,
  isGuest,
  getBagCount,
  addToBag,
  removeFromBag,
} from "../lib/save";
import { ITEMS, ItemId } from "../lib/items";
import { play, resumeAudio } from "../lib/audio";
import {
  Creature,
  SPECIES,
  MOVES,
  createWild,
  damageCalc,
  gainExp,
  tryCatch,
  expYield,
  effectiveness,
  TYPE_COLORS,
  StatusCondition,
  StatKey,
  applyStatStage,
  applyStatus,
  applyEndOfTurnStatus,
  canAct,
  clearVolatile,
  fullyHeal,
  evolveCheck,
  chooseBestMove,
  effectiveStat,
  type Move,
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
  findFieldItem,
  trainerLineOfSight,
  BLOCKED_TILES,
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
  TILE_WATER_B,
  TILE_SAND,
  TILE_PATH,
  TILE_BUILDING,
  TILE_DOOR,
  TILE_SIGN,
  TILE_CUT_TREE,
  TILE_FIELD_ITEM,
  TILE_LAVA,
  TILE_LAVA_B,
  TILE_SNOW,
  NPC_MENTOR,
  NPC_CLERK,
  NPC_TRAINER,
  NPC_PICNICKER,
  NPC_FISHER,
  NPC_GYM_LEADER,
  EXCLAIM,
  ICON_STONE_BADGE,
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

type MenuKind =
  | "pause"
  | "starter"
  | "party"
  | "battleMain"
  | "battleFight"
  | "battleBag"
  | "battleNew"
  | "battleSwitch"
  | "shop"
  | "shopQty"
  | "worldmap"
  | "bag"
  | "dex"
  | "dex_detail"
  | "pc"
  | "moveLearn"   // prompt to forget which move when learning a 5th
  | "yesno"       // generic confirm/cancel prompt (used for Cut, Escape Rope, etc)
  | "partyTarget"; // pick a party member to use a status/PP item on

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
  | "endTurnTick" // poison/burn residual damage messages between turns
  | "throwBall"
  | "checkCatch"
  | "brokeFree" // capsule broke, enemy will attack next
  | "switchIn" // showing "X fainted! Go Y!" before menu reopens
  | "evolution" // animated evolve sequence
  | "trainerSwitch" // trainer sends out their next Monstro
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
  lastCapsule?: ItemId; // which capsule was last thrown — affects catch math
  /** When set, after enemy attack we run this player move (turn-order: enemy went first). */
  pendingPlayerMoveIdx?: number;
  /** True if the enemy already attacked this turn (enemy-first ordering). Prevents a double attack. */
  enemyActedThisTurn?: boolean;
  /** Brief screen flash on critical hits (alpha 0..1). */
  critFlash: number;
  // === Trainer battle support ===
  trainerBattle?: {
    name: string;
    party: Creature[];        // their roster
    activeIdx: number;        // index of the one currently out
    defeatedIdx: number[];    // indexes already KO'd
    intro: string[];
    victory: string[];
    prize: number;            // coin prize on full defeat
    gymLeader?: boolean;      // smart AI + heal logic
    potionCharges?: number;   // remaining boss-potions
    rewardItem?: ItemId;      // bonus item granted on defeat (e.g. stone_badge)
  };
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
  | "transition"
  | "trainerSpot"; // LOS "!" exclamation pause before forced battle

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
  /** When a trainer's line-of-sight catches the player, this holds the NPC + timer until battle starts. */
  trainerSpot?: { npc: NpcDef; timer: number };
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
  const [coins, setCoins] = useState(0);
  const [lastSavedLabel, setLastSavedLabel] = useState<string>("");
  const [hasBadge, setHasBadge] = useState(false);
  const [hasFlame, setHasFlame] = useState(false);
  const [hasFrost, setHasFrost] = useState(false);

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
    setCoins(initial.save.money);
    if (initial.save.lastSavedAt) setLastSavedLabel(formatSavedTime(initial.save.lastSavedAt));
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
      // Unlock the Web Audio context on the first user gesture (Chrome policy).
      resumeAudio();
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
    let lastHintKey = "";

    function loop(t: number) {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      const s = stateRef.current;
      if (s && ctx) {
        update(s, dt);
        render(ctx, s);
        // Throttle hint updates: only re-render React when context changes
        const key = `${s.mode}|${s.menu?.kind ?? ""}|${s.battle?.phase ?? ""}`;
        if (key !== lastHintKey) {
          lastHintKey = key;
          const newHint = currentHint(s);
          setHint((prev) => (prev === newHint ? prev : newHint));
        }
        // Update coin counter only when it actually changes
        setCoins((prev) => (prev === s.save.money ? prev : s.save.money));
        // Toolbar badge indicators
        const stone = !!s.save.flags["gymBrakDefeated"];
        const flame = !!s.save.flags["gymMagmaDefeated"];
        const frost = !!s.save.flags["gymYukiDefeated"];
        setHasBadge((prev) => (prev === stone ? prev : stone));
        setHasFlame((prev) => (prev === flame ? prev : flame));
        setHasFrost((prev) => (prev === frost ? prev : frost));
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

  /** Save-aware tile lookup: cleared cut trees become path; picked-up field items become grass. */
  function effectiveTile(map: GameMap, x: number, y: number): TileType | null {
    const t = getTile(map, x, y);
    if (!t) return t;
    const s = stateRef.current;
    if (!s) return t;
    if (t === "C" && s.save.flags[`cut:${map.id}:${x}:${y}`]) return "P";
    if (t === "F") {
      const fi = findFieldItem(map, x, y);
      if (fi && s.save.flags[fi.flag]) return "G";
    }
    return t;
  }

  /** Save-aware blocked-tile check. Defeated trainers step aside (their tile becomes walkable). */
  function isBlockedNow(map: GameMap, x: number, y: number): boolean {
    const t = effectiveTile(map, x, y);
    if (t === null) return true;
    if (BLOCKED_TILES.has(t)) return true;
    const npc = map.npcs.find((n) => n.x === x && n.y === y);
    if (npc) {
      const s = stateRef.current;
      if (s && npc.trainer && s.save.flags[npc.trainer.flag]) {
        return false; // defeated trainer — walk through
      }
      return true;
    }
    return false;
  }

  /** Scan all undefeated trainers on the current map; if any has the player in LOS, trigger the spot animation. */
  function checkTrainerLOS() {
    const s = stateRef.current;
    if (!s) return;
    const map = MAPS[s.save.position.mapId];
    for (const npc of map.npcs) {
      if (!npc.trainer) continue;
      if (s.save.flags[npc.trainer.flag]) continue;
      if (!npc.trainer.visionRange || npc.trainer.visionRange <= 0) continue;
      const los = trainerLineOfSight(npc);
      if (los.some((t) => t.x === s.player.x && t.y === s.player.y)) {
        s.mode = "trainerSpot";
        s.trainerSpot = { npc, timer: 0.9 };
        return;
      }
    }
  }

  /** Pickup a field item if the player just stepped onto one and it hasn't been picked up. */
  function tryPickupFieldItem() {
    const s = stateRef.current;
    if (!s) return;
    const map = MAPS[s.save.position.mapId];
    const fi = findFieldItem(map, s.player.x, s.player.y);
    if (!fi) return;
    if (s.save.flags[fi.flag]) return;
    s.save.flags[fi.flag] = true;
    addToBag(s.save.bag, fi.itemId, fi.qty);
    const it = ITEMS[fi.itemId];
    s.toast = { text: `Found ${it.name}!`, timer: 1.5 };
    startDialogue([`You found a ${it.name} on the ground!`, `(Added to BAG.)`]);
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
    setLastSavedLabel(formatSavedTime(s.save.lastSavedAt));
    setTimeout(() => setSavedFlash(false), 1500);
    if (showToast) {
      s.toast = { text: "Game Saved!", timer: 1.5 };
    }
  }

  function formatSavedTime(t: number): string {
    try {
      const d = new Date(t);
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      return `${hh}:${mm}`;
    } catch {
      return "";
    }
  }

  function tryMove(dir: Facing) {
    const s = stateRef.current;
    if (!s || s.player.isMoving) return;
    s.player.facing = dir;
    const map = MAPS[s.save.position.mapId];
    const tx = s.player.x + (dir === "left" ? -1 : dir === "right" ? 1 : 0);
    const ty = s.player.y + (dir === "up" ? -1 : dir === "down" ? 1 : 0);
    if (isBlockedNow(map, tx, ty)) return;
    s.player.isMoving = true;
    s.player.moveProgress = 0;
  }

  /** Shared press/release plumbing used by keyboard events AND touch controls. */
  function pressKey(key: string) {
    const s = stateRef.current;
    if (!s) return;
    resumeAudio(); // chrome autoplay unlock on any user gesture
    if (s.pressed.has(key)) return;
    s.pressed.add(key);
    handleKeyDown(key);
  }

  function releaseKey(key: string) {
    const s = stateRef.current;
    if (!s) return;
    s.pressed.delete(key);
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
    // Cuttable tree — uses the Cut Stone key item, then clears the tile permanently.
    const faced = getTile(map, tx, ty);
    if (faced === "C" && !s.save.flags[`cut:${map.id}:${tx}:${ty}`]) {
      const hasStone = s.save.flags["gotCutStone"] || getBagCount(s.save.bag, "cut_stone") > 0;
      if (!hasStone) {
        startDialogue(["A strange pink-leafed tree...", "It might fall to a special stone."]);
        return;
      }
      // Yes/No confirmation
      startMenu({
        kind: "yesno",
        options: ["Yes", "No"],
        selected: 0,
        data: { prompt: ["Use the Cut Stone on this tree?"], action: "cutTree", args: { x: tx, y: ty } },
      });
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
    // === Trainer battle ===
    if (npc.trainer) {
      const t = npc.trainer;
      if (s.save.flags[t.flag]) {
        // Already defeated — show alternative banter
        startDialogue(npc.altDialogue ?? ["Great battle earlier!"]);
        return;
      }
      // Need at least one usable Monstro to be challenged
      if (s.save.party.length === 0 || !s.save.party.some((c) => c.currentHp > 0)) {
        startDialogue(["You need a Monstro first!"]);
        return;
      }
      // Show intro, then launch trainer battle.
      startDialogue(t.intro, () => {
        startTrainerBattle(t);
      });
      return;
    }
    if (npc.requiresFlag && !s.save.flags[npc.requiresFlag]) {
      startDialogue(npc.dialogue);
      return;
    }
    // === One-time item giver (e.g. Cut Tutor) ===
    if (npc.givesItem) {
      const gift = npc.givesItem;
      if (s.save.flags[gift.flag]) {
        startDialogue(npc.altDialogue ?? npc.dialogue);
        return;
      }
      startDialogue(npc.dialogue, () => {
        const s2 = stateRef.current;
        if (!s2) return;
        s2.save.flags[gift.flag] = true;
        addToBag(s2.save.bag, gift.itemId, gift.qty);
        play("confirm");
        startDialogue([`Received ${ITEMS[gift.itemId].name} x${gift.qty}!`]);
      });
      return;
    }
    if (npc.shop) {
      // Show greeting then open shop
      const shopItems = npc.shop;
      const useAlt = npc.altDialogue && npc.flagAfter && s.save.flags[npc.flagAfter];
      startDialogue(useAlt ? npc.altDialogue! : npc.dialogue, () => {
        const s2 = stateRef.current;
        if (!s2) return;
        if (npc.flagAfter) s2.save.flags[npc.flagAfter] = true;
        s2.menu = {
          kind: "shop",
          options: buildShopOptions(shopItems),
          selected: 0,
          data: { itemIds: shopItems },
        };
        s2.mode = "menu";
      });
      return;
    }
    if (npc.pc) {
      // Greeting → open PC storage
      startDialogue(npc.dialogue, () => {
        openPcStorage();
      });
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
    const opts = ["PARTY", "MONSTRODEX", "BAG", "MAP", "SAVE", "QUIT"];
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
    // Audio: small blip on nav, confirm on accept
    if (key === "up" || key === "down" || key === "left" || key === "right") play("cursor");
    if (key === "confirm") play("confirm");
    if (key === "cancel" || key === "menu") play("cancel");
    // Quantity selector uses ← / → and ↑ / ↓ to adjust qty
    if (m.kind === "shopQty") {
      const max = Math.max(1, m.data?.max ?? 1);
      if (key === "left" || key === "down") {
        m.selected = Math.max(1, m.selected - 1);
      } else if (key === "right" || key === "up") {
        m.selected = Math.min(max, m.selected + 1);
      } else if (key === "confirm") {
        handleMenuConfirm();
      } else if (key === "cancel" || key === "menu") {
        // Back to shop list
        const shopList = (m.data?.shopList as ItemId[]) || [];
        const returnSelected = (m.data?.returnSelected as number) ?? 0;
        s.menu = { kind: "shop", options: buildShopOptions(shopList), selected: returnSelected, data: { itemIds: shopList } };
      }
      return;
    }
    // Dex detail: ↑/↓ cycles species and updates the sprite
    if (m.kind === "dex_detail") {
      const ids = (m.data?.speciesIds as string[]) || [];
      if (key === "up") {
        m.selected = (m.selected - 1 + ids.length) % ids.length;
        return;
      } else if (key === "down") {
        m.selected = (m.selected + 1) % ids.length;
        return;
      }
    }
    // Yes/No: left/right toggles between Yes (0) and No (1)
    if (m.kind === "yesno") {
      if (key === "left" || key === "up") { m.selected = 0; return; }
      if (key === "right" || key === "down") { m.selected = 1; return; }
      if (key === "confirm") { handleMenuConfirm(); return; }
      if (key === "cancel" || key === "menu") { handleMenuCancel(); return; }
      return;
    }
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
    const k = s.menu.kind;
    if (k === "pause" || k === "party" || k === "worldmap" || k === "bag" || k === "pc" || k === "dex") {
      closeMenu();
    } else if (k === "dex_detail") {
      // Go back to the dex list
      const parent = s.menu.data?.parent as Menu | undefined;
      s.menu = parent ?? undefined;
      if (!parent) closeMenu();
    } else if (k === "shop") {
      // Exit shop with goodbye
      s.menu = undefined;
      startDialogue(["Thank you, come again!"]);
    } else if (k === "battleFight" || k === "battleBag" || k === "battleSwitch") {
      if (s.battle) {
        s.battle.phase = "menu";
        s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
      }
    } else if (k === "yesno" || k === "partyTarget" || k === "moveLearn") {
      // For yes/no, cancel = "no"; for the others, cancel just closes.
      closeMenu();
    }
  }

  /**
   * Open the PC storage interface, accessible at the Lumencove healing center.
   * Lists every party member then every storage member as a single menu so the
   * player can swap them with SPACE.
   */
  function openPcStorage() {
    const s = stateRef.current;
    if (!s) return;
    rebuildPcMenu(0);
  }

  function rebuildPcMenu(selected: number) {
    const s = stateRef.current;
    if (!s) return;
    const partySlots = s.save.party.map((c) =>
      `[P] ${SPECIES[c.speciesId].name} Lv${c.level} HP ${c.currentHp}/${c.maxHp}`
    );
    const storageSlots = s.save.storage.map((c) =>
      `[B] ${SPECIES[c.speciesId].name} Lv${c.level} HP ${c.currentHp}/${c.maxHp}`
    );
    const options = [...partySlots, "─── BOX ───", ...storageSlots, "Close PC"];
    s.menu = {
      kind: "pc",
      options,
      selected: Math.min(selected, Math.max(0, options.length - 1)),
      data: { partyCount: s.save.party.length, storageCount: s.save.storage.length },
    };
    s.mode = "menu";
  }

  /**
   * Selecting a row in the PC moves that Monstro between Party and Box.
   * The separator row and "Close PC" row are handled gracefully.
   */
  function handlePcConfirm(selected: number) {
    const s = stateRef.current;
    if (!s || !s.menu) return;
    const partyCount = s.save.party.length;
    const storageCount = s.save.storage.length;
    const separatorIdx = partyCount;
    const storageStart = partyCount + 1;
    const closeIdx = partyCount + 1 + storageCount;
    if (selected === closeIdx) { closeMenu(); return; }
    if (selected === separatorIdx) return; // ignore divider
    if (selected < partyCount) {
      // Party row → move to storage. Don't allow if it's the last alive Monstro.
      if (partyCount === 1) {
        startDialogue(["You can't put your last Monstro in the PC!"]);
        return;
      }
      const [moved] = s.save.party.splice(selected, 1);
      s.save.storage.push(moved);
      rebuildPcMenu(selected);
      return;
    }
    if (selected >= storageStart) {
      const storageIdx = selected - storageStart;
      if (s.save.party.length >= 6) {
        startDialogue(["Your party is full!"]);
        return;
      }
      const [moved] = s.save.storage.splice(storageIdx, 1);
      s.save.party.push(moved);
      rebuildPcMenu(s.save.party.length - 1);
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
          s.menu = undefined;
          startDialogue(["You have no Monstro yet."]);
        } else {
          startMenu({ kind: "party", options: s.save.party.map((c) => `${SPECIES[c.speciesId].name} Lv${c.level}`), selected: 0 });
        }
      } else if (choice === "BAG") {
        // Show full bag list with descriptions
        const owned: ItemId[] = (Object.keys(ITEMS) as ItemId[]).filter((id) => getBagCount(s.save.bag, id) > 0);
        if (owned.length === 0) {
          s.menu = undefined;
          startDialogue([
            "Your bag is empty.",
            `You have ${s.save.money} coins. Try the Mart!`,
          ]);
        } else {
          const labels = owned.map((id) => `${ITEMS[id].name} x${getBagCount(s.save.bag, id)}`);
          startMenu({ kind: "bag", options: [...labels, "Close"], selected: 0, data: { itemIds: owned } });
        }
      } else if (choice === "MAP") {
        // World map overlay
        const mapIds = Object.keys(MAPS);
        startMenu({ kind: "worldmap", options: mapIds, selected: mapIds.indexOf(s.save.position.mapId), data: { mapIds } });
      } else if (choice === "MONSTRODEX") {
        // Open paged Monstrodex listing every species the player has seen
        const allIds = Object.keys(SPECIES);
        // Show all species but mark unseen as "?" — classic dex experience
        const labels = allIds.map((id) => {
          const seen = s.save.monstroSeen.includes(id);
          const caught = s.save.monstroCaught.includes(id);
          const sp = SPECIES[id];
          const dot = caught ? "● " : seen ? "○ " : "  ";
          return `${dot}${seen ? sp.name : "???????"}`;
        });
        startMenu({ kind: "dex", options: labels, selected: 0, data: { speciesIds: allIds } });
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
      s.menu = undefined;
      startDialogue(lines);
    } else if (m.kind === "battleMain") {
      const choice = m.options[m.selected];
      if (choice === "FIGHT") openFightMenu();
      else if (choice === "BAG") openBattleBag();
      else if (choice === "PARTY") openBattleSwitchMenu();
      else if (choice === "RUN") {
        if (s.battle?.trainerBattle) {
          // Cannot flee a trainer battle
          startDialogue(["No! There's no running from a trainer battle!"]);
          s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
        } else {
          runFromBattle();
        }
      }
    } else if (m.kind === "battleSwitch") {
      handleBattleSwitchConfirm(m.selected);
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
      const itemIds = (m.data?.itemIds as ItemId[]) || [];
      const itemId = itemIds[m.selected];
      // Last entry is always "Cancel"
      if (!itemId) {
        s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
        return;
      }
      useItemInBattle(itemId);
    } else if (m.kind === "bag") {
      // Out-of-battle bag screen: items + Close
      const itemIds = (m.data?.itemIds as ItemId[]) || [];
      const itemId = itemIds[m.selected];
      if (!itemId) {
        closeMenu();
        return;
      }
      const it = ITEMS[itemId];
      const qty = getBagCount(s.save.bag, itemId);
      // Repel
      if (it.category === "field" && itemId === "repel") {
        if (qty <= 0) { startDialogue([`You have no ${it.name} left.`]); s.menu = undefined; return; }
        removeFromBag(s.save.bag, itemId, 1);
        s.save.repelSteps = (s.save.repelSteps ?? 0) + 100;
        s.menu = undefined;
        startDialogue([
          `Used Repel!`,
          `Weak wild Monstro will stay away for the next 100 steps.`,
        ]);
        return;
      }
      // Escape Rope — confirm before warping
      if (it.category === "field" && itemId === "escape_rope") {
        if (qty <= 0) { startDialogue([`No Escape Rope left.`]); s.menu = undefined; return; }
        startMenu({
          kind: "yesno",
          options: ["Yes", "No"],
          selected: 0,
          data: { prompt: ["Use the Escape Rope?"], action: "escapeRope" },
        });
        return;
      }
      // Heal / Status-cure / PP / Revive — open a "choose a Monstro" prompt
      if (it.category === "heal" || it.category === "status" || it.category === "pp" || it.category === "revive") {
        if (s.save.party.length === 0) { startDialogue([`You have no Monstro to use this on.`]); s.menu = undefined; return; }
        openPartyTarget(itemId);
        return;
      }
      // Capture items / key items: just show description
      s.menu = undefined;
      startDialogue([
        `${it.name} (x${qty})`,
        it.description,
      ]);
    } else if (m.kind === "dex") {
      // Selecting a species opens its detail page (only if seen at least once)
      const ids = (m.data?.speciesIds as string[]) || [];
      const id = ids[m.selected];
      if (!id) { closeMenu(); return; }
      if (!s.save.monstroSeen.includes(id)) {
        startDialogue([`You haven't encountered that Monstro yet.`]);
        return;
      }
      s.menu = { kind: "dex_detail", options: ids, selected: m.selected, data: { speciesIds: ids, parent: m } };
    } else if (m.kind === "dex_detail") {
      // Pressing SPACE on the detail page goes back to the dex list
      const ids = (m.data?.speciesIds as string[]) || [];
      const parent = m.data?.parent as Menu | undefined;
      if (parent) {
        s.menu = parent;
      } else {
        // Fallback to closing
        closeMenu();
      }
      void ids;
    } else if (m.kind === "pc") {
      // Toggle a creature between party and storage
      handlePcConfirm(m.selected);
    } else if (m.kind === "shop") {
      // First option is always "Leave"
      const itemIds = (m.data?.itemIds as ItemId[]) || [];
      if (m.selected >= itemIds.length) {
        s.menu = undefined;
        startDialogue(["Thank you, come again!"]);
        return;
      }
      const itemId = itemIds[m.selected];
      const it = ITEMS[itemId];
      // Open qty selector
      s.menu = {
        kind: "shopQty",
        options: [],
        selected: 1,
        data: { itemId, shopList: itemIds, returnSelected: m.selected, max: Math.min(99, Math.floor(s.save.money / it.price)) },
      };
    } else if (m.kind === "shopQty") {
      const itemId = m.data?.itemId as ItemId | undefined;
      const shopList = (m.data?.shopList as ItemId[]) || [];
      const returnSelected = (m.data?.returnSelected as number) ?? 0;
      const qty = Math.max(1, m.selected);
      if (!itemId) {
        s.menu = { kind: "shop", options: buildShopOptions(shopList), selected: returnSelected, data: { itemIds: shopList } };
        return;
      }
      const it = ITEMS[itemId];
      const total = it.price * qty;
      if (s.save.money < total) {
        s.menu = undefined;
        startDialogue(["You don't have enough coins for that."], () => {
          // Go back to the shop list
          const s2 = stateRef.current;
          if (!s2) return;
          s2.menu = { kind: "shop", options: buildShopOptions(shopList), selected: returnSelected, data: { itemIds: shopList } };
          s2.mode = "menu";
        });
        return;
      }
      s.save.money -= total;
      addToBag(s.save.bag, itemId, qty);
      // Return to shop with confirmation dialogue
      s.menu = undefined;
      startDialogue([
        `Purchased ${it.name} x${qty} for ${total} coins.`,
        `Anything else?`,
      ], () => {
        const s2 = stateRef.current;
        if (!s2) return;
        s2.menu = { kind: "shop", options: buildShopOptions(shopList), selected: returnSelected, data: { itemIds: shopList } };
        s2.mode = "menu";
      });
    } else if (m.kind === "yesno") {
      // 0 = Yes, 1 = No
      const yes = m.selected === 0;
      const action = m.data?.action as string | undefined;
      const args = m.data?.args ?? {};
      s.menu = undefined;
      if (!yes) {
        s.mode = "overworld";
        return;
      }
      if (action === "cutTree") {
        const map = MAPS[s.save.position.mapId];
        s.save.flags[`cut:${map.id}:${args.x}:${args.y}`] = true;
        play("hit");
        startDialogue([`The tree fell away with a soft chime!`]);
      } else if (action === "escapeRope") {
        // Teleport to Lumencove healing pad (the only safe haven so far)
        removeFromBag(s.save.bag, "escape_rope", 1);
        s.save.position = { mapId: "lumencove", x: 13, y: 4, facing: "down" };
        s.player.x = 13;
        s.player.y = 4;
        s.player.facing = "down";
        centerCamera(s);
        startDialogue(["The Escape Rope whisked you back to Lumencove!"]);
      }
    } else if (m.kind === "moveLearn") {
      // Choosing which existing move slot to forget. Last option is "Don't learn".
      const target = m.data?.target as Creature | undefined;
      const newMoveId = m.data?.newMoveId as string | undefined;
      const queue = (m.data?.queue as string[]) || [];
      if (!target || !newMoveId) { closeMenu(); return; }
      if (m.selected >= 4) {
        // Don't learn this move; consume from queue and ask about the next
        progressMoveLearnQueue(target, queue);
        return;
      }
      const forgotName = MOVES[target.moves[m.selected].moveId].name;
      const mv = MOVES[newMoveId];
      target.moves[m.selected] = { moveId: newMoveId, pp: mv.pp, maxPp: mv.pp };
      s.menu = undefined;
      startDialogue([
        `1, 2, and... POOF!`,
        `${SPECIES[target.speciesId].name} forgot ${forgotName}!`,
        `${SPECIES[target.speciesId].name} learned ${mv.name}!`,
      ], () => progressMoveLearnQueue(target, queue));
    } else if (m.kind === "partyTarget") {
      const itemId = m.data?.itemId as ItemId | undefined;
      if (!itemId) { closeMenu(); return; }
      applyItemToPartyMember(itemId, m.selected);
    }
  }

  /** Apply a status / pp / heal item to the chosen party member, then close. */
  function applyItemToPartyMember(itemId: ItemId, partyIdx: number) {
    const s = stateRef.current;
    if (!s) return;
    const c = s.save.party[partyIdx];
    if (!c) { closeMenu(); return; }
    const it = ITEMS[itemId];
    if (it.curesStatus) {
      const need = it.curesStatus;
      if (c.status === "ok" || c.status === "fainted") {
        startDialogue([`${SPECIES[c.speciesId].name} doesn't need that.`]);
        s.menu = undefined;
        return;
      }
      if (need !== "any" && c.status !== need) {
        startDialogue([`That doesn't work on ${SPECIES[c.speciesId].name}'s current condition.`]);
        s.menu = undefined;
        return;
      }
      c.status = "ok";
      c.sleepTurns = 0;
      removeFromBag(s.save.bag, itemId, 1);
      play("heal");
      s.menu = undefined;
      startDialogue([`Used ${it.name} on ${SPECIES[c.speciesId].name}.`, `Cured!`]);
      return;
    }
    if (it.ppRestore) {
      let restored = 0;
      for (const slot of c.moves) {
        const before = slot.pp;
        slot.pp = Math.min(slot.maxPp, slot.pp + it.ppRestore);
        restored += slot.pp - before;
      }
      removeFromBag(s.save.bag, itemId, 1);
      play("heal");
      s.menu = undefined;
      startDialogue([`Used ${it.name} on ${SPECIES[c.speciesId].name}.`, `Restored ${restored} PP across moves.`]);
      return;
    }
    if (it.healAmount) {
      if (c.currentHp >= c.maxHp) {
        startDialogue([`${SPECIES[c.speciesId].name} is at full HP.`]);
        s.menu = undefined;
        return;
      }
      const before = c.currentHp;
      c.currentHp = Math.min(c.maxHp, c.currentHp + it.healAmount);
      removeFromBag(s.save.bag, itemId, 1);
      play("heal");
      s.menu = undefined;
      startDialogue([`Used ${it.name} on ${SPECIES[c.speciesId].name}.`, `Restored ${c.currentHp - before} HP.`]);
      return;
    }
    if (it.reviveFactor) {
      if (c.currentHp > 0) {
        startDialogue([`${SPECIES[c.speciesId].name} doesn't need a Revive.`]);
        s.menu = undefined;
        return;
      }
      c.currentHp = Math.max(1, Math.floor(c.maxHp * it.reviveFactor));
      c.status = "ok";
      removeFromBag(s.save.bag, itemId, 1);
      play("heal");
      s.menu = undefined;
      startDialogue([`Revived ${SPECIES[c.speciesId].name}!`]);
      return;
    }
    s.menu = undefined;
  }

  /** Open a "choose a Monstro" menu to apply a status / pp / heal item out of battle. */
  function openPartyTarget(itemId: ItemId) {
    const s = stateRef.current;
    if (!s) return;
    const labels = s.save.party.map((c) => {
      const sp = SPECIES[c.speciesId];
      const stat = c.status && c.status !== "ok" && c.status !== "fainted" ? ` [${c.status.toUpperCase()}]` : "";
      return `${sp.name} Lv${c.level} HP ${c.currentHp}/${c.maxHp}${stat}`;
    });
    startMenu({ kind: "partyTarget", options: [...labels, "Cancel"], selected: 0, data: { itemId } });
  }

  /** Walk the pendingLearns queue: open a forget-prompt for the next move, or close. */
  function progressMoveLearnQueue(target: Creature, queue: string[]) {
    const s = stateRef.current;
    if (!s) return;
    if (queue.length === 0) {
      s.menu = undefined;
      s.mode = "overworld";
      return;
    }
    const [next, ...rest] = queue;
    const mv = MOVES[next];
    s.menu = {
      kind: "moveLearn",
      options: [
        ...target.moves.map((m) => MOVES[m.moveId].name),
        `Don't learn ${mv.name}`,
      ],
      selected: 0,
      data: { target, newMoveId: next, queue: rest },
    };
    s.mode = "menu";
    startDialogue([
      `${SPECIES[target.speciesId].name} wants to learn ${mv.name}!`,
      `But it already knows 4 moves...`,
      `Which one should be forgotten?`,
    ], () => {
      const s2 = stateRef.current;
      if (!s2) return;
      // After dialogue, ensure menu is still set; if cleared, restore.
      if (!s2.menu) s2.menu = {
        kind: "moveLearn",
        options: [...target.moves.map((m) => MOVES[m.moveId].name), `Don't learn ${mv.name}`],
        selected: 0,
        data: { target, newMoveId: next, queue: rest },
      };
      s2.mode = "menu";
    });
  }

  // Build the labelled option list for a shop, including the trailing "Leave".
  function buildShopOptions(items: ItemId[]): string[] {
    return [...items.map((id) => `${ITEMS[id].name} — ${ITEMS[id].price}c`), "Leave"];
  }

  // Use an item from the battle bag.
  function useItemInBattle(itemId: ItemId) {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const have = getBagCount(s.save.bag, itemId);
    const it = ITEMS[itemId];
    if (have <= 0) {
      battleMessage(`No ${it.name} left!`, "bagMenu");
      return;
    }
    if (it.category === "capture") {
      s.menu = undefined;
      throwCapsule(itemId);
      return;
    }
    if (it.category === "heal") {
      const c = s.save.party[s.battle.activeIdx];
      if (c.currentHp >= c.maxHp) {
        battleMessage("HP is already full!", "bagMenu");
        return;
      }
      removeFromBag(s.save.bag, itemId, 1);
      const heal = it.healAmount ?? 30;
      c.currentHp = Math.min(c.maxHp, c.currentHp + heal);
      s.menu = undefined;
      battleMessage(`${SPECIES[c.speciesId].name} recovered ${heal} HP!`, "enemyAttack");
      return;
    }
    if (it.category === "revive") {
      // Revives are not usable in single-Monstro battles yet
      battleMessage("Can't use that here.", "bagMenu");
      return;
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

  /**
   * Open a "send out which Monstro?" menu. Includes every party member with
   * their level + HP. The currently active member is shown but not selectable.
   */
  function openBattleSwitchMenu() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    if (s.save.party.length <= 1) {
      // Nothing to switch with, just close back to main menu
      startDialogue([`You have no other Monstro to switch in.`]);
      s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
      return;
    }
    const labels = s.save.party.map((c, i) => {
      const sp = SPECIES[c.speciesId];
      const tag = i === b.activeIdx ? " (active)" : c.currentHp <= 0 ? " (fainted)" : "";
      const hpFrag = c.currentHp <= 0 ? "" : ` ${c.currentHp}/${c.maxHp}`;
      return `${sp.name} Lv${c.level}${hpFrag}${tag}`;
    });
    s.menu = {
      kind: "battleSwitch",
      options: [...labels, "Cancel"],
      selected: 0,
    };
  }

  /**
   * Confirm a switch: validate selection, perform the swap, and consume the turn
   * by triggering the enemy's attack.
   */
  function handleBattleSwitchConfirm(selected: number) {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    // Cancel row
    if (selected >= s.save.party.length) {
      s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
      return;
    }
    const target = s.save.party[selected];
    const previousOptions = s.menu?.options ?? [];
    if (selected === b.activeIdx) {
      startDialogue([`That Monstro is already in battle!`]);
      s.menu = { kind: "battleSwitch", options: previousOptions, selected };
      return;
    }
    if (target.currentHp <= 0) {
      startDialogue([`${SPECIES[target.speciesId].name} has fainted and cannot battle.`]);
      s.menu = { kind: "battleSwitch", options: previousOptions, selected };
      return;
    }
    const oldName = SPECIES[s.save.party[b.activeIdx].speciesId].name;
    const newName = SPECIES[target.speciesId].name;
    // Clear volatile (stat stages) on the outgoing creature
    clearVolatile(s.save.party[b.activeIdx]);
    b.activeIdx = selected;
    s.menu = undefined;
    queueBattleMessages([
      { text: `${oldName}, come back!`, next: "enemyAttack" },
      { text: `Go, ${newName}!`, action: () => { /* sprite will refresh from activeIdx */ } },
    ]);
    // After the switch-in message resolves, enemy attacks (switching costs a turn).
    // We chain enemyAttack via the "next" of the second message; advanceBattlePhase
    // already handles `enemyAttack` properly.
  }

  function openBattleBag() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    // Show every item the player owns, in stable order
    const owned: ItemId[] = (Object.keys(ITEMS) as ItemId[]).filter((id) => getBagCount(s.save.bag, id) > 0);
    const labels = owned.map((id) => `${ITEMS[id].name} x${getBagCount(s.save.bag, id)}`);
    s.menu = {
      kind: "battleBag",
      options: [...labels, "Cancel"],
      selected: 0,
      data: { itemIds: owned },
    };
    s.battle.phase = "bagMenu";
  }

  function handleBattleInput(key: string) {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    if (b.phase === "intro" || b.phase === "playerAttack" || b.phase === "enemyAttack" || b.phase === "endTurnTick" || b.phase === "throwBall" || b.phase === "checkCatch" || b.phase === "brokeFree" || b.phase === "switchIn" || b.phase === "trainerSwitch") {
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
    s.battle.messageQueue = [];
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
      // After player attack message, check if enemy fainted, else enemy attacks (unless it already did this turn).
      if (b.enemy.currentHp <= 0) {
        play("faint");
        onEnemyFainted();
      } else if (b.enemyActedThisTurn) {
        // Enemy already attacked first this turn — go straight to end-of-turn residuals.
        b.enemyActedThisTurn = false;
        const tickMsgs = endOfTurnTick(s);
        if (tickMsgs.length > 0) {
          queueBattleMessages(tickMsgs);
        } else {
          b.phase = "menu";
          s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
        }
      } else {
        doEnemyAttack();
      }
    } else if (b.phase === "enemyAttack") {
      if (s.save.party[b.activeIdx].currentHp <= 0) {
        play("faint");
        onPlayerFainted();
      } else if (b.pendingPlayerMoveIdx !== undefined) {
        // Enemy went first; now run the player's queued move
        const moveIdx = b.pendingPlayerMoveIdx;
        b.pendingPlayerMoveIdx = undefined;
        const c = s.save.party[b.activeIdx];
        const slot = c.moves[moveIdx];
        if (slot) {
          const enemyLabel = b.trainerBattle
            ? `${b.trainerBattle.name}'s ${SPECIES[b.enemy.speciesId].name}`
            : `Wild ${SPECIES[b.enemy.speciesId].name}`;
          const msgs = executeMove(c, b.enemy, slot, SPECIES[c.speciesId].name, enemyLabel, true, "playerAttack");
          queueBattleMessages(msgs);
        } else {
          b.phase = "menu";
          s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
        }
      } else {
        // End-of-turn residual status damage (player first then enemy)
        const tickMsgs = endOfTurnTick(s);
        if (tickMsgs.length > 0) {
          queueBattleMessages(tickMsgs);
        } else {
          b.phase = "menu";
          s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
        }
      }
    } else if (b.phase === "endTurnTick") {
      // After residual tick message finishes, decide next step (faint or menu)
      const p = s.save.party[b.activeIdx];
      if (p.currentHp <= 0) {
        onPlayerFainted();
      } else if (b.enemy.currentHp <= 0) {
        onEnemyFainted();
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
        // It broke out — move to brokeFree phase, enemy attacks on next advance
        s.menu = undefined;
        b.phase = "brokeFree";
        b.message = "Oh no! It broke free!";
        b.messageProgress = 0;
        b.messageQueue = [];
      }
    } else if (b.phase === "brokeFree") {
      // User dismissed the "broke free" message → enemy now attacks
      doEnemyAttack();
    } else if (b.phase === "switchIn") {
      // After fainted-switch message, open main menu
      b.phase = "menu";
      s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
    } else if (b.phase === "trainerSwitch") {
      // Trainer sent out next Monstro — return to menu
      b.phase = "menu";
      s.menu = { kind: "battleMain", options: ["FIGHT", "BAG", "PARTY", "RUN"], selected: 0 };
    }
  }

  /**
   * Resolve a single move executed by `attacker` against `defender`.
   * Returns the message queue to push. Centralised so player and enemy share
   * the exact same rules (canAct, accuracy, damage, status riders, stat changes).
   */
  function executeMove(
    attacker: Creature,
    defender: Creature,
    moveSlot: { moveId: string; pp: number; maxPp: number },
    actorLabel: string,
    targetLabel: string,
    isPlayer: boolean,
    nextPhase: BattlePhase
  ): { text: string; next?: BattlePhase; action?: () => void }[] {
    const s = stateRef.current!;
    const b = s.battle!;
    const move = MOVES[moveSlot.moveId];

    // Sleep / paralysis check
    const act = canAct(attacker);
    if (act.msg && act.wokeUp) {
      // woke up this turn and acts immediately, push wake-up message first
      // (the message itself is queued)
    }
    if (!act.canAct) {
      return [{ text: `${actorLabel} ${act.msg}`, next: nextPhase }];
    }

    moveSlot.pp = Math.max(0, moveSlot.pp - 1);
    if (isPlayer) b.playerAnimX = 1; else b.enemyAnimX = 1;

    const res = damageCalc(attacker, defender, move);
    const msgs: { text: string; next?: BattlePhase; action?: () => void }[] = [];
    // Lead with optional wake-up announcement.
    if (act.msg) msgs.push({ text: `${actorLabel} ${act.msg}`, next: nextPhase });
    msgs.push({ text: `${actorLabel} used ${move.name}!`, next: nextPhase });

    if (res.missed) {
      msgs.push({ text: `It missed!` });
      return msgs;
    }

    // Apply damage
    if (move.power > 0) {
      defender.currentHp = Math.max(0, defender.currentHp - res.dmg);
      if (isPlayer) b.enemyShake = 0.5; else b.playerShake = 0.5;
      if (res.dmg > 0) play(res.crit ? "crit" : "hit");
      if (res.crit && res.dmg > 0) {
        msgs.push({ text: "A critical hit!" });
        b.critFlash = 1;
      }
      if (res.eff === 0) msgs.push({ text: "It had no effect..." });
      else if (res.eff >= 2) msgs.push({ text: "It's super effective!" });
      else if (res.eff > 0 && res.eff < 1) msgs.push({ text: "It's not very effective..." });

      // Drain effect — heal attacker by a fraction of damage dealt
      if (move.effect?.drainFraction && res.dmg > 0) {
        const before = attacker.currentHp;
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + Math.max(1, Math.floor(res.dmg * move.effect.drainFraction)));
        const drained = attacker.currentHp - before;
        if (drained > 0) msgs.push({ text: `${actorLabel} drained ${drained} HP!` });
      }
    }

    // Self-heal (e.g. Recover) — only for 0-power status moves
    if (move.effect?.selfHealFraction && move.power === 0) {
      const before = attacker.currentHp;
      const heal = Math.max(1, Math.floor(attacker.maxHp * move.effect.selfHealFraction));
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
      const restored = attacker.currentHp - before;
      if (restored > 0) {
        msgs.push({ text: `${actorLabel} restored ${restored} HP!` });
        play("heal");
      } else {
        msgs.push({ text: `${actorLabel}'s HP is already full!` });
      }
    }

    // Apply secondary status (only if target still alive)
    if (move.effect?.inflictStatus && defender.currentHp > 0) {
      const { kind, chance } = move.effect.inflictStatus;
      if (Math.random() < chance) {
        const ok = applyStatus(defender, kind);
        if (ok) {
          const verb =
            kind === "psn" ? "was poisoned!" :
            kind === "brn" ? "was burned!" :
            kind === "par" ? "is paralysed! It may be unable to move!" :
            kind === "slp" ? "fell asleep!" : "was afflicted!";
          msgs.push({ text: `${targetLabel} ${verb}` });
        }
      }
    }

    // Apply stat-stage change
    if (move.effect?.statChange) {
      const sc = move.effect.statChange;
      if (sc.chance === undefined || Math.random() < sc.chance) {
        const target = sc.target === "self" ? attacker : defender;
        const tgtLabel = sc.target === "self" ? actorLabel : targetLabel;
        const result = applyStatStage(target, sc.stat, sc.delta);
        if (result.capped) {
          msgs.push({ text: `${tgtLabel}'s ${sc.stat.toUpperCase()} won't go ${sc.delta > 0 ? "higher" : "lower"}!` });
        } else {
          const word = describeStatChange(sc.delta);
          msgs.push({ text: `${tgtLabel}'s ${sc.stat.toUpperCase()} ${word}` });
        }
      }
    }

    return msgs;
  }

  function describeStatChange(delta: number): string {
    if (delta >= 2) return "sharply rose!";
    if (delta === 1) return "rose!";
    if (delta === -1) return "fell!";
    if (delta <= -2) return "sharply fell!";
    return "didn't change.";
  }

  /**
   * Apply end-of-turn residual damage from poison/burn to both combatants.
   * Returns the message queue, with the final message chained back to
   * `endTurnTick` so we can resolve any fainting after they're shown.
   */
  function endOfTurnTick(s: GameRef): { text: string; next?: BattlePhase; action?: () => void }[] {
    if (!s.battle) return [];
    const b = s.battle;
    const c = s.save.party[b.activeIdx];
    const msgs: { text: string; next?: BattlePhase; action?: () => void }[] = [];
    const playerTick = c.currentHp > 0 ? applyEndOfTurnStatus(c) : null;
    if (playerTick) msgs.push({ text: `${SPECIES[c.speciesId].name} ${playerTick.msg}`, next: "endTurnTick" });
    const enemyTick = b.enemy.currentHp > 0 ? applyEndOfTurnStatus(b.enemy) : null;
    if (enemyTick) msgs.push({ text: `Wild ${SPECIES[b.enemy.speciesId].name} ${enemyTick.msg}`, next: "endTurnTick" });
    // Always chain the last message to endTurnTick so we resolve faint/menu transitions
    if (msgs.length > 0) msgs[msgs.length - 1].next = "endTurnTick";
    return msgs;
  }

  /**
   * Trigger an evolution sequence inline within the post-victory message chain.
   * Returns extra messages to append, including an action that mutates the
   * creature when the player advances past the "X is evolving!" line.
   */
  function evolutionMessages(c: Creature): { text: string; next?: BattlePhase; action?: () => void }[] {
    const sp = SPECIES[c.speciesId];
    if (!sp.evolution || c.level < sp.evolution.level) return [];
    const fromName = sp.name;
    const toName = SPECIES[sp.evolution.toSpeciesId].name;
    return [
      { text: `Huh? ${fromName} is evolving!`, action: () => {
        // The evolution mutation runs when this message becomes the current one
        evolveCheck(c);
      } },
      { text: `${fromName} evolved into ${toName}!` },
    ];
  }

  /**
   * Pick which side acts first given each side's planned move. Higher priority
   * wins; tied priority falls back to effective speed; tied speed is a coin flip.
   */
  function decidePlayerFirst(playerMove: Move, enemyMove: Move, player: Creature, enemy: Creature): boolean {
    const pPri = playerMove.priority ?? 0;
    const ePri = enemyMove.priority ?? 0;
    if (pPri !== ePri) return pPri > ePri;
    const pSpd = effectiveStat(player, "spd");
    const eSpd = effectiveStat(enemy, "spd");
    if (pSpd !== eSpd) return pSpd > eSpd;
    return Math.random() < 0.5;
  }

  function doPlayerAttack(moveIdx: number) {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    const c = s.save.party[b.activeIdx];
    const playerMoveSlot = c.moves[moveIdx];
    const playerMove = MOVES[playerMoveSlot.moveId];
    // Pick the enemy's response in advance so we can compute turn order
    const enemyMoveSlot = pickEnemyMove();
    const enemyMove = MOVES[enemyMoveSlot.moveId];
    if (decidePlayerFirst(playerMove, enemyMove, c, b.enemy)) {
      const msgs = executeMove(
        c, b.enemy, playerMoveSlot,
        SPECIES[c.speciesId].name,
        b.trainerBattle ? `${b.trainerBattle.name}'s ${SPECIES[b.enemy.speciesId].name}` : `Wild ${SPECIES[b.enemy.speciesId].name}`,
        true, "playerAttack",
      );
      queueBattleMessages(msgs);
    } else {
      // Enemy goes first; player attacks after if still alive.
      b.pendingPlayerMoveIdx = moveIdx;
      b.enemyActedThisTurn = true;
      doEnemyAttackWithSlot(enemyMoveSlot);
    }
  }

  /**
   * Pick the enemy's move using random AI for wild battles and a smart scorer for trainers.
   * Filtering by remaining PP happens inside chooseBestMove.
   */
  function pickEnemyMove(): { moveId: string; pp: number; maxPp: number } {
    const s = stateRef.current!;
    const b = s.battle!;
    const target = s.save.party[b.activeIdx];
    if (b.trainerBattle) {
      return chooseBestMove(b.enemy, target);
    }
    // Wild — random with PP preference
    const usable = b.enemy.moves.filter((m) => m.pp > 0);
    const pool = usable.length > 0 ? usable : b.enemy.moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Boss heal-AI: when HP drops below 30% and potionCharges remain, the gym leader
   * spends one to fully restore its active Monstro. Returns true if it healed and
   * the turn is consumed.
   */
  function trainerAITryHeal(): boolean {
    const s = stateRef.current;
    if (!s || !s.battle || !s.battle.trainerBattle) return false;
    const tb = s.battle.trainerBattle;
    if (!tb.gymLeader || !tb.potionCharges || tb.potionCharges <= 0) return false;
    const e = s.battle.enemy;
    if (e.currentHp <= 0) return false;
    if (e.currentHp / e.maxHp > 0.3) return false;
    tb.potionCharges -= 1;
    const before = e.currentHp;
    e.currentHp = e.maxHp;
    play("heal");
    queueBattleMessages([
      { text: `${tb.name} used a Hyper Potion!` },
      { text: `${SPECIES[e.speciesId].name} restored ${e.currentHp - before} HP!`, next: "enemyAttack" },
    ]);
    return true;
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
    // Gym leader heal opportunity short-circuits the attack
    if (trainerAITryHeal()) return;
    const moveSlot = pickEnemyMove();
    doEnemyAttackWithSlot(moveSlot);
  }

  /** Shared core of enemy attack — used by both first-actor and second-actor paths. */
  function doEnemyAttackWithSlot(moveSlot: { moveId: string; pp: number; maxPp: number }) {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    b.phase = "enemyAttack";
    const target = s.save.party[b.activeIdx];
    const enemyLabel = b.trainerBattle ? `${b.trainerBattle.name}'s ${SPECIES[b.enemy.speciesId].name}` : `Wild ${SPECIES[b.enemy.speciesId].name}`;
    const msgs = executeMove(
      b.enemy, target, moveSlot,
      enemyLabel,
      SPECIES[target.speciesId].name,
      false, "enemyAttack"
    );
    queueBattleMessages(msgs);
  }

  function onEnemyFainted() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    const c = s.save.party[b.activeIdx];
    const enemySpecies = SPECIES[b.enemy.speciesId];
    // Trainer Monstro give 1.5x EXP (Gen 1 style)
    const xpBase = expYield(enemySpecies, b.enemy.level);
    const xp = b.trainerBattle ? Math.floor(xpBase * 1.5) : xpBase;
    const result = gainExp(c, xp);
    const msgs: { text: string; next?: BattlePhase; action?: () => void }[] = [];

    if (b.trainerBattle) {
      msgs.push({ text: `${b.trainerBattle.name}'s ${enemySpecies.name} fainted!`, next: "victory" });
    } else {
      msgs.push({ text: `Wild ${enemySpecies.name} fainted!`, next: "victory" });
    }
    msgs.push({ text: `${SPECIES[c.speciesId].name} gained ${xp} EXP!` });

    // Coin reward only for wild battles (trainer pays a prize at end)
    if (!b.trainerBattle) {
      const coinReward = Math.max(5, Math.round(b.enemy.level * 10 * (0.9 + Math.random() * 0.2)));
      s.save.money += coinReward;
      msgs.push({ text: `You found ${coinReward} coins!` });
    }

    if (result.leveledUp) {
      msgs.push({ text: `${SPECIES[c.speciesId].name} grew to Lv${c.level}!`, action: () => play("levelup") });
      for (const mvName of result.newMoves) {
        msgs.push({ text: `${SPECIES[c.speciesId].name} learned ${mvName}!` });
      }
      // Pending learns (couldn't auto-add because moveset is full) get queued
      // and surfaced after the battle ends, so the player can pick what to forget.
      if (result.pendingLearns.length > 0) {
        (b as any).pendingLearns = (b as any).pendingLearns ?? [];
        (b as any).pendingLearns.push({ creature: c, moves: result.pendingLearns });
      }
      const evoMsgs = evolutionMessages(c);
      if (evoMsgs.length > 0) {
        evoMsgs[0].action = () => play("evolution");
        msgs.push(...evoMsgs);
      }
    }

    // Trainer: queue next Monstro, or end battle with prize + reward item
    if (b.trainerBattle) {
      const t = b.trainerBattle;
      t.defeatedIdx.push(t.activeIdx);
      const nextIdx = t.party.findIndex((_, i) => !t.defeatedIdx.includes(i));
      if (nextIdx >= 0) {
        // Send out next
        const nextMon = t.party[nextIdx];
        msgs.push({ text: `${t.name} is about to send out ${SPECIES[nextMon.speciesId].name}!`, action: () => {
          const s2 = stateRef.current;
          if (!s2 || !s2.battle || !s2.battle.trainerBattle) return;
          s2.battle.trainerBattle.activeIdx = nextIdx;
          s2.battle.enemy = nextMon;
          s2.battle.enemyMaxHp = nextMon.maxHp;
          s2.battle.enemyHpShown = nextMon.currentHp;
          if (!s2.save.monstroSeen.includes(nextMon.speciesId)) s2.save.monstroSeen.push(nextMon.speciesId);
        } });
        msgs.push({ text: `${t.name} sent out ${SPECIES[nextMon.speciesId].name}!`, next: "trainerSwitch" });
      } else {
        // Final defeat — pay prize, set flag, and award reward item if any
        s.save.money += t.prize;
        const flag = (b as any).trainerFlag as string | undefined;
        if (flag) s.save.flags[flag] = true;
        msgs.push({ text: `You defeated ${t.name}!` });
        for (const v of t.victory) msgs.push({ text: v });
        msgs.push({ text: `Received ${t.prize} coins as prize!` });
        if (t.rewardItem) {
          const reward = t.rewardItem;
          addToBag(s.save.bag, reward, 1);
          msgs.push({ text: `You received the ${ITEMS[reward].name}!`, action: () => play("levelup") });
        }
        if (t.gymLeader) {
          msgs.push({ text: `A new path opens for you, traveler!` });
        }
      }
    }

    queueBattleMessages(msgs);
  }

  function onPlayerFainted() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    b.pendingPlayerMoveIdx = undefined; // stale move from the faint turn must not replay
    const c = s.save.party[b.activeIdx];
    // Find next non-fainted
    const nextIdx = s.save.party.findIndex((p, i) => i !== b.activeIdx && p.currentHp > 0);
    if (nextIdx >= 0) {
      const oldName = SPECIES[c.speciesId].name;
      b.activeIdx = nextIdx;
      const newName = SPECIES[s.save.party[nextIdx].speciesId].name;
      // Queue: faint message → switchIn message → menu (via switchIn phase advance)
      b.phase = "switchIn";
      b.message = `${oldName} fainted! Go, ${newName}!`;
      b.messageProgress = 0;
      b.messageQueue = [];
    } else {
      // All fainted - blackout
      queueBattleMessages([
        { text: `${SPECIES[c.speciesId].name} fainted!`, next: "defeat" },
        { text: `${displayName} blacked out...`, action: () => {} },
        { text: `You rush back to Hearthwick Town.`, action: () => {
          // Heal party and teleport (apply to both save and live player)
          s.save.party.forEach((p) => { p.currentHp = Math.max(1, Math.floor(p.maxHp / 2)); });
          s.save.position = { mapId: "hearthwick", x: 9, y: 8, facing: "down" };
          s.player.x = 9;
          s.player.y = 8;
          s.player.facing = "down";
          s.player.isMoving = false;
          s.player.moveProgress = 0;
          centerCamera(s);
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
      // Use brokeFree-style phase: user dismisses message, then enemy attacks
      b.phase = "brokeFree";
      b.message = "Couldn't escape!";
      b.messageProgress = 0;
      b.messageQueue = [];
    }
  }

  function throwCapsule(itemId: ItemId = "capsule") {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    removeFromBag(s.save.bag, itemId, 1);
    b.ballAnim = 0;
    b.lastCapsule = itemId;
    battleMessage(`${displayName} threw a ${ITEMS[itemId].name}!`, "throwBall");
  }

  function resolveCatch() {
    const s = stateRef.current;
    if (!s || !s.battle) return;
    const b = s.battle;
    const mult = ITEMS[b.lastCapsule ?? "capsule"].catchMultiplier ?? 1;
    const caught = tryCatch(b.enemy, mult);
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
    play("catch");
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
    // Reset volatile (stat stages) on every party member so they don't bleed across fights.
    for (const c of s.save.party) clearVolatile(c);
    // Pull any pending move-learn prompts off the battle and surface them to the player.
    const pending: { creature: Creature; moves: string[] }[] = (s.battle as any)?.pendingLearns ?? [];
    s.battle = undefined;
    s.menu = undefined;
    s.mode = "overworld";
    if (pending.length > 0) {
      // Flatten into a list of (creature, single move) tasks
      const tasks: { creature: Creature; moves: string[] }[] = [];
      for (const p of pending) tasks.push({ creature: p.creature, moves: p.moves });
      const runTasks = () => {
        const t = tasks.shift();
        if (!t) return;
        progressMoveLearnQueue(t.creature, t.moves);
      };
      runTasks();
    }
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
      critFlash: 0,
    };
    s.mode = "battle";
    if (s.battle.activeIdx < 0) s.battle.activeIdx = 0;
  }

  /**
   * Start a trainer battle. The trainer's first Monstro is sent out and any
   * subsequent KOs trigger their next; trainer wins broadcast a prize.
   */
  function startTrainerBattle(t: {
    name: string;
    party: { speciesId: string; level: number }[];
    intro: string[];
    victory: string[];
    prize: number;
    flag: string;
    gymLeader?: boolean;
    potionCharges?: number;
    rewardItem?: ItemId;
  }) {
    const s = stateRef.current;
    if (!s) return;
    if (t.party.length === 0) return;
    const party = t.party.map((p) => createWild(p.speciesId, p.level));
    const first = party[0];
    if (!s.save.monstroSeen.includes(first.speciesId)) s.save.monstroSeen.push(first.speciesId);
    s.battle = {
      enemy: first,
      enemyMaxHp: first.maxHp,
      activeIdx: s.save.party.findIndex((p) => p.currentHp > 0),
      phase: "intro",
      message: `${t.name} sent out ${SPECIES[first.speciesId].name}!`,
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
      enemyHpShown: first.currentHp,
      playerHpShown: s.save.party[0]?.currentHp || 0,
      critFlash: 0,
      trainerBattle: {
        name: t.name,
        party,
        activeIdx: 0,
        defeatedIdx: [],
        intro: t.intro,
        victory: t.victory,
        prize: t.prize,
        gymLeader: t.gymLeader,
        potionCharges: t.potionCharges ?? 0,
        rewardItem: t.rewardItem,
      },
    };
    // Persist the flag reference on the battle so we can set it after victory.
    (s.battle as any).trainerFlag = t.flag;
    s.mode = "battle";
    if (s.battle.activeIdx < 0) s.battle.activeIdx = 0;
  }

  // Compute a contextual help string for the bottom-of-screen hint
  function currentHint(s: GameRef): string {
    if (s.mode === "dialogue") return "SPACE/ENTER · Continue · (hold to fast-forward)";
    if (s.mode === "battle") {
      if (!s.menu) return "SPACE/ENTER · Continue · (hold to fast-forward)";
      if (s.menu.kind === "battleMain") return "Arrows · Navigate · SPACE · Confirm";
      if (s.menu.kind === "battleFight") return "Arrows · Pick move · SPACE · Use · ESC · Back";
      if (s.menu.kind === "battleBag") return "Arrows · Navigate · SPACE · Use · ESC · Back";
    }
    if (s.mode === "menu") {
      if (s.menu?.kind === "starter") return "Arrows · Browse · SPACE · Choose";
      if (s.menu?.kind === "shop") return "↑ ↓ Browse · SPACE Buy · ESC Leave";
      if (s.menu?.kind === "shopQty") return "← → Change qty · SPACE Confirm · ESC Back";
      if (s.menu?.kind === "worldmap") return "↑ ↓ Browse regions · ESC Close";
      if (s.menu?.kind === "bag") return "↑ ↓ Browse · SPACE Use/Inspect · ESC Close";
      if (s.menu?.kind === "dex") return "↑ ↓ Browse · SPACE View · ESC Back";
      if (s.menu?.kind === "dex_detail") return "↑ ↓ Browse · SPACE/ESC Back";
      if (s.menu?.kind === "pc") return "↑ ↓ Browse · SPACE Swap · ESC Close";
      if (s.menu?.kind === "yesno") return "← → choose · SPACE Confirm · ESC Cancel";
      if (s.menu?.kind === "moveLearn") return "↑ ↓ Browse · SPACE Forget · ESC Cancel";
      if (s.menu?.kind === "partyTarget") return "↑ ↓ Browse · SPACE Use · ESC Cancel";
      return "Arrows · Navigate · SPACE · Select · ESC · Close";
    }
    if (s.mode === "battle" && s.menu?.kind === "battleSwitch") {
      return "↑ ↓ Browse · SPACE Switch · ESC Back";
    }
    return "Arrows/WASD · Move · SPACE · Talk · ESC · Menu · SHIFT · Run";
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
          // Check portal — respect flag-gated exits
          const portal = findPortal(map, s.player.x, s.player.y);
          if (portal) {
            if (portal.requiresFlag && !s.save.flags[portal.requiresFlag]) {
              startDialogue(portal.blockedMsg ?? ["The way is sealed for now."]);
              centerCamera(s);
              return;
            }
            doTransition(portal.toMap, portal.toX, portal.toY, s.player.facing);
            centerCamera(s);
            return;
          }
          // Decrement Repel counter on each step taken
          if ((s.save.repelSteps ?? 0) > 0) {
            s.save.repelSteps = (s.save.repelSteps ?? 0) - 1;
            if (s.save.repelSteps === 0) {
              startDialogue(["The Repel's effect wore off."]);
            }
          }
          // Field-item pickup — happens BEFORE encounter check so the item gets to you safely
          if (tile === "F") {
            tryPickupFieldItem();
            centerCamera(s);
            return;
          }
          // Tall grass encounter — suppressed while Repel is active
          if (tile === "T" && (s.save.repelSteps ?? 0) <= 0) {
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
          // Trainer line-of-sight: any undefeated trainer that "sees" the player triggers a forced battle.
          checkTrainerLOS();
          if (stateRef.current?.mode === "trainerSpot") {
            centerCamera(s);
            return;
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
    } else if (s.mode === "trainerSpot" && s.trainerSpot) {
      // Tick the LOS-spot timer, then auto-run the trainer NPC (which fires the battle).
      s.trainerSpot.timer -= dt;
      if (s.trainerSpot.timer <= 0) {
        const npc = s.trainerSpot.npc;
        s.trainerSpot = undefined;
        s.mode = "overworld";
        runNpc(npc); // dialogue + trainer battle
      }
    } else if (s.mode === "dialogue" && s.dialogue) {
      // Animate text typing — hold confirm to fast-forward
      const fullLen = s.dialogue.lines[s.dialogue.index].length;
      const fast = s.pressed.has("confirm") || s.pressed.has("cancel");
      const speed = fast ? 240 : 60;
      s.dialogue.charsShown = Math.min(fullLen, s.dialogue.charsShown + dt * speed);
    } else if (s.mode === "battle" && s.battle) {
      const b = s.battle;
      // Fade in
      if (b.fadeIn > 0) {
        b.fadeIn = Math.max(0, b.fadeIn - dt * 1.2);
      }
      // Animate message text — hold confirm to fast-forward
      if (b.messageProgress < b.message.length) {
        const fast = s.pressed.has("confirm") || s.pressed.has("cancel");
        const speed = fast ? 200 : 50;
        b.messageProgress = Math.min(b.message.length, b.messageProgress + dt * speed);
      }
      // Shake
      if (b.playerShake > 0) b.playerShake = Math.max(0, b.playerShake - dt * 2);
      if (b.enemyShake > 0) b.enemyShake = Math.max(0, b.enemyShake - dt * 2);
      // Crit flash decay
      if (b.critFlash > 0) b.critFlash = Math.max(0, b.critFlash - dt * 2.4);
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
    play("heal");
    s.save.party.forEach((c) => { fullyHeal(c); });
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
        const t = effectiveTile(map, tx, ty);
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

    // Draw NPCs (skip the LOS-spot NPC if we're rendering the "!" — it stays in place anyway)
    for (const npc of map.npcs) {
      const px = npc.x * TILE_SIZE - camX;
      const py = npc.y * TILE_SIZE - camY;
      if (px < -TILE_SIZE || px > CANVAS_W || py < -TILE_SIZE || py > CANVAS_H) continue;
      const npcSprite = npcSpriteFor(npc.spriteKey);
      // Slight shadow oval beneath the NPC for grounded feel.
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 4, TILE_SIZE * 0.4, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      drawSprite(ctx, npcSprite, px, py, PIXEL_SCALE);
    }

    // Player drop shadow
    const px = playerPxX - camX;
    const py = playerPxY - camY;
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 4, TILE_SIZE * 0.4, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw player
    let sprite: Sprite;
    let flip = false;
    const useFrameB = s.player.isMoving && s.player.walkFrame === 1;
    if (s.player.facing === "down") sprite = useFrameB ? PLAYER_DOWN_B : PLAYER_DOWN_A;
    else if (s.player.facing === "up") sprite = PLAYER_UP_A;
    else if (s.player.facing === "left") sprite = PLAYER_LEFT_A;
    else { sprite = PLAYER_LEFT_A; flip = true; }
    drawSprite(ctx, sprite, px, py, PIXEL_SCALE, flip);

    // Render "!" emote over trainer head during LOS spot pause
    if (s.mode === "trainerSpot" && s.trainerSpot) {
      const tn = s.trainerSpot.npc;
      const ex = tn.x * TILE_SIZE - camX;
      const ey = tn.y * TILE_SIZE - camY - TILE_SIZE + 4 + Math.sin(performance.now() / 60) * 2;
      drawSprite(ctx, EXCLAIM, ex, ey, PIXEL_SCALE);
    }

    // Dark-cave vignette (cuts the rendered map into a flashlight circle around the player).
    if (map.dark) {
      const cx = px + TILE_SIZE / 2;
      const cy = py + TILE_SIZE / 2;
      const radius = TILE_SIZE * 4;
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // Map name banner (briefly when changed)
    // (simple - always show a small marker)
    drawTextBox(ctx, map.name.toUpperCase(), 8, 8, "#fff", "#000", 11);
  }

  function npcSpriteFor(kind: NpcDef["spriteKey"]): Sprite {
    switch (kind) {
      case "clerk": return NPC_CLERK;
      case "trainer": return NPC_TRAINER;
      case "picnicker": return NPC_PICNICKER;
      case "fisher": return NPC_FISHER;
      case "gymleader": return NPC_GYM_LEADER;
      case "mentor":
      default: return NPC_MENTOR;
    }
  }

  function renderTile(ctx: CanvasRenderingContext2D, t: TileType, px: number, py: number) {
    // Base layer
    if (t === "G" || t === "T" || t === "X" || t === "N" || t === "I" || t === "H" || t === "C" || t === "F") {
      drawSprite(ctx, TILE_GRASS, px, py, PIXEL_SCALE);
    } else if (t === "Z") {
      drawSprite(ctx, TILE_SNOW, px, py, PIXEL_SCALE);
    } else if (t === "P" || t === "D") {
      drawSprite(ctx, TILE_PATH, px, py, PIXEL_SCALE);
    } else if (t === "S") {
      drawSprite(ctx, TILE_SAND, px, py, PIXEL_SCALE);
    } else if (t === "W") {
      // 2-frame water animation, 600ms cycle
      const waterFrame = Math.floor(performance.now() / 600) % 2 === 0 ? TILE_WATER : TILE_WATER_B;
      drawSprite(ctx, waterFrame, px, py, PIXEL_SCALE);
    } else if (t === "L") {
      // 2-frame lava animation, 400ms cycle (faster than water for bubbling feel)
      const lavaFrame = Math.floor(performance.now() / 400) % 2 === 0 ? TILE_LAVA : TILE_LAVA_B;
      drawSprite(ctx, lavaFrame, px, py, PIXEL_SCALE);
    } else if (t === "B") {
      drawSprite(ctx, TILE_BUILDING, px, py, PIXEL_SCALE);
    }
    // Overlay
    if (t === "T") drawSprite(ctx, TILE_TALL_GRASS, px, py, PIXEL_SCALE);
    if (t === "X") drawSprite(ctx, TILE_TREE, px, py, PIXEL_SCALE);
    if (t === "D") drawSprite(ctx, TILE_DOOR, px, py, PIXEL_SCALE);
    if (t === "I") drawSprite(ctx, TILE_SIGN, px, py, PIXEL_SCALE);
    if (t === "C") drawSprite(ctx, TILE_CUT_TREE, px, py, PIXEL_SCALE);
    if (t === "F") drawSprite(ctx, TILE_FIELD_ITEM, px, py, PIXEL_SCALE);
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
      // Pause menu coin counter
      if (m.kind === "pause") {
        drawText(ctx, `${s.save.money} coins`, x + w / 2, y + h + 18, "#ffd040", 12, "center");
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
    } else if (m.kind === "shop") {
      renderShopMenu(ctx, s, m);
    } else if (m.kind === "shopQty") {
      renderShopQty(ctx, s, m);
    } else if (m.kind === "worldmap") {
      renderWorldMap(ctx, s, m);
    } else if (m.kind === "bag") {
      renderBagMenu(ctx, s, m);
    } else if (m.kind === "dex") {
      renderDexList(ctx, s, m);
    } else if (m.kind === "dex_detail") {
      renderDexDetail(ctx, s, m);
    } else if (m.kind === "pc") {
      renderPcMenu(ctx, s, m);
    } else if (m.kind === "yesno") {
      renderYesNo(ctx, s, m);
    } else if (m.kind === "moveLearn") {
      renderMoveLearn(ctx, s, m);
    } else if (m.kind === "partyTarget") {
      renderPartyTarget(ctx, s, m);
    }
  }

  function renderYesNo(ctx: CanvasRenderingContext2D, s: GameRef, m: Menu) {
    dimBackground(ctx, 0.65);
    const prompt = (m.data?.prompt as string[]) ?? ["Are you sure?"];
    const w = 320;
    const h = 140;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2;
    ctx.fillStyle = "rgba(20,20,40,0.97)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    let py = y + 30;
    for (const line of prompt) {
      drawText(ctx, line, x + w / 2, py, "#fff", 13, "center");
      py += 18;
    }
    const optY = y + h - 36;
    for (let i = 0; i < m.options.length; i++) {
      const ox = x + (i === 0 ? w / 2 - 70 : w / 2 + 10);
      if (i === m.selected) {
        ctx.fillStyle = "rgba(255,224,102,0.2)";
        ctx.fillRect(ox - 8, optY - 14, 60, 22);
      }
      drawText(ctx, m.options[i], ox + 22, optY, i === m.selected ? "#ffe066" : "#fff", 14, "center");
    }
  }

  function renderMoveLearn(ctx: CanvasRenderingContext2D, s: GameRef, m: Menu) {
    dimBackground(ctx, 0.6);
    const target = m.data?.target as Creature | undefined;
    const newMoveId = m.data?.newMoveId as string | undefined;
    if (!target || !newMoveId) return;
    const mv = MOVES[newMoveId];
    const w = 420;
    const h = 260;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2;
    ctx.fillStyle = "rgba(20,20,40,0.97)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    drawText(ctx, `${SPECIES[target.speciesId].name} learning ${mv.name}`, x + w / 2, y + 22, "#ffe066", 13, "center");
    drawText(ctx, "Which move to forget?", x + w / 2, y + 42, "#88c8ff", 11, "center");
    for (let i = 0; i < m.options.length; i++) {
      const oy = y + 64 + i * 28;
      if (i === m.selected) {
        ctx.fillStyle = "rgba(255,224,102,0.2)";
        ctx.fillRect(x + 10, oy - 14, w - 20, 26);
        drawText(ctx, ">", x + 14, oy, "#ffe066", 13, "left");
      }
      const isCancel = i >= 4;
      drawText(ctx, m.options[i], x + 36, oy, isCancel ? "#b8b8d4" : "#fff", 13, "left");
      if (!isCancel && target.moves[i]) {
        const slot = target.moves[i];
        const mv2 = MOVES[slot.moveId];
        drawText(ctx, `PWR ${mv2.power > 0 ? mv2.power : "—"}  PP ${slot.pp}/${slot.maxPp}`, x + w - 16, oy, "#cfcfdc", 11, "right");
      }
    }
  }

  function renderPartyTarget(ctx: CanvasRenderingContext2D, s: GameRef, m: Menu) {
    dimBackground(ctx, 0.55);
    const itemId = m.data?.itemId as ItemId | undefined;
    const w = 420;
    const h = 260;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2 - 8;
    ctx.fillStyle = "rgba(20,20,40,0.97)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    const title = itemId ? `Use ${ITEMS[itemId].name} on...` : "Choose a Monstro";
    drawText(ctx, title, x + w / 2, y + 22, "#ffe066", 14, "center");
    for (let i = 0; i < m.options.length; i++) {
      const oy = y + 50 + i * 24;
      if (i === m.selected) {
        ctx.fillStyle = "rgba(255,224,102,0.2)";
        ctx.fillRect(x + 10, oy - 14, w - 20, 22);
        drawText(ctx, ">", x + 14, oy, "#ffe066", 13, "left");
      }
      const isCancel = i >= s.save.party.length;
      drawText(ctx, m.options[i], x + 36, oy, isCancel ? "#b8b8d4" : "#fff", 12, "left");
    }
  }

  // Dim background so menus pop on top of the overworld
  function dimBackground(ctx: CanvasRenderingContext2D, alpha: number = 0.55) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function renderShopMenu(ctx: CanvasRenderingContext2D, s: GameRef, m: Menu) {
    dimBackground(ctx, 0.55);
    const w = 460;
    const h = 280;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2 - 12;
    ctx.fillStyle = "rgba(20,20,40,0.97)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    drawText(ctx, "MART", x + w / 2, y + 22, "#ffe066", 16, "center");
    drawText(ctx, `${s.save.money} coins`, x + w - 12, y + 22, "#ffd040", 12, "right");

    // List
    const itemIds = (m.data?.itemIds as ItemId[]) || [];
    const labels = m.options;
    const listX = x + 12;
    const listY = y + 44;
    const rowH = 22;
    for (let i = 0; i < labels.length; i++) {
      const oy = listY + i * rowH;
      if (i === m.selected) {
        ctx.fillStyle = "rgba(255,224,102,0.15)";
        ctx.fillRect(listX, oy - 4, w - 24, rowH);
        drawText(ctx, ">", listX + 4, oy + 10, "#ffe066", 13, "left");
      }
      const isLeave = i >= itemIds.length;
      const label = labels[i];
      drawText(ctx, isLeave ? "Leave" : label, listX + 22, oy + 10, isLeave ? "#b8b8d4" : "#fff", 12, "left");
      if (!isLeave) {
        const id = itemIds[i];
        const owned = getBagCount(s.save.bag, id);
        drawText(ctx, `Owned: ${owned}`, x + w - 12, oy + 10, "#88f0c4", 11, "right");
      }
    }
    // Description panel for the highlighted item
    const descY = y + h - 64;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(x + 8, descY, w - 16, 56);
    ctx.strokeStyle = "rgba(255,224,102,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, descY, w - 16, 56);
    if (m.selected < itemIds.length) {
      const it = ITEMS[itemIds[m.selected]];
      drawText(ctx, it.name, x + 16, descY + 16, "#ffe066", 12, "left");
      drawText(ctx, `${it.price} coins`, x + w - 16, descY + 16, "#ffd040", 11, "right");
      const lines = wrapText(ctx, it.description, w - 32, "11px monospace");
      let dy = descY + 32;
      for (const ln of lines.slice(0, 2)) {
        drawText(ctx, ln, x + 16, dy, "#cfcfdc", 11, "left");
        dy += 13;
      }
    } else {
      drawText(ctx, "Leave the shop.", x + 16, descY + 28, "#b8b8d4", 11, "left");
    }
  }

  function renderShopQty(ctx: CanvasRenderingContext2D, s: GameRef, m: Menu) {
    dimBackground(ctx, 0.65);
    const itemId = m.data?.itemId as ItemId | undefined;
    if (!itemId) return;
    const it = ITEMS[itemId];
    const qty = Math.max(1, m.selected);
    const total = it.price * qty;
    const max = Math.max(1, m.data?.max ?? 1);

    const w = 360;
    const h = 180;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2;
    ctx.fillStyle = "rgba(20,20,40,0.97)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    drawText(ctx, `Buy ${it.name}`, x + w / 2, y + 28, "#ffe066", 16, "center");
    drawText(ctx, `${it.price} coins each`, x + w / 2, y + 50, "#ffd040", 12, "center");

    // Qty stepper
    drawText(ctx, `◄  x${qty}  ►`, x + w / 2, y + 92, "#fff", 22, "center");
    drawText(ctx, `Total: ${total} coins`, x + w / 2, y + 122, total > s.save.money ? "#ff6b6b" : "#5fae5f", 13, "center");
    drawText(ctx, `(max ${max})`, x + w / 2, y + 142, "#b8b8d4", 10, "center");
    drawText(ctx, `SPACE: Buy   ESC: Back`, x + w / 2, y + 162, "#b8b8d4", 10, "center");
  }

  function renderWorldMap(ctx: CanvasRenderingContext2D, s: GameRef, m: Menu) {
    dimBackground(ctx, 0.7);
    const w = 520;
    const h = 360;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2;
    ctx.fillStyle = "rgba(15,30,15,0.97)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    drawText(ctx, "WORLD MAP — VERDANT REGION", x + w / 2, y + 24, "#ffe066", 14, "center");

    // Render every known region as a stacked box (north → south progression).
    const mapIds = (m.data?.mapIds as string[]) || [];
    const boxW = 240;
    const boxH = 32;
    const cx = x + w / 2;
    const startY = y + 50;
    const gap = 8;
    const order = ["hearthwick", "whisperwood", "route1", "lumencove", "sunshore", "emberfall", "frostpeak"];
    // Connecting path
    ctx.strokeStyle = "#6a4f2a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, startY + boxH);
    ctx.lineTo(cx, startY + order.length * boxH + (order.length - 1) * gap);
    ctx.stroke();
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const map = MAPS[id];
      if (!map) continue;
      const bx = cx - boxW / 2;
      const by = startY + i * (boxH + gap);
      const isCurrent = id === s.save.position.mapId;
      const isSelected = mapIds[m.selected] === id;
      ctx.fillStyle = isCurrent ? "#2c5a2c" : map.dark ? "#1a1a25" : "#1f3a20";
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeStyle = isSelected ? "#ffe066" : isCurrent ? "#9fe0a0" : "#5a7a5a";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(bx, by, boxW, boxH);
      drawText(ctx, map.name, bx + boxW / 2, by + 20, "#fff", 12, "center");
      if (isCurrent) drawText(ctx, "●", bx + 16, by + 20, "#ffe066", 12, "left");
    }
    // Hint
    drawText(ctx, "↑ ↓ to browse  ·  ESC to close", x + w / 2, y + h - 18, "#b8b8d4", 11, "center");
  }

  function renderBagMenu(ctx: CanvasRenderingContext2D, s: GameRef, m: Menu) {
    dimBackground(ctx, 0.55);
    const w = 460;
    const h = 300;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2 - 8;
    ctx.fillStyle = "rgba(20,20,40,0.97)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    drawText(ctx, "BAG", x + w / 2, y + 22, "#ffe066", 16, "center");
    drawText(ctx, `${s.save.money} coins`, x + w - 12, y + 22, "#ffd040", 12, "right");

    const itemIds = (m.data?.itemIds as ItemId[]) || [];
    const labels = m.options;
    const listX = x + 12;
    const listY = y + 44;
    const rowH = 22;
    for (let i = 0; i < labels.length; i++) {
      const oy = listY + i * rowH;
      if (i === m.selected) {
        ctx.fillStyle = "rgba(255,224,102,0.15)";
        ctx.fillRect(listX, oy - 4, w - 24, rowH);
        drawText(ctx, ">", listX + 4, oy + 10, "#ffe066", 13, "left");
      }
      const isClose = i >= itemIds.length;
      drawText(ctx, isClose ? "Close" : labels[i], listX + 22, oy + 10, isClose ? "#b8b8d4" : "#fff", 12, "left");
    }
    // Description for highlighted item
    const descY = y + h - 64;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(x + 8, descY, w - 16, 56);
    ctx.strokeStyle = "rgba(255,224,102,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 8, descY, w - 16, 56);
    if (m.selected < itemIds.length) {
      const it = ITEMS[itemIds[m.selected]];
      drawText(ctx, it.name, x + 16, descY + 16, "#ffe066", 12, "left");
      const lines = wrapText(ctx, it.description, w - 32, "11px monospace");
      let dy = descY + 32;
      for (const ln of lines.slice(0, 2)) {
        drawText(ctx, ln, x + 16, dy, "#cfcfdc", 11, "left");
        dy += 13;
      }
    }
  }

  /**
   * Compact, scrollable Monstrodex list. Shows ● for caught, ○ for seen, blank
   * for unseen. Pressing SPACE on a seen entry opens the detail page.
   */
  function renderDexList(ctx: CanvasRenderingContext2D, s: GameRef, m: Menu) {
    dimBackground(ctx, 0.6);
    const ids = (m.data?.speciesIds as string[]) || [];
    const w = 480;
    const h = 360;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2 - 8;
    ctx.fillStyle = "rgba(20,20,40,0.97)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    drawText(ctx, "MONSTRODEX", x + w / 2, y + 22, "#ffe066", 16, "center");
    const seenCount = s.save.monstroSeen.length;
    const caughtCount = s.save.monstroCaught.length;
    const total = ids.length;
    drawText(ctx, `Seen ${seenCount}/${total}   Caught ${caughtCount}/${total}`, x + w / 2, y + 42, "#88c8ff", 11, "center");

    const listX = x + 14;
    const rowH = 20;
    const startY = y + 60;
    const visibleRows = Math.floor((h - 90) / rowH);
    // Scroll so selected stays visible
    const startIdx = Math.max(0, Math.min(m.selected - Math.floor(visibleRows / 2), ids.length - visibleRows));
    for (let i = 0; i < visibleRows && startIdx + i < ids.length; i++) {
      const realIdx = startIdx + i;
      const oy = startY + i * rowH;
      if (realIdx === m.selected) {
        ctx.fillStyle = "rgba(255,224,102,0.15)";
        ctx.fillRect(listX, oy - 2, w - 28, rowH);
        drawText(ctx, ">", listX + 4, oy + 13, "#ffe066", 13, "left");
      }
      drawText(ctx, `#${(realIdx + 1).toString().padStart(2, "0")}`, listX + 20, oy + 13, "#aaa", 11, "left");
      drawText(ctx, m.options[realIdx] ?? "", listX + 70, oy + 13, "#fff", 12, "left");
    }
    drawText(ctx, "SPACE View · ESC Back", x + w / 2, y + h - 14, "#b8b8d4", 11, "center");
  }

  /** Full-page detail of a single species — sprite, stats, description. */
  function renderDexDetail(ctx: CanvasRenderingContext2D, s: GameRef, m: Menu) {
    dimBackground(ctx, 0.7);
    const ids = (m.data?.speciesIds as string[]) || [];
    const id = ids[m.selected];
    if (!id) return;
    const sp = SPECIES[id];
    if (!sp) return;
    const seen = s.save.monstroSeen.includes(id);
    const caught = s.save.monstroCaught.includes(id);

    const w = 520;
    const h = 360;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2 - 8;
    ctx.fillStyle = "rgba(20,20,40,0.97)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    drawText(ctx, `#${(m.selected + 1).toString().padStart(3, "0")}  ${sp.name.toUpperCase()}`, x + w / 2, y + 24, "#ffe066", 16, "center");

    if (seen) {
      // Sprite preview
      drawSprite(ctx, sp.sprite, x + 24, y + 50, 3);
      // Types
      let typeX = x + 24;
      const typeY = y + 200;
      for (const t of sp.types) {
        ctx.fillStyle = TYPE_COLORS[t];
        ctx.fillRect(typeX, typeY, 70, 18);
        drawText(ctx, t.toUpperCase(), typeX + 35, typeY + 13, "#1a1326", 10, "center");
        typeX += 78;
      }
      // Stats panel
      const panelX = x + 160;
      const panelY = y + 56;
      drawText(ctx, "Base Stats", panelX, panelY, "#88c8ff", 11, "left");
      const stats: [string, number][] = [["HP", sp.baseStats.hp], ["ATK", sp.baseStats.atk], ["DEF", sp.baseStats.def], ["SPD", sp.baseStats.spd]];
      for (let i = 0; i < stats.length; i++) {
        const sy = panelY + 18 + i * 18;
        drawText(ctx, stats[i][0], panelX, sy, "#fff", 12, "left");
        // Bar
        const bw = 160;
        ctx.fillStyle = "#1a1326";
        ctx.fillRect(panelX + 50, sy - 10, bw, 10);
        ctx.fillStyle = sp.color;
        ctx.fillRect(panelX + 50, sy - 10, Math.min(bw, (bw * stats[i][1]) / 150), 10);
        drawText(ctx, `${stats[i][1]}`, panelX + 50 + bw + 8, sy, "#fff", 11, "left");
      }
      // Description (wrapped)
      const descLines = wrapText(ctx, sp.description, w - 48, "12px monospace");
      let dy = y + 232;
      for (const ln of descLines.slice(0, 3)) {
        drawText(ctx, ln, x + 24, dy, "#cfcfdc", 12, "left");
        dy += 16;
      }
      // Location
      if (sp.locations && sp.locations.length > 0) {
        drawText(ctx, "Found:", x + 24, y + 296, "#ffe066", 11, "left");
        drawText(ctx, sp.locations.join(" · "), x + 72, y + 296, "#fff", 11, "left");
      }
      // Caught indicator
      if (caught) drawText(ctx, "● OWNED", x + w - 24, y + 24, "#5fae5f", 12, "right");
      else drawText(ctx, "○ SEEN", x + w - 24, y + 24, "#88c8ff", 12, "right");
    } else {
      drawText(ctx, "Unknown — encounter this Monstro in the wild!", x + w / 2, y + h / 2, "#aaa", 12, "center");
    }
    drawText(ctx, "↑ ↓ Browse · SPACE/ESC Back", x + w / 2, y + h - 14, "#b8b8d4", 11, "center");
  }

  /** Simple PC storage UI — vertical list of Party then Box, swap with SPACE. */
  function renderPcMenu(ctx: CanvasRenderingContext2D, s: GameRef, m: Menu) {
    dimBackground(ctx, 0.6);
    const w = 480;
    const h = 360;
    const x = (CANVAS_W - w) / 2;
    const y = (CANVAS_H - h) / 2 - 8;
    ctx.fillStyle = "rgba(20,20,40,0.97)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#ffe066";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    drawText(ctx, "STORAGE PC", x + w / 2, y + 22, "#ffe066", 16, "center");
    drawText(ctx, "[P] Party · [B] Box · SPACE to swap", x + w / 2, y + 42, "#88c8ff", 10, "center");

    const partyCount = (m.data?.partyCount as number) ?? s.save.party.length;
    const startY = y + 64;
    const rowH = 20;
    const visibleRows = Math.floor((h - 100) / rowH);
    const startIdx = Math.max(0, Math.min(m.selected - Math.floor(visibleRows / 2), Math.max(0, m.options.length - visibleRows)));
    for (let i = 0; i < visibleRows && startIdx + i < m.options.length; i++) {
      const realIdx = startIdx + i;
      const oy = startY + i * rowH;
      if (realIdx === m.selected) {
        ctx.fillStyle = "rgba(255,224,102,0.15)";
        ctx.fillRect(x + 14, oy - 2, w - 28, rowH);
        drawText(ctx, ">", x + 18, oy + 13, "#ffe066", 13, "left");
      }
      const label = m.options[realIdx];
      // Color party rows green, storage rows blue, divider grey, close white
      let color = "#fff";
      if (label.startsWith("[P]")) color = "#9fe0a0";
      else if (label.startsWith("[B]")) color = "#88c8ff";
      else if (label.startsWith("───")) color = "#7a7a7a";
      drawText(ctx, label, x + 34, oy + 13, color, 12, "left");
    }
    drawText(ctx, `Party ${partyCount}/6   Box ${s.save.storage.length}`, x + w / 2, y + h - 14, "#b8b8d4", 11, "center");
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
    // Player's active Monstro (back-view stand-in: flipped horizontally + a touch larger).
    // The trainer sprite was previously rendered here by mistake — this now shows the actual Monstro.
    const playerShake = b.playerShake > 0 ? Math.sin(b.playerShake * 30) * 4 : 0;
    const playerOffsetX = b.playerAnimX > 0 ? b.playerAnimX * 20 : 0;
    const playerSpecies = SPECIES[c.speciesId];
    drawSprite(ctx, playerSpecies.sprite, 20 + playerShake + playerOffsetX, CANVAS_H - 220, 3, true);

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
    drawBattleHpBox(ctx, 16, 16, enemySp.name, b.enemy.level, b.enemyHpShown, b.enemyMaxHp, false, b.enemy.status);
    // Player HP box (bottom-right of arena)
    drawBattleHpBox(ctx, CANVAS_W - 240, CANVAS_H - 200, SPECIES[c.speciesId].name, c.level, b.playerHpShown, c.maxHp, true, c.status);

    // Message / menu area
    if (s.menu && (s.menu.kind === "battleMain" || s.menu.kind === "battleFight" || s.menu.kind === "battleBag" || s.menu.kind === "battleSwitch")) {
      renderBattleMenu(ctx, s);
    } else {
      renderBattleMessage(ctx, b);
    }

    // Crit flash overlay (decays quickly)
    if (b.critFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${b.critFlash * 0.55})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    // Fade-in
    if (b.fadeIn > 0) {
      ctx.fillStyle = `rgba(0,0,0,${b.fadeIn})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  function drawBattleHpBox(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    name: string, level: number,
    hp: number, maxHp: number,
    showHpNum: boolean,
    status: StatusCondition = "ok"
  ) {
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
    // Status badge — small colored pill next to the name
    if (status && status !== "ok" && status !== "fainted") {
      const badge = statusBadge(status);
      const bx = x + 8;
      const by = y + h - 16;
      ctx.fillStyle = badge.color;
      ctx.fillRect(bx, by, 32, 14);
      ctx.strokeStyle = "#1a1326";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, 32, 14);
      drawText(ctx, badge.label, bx + 16, by + 10, "#fff", 9, "center");
    }
  }

  function statusBadge(status: StatusCondition): { label: string; color: string } {
    switch (status) {
      case "psn": return { label: "PSN", color: "#9a4ad8" };
      case "brn": return { label: "BRN", color: "#ff6b35" };
      case "par": return { label: "PAR", color: "#c8a020" };
      case "slp": return { label: "SLP", color: "#7080a8" };
      default:    return { label: "", color: "#000" };
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
    // Continue indicator when text is fully shown
    if (b.messageProgress >= b.message.length) {
      const blink = Math.floor(Date.now() / 400) % 2 === 0;
      if (blink) {
        ctx.fillStyle = "#ffe066";
        ctx.beginPath();
        ctx.moveTo(CANVAS_W - 28, boxY + 64);
        ctx.lineTo(CANVAS_W - 18, boxY + 64);
        ctx.lineTo(CANVAS_W - 23, boxY + 72);
        ctx.closePath();
        ctx.fill();
      }
      drawText(ctx, "[SPACE] next", CANVAS_W - 110, boxY + 70, "#b8b8d4", 10, "left");
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
        // PP color: red when 0, yellow at <=25%, white otherwise
        const slot = c.moves[i];
        let nameColor = "#fff";
        if (slot) {
          if (slot.pp <= 0) nameColor = "#ff6b6b";
          else if (slot.pp <= Math.ceil(slot.maxPp / 4)) nameColor = "#ffd040";
        }
        drawText(ctx, m.options[i], x + 16, y + 2, nameColor, 14, "left");
      }
      // Move detail card on right
      const sel = c.moves[m.selected];
      if (sel) {
        const mv = MOVES[sel.moveId];
        // Type pill
        ctx.fillStyle = TYPE_COLORS[mv.type];
        ctx.fillRect(CANVAS_W - 100, boxY - 28, 92, 24);
        ctx.strokeStyle = "#1a1326";
        ctx.lineWidth = 2;
        ctx.strokeRect(CANVAS_W - 100, boxY - 28, 92, 24);
        drawText(ctx, mv.type.toUpperCase(), CANVAS_W - 54, boxY - 12, "#1a1326", 11, "center");
        // PP / power / accuracy line above the menu box
        const pwr = mv.power > 0 ? `PWR ${mv.power}` : "STATUS";
        drawText(ctx, `${pwr}  ACC ${mv.accuracy}%  PP ${sel.pp}/${sel.maxPp}`, CANVAS_W - 8, boxY - 38, "#fff", 11, "right");
        // Type-effectiveness preview vs current enemy
        if (s.battle.enemy && mv.power > 0) {
          const def = SPECIES[s.battle.enemy.speciesId];
          const eff = effectiveness(mv.type, def.types);
          let effText = "";
          let effColor = "#b8b8d4";
          if (eff === 0) { effText = "NO EFFECT"; effColor = "#888"; }
          else if (eff >= 2) { effText = "SUPER EFFECTIVE x" + eff; effColor = "#5fae5f"; }
          else if (eff > 0 && eff < 1) { effText = "RESISTED x" + eff; effColor = "#ff6b6b"; }
          if (effText) drawText(ctx, effText, CANVAS_W - 8, boxY - 54, effColor, 10, "right");
        }
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
      // Catch chance hint when capsule highlighted
      if (m.selected === 0 && s.battle.enemy) {
        const e = s.battle.enemy;
        const sp = SPECIES[e.speciesId];
        const hpFactor = (3 * e.maxHp - 2 * e.currentHp) / (3 * e.maxHp);
        const chance = Math.max(0.01, Math.min(0.99, (hpFactor * sp.catchRate) / 255));
        const pct = Math.round(chance * 100);
        let color = "#ff6b6b";
        if (pct >= 60) color = "#5fae5f";
        else if (pct >= 30) color = "#ffd040";
        drawText(ctx, `~${pct}% catch chance (lower HP = easier!)`, CANVAS_W - 24, boxY - 12, color, 11, "right");
      }
    } else if (m.kind === "battleSwitch") {
      drawText(ctx, "Choose a Monstro to send out:", 16, boxY + 4, "#ffe066", 11, "left");
      for (let i = 0; i < m.options.length; i++) {
        const x = 24;
        const y = boxY + 22 + i * 18;
        if (i === m.selected) {
          ctx.fillStyle = "rgba(255,224,102,0.2)";
          ctx.fillRect(x - 6, y - 12, CANVAS_W - 48, 18);
          drawText(ctx, ">", x - 6, y, "#ffe066", 13, "left");
        }
        // Grey out fainted / active
        const party = s.save.party[i];
        let color = "#fff";
        if (party && party.currentHp <= 0) color = "#7a7a7a";
        else if (party && s.battle.activeIdx === i) color = "#88c8ff";
        drawText(ctx, m.options[i], x + 16, y, color, 12, "left");
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

  function handleLogout() {
    const ok = window.confirm("Save and log out? Your progress is autosaved.");
    if (!ok) return;
    doSave(false);
    onLogout();
  }

  return (
    <div className="game-wrapper">
      <div className="game-toolbar">
        <span className="toolbar-btn" style={{ cursor: "default" }}>
          {displayName}{isGuest(username) ? " (Guest)" : ""}
        </span>
        <span className="toolbar-btn" style={{ cursor: "default", color: "#ffd040" }} title="Spend at Marts to buy items">
          ⛁ {coins}
        </span>
        {hasBadge && (
          <span className="toolbar-btn" style={{ cursor: "default", color: "#d4cec0" }} title="Stone Badge — Cave Warden Brak">
            ◇ Stone
          </span>
        )}
        {hasFlame && (
          <span className="toolbar-btn" style={{ cursor: "default", color: "#ff8a3c" }} title="Flame Badge — Volcano Sage Magma">
            ◇ Flame
          </span>
        )}
        {hasFrost && (
          <span className="toolbar-btn" style={{ cursor: "default", color: "#88c8ff" }} title="Frost Badge — Elder Yuki">
            ◇ Frost
          </span>
        )}
        <button className="toolbar-btn" onClick={() => doSave(true)} title="Save game (or press ESC > SAVE)">
          {savedFlash ? "✓ Saved" : (lastSavedLabel ? `Save (${lastSavedLabel})` : "Save")}
        </button>
        <button className="toolbar-btn" onClick={handleLogout} title="Save and return to title">Logout</button>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="game-canvas"
        style={{ width: "min(96vw, 960px)", height: "auto" }}
      />
      <div className="hint">{hint}</div>
      <div className="touch-controls" aria-label="Touch controls">
        {/* D-pad on the left */}
        <div className="dpad" role="group" aria-label="Directional pad">
          <TouchButton className="dpad-btn dpad-up" label="▲" ariaLabel="Up" k="up" press={pressKey} release={releaseKey} />
          <TouchButton className="dpad-btn dpad-down" label="▼" ariaLabel="Down" k="down" press={pressKey} release={releaseKey} />
          <TouchButton className="dpad-btn dpad-left" label="◀" ariaLabel="Left" k="left" press={pressKey} release={releaseKey} />
          <TouchButton className="dpad-btn dpad-right" label="▶" ariaLabel="Right" k="right" press={pressKey} release={releaseKey} />
          <div className="dpad-center" aria-hidden="true" />
        </div>
        {/* Middle: Menu + Run pills */}
        <div className="touch-middle">
          <TouchButton className="action-btn muted" label="MENU" ariaLabel="Open menu" k="menu" press={pressKey} release={releaseKey} oneShot />
          <TouchButton className="action-btn muted" label="RUN" ariaLabel="Hold to run" k="run" press={pressKey} release={releaseKey} />
        </div>
        {/* Action cluster on the right: A (confirm) + B (cancel) */}
        <div className="action-cluster">
          <div className="action-row">
            <TouchButton className="action-btn secondary" label="B" ariaLabel="Cancel" k="cancel" press={pressKey} release={releaseKey} />
            <TouchButton className="action-btn primary" label="A" ariaLabel="Confirm / Talk" k="confirm" press={pressKey} release={releaseKey} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A single touch button that emits a "key press" on pointer-down and a release
 * on pointer-up/leave/cancel. Works equally well for mouse and touch input.
 * `oneShot` releases immediately after press (used for menu-toggle buttons).
 */
function TouchButton({
  className, label, ariaLabel, k, press, release, oneShot,
}: {
  className: string;
  label: string;
  ariaLabel: string;
  k: string;
  press: (k: string) => void;
  release: (k: string) => void;
  oneShot?: boolean;
}) {
  const isDownRef = useRef(false);
  function onDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (isDownRef.current) return;
    isDownRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    press(k);
    if (oneShot) {
      // Release on the next animation frame so the press is observed at least once.
      requestAnimationFrame(() => release(k));
    }
  }
  function onUp(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (!isDownRef.current) return;
    isDownRef.current = false;
    release(k);
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
