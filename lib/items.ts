// ============================================================================
// Items registry — describes every item the player can hold, buy, or use.
// Bag inventory is stored on save.bag as a count keyed by ItemId.
// ============================================================================

export type ItemId =
  | "capsule"
  | "greater_capsule"
  | "ultra_capsule"
  | "potion"
  | "super_potion"
  | "revive"
  | "repel"
  | "antidote"
  | "burn_heal"
  | "paralyse_heal"
  | "awakening"
  | "escape_rope"
  | "ether"
  | "stone_badge"
  | "cut_stone"
  | "flame_badge"
  | "frost_badge";

export type ItemCategory = "capture" | "heal" | "revive" | "key" | "field" | "status" | "pp";

export type Item = {
  id: ItemId;
  name: string;
  short: string;       // short label used in compact lists
  category: ItemCategory;
  price: number;       // purchase price in coins (0 = unsellable / not for sale)
  sellPrice: number;   // sell-back price
  description: string; // shown in shop / bag
  // Effects (used by Game logic):
  catchMultiplier?: number;      // for capture items, multiplies catch chance
  healAmount?: number;           // for heal items, HP restored
  reviveFactor?: number;         // for revive items, fraction of maxHp restored
  curesStatus?: "psn" | "brn" | "par" | "slp" | "any"; // status the item cures
  ppRestore?: number;            // PP restored to all moves of selected creature
  battleUseOnly?: boolean;
  /** Hidden from shop lists (key items, badges). */
  keyItem?: boolean;
};

export const ITEMS: Record<ItemId, Item> = {
  capsule: {
    id: "capsule",
    name: "Catch Capsule",
    short: "Capsule",
    category: "capture",
    price: 200,
    sellPrice: 100,
    description: "A starter capture sphere. Toss it at a weakened wild Monstro to attempt a catch.",
    catchMultiplier: 1,
  },
  greater_capsule: {
    id: "greater_capsule",
    name: "Greater Capsule",
    short: "Greater Cap",
    category: "capture",
    price: 600,
    sellPrice: 300,
    description: "An improved sphere. Catches 1.5× more reliably than a Catch Capsule.",
    catchMultiplier: 1.5,
  },
  ultra_capsule: {
    id: "ultra_capsule",
    name: "Ultra Capsule",
    short: "Ultra Cap",
    category: "capture",
    price: 1200,
    sellPrice: 600,
    description: "Top-tier sphere. Doubles the catch rate. Use on tough rare Monstro.",
    catchMultiplier: 2,
  },
  potion: {
    id: "potion",
    name: "Potion",
    short: "Potion",
    category: "heal",
    price: 150,
    sellPrice: 75,
    description: "Restores 30 HP to a single Monstro.",
    healAmount: 30,
  },
  super_potion: {
    id: "super_potion",
    name: "Super Potion",
    short: "Super Pot",
    category: "heal",
    price: 400,
    sellPrice: 200,
    description: "Restores 80 HP to a single Monstro.",
    healAmount: 80,
  },
  revive: {
    id: "revive",
    name: "Revive",
    short: "Revive",
    category: "revive",
    price: 800,
    sellPrice: 400,
    description: "Revives a fainted Monstro with half its max HP.",
    reviveFactor: 0.5,
  },
  repel: {
    id: "repel",
    name: "Repel",
    short: "Repel",
    category: "field",
    price: 350,
    sellPrice: 175,
    description: "Wards off weak wild Monstro for 100 steps when used in the field.",
  },
  antidote: {
    id: "antidote",
    name: "Antidote",
    short: "Antidote",
    category: "status",
    price: 100,
    sellPrice: 50,
    description: "Cures one Monstro of poison. Use in or out of battle.",
    curesStatus: "psn",
  },
  burn_heal: {
    id: "burn_heal",
    name: "Burn Heal",
    short: "BrnHeal",
    category: "status",
    price: 250,
    sellPrice: 125,
    description: "Cures one Monstro of a burn.",
    curesStatus: "brn",
  },
  paralyse_heal: {
    id: "paralyse_heal",
    name: "Paralyse Heal",
    short: "ParHeal",
    category: "status",
    price: 200,
    sellPrice: 100,
    description: "Cures one Monstro of paralysis.",
    curesStatus: "par",
  },
  awakening: {
    id: "awakening",
    name: "Awakening",
    short: "Wake",
    category: "status",
    price: 250,
    sellPrice: 125,
    description: "Wakes one Monstro from sleep.",
    curesStatus: "slp",
  },
  escape_rope: {
    id: "escape_rope",
    name: "Escape Rope",
    short: "Rope",
    category: "field",
    price: 550,
    sellPrice: 275,
    description: "A sturdy rope that teleports you back to the last visited healing pad.",
  },
  ether: {
    id: "ether",
    name: "Ether",
    short: "Ether",
    category: "pp",
    price: 1200,
    sellPrice: 600,
    description: "Restores 10 PP to every move of one Monstro.",
    ppRestore: 10,
  },
  stone_badge: {
    id: "stone_badge",
    name: "Stone Badge",
    short: "S.Badge",
    category: "key",
    price: 0,
    sellPrice: 0,
    description: "Proof of victory over Cave Warden Brak. Tradeable for nothing — earn its meaning.",
    keyItem: true,
  },
  cut_stone: {
    id: "cut_stone",
    name: "Cut Stone",
    short: "CutStn",
    category: "key",
    price: 0,
    sellPrice: 0,
    description: "An ancient blade-shaped stone. Slices through Whisperwood's odd pink trees.",
    keyItem: true,
  },
  flame_badge: {
    id: "flame_badge",
    name: "Flame Badge",
    short: "F.Badge",
    category: "key",
    price: 0,
    sellPrice: 0,
    description: "Proof of victory over Volcano Sage Magma. Its heat still pulses faintly.",
    keyItem: true,
  },
  frost_badge: {
    id: "frost_badge",
    name: "Frost Badge",
    short: "Fr.Badge",
    category: "key",
    price: 0,
    sellPrice: 0,
    description: "Proof of victory over Elder Yuki of Frostpeak. Cool to the touch.",
    keyItem: true,
  },
};

export const ALL_ITEM_IDS: ItemId[] = Object.keys(ITEMS) as ItemId[];

export function itemPrice(id: ItemId): number {
  return ITEMS[id].price;
}

export function itemSellPrice(id: ItemId): number {
  return ITEMS[id].sellPrice;
}

export function isCapture(id: ItemId): boolean {
  return ITEMS[id].category === "capture";
}
