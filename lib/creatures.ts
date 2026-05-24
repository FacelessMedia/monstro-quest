import { Sprite, CINDERPAW, AQUADRIP, SPRIGLING, BOLTKIT, ROCKLE, WISPLET, BUZZBEE, GOOLET, SPINIFIN } from "./sprites";

export type ElementType = "fire" | "water" | "grass" | "electric" | "rock" | "ghost" | "bug" | "psychic" | "normal";

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
};

// Type effectiveness chart - attacker vs defender
export const TYPE_CHART: Record<ElementType, Partial<Record<ElementType, number>>> = {
  fire: { grass: 2, bug: 2, water: 0.5, fire: 0.5, rock: 0.5 },
  water: { fire: 2, rock: 2, water: 0.5, grass: 0.5, electric: 1 },
  grass: { water: 2, rock: 2, grass: 0.5, fire: 0.5, bug: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, rock: 0.5 },
  rock: { fire: 2, bug: 2, grass: 0.5, water: 0.5 },
  ghost: { ghost: 2, psychic: 2, normal: 0 },
  bug: { grass: 2, psychic: 2, fire: 0.5, ghost: 0.5 },
  psychic: { ghost: 0, bug: 0.5, psychic: 0.5 },
  normal: { rock: 0.5, ghost: 0 },
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
  statusEffect?: "burn" | "paralyze" | "sleep"; // future use
};

export const MOVES: Record<string, Move> = {
  tackle: { id: "tackle", name: "Tackle", type: "normal", power: 40, accuracy: 100, pp: 35, category: "physical", description: "A basic body slam." },
  scratch: { id: "scratch", name: "Scratch", type: "normal", power: 40, accuracy: 100, pp: 35, category: "physical", description: "Sharp claws strike the target." },
  ember: { id: "ember", name: "Ember", type: "fire", power: 40, accuracy: 100, pp: 25, category: "special", description: "A small flame is hurled at the foe." },
  flameburst: { id: "flameburst", name: "Flame Burst", type: "fire", power: 70, accuracy: 100, pp: 15, category: "special", description: "A bursting flame attack." },
  bubble: { id: "bubble", name: "Bubble", type: "water", power: 40, accuracy: 100, pp: 30, category: "special", description: "Bubbles pelt the target." },
  watergun: { id: "watergun", name: "Water Gun", type: "water", power: 40, accuracy: 100, pp: 25, category: "special", description: "Water is shot at the foe." },
  surge: { id: "surge", name: "Aqua Surge", type: "water", power: 75, accuracy: 100, pp: 10, category: "special", description: "A powerful wave attack." },
  vine: { id: "vine", name: "Vine Whip", type: "grass", power: 45, accuracy: 100, pp: 25, category: "physical", description: "Vines lash at the foe." },
  leafblade: { id: "leafblade", name: "Leaf Blade", type: "grass", power: 70, accuracy: 100, pp: 15, category: "physical", description: "A sharp leaf cuts the foe." },
  spark: { id: "spark", name: "Spark", type: "electric", power: 45, accuracy: 100, pp: 20, category: "physical", description: "An electrified body slam." },
  thunderbolt: { id: "thunderbolt", name: "Thunderbolt", type: "electric", power: 75, accuracy: 100, pp: 15, category: "special", description: "A powerful electric jolt." },
  rockthrow: { id: "rockthrow", name: "Rock Throw", type: "rock", power: 50, accuracy: 90, pp: 15, category: "physical", description: "Rocks are hurled at the foe." },
  lick: { id: "lick", name: "Lick", type: "ghost", power: 30, accuracy: 100, pp: 30, category: "physical", description: "A ghostly lick attack." },
  shadowsneak: { id: "shadowsneak", name: "Shadow Sneak", type: "ghost", power: 50, accuracy: 100, pp: 15, category: "physical", description: "A swift shadow strike." },
  bite: { id: "bite", name: "Bite", type: "normal", power: 50, accuracy: 100, pp: 25, category: "physical", description: "A fierce biting attack." },
  sting: { id: "sting", name: "Bug Sting", type: "bug", power: 50, accuracy: 100, pp: 25, category: "physical", description: "A stinging stab." },
  confuse: { id: "confuse", name: "Confusion", type: "psychic", power: 50, accuracy: 100, pp: 20, category: "special", description: "Psychic waves strike the foe." },
  growl: { id: "growl", name: "Growl", type: "normal", power: 0, accuracy: 100, pp: 40, category: "status", description: "Lowers the foe's attack." },
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
    learnset: [
      { level: 1, moveId: "scratch" },
      { level: 1, moveId: "growl" },
      { level: 7, moveId: "ember" },
      { level: 14, moveId: "bite" },
      { level: 21, moveId: "flameburst" },
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
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 7, moveId: "bubble" },
      { level: 14, moveId: "watergun" },
      { level: 21, moveId: "surge" },
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
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 7, moveId: "vine" },
      { level: 14, moveId: "scratch" },
      { level: 21, moveId: "leafblade" },
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
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 1, moveId: "growl" },
      { level: 6, moveId: "spark" },
      { level: 18, moveId: "thunderbolt" },
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
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 4, moveId: "rockthrow" },
      { level: 12, moveId: "bite" },
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
    learnset: [
      { level: 1, moveId: "lick" },
      { level: 8, moveId: "confuse" },
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
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 5, moveId: "sting" },
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
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 6, moveId: "confuse" },
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
    learnset: [
      { level: 1, moveId: "tackle" },
      { level: 4, moveId: "bubble" },
      { level: 12, moveId: "watergun" },
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
  status: "ok" | "fainted";
};

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

export function damageCalc(attacker: Creature, defender: Creature, move: Move): { dmg: number; eff: number; crit: boolean } {
  if (move.power <= 0) return { dmg: 0, eff: 1, crit: false };
  const atkS = attacker.atk;
  const defS = defender.def;
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
  return { dmg, eff, crit };
}

export function gainExp(creature: Creature, amount: number): { leveledUp: boolean; newMoves: string[] } {
  const sp = SPECIES[creature.speciesId];
  const prevLvl = creature.level;
  creature.exp += amount;
  const newLvl = Math.min(100, levelFromExp(creature.exp));
  const newMoves: string[] = [];
  if (newLvl > prevLvl) {
    creature.level = newLvl;
    // Recompute stats
    const ratio = creature.currentHp / creature.maxHp;
    creature.maxHp = statAt(sp.baseStats.hp, newLvl, true);
    creature.atk = statAt(sp.baseStats.atk, newLvl);
    creature.def = statAt(sp.baseStats.def, newLvl);
    creature.spd = statAt(sp.baseStats.spd, newLvl);
    creature.currentHp = Math.max(1, Math.floor(creature.maxHp * ratio));
    // Learn new moves
    for (const entry of sp.learnset) {
      if (entry.level > prevLvl && entry.level <= newLvl) {
        if (!creature.moves.find((m) => m.moveId === entry.moveId)) {
          if (creature.moves.length < 4) {
            const mv = MOVES[entry.moveId];
            creature.moves.push({ moveId: entry.moveId, pp: mv.pp, maxPp: mv.pp });
            newMoves.push(mv.name);
          } else {
            // Replace last
            const mv = MOVES[entry.moveId];
            creature.moves[3] = { moveId: entry.moveId, pp: mv.pp, maxPp: mv.pp };
            newMoves.push(mv.name);
          }
        }
      }
    }
    return { leveledUp: true, newMoves };
  }
  return { leveledUp: false, newMoves };
}

export function tryCatch(target: Creature): boolean {
  const sp = SPECIES[target.speciesId];
  const hpFactor = (3 * target.maxHp - 2 * target.currentHp) / (3 * target.maxHp);
  const rate = sp.catchRate;
  // Simple formula
  const chance = (hpFactor * rate) / 255;
  return Math.random() < chance;
}

export function expYield(species: Species, level: number): number {
  return Math.floor((species.baseStats.hp + species.baseStats.atk + species.baseStats.def + species.baseStats.spd) * level / 7);
}
