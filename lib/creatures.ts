import {
  Sprite,
  CINDERPAW, AQUADRIP, SPRIGLING, BOLTKIT, ROCKLE, WISPLET, BUZZBEE, GOOLET, SPINIFIN,
  CINDERWOLF, AQUAFLOW, SPRITEBLADE, BUZZHIVE,
  SHROOMIE, MOSSBUN, STONEPUP, BATLING, LUMINOX, VOLTKIT, ROCKSIRE,
  PEBBAT, FLAREFOX, MAGMITE, MAGMAROTH, FROSTPUP, SNOWVEIL, GUSTWING, KRYSTALIN,
} from "./sprites";

export type ElementType = "fire" | "water" | "grass" | "electric" | "rock" | "ghost" | "bug" | "psychic" | "normal" | "ice";

export const TYPE_COLORS: Record<ElementType, string> = {
  fire: "#ff6b35",
  water: "#3a8fe0",
  grass: "#5fae5f",
  electric: "#ffd040",
  rock: "#a8a098",
  ghost: "#9a6ad8",
  bug: "#a0b830",
  psychic: "#f060a8",
  normal: "#b8b8a8",
  ice: "#88c8ff",
};

// Type effectiveness chart - attacker vs defender
export const TYPE_CHART: Record<ElementType, Partial<Record<ElementType, number>>> = {
  fire: { grass: 2, bug: 2, ice: 2, water: 0.5, fire: 0.5, rock: 0.5 },
  water: { fire: 2, rock: 2, water: 0.5, grass: 0.5, electric: 1 },
  grass: { water: 2, rock: 2, grass: 0.5, fire: 0.5, bug: 0.5, ice: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, rock: 0.5, ice: 1 },
  rock: { fire: 2, bug: 2, ice: 2, grass: 0.5, water: 0.5 },
  ghost: { ghost: 2, psychic: 2, normal: 0 },
  bug: { grass: 2, psychic: 2, fire: 0.5, ghost: 0.5 },
  psychic: { ghost: 0, bug: 0.5, psychic: 0.5 },
  normal: { rock: 0.5, ghost: 0 },
  ice: { grass: 2, rock: 2, fire: 0.5, water: 0.5, ice: 0.5 },
};

export type StatusCondition = "ok" | "psn" | "brn" | "par" | "slp" | "fainted";
export type StatKey = "atk" | "def" | "spd";

export type MoveEffect = {
  // Inflict primary status on the target. Most secondary effects use a chance.
  inflictStatus?: { kind: Exclude<StatusCondition, "ok" | "fainted">; chance: number };
  // Stat changes on the target or self. Use positive numbers to raise, negative to lower.
  statChange?: { target: "self" | "foe"; stat: StatKey; delta: number; chance?: number };
  // Drain fraction — for HP-leeching moves like Mega Drain. Returns this much of damage dealt as HP to the user.
  drainFraction?: number;
  // Heal the user by this fraction of their maxHp (only meaningful for status moves with power 0, e.g. Recover).
  selfHealFraction?: number;
};

export type Move = {
  id: string;
  name: string;
  type: ElementType;
  power: number;
  accuracy: number; // 0-100
  pp: number;
  category: "physical" | "special" | "status";
  description: string;
  /** Higher priority moves act before lower ones regardless of speed. Default 0. Quick Attack = +1. */
  priority?: number;
  /** Marks this move as a usable field move (e.g. Cut on a special tree). Battle ignores this. */
  fieldMove?: "cut";
  effect?: MoveEffect;
};

export const MOVES: Record<string, Move> = {
  // === Damage ===
  tackle: { id: "tackle", name: "Tackle", type: "normal", power: 40, accuracy: 100, pp: 35, category: "physical", description: "A basic body slam." },
  scratch: { id: "scratch", name: "Scratch", type: "normal", power: 40, accuracy: 100, pp: 35, category: "physical", description: "Sharp claws strike the target." },
  bite: { id: "bite", name: "Bite", type: "normal", power: 50, accuracy: 100, pp: 25, category: "physical", description: "A fierce biting attack." },

  ember: { id: "ember", name: "Ember", type: "fire", power: 40, accuracy: 100, pp: 25, category: "special",
    description: "A small flame. 10% chance to burn the target.",
    effect: { inflictStatus: { kind: "brn", chance: 0.1 } } },
  flameburst: { id: "flameburst", name: "Flame Burst", type: "fire", power: 70, accuracy: 100, pp: 15, category: "special",
    description: "A bursting flame. 20% chance to burn.",
    effect: { inflictStatus: { kind: "brn", chance: 0.2 } } },

  bubble: { id: "bubble", name: "Bubble", type: "water", power: 40, accuracy: 100, pp: 30, category: "special",
    description: "Bubbles pelt the foe. 10% chance to lower speed.",
    effect: { statChange: { target: "foe", stat: "spd", delta: -1, chance: 0.1 } } },
  watergun: { id: "watergun", name: "Water Gun", type: "water", power: 40, accuracy: 100, pp: 25, category: "special", description: "Water is shot at the foe." },
  surge: { id: "surge", name: "Aqua Surge", type: "water", power: 75, accuracy: 100, pp: 10, category: "special", description: "A powerful wave attack." },

  vine: { id: "vine", name: "Vine Whip", type: "grass", power: 45, accuracy: 100, pp: 25, category: "physical", description: "Vines lash at the foe." },
  leafblade: { id: "leafblade", name: "Leaf Blade", type: "grass", power: 70, accuracy: 100, pp: 15, category: "physical", description: "A sharp leaf cuts the foe." },

  spark: { id: "spark", name: "Spark", type: "electric", power: 45, accuracy: 100, pp: 20, category: "physical",
    description: "An electrified slam. 30% chance to paralyse.",
    effect: { inflictStatus: { kind: "par", chance: 0.3 } } },
  thunderbolt: { id: "thunderbolt", name: "Thunderbolt", type: "electric", power: 75, accuracy: 100, pp: 15, category: "special",
    description: "A powerful jolt. 10% chance to paralyse.",
    effect: { inflictStatus: { kind: "par", chance: 0.1 } } },

  rockthrow: { id: "rockthrow", name: "Rock Throw", type: "rock", power: 50, accuracy: 90, pp: 15, category: "physical", description: "Rocks are hurled at the foe." },
  lick: { id: "lick", name: "Lick", type: "ghost", power: 30, accuracy: 100, pp: 30, category: "physical",
    description: "A ghostly lick. 30% chance to paralyse.",
    effect: { inflictStatus: { kind: "par", chance: 0.3 } } },
  shadowsneak: { id: "shadowsneak", name: "Shadow Sneak", type: "ghost", power: 50, accuracy: 100, pp: 15, category: "physical", description: "A swift shadow strike that often goes first." },

  sting: { id: "sting", name: "Bug Sting", type: "bug", power: 50, accuracy: 100, pp: 25, category: "physical",
    description: "A stinging stab. 20% chance to poison.",
    effect: { inflictStatus: { kind: "psn", chance: 0.2 } } },
  confuse: { id: "confuse", name: "Confusion", type: "psychic", power: 50, accuracy: 100, pp: 20, category: "special", description: "Psychic waves strike the foe." },

  // === Pure status / stat moves ===
  growl: { id: "growl", name: "Growl", type: "normal", power: 0, accuracy: 100, pp: 40, category: "status",
    description: "A loud growl that lowers the foe's Attack.",
    effect: { statChange: { target: "foe", stat: "atk", delta: -1 } } },
  tailwhip: { id: "tailwhip", name: "Tail Whip", type: "normal", power: 0, accuracy: 100, pp: 30, category: "status",
    description: "Wags the tail to lower the foe's Defense.",
    effect: { statChange: { target: "foe", stat: "def", delta: -1 } } },
  howl: { id: "howl", name: "Howl", type: "normal", power: 0, accuracy: 100, pp: 30, category: "status",
    description: "A fierce howl that boosts the user's Attack.",
    effect: { statChange: { target: "self", stat: "atk", delta: 1 } } },
  thunderwave: { id: "thunderwave", name: "Thunder Wave", type: "electric", power: 0, accuracy: 90, pp: 20, category: "status",
    description: "A weak jolt that paralyses the target.",
    effect: { inflictStatus: { kind: "par", chance: 1 } } },
  poisonpowder: { id: "poisonpowder", name: "Poison Powder", type: "bug", power: 0, accuracy: 75, pp: 25, category: "status",
    description: "Scatters poisonous dust that poisons the foe.",
    effect: { inflictStatus: { kind: "psn", chance: 1 } } },
  sleeppowder: { id: "sleeppowder", name: "Sleep Powder", type: "grass", power: 0, accuracy: 75, pp: 15, category: "status",
    description: "Scatters a dust that puts the foe to sleep.",
    effect: { inflictStatus: { kind: "slp", chance: 1 } } },
  harden: { id: "harden", name: "Harden", type: "rock", power: 0, accuracy: 100, pp: 30, category: "status",
    description: "Tenses the body, raising Defense.",
    effect: { statChange: { target: "self", stat: "def", delta: 1 } } },
  agility: { id: "agility", name: "Agility", type: "psychic", power: 0, accuracy: 100, pp: 30, category: "status",
    description: "Relaxes the body to sharply raise Speed.",
    effect: { statChange: { target: "self", stat: "spd", delta: 2 } } },

  // === New (deep upgrade #2) ===
  cut: { id: "cut", name: "Cut", type: "grass", power: 50, accuracy: 95, pp: 30, category: "physical",
    description: "A slicing strike. Can also clear small trees in the field.",
    fieldMove: "cut" },
  quickattack: { id: "quickattack", name: "Quick Attack", type: "normal", power: 40, accuracy: 100, pp: 30, category: "physical",
    description: "Strikes first thanks to its blinding speed.",
    priority: 1 },
  hyperfang: { id: "hyperfang", name: "Hyper Fang", type: "normal", power: 80, accuracy: 90, pp: 15, category: "physical",
    description: "Sharp fangs deliver a punishing bite." },
  confuseray: { id: "confuseray", name: "Confuse Ray", type: "ghost", power: 0, accuracy: 100, pp: 10, category: "status",
    description: "A spooky ray that paralyses the target.",
    effect: { inflictStatus: { kind: "par", chance: 1 } } },
  recover: { id: "recover", name: "Recover", type: "psychic", power: 0, accuracy: 100, pp: 10, category: "status",
    description: "Restores about half of the user's max HP.",
    effect: { selfHealFraction: 0.5 } },
  megadrain: { id: "megadrain", name: "Mega Drain", type: "grass", power: 40, accuracy: 100, pp: 15, category: "special",
    description: "Drains the foe and restores some of the user's HP.",
    effect: { drainFraction: 0.5 } },
  smokescreen: { id: "smokescreen", name: "Smokescreen", type: "normal", power: 0, accuracy: 100, pp: 20, category: "status",
    description: "Smoke lowers the foe's Attack.",
    effect: { statChange: { target: "foe", stat: "atk", delta: -1 } } },
  megapunch: { id: "megapunch", name: "Mega Punch", type: "normal", power: 80, accuracy: 85, pp: 20, category: "physical",
    description: "A powerful punch with raw force." },

  // === New (deep upgrade #3) ===
  icefang: { id: "icefang", name: "Ice Fang", type: "ice", power: 65, accuracy: 95, pp: 15, category: "physical",
    description: "An icy bite. 10% chance to paralyse.",
    effect: { inflictStatus: { kind: "par", chance: 0.1 } } },
  frostbeam: { id: "frostbeam", name: "Frost Beam", type: "ice", power: 70, accuracy: 100, pp: 15, category: "special",
    description: "A beam of cold. 10% chance to paralyse with frostbite.",
    effect: { inflictStatus: { kind: "par", chance: 0.1 } } },
  blizzard: { id: "blizzard", name: "Blizzard", type: "ice", power: 90, accuracy: 75, pp: 10, category: "special",
    description: "A roaring storm of ice. Powerful but inaccurate." },
  magmapunch: { id: "magmapunch", name: "Magma Punch", type: "fire", power: 75, accuracy: 95, pp: 15, category: "physical",
    description: "A molten fist. 20% chance to burn.",
    effect: { inflictStatus: { kind: "brn", chance: 0.2 } } },
  flamewheel: { id: "flamewheel", name: "Flame Wheel", type: "fire", power: 60, accuracy: 100, pp: 25, category: "physical",
    description: "Charges through foes in a wheel of flame." },
  gust: { id: "gust", name: "Gust", type: "normal", power: 40, accuracy: 100, pp: 35, category: "special",
    description: "A swift blast of wind." },
  wingstrike: { id: "wingstrike", name: "Wing Strike", type: "normal", power: 60, accuracy: 100, pp: 20, category: "physical",
    description: "A diving wing slam." },
  psybeam: { id: "psybeam", name: "Psy Beam", type: "psychic", power: 65, accuracy: 100, pp: 15, category: "special",
    description: "A psychic ray that pierces the mind." },
};

export type Species = {
  id: string;
  name: string;
  types: ElementType[];
  sprite: Sprite;
  baseStats: { hp: number; atk: number; def: number; spd: number };
  description: string;
  catchRate: number; // higher = easier to catch (3-255 like classic)
  learnset: { level: number; moveId: string }[];
  color: string; // theme color
  // Optional level-up evolution into another species.
  evolution?: { toSpeciesId: string; level: number };
  // Where the species can be encountered in the wild — purely for Monstrodex display.
  locations?: string[];
};

export const SPECIES: Record<string, Species> = {
  cinderpaw: {
    id: "cinderpaw",
    name: "Cinderpaw",
    types: ["fire"],
    sprite: CINDERPAW,
    baseStats: { hp: 39, atk: 52, def: 43, spd: 65 },
    description: "A fox-cub said to ignite its tail when excited. Loves warm places.",
    catchRate: 80,
    color: "#ff6b35",
    locations: ["Starter — Professor Cedar"],
    evolution: { toSpeciesId: "cinderwolf", level: 16 },
    learnset: [
      { level: 1, moveId: "scratch" },
      { level: 1, moveId: "growl" },
      { level: 7, moveId: "ember" },
      { level: 12, moveId: "howl" },
      { level: 14, moveId: "bite" },
      { level: 21, moveId: "flameburst" },
    ],
  },
  cinderwolf: {
    id: "cinderwolf",
    name: "Cinderwolf",
    types: ["fire"],
    sprite: CINDERWOLF,
    baseStats: { hp: 58, atk: 78, def: 60, spd: 84 },
    description: "Cinderpaw's evolved form. Its mane burns hotter when it howls.",
    catchRate: 45,
    color: "#ff5a1c",
    locations: ["Evolve Cinderpaw at Lv16"],
    learnset: [
      { level: 1, moveId: "scratch" },
      { level: 1, moveId: "growl" },
      { level: 1, moveId: "ember" },
      { level: 16, moveId: "bite" },
      { level: 20, moveId: "howl" },
      { level: 26, moveId: "flameburst" },
    ],
  },
  aquadrip: {
    id: "aquadrip",
    name: "Aquadrip",
    types: ["water"],
    sprite: AQUADRIP,
    baseStats: { hp: 44, atk: 48, def: 65, spd: 43 },
    description: "A friendly salamander whose body holds a constant fresh-water current.",
    catchRate: 80,
    color: "#3a8fe0",
    locations: ["Starter — Professor Cedar"],
    evolution: { toSpeciesId: "aquaflow", level: 16 },
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 7, moveId: "bubble" },
      { level: 12, moveId: "harden" },
      { level: 14, moveId: "watergun" },
      { level: 21, moveId: "surge" },
    ],
  },
  aquaflow: {
    id: "aquaflow",
    name: "Aquaflow",
    types: ["water"],
    sprite: AQUAFLOW,
    baseStats: { hp: 62, atk: 64, def: 84, spd: 60 },
    description: "Aquadrip evolved. Currents flow through its sleek, sapphire body.",
    catchRate: 45,
    color: "#1a5fa8",
    locations: ["Evolve Aquadrip at Lv16"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 1, moveId: "bubble" },
      { level: 16, moveId: "watergun" },
      { level: 22, moveId: "harden" },
      { level: 28, moveId: "surge" },
    ],
  },
  sprigling: {
    id: "sprigling",
    name: "Sprigling",
    types: ["grass"],
    sprite: SPRIGLING,
    baseStats: { hp: 45, atk: 49, def: 49, spd: 45 },
    description: "Sprouts the sweetest blossoms when raised with care.",
    catchRate: 80,
    color: "#5fae5f",
    locations: ["Starter — Professor Cedar"],
    evolution: { toSpeciesId: "spriteblade", level: 16 },
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 7, moveId: "vine" },
      { level: 12, moveId: "sleeppowder" },
      { level: 14, moveId: "scratch" },
      { level: 21, moveId: "leafblade" },
    ],
  },
  spriteblade: {
    id: "spriteblade",
    name: "Spriteblade",
    types: ["grass"],
    sprite: SPRITEBLADE,
    baseStats: { hp: 62, atk: 78, def: 62, spd: 70 },
    description: "Sprigling evolved. Its leaf-blades can carve through stone.",
    catchRate: 45,
    color: "#3a7a3a",
    locations: ["Evolve Sprigling at Lv16"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 1, moveId: "vine" },
      { level: 16, moveId: "scratch" },
      { level: 20, moveId: "sleeppowder" },
      { level: 26, moveId: "leafblade" },
    ],
  },
  boltkit: {
    id: "boltkit",
    name: "Boltkit",
    types: ["electric"],
    sprite: BOLTKIT,
    baseStats: { hp: 35, atk: 55, def: 30, spd: 90 },
    description: "Static electricity courses through its bushy tail.",
    catchRate: 100,
    color: "#ffd040",
    locations: ["Verdant Wilds — Route 1 (uncommon)"],
    evolution: { toSpeciesId: "voltkit", level: 18 },
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 4, moveId: "quickattack" },
      { level: 6, moveId: "spark" },
      { level: 12, moveId: "thunderwave" },
      { level: 18, moveId: "thunderbolt" },
      { level: 24, moveId: "agility" },
    ],
  },
  rockle: {
    id: "rockle",
    name: "Rockle",
    types: ["rock"],
    sprite: ROCKLE,
    baseStats: { hp: 50, atk: 70, def: 90, spd: 25 },
    description: "Carries an ancient stone shell that even cannons cannot crack.",
    catchRate: 120,
    color: "#a8a098",
    locations: ["Verdant Wilds — Route 1 (rare)", "Sunshore Caves"],
    evolution: { toSpeciesId: "rocksire", level: 20 },
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 4, moveId: "rockthrow" },
      { level: 9, moveId: "harden" },
      { level: 12, moveId: "bite" },
      { level: 18, moveId: "smokescreen" },
      { level: 24, moveId: "megapunch" },
    ],
  },
  wisplet: {
    id: "wisplet",
    name: "Wisplet",
    types: ["ghost"],
    sprite: WISPLET,
    baseStats: { hp: 30, atk: 35, def: 30, spd: 80 },
    description: "Drifts through old hollows, whispering in dreams.",
    catchRate: 90,
    color: "#9a6ad8",
    locations: ["Verdant Wilds — Route 1 (rare)"],
    learnset: [
      { level: 1, moveId: "lick" },
      { level: 8, moveId: "confuse" },
      { level: 12, moveId: "sleeppowder" },
      { level: 16, moveId: "shadowsneak" },
    ],
  },
  buzzbee: {
    id: "buzzbee",
    name: "Buzzbee",
    types: ["bug"],
    sprite: BUZZBEE,
    baseStats: { hp: 40, atk: 35, def: 30, spd: 50 },
    description: "Travels in tiny swarms; its sting is sharp but quick to heal.",
    catchRate: 200,
    color: "#a0b830",
    locations: ["Verdant Wilds — Route 1 (common)"],
    evolution: { toSpeciesId: "buzzhive", level: 14 },
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 5, moveId: "sting" },
      { level: 10, moveId: "poisonpowder" },
    ],
  },
  buzzhive: {
    id: "buzzhive",
    name: "Buzzhive",
    types: ["bug"],
    sprite: BUZZHIVE,
    baseStats: { hp: 65, atk: 60, def: 60, spd: 55 },
    description: "Buzzbee evolved. The swarm's drone strikes fear into prey.",
    catchRate: 50,
    color: "#c8a020",
    locations: ["Evolve Buzzbee at Lv14"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "sting" },
      { level: 14, moveId: "poisonpowder" },
      { level: 22, moveId: "agility" },
    ],
  },
  goolet: {
    id: "goolet",
    name: "Goolet",
    types: ["psychic"],
    sprite: GOOLET,
    baseStats: { hp: 60, atk: 40, def: 55, spd: 30 },
    description: "A translucent gel that hums with hidden mind-waves.",
    catchRate: 90,
    color: "#a060e0",
    locations: ["Verdant Wilds — Route 1 (uncommon)"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 6, moveId: "confuse" },
      { level: 10, moveId: "harden" },
      { level: 14, moveId: "bite" },
    ],
  },
  spinifin: {
    id: "spinifin",
    name: "Spinifin",
    types: ["water"],
    sprite: SPINIFIN,
    baseStats: { hp: 30, atk: 50, def: 35, spd: 80 },
    description: "Darts through streams with sparkling fins.",
    catchRate: 180,
    color: "#5fb2ff",
    locations: ["Verdant Wilds — Route 1 (uncommon)"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 4, moveId: "bubble" },
      { level: 8, moveId: "agility" },
      { level: 12, moveId: "watergun" },
    ],
  },
  // ============================== NEW SPECIES ==============================
  shroomie: {
    id: "shroomie",
    name: "Shroomie",
    types: ["grass"],
    sprite: SHROOMIE,
    baseStats: { hp: 50, atk: 35, def: 55, spd: 25 },
    description: "A red-capped mushroom monster. Spreads spores when startled.",
    catchRate: 190,
    color: "#d04040",
    locations: ["Whisperwood Forest (common)"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 6, moveId: "poisonpowder" },
      { level: 10, moveId: "sleeppowder" },
      { level: 14, moveId: "megadrain" },
      { level: 20, moveId: "leafblade" },
    ],
  },
  mossbun: {
    id: "mossbun",
    name: "Mossbun",
    types: ["grass", "normal"],
    sprite: MOSSBUN,
    baseStats: { hp: 48, atk: 50, def: 40, spd: 70 },
    description: "A bunny cloaked in soft moss. Bounds nimbly through deep forest.",
    catchRate: 150,
    color: "#7aae6f",
    locations: ["Whisperwood Forest (uncommon)"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "tailwhip" },
      { level: 4, moveId: "quickattack" },
      { level: 8, moveId: "vine" },
      { level: 14, moveId: "megadrain" },
      { level: 20, moveId: "hyperfang" },
    ],
  },
  stonepup: {
    id: "stonepup",
    name: "Stonepup",
    types: ["rock"],
    sprite: STONEPUP,
    baseStats: { hp: 45, atk: 60, def: 65, spd: 35 },
    description: "A stone-furred pup from the deep caves. Loyal and stubborn.",
    catchRate: 130,
    color: "#a8a098",
    locations: ["Sunshore Caves (common)"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 5, moveId: "rockthrow" },
      { level: 9, moveId: "harden" },
      { level: 13, moveId: "bite" },
      { level: 18, moveId: "hyperfang" },
      { level: 24, moveId: "megapunch" },
    ],
  },
  batling: {
    id: "batling",
    name: "Batling",
    types: ["ghost"],
    sprite: BATLING,
    baseStats: { hp: 35, atk: 45, def: 30, spd: 85 },
    description: "A spectral bat that fades in and out of cave shadows.",
    catchRate: 140,
    color: "#7a4ad8",
    locations: ["Sunshore Caves (uncommon)"],
    learnset: [
      { level: 1, moveId: "lick" },
      { level: 4, moveId: "quickattack" },
      { level: 8, moveId: "confuseray" },
      { level: 12, moveId: "shadowsneak" },
      { level: 18, moveId: "bite" },
      { level: 24, moveId: "hyperfang" },
    ],
  },
  luminox: {
    id: "luminox",
    name: "Luminox",
    types: ["psychic"],
    sprite: LUMINOX,
    baseStats: { hp: 60, atk: 50, def: 55, spd: 60 },
    description: "A radiant fox whose tails glow with stored moonlight. Said to grant wishes.",
    catchRate: 45,
    color: "#f060a8",
    locations: ["Sunshore Caves (very rare)"],
    learnset: [
      { level: 1, moveId: "confuse" },
      { level: 1, moveId: "growl" },
      { level: 8, moveId: "confuseray" },
      { level: 14, moveId: "recover" },
      { level: 20, moveId: "agility" },
      { level: 28, moveId: "thunderbolt" },
    ],
  },
  voltkit: {
    id: "voltkit",
    name: "Voltkit",
    types: ["electric"],
    sprite: VOLTKIT,
    baseStats: { hp: 55, atk: 78, def: 50, spd: 110 },
    description: "Boltkit evolved. Twin tails crackle with stored lightning.",
    catchRate: 45,
    color: "#ff8a1c",
    locations: ["Evolve Boltkit at Lv18"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 1, moveId: "quickattack" },
      { level: 1, moveId: "spark" },
      { level: 18, moveId: "thunderwave" },
      { level: 22, moveId: "thunderbolt" },
      { level: 28, moveId: "agility" },
    ],
  },
  rocksire: {
    id: "rocksire",
    name: "Rocksire",
    types: ["rock"],
    sprite: ROCKSIRE,
    baseStats: { hp: 70, atk: 100, def: 130, spd: 30 },
    description: "Rockle evolved. A walking fortress with cratered armour.",
    catchRate: 45,
    color: "#7a7268",
    locations: ["Evolve Rockle at Lv20"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "rockthrow" },
      { level: 1, moveId: "harden" },
      { level: 1, moveId: "bite" },
      { level: 20, moveId: "smokescreen" },
      { level: 26, moveId: "megapunch" },
      { level: 32, moveId: "hyperfang" },
    ],
  },
  // =========================== EMBERFALL ===========================
  pebbat: {
    id: "pebbat",
    name: "Pebbat",
    types: ["rock"],
    sprite: PEBBAT,
    baseStats: { hp: 45, atk: 55, def: 60, spd: 85 },
    description: "A small bat with stone-like wings. Lives in volcanic caves.",
    catchRate: 150,
    color: "#a8a098",
    locations: ["Emberfall Volcano (common)"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 4, moveId: "quickattack" },
      { level: 8, moveId: "rockthrow" },
      { level: 14, moveId: "bite" },
      { level: 18, moveId: "smokescreen" },
      { level: 24, moveId: "hyperfang" },
    ],
  },
  flarefox: {
    id: "flarefox",
    name: "Flarefox",
    types: ["fire"],
    sprite: FLAREFOX,
    baseStats: { hp: 50, atk: 65, def: 45, spd: 80 },
    description: "Twin-tailed fox of the volcano. Spits sparks when frightened.",
    catchRate: 120,
    color: "#ff8a3c",
    locations: ["Emberfall Volcano (common)"],
    learnset: [
      { level: 1, moveId: "scratch" },
      { level: 1, moveId: "growl" },
      { level: 4, moveId: "ember" },
      { level: 10, moveId: "quickattack" },
      { level: 14, moveId: "flamewheel" },
      { level: 22, moveId: "flameburst" },
    ],
  },
  magmite: {
    id: "magmite",
    name: "Magmite",
    types: ["fire"],
    sprite: MAGMITE,
    baseStats: { hp: 55, atk: 75, def: 60, spd: 35 },
    description: "An ember-creature wrapped in basalt. Slow, but burning hot.",
    catchRate: 90,
    color: "#ff6b35",
    locations: ["Emberfall Volcano (uncommon)"],
    evolution: { toSpeciesId: "magmaroth", level: 22 },
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "ember" },
      { level: 8, moveId: "harden" },
      { level: 12, moveId: "flameburst" },
      { level: 18, moveId: "magmapunch" },
      { level: 24, moveId: "smokescreen" },
    ],
  },
  magmaroth: {
    id: "magmaroth",
    name: "Magmaroth",
    types: ["fire", "rock"],
    sprite: MAGMAROTH,
    baseStats: { hp: 80, atk: 110, def: 110, spd: 40 },
    description: "Magmite evolved. A towering molten knight clad in obsidian.",
    catchRate: 45,
    color: "#a02810",
    locations: ["Evolve Magmite at Lv22"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "ember" },
      { level: 1, moveId: "harden" },
      { level: 1, moveId: "magmapunch" },
      { level: 22, moveId: "flameburst" },
      { level: 28, moveId: "megapunch" },
      { level: 34, moveId: "hyperfang" },
    ],
  },
  // =========================== FROSTPEAK ===========================
  frostpup: {
    id: "frostpup",
    name: "Frostpup",
    types: ["ice"],
    sprite: FROSTPUP,
    baseStats: { hp: 50, atk: 55, def: 50, spd: 70 },
    description: "An icy pup with a heart-shaped nose. Loves to romp in fresh snow.",
    catchRate: 130,
    color: "#88c8ff",
    locations: ["Frostpeak Tundra (common)"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 6, moveId: "bubble" },
      { level: 10, moveId: "icefang" },
      { level: 16, moveId: "bite" },
      { level: 22, moveId: "frostbeam" },
    ],
  },
  snowveil: {
    id: "snowveil",
    name: "Snowveil",
    types: ["ice", "ghost"],
    sprite: SNOWVEIL,
    baseStats: { hp: 60, atk: 50, def: 55, spd: 75 },
    description: "A drifting blizzard-spirit. Tells lullabies on the wind.",
    catchRate: 80,
    color: "#cfe8ff",
    locations: ["Frostpeak Tundra (uncommon)"],
    learnset: [
      { level: 1, moveId: "lick" },
      { level: 1, moveId: "growl" },
      { level: 8, moveId: "confuseray" },
      { level: 12, moveId: "icefang" },
      { level: 18, moveId: "shadowsneak" },
      { level: 24, moveId: "blizzard" },
    ],
  },
  gustwing: {
    id: "gustwing",
    name: "Gustwing",
    types: ["normal"],
    sprite: GUSTWING,
    baseStats: { hp: 45, atk: 50, def: 40, spd: 100 },
    description: "Soars on tundra updrafts. Cries pierce the clouds.",
    catchRate: 170,
    color: "#b8b8a8",
    locations: ["Frostpeak Tundra (common)"],
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 4, moveId: "quickattack" },
      { level: 8, moveId: "gust" },
      { level: 14, moveId: "wingstrike" },
      { level: 22, moveId: "agility" },
    ],
  },
  krystalin: {
    id: "krystalin",
    name: "Krystalin",
    types: ["psychic", "ice"],
    sprite: KRYSTALIN,
    baseStats: { hp: 70, atk: 65, def: 70, spd: 75 },
    description: "A crystalline fox of legend. Said to glow on moonlit peaks.",
    catchRate: 30,
    color: "#a060e0",
    locations: ["Frostpeak Tundra (very rare)"],
    learnset: [
      { level: 1, moveId: "confuse" },
      { level: 1, moveId: "growl" },
      { level: 8, moveId: "psybeam" },
      { level: 14, moveId: "icefang" },
      { level: 18, moveId: "recover" },
      { level: 24, moveId: "frostbeam" },
      { level: 32, moveId: "blizzard" },
    ],
  },
};

// ===== Creature instance & calculations (simplified Gen 1-style) =====

export type Creature = {
  speciesId: string;
  nickname?: string;
  level: number;
  exp: number;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  moves: { moveId: string; pp: number; maxPp: number }[];
  status: StatusCondition;
  // Sleep turn counter — when > 0 the creature is asleep and skips a turn each turn.
  sleepTurns?: number;
  // Stat stage modifiers (-6..+6). Reset on switch / battle-end.
  statStages?: { atk: number; def: number; spd: number };
};

// Multipliers for each stat stage (-6..+6). Standard Pokémon table.
const STAGE_MULT: Record<number, number> = {
  [-6]: 2 / 8, [-5]: 2 / 7, [-4]: 2 / 6, [-3]: 2 / 5, [-2]: 2 / 4, [-1]: 2 / 3,
  0: 1, 1: 3 / 2, 2: 4 / 2, 3: 5 / 2, 4: 6 / 2, 5: 7 / 2, 6: 8 / 2,
};

function clampStage(n: number): number {
  return Math.max(-6, Math.min(6, n));
}

export function getStatStage(c: Creature, stat: StatKey): number {
  return clampStage(c.statStages?.[stat] ?? 0);
}

export function applyStatStage(c: Creature, stat: StatKey, delta: number): { applied: number; capped: boolean } {
  if (!c.statStages) c.statStages = { atk: 0, def: 0, spd: 0 };
  const before = c.statStages[stat];
  const after = clampStage(before + delta);
  c.statStages[stat] = after;
  return { applied: after - before, capped: after === before };
}

/** Effective stat value after status conditions and stat stages. */
export function effectiveStat(c: Creature, stat: StatKey): number {
  const base = stat === "atk" ? c.atk : stat === "def" ? c.def : c.spd;
  let v = base * (STAGE_MULT[getStatStage(c, stat)] ?? 1);
  // Burn halves attack damage in classic Gen 1.
  if (stat === "atk" && c.status === "brn") v *= 0.5;
  // Paralysis cripples speed in classic Gen 1.
  if (stat === "spd" && c.status === "par") v *= 0.25;
  return Math.max(1, Math.floor(v));
}

/** Try to inflict a primary status. Returns true if it stuck. */
export function applyStatus(c: Creature, kind: Exclude<StatusCondition, "ok" | "fainted">): boolean {
  if (c.status && c.status !== "ok") return false; // already has a status
  if (c.currentHp <= 0) return false;
  c.status = kind;
  if (kind === "slp") c.sleepTurns = 1 + Math.floor(Math.random() * 3); // 1-3 turns
  return true;
}

/** Heal a creature fully (used by Pokemon Center / Revive in storage). */
export function fullyHeal(c: Creature) {
  c.currentHp = c.maxHp;
  c.status = "ok";
  c.sleepTurns = 0;
  if (c.statStages) c.statStages = { atk: 0, def: 0, spd: 0 };
  for (const m of c.moves) m.pp = m.maxPp;
}

/** Cleared whenever a creature leaves play (switch or faint). */
export function clearVolatile(c: Creature) {
  c.statStages = { atk: 0, def: 0, spd: 0 };
}

/** End-of-turn residual damage (poison + burn). Returns damage and a message. */
export function applyEndOfTurnStatus(c: Creature): { dmg: number; msg?: string } | null {
  if (c.status === "psn") {
    const dmg = Math.max(1, Math.floor(c.maxHp / 8));
    c.currentHp = Math.max(0, c.currentHp - dmg);
    return { dmg, msg: "is hurt by poison!" };
  }
  if (c.status === "brn") {
    const dmg = Math.max(1, Math.floor(c.maxHp / 16));
    c.currentHp = Math.max(0, c.currentHp - dmg);
    return { dmg, msg: "is hurt by its burn!" };
  }
  return null;
}

/** Determines whether the creature can act this turn (sleep / paralysis). */
export function canAct(c: Creature): { canAct: boolean; msg?: string; wokeUp?: boolean } {
  if (c.status === "slp") {
    if ((c.sleepTurns ?? 0) > 0) {
      c.sleepTurns! -= 1;
      if (c.sleepTurns === 0) {
        c.status = "ok";
        return { canAct: true, msg: "woke up!", wokeUp: true };
      }
      return { canAct: false, msg: "is fast asleep." };
    }
    c.status = "ok";
    return { canAct: true };
  }
  if (c.status === "par" && Math.random() < 0.25) {
    return { canAct: false, msg: "is fully paralysed!" };
  }
  return { canAct: true };
}

export function statAt(base: number, level: number, isHp: boolean = false): number {
  // Simplified Gen 1-ish formula
  if (isHp) return Math.floor(((base + 50) * 2 * level) / 100) + level + 10;
  return Math.floor((base * 2 * level) / 100) + 5;
}

export function expForLevel(level: number): number {
  // medium-fast: n^3
  return Math.floor(level * level * level);
}

export function levelFromExp(exp: number): number {
  let lvl = 1;
  while (expForLevel(lvl + 1) <= exp && lvl < 100) lvl++;
  return lvl;
}

export function createWild(speciesId: string, level: number): Creature {
  const sp = SPECIES[speciesId];
  const maxHp = statAt(sp.baseStats.hp, level, true);
  const atk = statAt(sp.baseStats.atk, level);
  const def = statAt(sp.baseStats.def, level);
  const spd = statAt(sp.baseStats.spd, level);
  // Determine moves: latest 4 from learnset where level <= current
  const known = sp.learnset.filter((l) => l.level <= level).slice(-4);
  const moves = known.length > 0
    ? known.map((l) => ({ moveId: l.moveId, pp: MOVES[l.moveId].pp, maxPp: MOVES[l.moveId].pp }))
    : [{ moveId: sp.learnset[0].moveId, pp: MOVES[sp.learnset[0].moveId].pp, maxPp: MOVES[sp.learnset[0].moveId].pp }];
  return {
    speciesId,
    level,
    exp: expForLevel(level),
    currentHp: maxHp,
    maxHp,
    atk,
    def,
    spd,
    moves,
    status: "ok",
  };
}

export function effectiveness(moveType: ElementType, defenderTypes: ElementType[]): number {
  let mult = 1;
  for (const t of defenderTypes) {
    const m = TYPE_CHART[moveType]?.[t];
    if (m !== undefined) mult *= m;
  }
  return mult;
}

export type DamageResult = {
  dmg: number;
  eff: number;     // type effectiveness multiplier
  crit: boolean;
  missed: boolean; // accuracy check failed
};

export function damageCalc(attacker: Creature, defender: Creature, move: Move): DamageResult {
  // Accuracy roll runs even for power-0 moves so e.g. Thunder Wave can miss.
  const missed = Math.random() * 100 > move.accuracy;
  if (move.power <= 0) return { dmg: 0, eff: 1, crit: false, missed };
  if (missed) return { dmg: 0, eff: 1, crit: false, missed: true };
  const atkS = effectiveStat(attacker, "atk");
  const defS = effectiveStat(defender, "def");
  const lvl = attacker.level;
  const base = Math.floor((((2 * lvl) / 5 + 2) * move.power * (atkS / Math.max(1, defS))) / 50) + 2;
  const defSpecies = SPECIES[defender.speciesId];
  const atkSpecies = SPECIES[attacker.speciesId];
  const eff = effectiveness(move.type, defSpecies.types);
  const stab = atkSpecies.types.includes(move.type) ? 1.5 : 1;
  const crit = Math.random() < 0.0625;
  const critMult = crit ? 1.5 : 1;
  const rand = 0.85 + Math.random() * 0.15;
  const dmg = Math.max(eff === 0 ? 0 : 1, Math.floor(base * eff * stab * critMult * rand));
  return { dmg, eff, crit, missed: false };
}

/**
 * If this level-up triggers an evolution, mutate the creature into the evolved
 * species in place and return the previous species id. Otherwise return null.
 */
export function evolveCheck(creature: Creature): { fromSpeciesId: string; toSpeciesId: string } | null {
  const sp = SPECIES[creature.speciesId];
  if (!sp.evolution) return null;
  if (creature.level < sp.evolution.level) return null;
  const next = SPECIES[sp.evolution.toSpeciesId];
  if (!next) return null;
  const from = creature.speciesId;
  creature.speciesId = next.id;
  // Recompute stats while preserving HP ratio
  const ratio = creature.currentHp / Math.max(1, creature.maxHp);
  creature.maxHp = statAt(next.baseStats.hp, creature.level, true);
  creature.atk = statAt(next.baseStats.atk, creature.level);
  creature.def = statAt(next.baseStats.def, creature.level);
  creature.spd = statAt(next.baseStats.spd, creature.level);
  creature.currentHp = Math.max(1, Math.floor(creature.maxHp * ratio));
  return { fromSpeciesId: from, toSpeciesId: next.id };
}

export function gainExp(creature: Creature, amount: number): { leveledUp: boolean; newMoves: string[]; pendingLearns: string[] } {
  const sp = SPECIES[creature.speciesId];
  const prevLvl = creature.level;
  creature.exp += amount;
  const newLvl = Math.min(100, levelFromExp(creature.exp));
  const newMoves: string[] = [];
  const pendingLearns: string[] = [];
  if (newLvl > prevLvl) {
    creature.level = newLvl;
    // Recompute stats
    const ratio = creature.currentHp / creature.maxHp;
    creature.maxHp = statAt(sp.baseStats.hp, newLvl, true);
    creature.atk = statAt(sp.baseStats.atk, newLvl);
    creature.def = statAt(sp.baseStats.def, newLvl);
    creature.spd = statAt(sp.baseStats.spd, newLvl);
    creature.currentHp = Math.max(1, Math.floor(creature.maxHp * ratio));
    // Learn new moves: only auto-add when there's an empty slot. Otherwise
    // queue them for the UI to prompt the player on which existing move to forget.
    for (const entry of sp.learnset) {
      if (entry.level > prevLvl && entry.level <= newLvl) {
        if (!creature.moves.find((m) => m.moveId === entry.moveId)) {
          if (creature.moves.length < 4) {
            const mv = MOVES[entry.moveId];
            creature.moves.push({ moveId: entry.moveId, pp: mv.pp, maxPp: mv.pp });
            newMoves.push(mv.name);
          } else {
            pendingLearns.push(entry.moveId);
          }
        }
      }
    }
    return { leveledUp: true, newMoves, pendingLearns };
  }
  return { leveledUp: false, newMoves, pendingLearns };
}

// ===== Smart move-selection AI (used by trainers; wild stays random) =====

/**
 * Score a single move for use against the given defender. Higher = better.
 * Considers type effectiveness, STAB, raw power, status usefulness, and
 * already-applied debuffs on the target.
 */
export function scoreMoveFor(attacker: Creature, defender: Creature, slot: { moveId: string; pp: number; maxPp: number }): number {
  if (slot.pp <= 0) return -Infinity;
  const mv = MOVES[slot.moveId];
  if (!mv) return -Infinity;
  if (mv.power > 0) {
    const eff = effectiveness(mv.type, SPECIES[defender.speciesId].types);
    const stab = SPECIES[attacker.speciesId].types.includes(mv.type) ? 1.5 : 1;
    return mv.power * eff * stab;
  }
  // Status / stat-change moves: only valuable if not already applied
  if (mv.effect?.inflictStatus) {
    if (defender.status !== "ok") return 4; // already statused; mostly worthless
    return 70 * mv.effect.inflictStatus.chance;
  }
  if (mv.effect?.selfHealFraction) {
    const missing = 1 - attacker.currentHp / Math.max(1, attacker.maxHp);
    return 30 + 90 * missing; // very valuable when low
  }
  if (mv.effect?.statChange) {
    const sc = mv.effect.statChange;
    // Self-buffs are useful when long-term — score modestly
    if (sc.target === "self" && (attacker.statStages?.[sc.stat] ?? 0) < 3) return 30 + 10 * Math.abs(sc.delta);
    if (sc.target === "foe" && (defender.statStages?.[sc.stat] ?? 0) > -3) return 35 + 10 * Math.abs(sc.delta);
    return 5;
  }
  return 10;
}

/** Pick the best move for `attacker` against `defender`, with light randomness. */
export function chooseBestMove(attacker: Creature, defender: Creature): { moveId: string; pp: number; maxPp: number } {
  const usable = attacker.moves.filter((m) => m.pp > 0);
  const pool = usable.length > 0 ? usable : attacker.moves;
  let best = pool[0];
  let bestScore = -Infinity;
  for (const slot of pool) {
    const score = scoreMoveFor(attacker, defender, slot) + Math.random() * 8;
    if (score > bestScore) { bestScore = score; best = slot; }
  }
  return best;
}

export function tryCatch(target: Creature, ballMultiplier: number = 1): boolean {
  const sp = SPECIES[target.speciesId];
  const hpFactor = (3 * target.maxHp - 2 * target.currentHp) / (3 * target.maxHp);
  const rate = sp.catchRate;
  // Simple formula: stronger balls multiply catch chance
  const chance = Math.min(1, (hpFactor * rate * ballMultiplier) / 255);
  return Math.random() < chance;
}

export function expYield(species: Species, level: number): number {
  return Math.floor((species.baseStats.hp + species.baseStats.atk + species.baseStats.def + species.baseStats.spd) * level / 7);
}
