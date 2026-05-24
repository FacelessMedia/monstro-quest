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

export type NpcDef = {
  x: number;
  y: number;
  spriteKey: "mentor";
  dialogue: string[];
  // optional: starter giver
  givesStarter?: boolean;
  // optional: trainer battle
  // trainer?: { creatures: { speciesId: string; level: number }[]; intro: string; victory: string };
  flagAfter?: string; // sets this flag once dialogue ends
  requiresFlag?: string; // only shown if this flag is missing (i.e. not done)
  altDialogue?: string[]; // shown when requiresFlag is already set
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
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGGGGGPPGGGGGGGGGX",
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
    "XGGGGGGGPPGGGGGGGGGX",
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
    "XGGGGGGGPPGGGGGGGGGX",
    "XGBBBBGGPPGGBBBBGGGX",
    "XGBBBBGGPPGGBHHBGGGX",
    "XGBBDBGGPPGGBBDBGGGX",
    "XGGGGGGGPPGGGGGGGGGX",
    "XGGGGGGGPPGGGGGGGGGX",
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
  ],
  signs: [],
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
