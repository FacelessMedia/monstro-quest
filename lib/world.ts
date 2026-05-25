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

export type TileType = "G" | "T" | "X" | "W" | "P" | "S" | "B" | "D" | "N" | "I" | "H" | "F";

export const BLOCKED_TILES: Set<TileType> = new Set(["X", "W", "B", "N", "I"]);

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
};

export type NpcDef = {
  x: number;
  y: number;
  spriteKey: "mentor" | "clerk" | "trainer";
  dialogue: string[];
  // optional: starter giver
  givesStarter?: boolean;
  flagAfter?: string;           // sets this flag once dialogue ends
  requiresFlag?: string;        // only shown if this flag is missing
  altDialogue?: string[];       // shown when requiresFlag is already set
  shop?: ItemId[];              // opens a mart after greeting
  trainer?: TrainerDef;         // triggers a trainer battle
  pc?: boolean;                 // opens the PC storage UI after greeting
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
    { x: 8, y: 14, toMap: "route1", toX: 8, toY: 1 },
    { x: 9, y: 14, toMap: "route1", toX: 9, toY: 1 },
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
    { x: 8, y: 0, toMap: "hearthwick", toX: 8, toY: 13 },
    { x: 9, y: 0, toMap: "hearthwick", toX: 9, toY: 13 },
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
    // === Trainer: Bug Catcher Tim ===
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
    "XGGWWWWWPPWWWWWWGGGX",
    "XGGWWWWWPPWWWWWWGGGX",
    "XGGGWWWWPPWWWWWGGGGX",
    "XGGGGWWWPPWWWWGGGGGX",
    "XXXXXXXXXXXXXXXXXXXX",
  ],
  encounters: [],
  portals: [
    { x: 8, y: 0, toMap: "route1", toX: 8, toY: 13 },
    { x: 9, y: 0, toMap: "route1", toX: 9, toY: 13 },
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
    // === Trainer: Coastal Rival Mara — tougher fight ===
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

export const MAPS: Record<string, GameMap> = {
  hearthwick,
  route1,
  lumencove,
};

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
