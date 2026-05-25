import { Creature } from "./creatures";
import { ItemId } from "./items";

// Bag is keyed by ItemId; legacy `capsules` and `potions` kept for backward-
// compatibility with v1 saves. Always read via `getBagCount` / `addToBag`.
export type Bag = {
  capsules?: number;       // legacy
  potions?: number;        // legacy
  items?: Partial<Record<ItemId, number>>;
};

export type GameSave = {
  version: number;
  username: string;
  party: Creature[];
  storage: Creature[]; // overflow box
  bag: Bag;
  money: number;
  position: { mapId: string; x: number; y: number; facing: "up" | "down" | "left" | "right" };
  flags: Record<string, boolean>;
  monstroSeen: string[];
  monstroCaught: string[];
  playTimeSec: number;
  lastSavedAt: number;
  /** Steps remaining of any active Repel effect — when > 0, encounters are skipped. */
  repelSteps?: number;
};

// ===== Bag helpers (centralised so the rest of the codebase never touches
// the legacy `capsules`/`potions` fields directly) =====
export function getBagCount(bag: Bag, id: ItemId): number {
  if (!bag.items) bag.items = {};
  let n = bag.items[id] ?? 0;
  // Migrate legacy fields on demand
  if (id === "capsule" && typeof bag.capsules === "number" && bag.capsules > 0) {
    n += bag.capsules;
    bag.items[id] = n;
    bag.capsules = 0;
  }
  if (id === "potion" && typeof bag.potions === "number" && bag.potions > 0) {
    n += bag.potions;
    bag.items[id] = n;
    bag.potions = 0;
  }
  return n;
}

export function addToBag(bag: Bag, id: ItemId, qty: number = 1) {
  if (!bag.items) bag.items = {};
  bag.items[id] = (bag.items[id] ?? 0) + qty;
  if (bag.items[id]! < 0) bag.items[id] = 0;
}

export function removeFromBag(bag: Bag, id: ItemId, qty: number = 1): boolean {
  const have = getBagCount(bag, id);
  if (have < qty) return false;
  if (!bag.items) bag.items = {};
  bag.items[id] = have - qty;
  return true;
}

const ACCOUNTS_KEY = "monstroquest:accounts";
const SAVE_KEY_PREFIX = "monstroquest:save:";
const CURRENT_USER_KEY = "monstroquest:currentUser";

type Accounts = Record<string, { passwordHash: string; createdAt: number }>;

function getAccounts(): Accounts {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function setAccounts(a: Accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
}

// Lightweight non-crypto hash (FNV-1a). Good enough for browser-side toy auth.
function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16);
}

export function registerAccount(username: string, password: string): { ok: true } | { ok: false; error: string } {
  username = username.trim().toLowerCase();
  if (!username || username.length < 2) return { ok: false, error: "Username must be 2+ characters" };
  if (!password || password.length < 3) return { ok: false, error: "Password must be 3+ characters" };
  if (!/^[a-z0-9_\-]+$/.test(username)) return { ok: false, error: "Username may only contain letters, numbers, _ and -" };
  const accounts = getAccounts();
  if (accounts[username]) return { ok: false, error: "Username already taken" };
  accounts[username] = { passwordHash: hash(password + ":" + username), createdAt: Date.now() };
  setAccounts(accounts);
  localStorage.setItem(CURRENT_USER_KEY, username);
  return { ok: true };
}

export function loginAccount(username: string, password: string): { ok: true } | { ok: false; error: string } {
  username = username.trim().toLowerCase();
  const accounts = getAccounts();
  const acc = accounts[username];
  if (!acc) return { ok: false, error: "No such account" };
  if (acc.passwordHash !== hash(password + ":" + username)) return { ok: false, error: "Wrong password" };
  localStorage.setItem(CURRENT_USER_KEY, username);
  return { ok: true };
}

export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function getCurrentUser(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_USER_KEY);
}

export function loginAsGuest() {
  localStorage.setItem(CURRENT_USER_KEY, "__guest__");
}

export function isGuest(user: string): boolean {
  return user === "__guest__";
}

export function displayName(user: string): string {
  return user === "__guest__" ? "Guest" : user;
}

export function saveGame(save: GameSave) {
  if (typeof window === "undefined") return;
  save.lastSavedAt = Date.now();
  localStorage.setItem(SAVE_KEY_PREFIX + save.username, JSON.stringify(save));
}

export function loadGame(username: string): GameSave | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SAVE_KEY_PREFIX + username);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as GameSave;
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function deleteSave(username: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SAVE_KEY_PREFIX + username);
}

export function newSave(username: string): GameSave {
  return {
    version: 1,
    username,
    party: [],
    storage: [],
    bag: { items: { capsule: 5, potion: 3 } },
    money: 500,
    position: { mapId: "hearthwick", x: 9, y: 8, facing: "down" },
    flags: {},
    monstroSeen: [],
    monstroCaught: [],
    playTimeSec: 0,
    lastSavedAt: Date.now(),
  };
}
