import type { ItemId } from "./items";

// Tilemap & world definitions.
// Tile codes:
//  G = grass (walkable)
//  T = tall grass (walkable, encounters)
//  X = tree / wall (blocked)
//  W = water (blocked)
//  P = path (walkable)
//  S = sand (walkable)
//  B = building wall (blocked)
//  D = door / map exit (walkable trigger)
//  N = NPC (blocked, interact)
//  I = sign (blocked, interact)
//  H = healing pad (walkable, full heal trigger)
//  F = catcher ball pickup (walkable, gives item)

export type TileType = "G" | "T" | "X" | "W" | "P" | "S" | "B" | "D" | "N" | "I" | "H" | "F" | "C";

// Note: F (field item) is walkable until picked up; the pickup logic handles consumption.
// C (cuttable tree) is blocked until the player uses a Cut Stone on it.
export const BLOCKED_TILES: Set<TileType> = new Set(["X", "W", "B", "N", "I", "C"]);

export type Encounter = { speciesId: string; minLevel: number; maxLevel: number; weight: number };

export type MapPortal = {
  x: number;
  y: number;
  toMap: string;
  toX: number;
  toY: number;
};

export type TrainerDef = {
  name: string;            // displayed name e.g. "Trainer Avery"
  party: { speciesId: string; level: number }[]; // their roster
  intro: string[];         // pre-battle taunts
  victory: string[];       // post-loss lines (when player wins)
  prize: number;           // coin reward on full defeat
  flag: string;            // save flag set once defeated (prevents re-battle)
  /** Tiles forward the trainer can see. When the player enters this LOS, the trainer auto-challenges. */
  visionRange?: number;
  /** Direction the trainer is "looking" — used by line-of-sight detection. Defaults to "down". */
  facing?: "up" | "down" | "left" | "right";
  /** True if this is a gym-leader-tier boss; enables smart AI + potion usage and grants a badge. */
  gymLeader?: boolean;
  /** How many full-restore charges the trainer can spend on their active Monstro when its HP is low. */
  potionCharges?: number;
  /** Bonus item to grant on defeat (e.g. stone_badge, cut_stone). */
  rewardItem?: ItemId;
};

export type NpcDef = {
  x: number;
  y: number;
  spriteKey: "mentor" | "clerk" | "trainer" | "picnicker" | "fisher" | "gymleader";
  dialogue: string[];
  // optional: starter giver
  givesStarter?: boolean;
  flagAfter?: string;           // sets this flag once dialogue ends
  requiresFlag?: string;        // only shown if this flag is missing
  altDialogue?: string[];       // shown when requiresFlag is already set
  shop?: ItemId[];              // opens a mart after greeting
  trainer?: TrainerDef;         // triggers a trainer battle
  pc?: boolean;                 // opens the PC storage UI after greeting
  /** If set, talking to this NPC grants this item once and sets the flag. */
  givesItem?: { itemId: ItemId; qty: number; flag: string };
};

/** A hidden field-item tile (F). Picking it up sets the flag so it doesn't respawn. */
export type FieldItem = {
  x: number;
  y: number;
  itemId: ItemId;
  qty: number;
  flag: string;
};

export type SignDef = { x: number; y: number; text: string[] };

export type GameMap = {
  id: string;
  name: string;
  tiles: string[]; // rows of single-char tile codes
  encounters: Encounter[];
  portals: MapPortal[];
  npcs: NpcDef[];
  signs: SignDef[];
  fieldItems?: FieldItem[];
  /** Dark-cave map — render with a vignette. */
  dark?: boolean;
  music?: string;
};

// ============ HEARTHWICK TOWN (starter) ============
const hearthwick: GameMap = {
  id: "hearthwick",
  name: "Hearthwick Town",
  tiles: [
    "XXXXXXXXXXXXXXXXXXXX",
    "XGGGGGGGGGGGGGGGGGGX",
    "XGBBBBGGGGGGGGBBBBGX",
    "XGBBBBGGIGGGGGGBBBGX",
    "XGBBDBGGGGGGGGGBDBGX",
    "XGGGGGGGGGGGGGGGGGGX",
    "XGGGGGGPPPPGGGGGGGGX",
    "XGGGGGGGPPGGGNGGGGGX",
    "XGGNGGGGPPGGGGGGGGGX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGGGGGPPGGGGGIGGGX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XXXXXXXXPPXXXXXXXXXX",
  ],
  encounters: [],
  portals: [
    { x: 8, y: 14, toMap: "whisperwood", toX: 8, toY: 1 },
    { x: 9, y: 14, toMap: "whisperwood", toX: 9, toY: 1 },
  ],
  npcs: [
    // Professor Cedar — gives the starter
    {
      x: 13,
      y: 7,
      spriteKey: "mentor",
      givesStarter: true,
      dialogue: [
        "Welcome, traveler!",
        "I am Professor Cedar.",
        "The wild Monstro of the Verdant Wilds grow fiercer by the day.",
        "Please, choose a partner!",
      ],
      altDialogue: [
        "May your bond with your partner grow ever stronger.",
        "Tall grass shelters many wild Monstro. Be ready!",
      ],
      flagAfter: "hasStarter",
    },
    // Hearthwick Mart clerk — standing outside the left building
    {
      x: 3,
      y: 8,
      spriteKey: "clerk",
      dialogue: [
        "Welcome to Hearthwick Mart!",
        "Stock up on capsules and potions before you head out.",
      ],
      shop: ["capsule", "greater_capsule", "potion", "super_potion", "revive"],
    },
  ],
  signs: [
    {
      x: 8,
      y: 3,
      text: [
        "HEARTHWICK TOWN",
        "Where every great journey begins.",
      ],
    },
    {
      x: 15,
      y: 11,
      text: [
        "TIP: Press ESC to open the menu.",
        "From there you can SAVE, view your PARTY, BAG, or the WORLD MAP.",
      ],
    },
  ],
};

// ============ ROUTE 1 ============
const route1: GameMap = {
  id: "route1",
  name: "Verdant Wilds — Route 1",
  tiles: [
    "XXXXXXXXPPXXXXXXXXXX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGTTGGPPGGTTTTGGGX",
    "XGTTTTTGPPGTTTTTTGGX",
    "XGTTTTGGPPGTTTTTTGGX",
    "XGTTGGGGPPGTTTGGGGGX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGXXXXPPXXXXGGGGGX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGGTTTPPTTTGGGGGGX",
    "XGGGTTTTPPTTTTGGGGGX",
    "XGGGTTGGPPGGTTGGNGGX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGNGGGPPGGGGGGGGGX",
    "XXXXXXXXPPXXXXXXXXXX",
  ],
  encounters: [
    { speciesId: "buzzbee", minLevel: 2, maxLevel: 4, weight: 40 },
    { speciesId: "boltkit", minLevel: 2, maxLevel: 5, weight: 20 },
    { speciesId: "spinifin", minLevel: 2, maxLevel: 4, weight: 15 },
    { speciesId: "wisplet", minLevel: 3, maxLevel: 5, weight: 10 },
    { speciesId: "rockle", minLevel: 3, maxLevel: 5, weight: 10 },
    { speciesId: "goolet", minLevel: 3, maxLevel: 6, weight: 5 },
  ],
  portals: [
    { x: 8, y: 0, toMap: "whisperwood", toX: 8, toY: 13 },
    { x: 9, y: 0, toMap: "whisperwood", toX: 9, toY: 13 },
    { x: 8, y: 14, toMap: "lumencove", toX: 8, toY: 1 },
    { x: 9, y: 14, toMap: "lumencove", toX: 9, toY: 1 },
  ],
  npcs: [
    {
      x: 16,
      y: 11,
      spriteKey: "mentor",
      dialogue: [
        "Adventurer! Catch your foes when their HP is low.",
        "Press B during a battle to throw a Catch Capsule.",
      ],
    },
    // === Trainer: Bug Catcher Tim — sees 3 tiles to his RIGHT ===
    {
      x: 4,
      y: 12,
      spriteKey: "trainer",
      dialogue: ["Hey! I saw you eyeing me!", "Bug Catcher Tim challenges you!"],
      altDialogue: ["My Buzzbee swarm needs more training..."],
      trainer: {
        name: "Bug Catcher Tim",
        intro: ["Hey! I saw you eyeing me!", "Bug Catcher Tim challenges you!"],
        victory: ["Hmph!", "My Buzzbees still have a lot to learn."],
        prize: 240,
        flag: "trainerTimDefeated",
        visionRange: 3,
        facing: "right",
        party: [
          { speciesId: "buzzbee", level: 5 },
          { speciesId: "buzzbee", level: 6 },
        ],
      },
    },
  ],
  signs: [],
};

// ============ LUMENCOVE TOWN ============
const lumencove: GameMap = {
  id: "lumencove",
  name: "Lumencove Town",
  tiles: [
    "XXXXXXXXPPXXXXXXXXXX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGGGGGPPIGGGGGGGGX",
    "XGBBBBGGPPGGBBBBGGGX",
    "XGBBBBGGPPGGBHHBGGGX",
    "XGBBDBGGPPGGBBDBGGGX",
    "XGGGGGGGPPGNGGGGGGGX",
    "XGGNGGGGPPGGGGGGGNGX",
    "XGGGGGGGPPGGGGNGGGGX",
    "XGGGWWWGPPGWWWGGGGGX",
    "XGGWWWWWSSWWWWWWGGGX",
    "XGGWWWWWSSWWWWWWGGGX",
    "XGGGWWWWSSWWWWWGGGGX",
    "XGGGGWWWSSWWWWGGGGGX",
    "XXXXXXXXSSXXXXXXXXXX",
  ],
  encounters: [],
  portals: [
    { x: 8, y: 0, toMap: "route1", toX: 8, toY: 13 },
    { x: 9, y: 0, toMap: "route1", toX: 9, toY: 13 },
    { x: 8, y: 14, toMap: "sunshore", toX: 8, toY: 1 },
    { x: 9, y: 14, toMap: "sunshore", toX: 9, toY: 1 },
  ],
  npcs: [
    // Healer info NPC near the pink building
    {
      x: 14,
      y: 8,
      spriteKey: "mentor",
      dialogue: [
        "Welcome to Lumencove!",
        "The pink building heals your Monstro fully.",
        "Step on the glowing pad to restore your team.",
      ],
    },
    // Lumencove Mart clerk (sells higher-tier gear)
    {
      x: 3,
      y: 7,
      spriteKey: "clerk",
      dialogue: [
        "Lumencove Mart at your service!",
        "We stock advanced capsules for tougher Monstro.",
      ],
      shop: ["capsule", "greater_capsule", "ultra_capsule", "super_potion", "revive", "repel"],
    },
    // === Trainer: Coastal Rival Mara — tougher fight, sees 3 down ===
    {
      x: 11,
      y: 6,
      spriteKey: "trainer",
      dialogue: ["A new face! Care for a battle?", "I'm Mara, and I won't go easy on you!"],
      altDialogue: ["You really know your Monstro. Train hard!"],
      trainer: {
        name: "Coastal Rival Mara",
        intro: ["A new face! Care for a battle?", "I'm Mara, and I won't go easy on you!"],
        victory: ["Whoa — you're really good!", "Take this — and keep training!"],
        prize: 600,
        flag: "trainerMaraDefeated",
        visionRange: 3,
        facing: "down",
        party: [
          { speciesId: "spinifin", level: 11 },
          { speciesId: "aquadrip", level: 13 },
        ],
      },
    },
    // === PC Attendant — opens storage box ===
    {
      x: 17,
      y: 7,
      spriteKey: "clerk",
      dialogue: [
        "Welcome to the Lumencove PC!",
        "I'll connect you to your Monstro storage.",
      ],
      pc: true,
    },
  ],
  signs: [
    {
      x: 10,
      y: 2,
      text: [
        "LUMENCOVE TOWN",
        "A coastal village known for its healing waters.",
      ],
    },
  ],
};

// ============ WHISPERWOOD FOREST (between Hearthwick and Route 1) ============
const whisperwood: GameMap = {
  id: "whisperwood",
  name: "Whisperwood Forest",
  tiles: [
    "XXXXXXXXPPXXXXXXXXXX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGTTTGGGPPGGGTTTGGGX",
    "XGTTTGGGPPGGGTTTGGGX",
    "XGTTGGGGNGGGGGGGTGGX",
    "XGGGGGGGGGGGGGGGGGGX",
    "XGGGGGGGGGGGGGGGGGGX",
    "XGGGGGGGGGGGGGGGCGGX",
    "XGGNGGGTTTTTGGXFGGGX",
    "XGGGGGGGTTTTTGGXXGGX",
    "XGGTTGGGGGGGGGGXXGGX",
    "XGTTTTGGGGGGGGGGGGGX",
    "XGTTTTGGGGGGGGGNGGGX",
    "XGGGGGGGGGGGGGGGGGGX",
    "XXXXXXXXPPXXXXXXXXXX",
  ],
  encounters: [
    { speciesId: "shroomie", minLevel: 3, maxLevel: 6, weight: 35 },
    { speciesId: "mossbun", minLevel: 3, maxLevel: 6, weight: 25 },
    { speciesId: "buzzbee", minLevel: 3, maxLevel: 5, weight: 15 },
    { speciesId: "goolet", minLevel: 3, maxLevel: 5, weight: 10 },
    { speciesId: "sprigling", minLevel: 4, maxLevel: 6, weight: 10 },
    { speciesId: "wisplet", minLevel: 4, maxLevel: 6, weight: 5 },
  ],
  portals: [
    { x: 8, y: 0, toMap: "hearthwick", toX: 8, toY: 13 },
    { x: 9, y: 0, toMap: "hearthwick", toX: 9, toY: 13 },
    { x: 8, y: 14, toMap: "route1", toX: 8, toY: 1 },
    { x: 9, y: 14, toMap: "route1", toX: 9, toY: 1 },
  ],
  npcs: [
    // === Cut Tutor — gives the Cut Stone (one-time) ===
    {
      x: 7,
      y: 4,
      spriteKey: "mentor",
      dialogue: [
        "Ho there, traveler!",
        "These pink-leafed trees only fall to a special stone...",
        "Here — take my Cut Stone. Use it on those odd trees!",
      ],
      altDialogue: [
        "May the Cut Stone serve you well!",
        "I hear those caves to the south hold even older trees...",
      ],
      givesItem: { itemId: "cut_stone", qty: 1, flag: "gotCutStone" },
      flagAfter: "gotCutStone",
    },
    // === Trainer: Picnicker Lily — sees 4 tiles RIGHT ===
    {
      x: 3,
      y: 8,
      spriteKey: "picnicker",
      dialogue: ["Hey hey! Want to share some berries — or some battles?"],
      altDialogue: ["This forest is so peaceful... mostly!"],
      trainer: {
        name: "Picnicker Lily",
        intro: ["Hey hey! Want to share some berries — or some battles?", "Picnicker Lily challenges you!"],
        victory: ["Aww! You were really strong!"],
        prize: 320,
        flag: "trainerLilyDefeated",
        visionRange: 4,
        facing: "right",
        party: [
          { speciesId: "mossbun", level: 6 },
          { speciesId: "shroomie", level: 7 },
        ],
      },
    },
    // === Trainer: Camper Bo — sees 5 tiles LEFT ===
    {
      x: 15,
      y: 12,
      spriteKey: "trainer",
      dialogue: ["Roughin' it in the woods! Ready for a scrap?"],
      altDialogue: ["The campfire calls me back to its warmth."],
      trainer: {
        name: "Camper Bo",
        intro: ["Roughin' it in the woods! Ready for a scrap?", "Camper Bo wants to battle!"],
        victory: ["Whew! Nice technique!"],
        prize: 400,
        flag: "trainerBoDefeated",
        visionRange: 5,
        facing: "left",
        party: [
          { speciesId: "boltkit", level: 8 },
          { speciesId: "buzzbee", level: 8 },
          { speciesId: "rockle", level: 9 },
        ],
      },
    },
  ],
  signs: [],
  fieldItems: [
    { x: 15, y: 8, itemId: "super_potion", qty: 1, flag: "fieldItem:whisperwood:15:8" },
  ],
};

// ============ SUNSHORE CAVES (south of Lumencove — gym leader's lair) ============
const sunshore: GameMap = {
  id: "sunshore",
  name: "Sunshore Caves",
  tiles: [
    "XXXXXXXXPPXXXXXXXXXX",
    "XBBBBBBBPPBBBBBBBBBX",
    "XBGGGGGGPPGGGGGGGGBX",
    "XBGGGGGGGGGGGGGGGGBX",
    "XBGTTGGGGGGGGGGTTGBX",
    "XBGTTGGGGGGGGGGTTGBX",
    "XBGGGGGGGGGGGGGGGGBX",
    "XBXXXXXXXXCCXXXXXXBX",
    "XBGGGGGGGGGGGGNGGGBX",
    "XBGTTGGGGGGGGGGTTGBX",
    "XBGTTGGGGGGGGGGTTGBX",
    "XBGGGGGGGGGGGGGGGGBX",
    "XBGGGGGGGGGNGGGGGGBX",
    "XBBBBBBBBBBBBBBBBBBX",
    "XXXXXXXXXXXXXXXXXXXX",
  ],
  encounters: [
    { speciesId: "stonepup", minLevel: 7, maxLevel: 11, weight: 35 },
    { speciesId: "batling", minLevel: 7, maxLevel: 11, weight: 25 },
    { speciesId: "rockle", minLevel: 8, maxLevel: 12, weight: 15 },
    { speciesId: "wisplet", minLevel: 7, maxLevel: 10, weight: 10 },
    { speciesId: "goolet", minLevel: 8, maxLevel: 11, weight: 10 },
    { speciesId: "luminox", minLevel: 12, maxLevel: 14, weight: 5 },
  ],
  portals: [
    { x: 8, y: 0, toMap: "lumencove", toX: 8, toY: 13 },
    { x: 9, y: 0, toMap: "lumencove", toX: 9, toY: 13 },
  ],
  dark: true,
  npcs: [
    // === Trainer: Fisher Cody — sees 4 tiles LEFT ===
    {
      x: 13,
      y: 8,
      spriteKey: "fisher",
      dialogue: ["Reel 'em in! These caves are full of fish-like Monstro!"],
      altDialogue: ["Wish my line had snagged that Aquaflow..."],
      trainer: {
        name: "Fisher Cody",
        intro: ["Reel 'em in! These caves are full of fish-like Monstro!", "Fisher Cody challenges you!"],
        victory: ["My lures will get you next time!"],
        prize: 480,
        flag: "trainerCodyDefeated",
        visionRange: 4,
        facing: "left",
        party: [
          { speciesId: "spinifin", level: 10 },
          { speciesId: "spinifin", level: 12 },
        ],
      },
    },
    // === Gym Leader: Cave Warden Brak — boss, smart AI, awards Stone Badge ===
    {
      x: 10,
      y: 12,
      spriteKey: "gymleader",
      dialogue: ["So... a new challenger reaches my cavern."],
      altDialogue: [
        "You wear the Stone Badge well, traveler.",
        "Use what you've earned — and seek the lands beyond.",
      ],
      trainer: {
        name: "Cave Warden Brak",
        intro: [
          "So... a new challenger reaches my cavern.",
          "I am Cave Warden Brak — keeper of these stones.",
          "If you wish to pass, you must prove your worth!",
        ],
        victory: [
          "Hmph! Your bond with your Monstro is strong.",
          "You've earned the STONE BADGE!",
        ],
        prize: 1500,
        flag: "gymBrakDefeated",
        visionRange: 0, // boss must be talked to (no LOS)
        facing: "up",
        gymLeader: true,
        potionCharges: 2, // can heal twice during the battle
        rewardItem: "stone_badge",
        party: [
          { speciesId: "stonepup", level: 14 },
          { speciesId: "batling", level: 14 },
          { speciesId: "rockle", level: 16 },
          { speciesId: "rocksire", level: 20 },
        ],
      },
    },
  ],
  signs: [],
  fieldItems: [
    { x: 17, y: 4, itemId: "ether", qty: 1, flag: "fieldItem:sunshore:17:4" },
    { x: 17, y: 5, itemId: "ultra_capsule", qty: 1, flag: "fieldItem:sunshore:17:5" },
  ],
};

export const MAPS: Record<string, GameMap> = {
  hearthwick,
  whisperwood,
  route1,
  lumencove,
  sunshore,
};

export function findFieldItem(map: GameMap, x: number, y: number): FieldItem | null {
  return map.fieldItems?.find((f) => f.x === x && f.y === y) || null;
}

/**
 * Build the set of tiles a trainer "sees" in front of them.
 * Used for line-of-sight forced-encounter detection.
 */
export function trainerLineOfSight(npc: NpcDef): { x: number; y: number }[] {
  if (!npc.trainer || !npc.trainer.visionRange || npc.trainer.visionRange <= 0) return [];
  const facing = npc.trainer.facing ?? "down";
  const dx = facing === "left" ? -1 : facing === "right" ? 1 : 0;
  const dy = facing === "up" ? -1 : facing === "down" ? 1 : 0;
  const out: { x: number; y: number }[] = [];
  for (let i = 1; i <= npc.trainer.visionRange; i++) {
    out.push({ x: npc.x + dx * i, y: npc.y + dy * i });
  }
  return out;
}

export function getTile(map: GameMap, x: number, y: number): TileType | null {
  if (y < 0 || y >= map.tiles.length) return null;
  const row = map.tiles[y];
  if (x < 0 || x >= row.length) return null;
  return row[x] as TileType;
}

export function isBlocked(map: GameMap, x: number, y: number): boolean {
  const t = getTile(map, x, y);
  if (t === null) return true;
  if (BLOCKED_TILES.has(t)) return true;
  // NPC tiles are blocked
  if (map.npcs.some((n) => n.x === x && n.y === y)) return true;
  return false;
}

export function findPortal(map: GameMap, x: number, y: number): MapPortal | null {
  return map.portals.find((p) => p.x === x && p.y === y) || null;
}

export function findNpc(map: GameMap, x: number, y: number): NpcDef | null {
  return map.npcs.find((n) => n.x === x && n.y === y) || null;
}

export function findSign(map: GameMap, x: number, y: number): SignDef | null {
  return map.signs.find((s) => s.x === x && s.y === y) || null;
}

export function rollEncounter(map: GameMap): { speciesId: string; level: number } | null {
  if (map.encounters.length === 0) return null;
  // 20% chance to trigger
  if (Math.random() > 0.18) return null;
  const total = map.encounters.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const enc of map.encounters) {
    r -= enc.weight;
    if (r <= 0) {
      const level = enc.minLevel + Math.floor(Math.random() * (enc.maxLevel - enc.minLevel + 1));
      return { speciesId: enc.speciesId, level };
    }
  }
  return null;
}
