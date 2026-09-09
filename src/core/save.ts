// IndexedDB save with localStorage fallback. Schema-versioned + validated on load, with a
// migration hook for future schemaVersion bumps (e.g. when the reality-layer phase adds fields).

import { freshAccessibility, type RunState } from './state';
import { SAVE_KEY, SAVE_SCHEMA_VERSION } from '../const';

const DB_NAME = 'tourlife';
const STORE = 'saves';

export function isValidRunState(v: unknown): v is RunState {
  if (!v || typeof v !== 'object') return false;
  const r = v as Partial<RunState>;
  return (
    typeof r.schemaVersion === 'number' &&
    typeof r.seed === 'string' &&
    !!r.band && typeof r.band.name === 'string' &&
    !!r.stats && typeof r.stats.energy === 'number' &&
    !!r.relationships && Array.isArray(r.flags) && Array.isArray(r.inventory) &&
    Array.isArray(r.route) && Array.isArray(r.log) && !!r.meta && !!r.accessibility
  );
}

/** Migrates an older-schema save forward. v1 is the only version today, but settings fields
 *  have been ADDED within v1 (dialogue autoAdvance/skipReadText) — a save written before they
 *  existed is still v1 and just lacks the keys, so missing accessibility keys are backfilled
 *  from the defaults rather than bumping the schema version for an additive change. */
export function migrate(raw: any): RunState | null {
  if (raw.schemaVersion !== SAVE_SCHEMA_VERSION) return null; // no prior versions exist yet
  const defaults = freshAccessibility();
  const saved = raw.accessibility ?? {};
  raw.accessibility = { ...defaults, ...saved, volumes: { ...defaults.volumes, ...(saved.volumes ?? {}) } };
  // Additive backfill, same shape as every other optional field: a save from before return legs
  // existed simply has no memories, and the return-leg feed treats that as "nothing to report".
  if (!Array.isArray(raw.cityMemories)) raw.cityMemories = [];
  return raw as RunState;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(db: IDBDatabase, key: string, value: unknown): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbGet<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveToKey(key: string, data: RunState): Promise<void> {
  const db = await openDb();
  if (db) {
    const ok = await idbSet(db, key, data);
    if (ok) return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // storage unavailable (private browsing) — play on without persistence
  }
}

async function loadFromKey(key: string): Promise<RunState | null> {
  const db = await openDb();
  if (db) {
    const raw = await idbGet<unknown>(db, key);
    if (raw) {
      const migrated = migrate(raw);
      if (migrated && isValidRunState(migrated)) return migrated;
      console.warn(`[save] IndexedDB save "${key}" failed validation, ignoring it`);
    }
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed);
    if (migrated && isValidRunState(migrated)) return migrated;
    console.warn(`[save] localStorage save "${key}" failed validation, ignoring it`);
    return null;
  } catch {
    return null;
  }
}

async function clearKey(key: string): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
    } catch {
      // ignore
    }
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function saveRun(data: RunState): Promise<void> {
  return saveToKey(SAVE_KEY, data);
}

export async function loadRun(): Promise<RunState | null> {
  return loadFromKey(SAVE_KEY);
}

export async function clearSave(): Promise<void> {
  return clearKey(SAVE_KEY);
}

export async function hasSave(): Promise<boolean> {
  return (await loadRun()) !== null;
}

// Close-out item 3b (r/visualnovels QoL consensus: save slots alongside a backlog). A separate
// namespace from SAVE_KEY — the auto/Continue save above is untouched by any of this, and an
// existing single-save player's Continue behavior doesn't change at all.
export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: SaveSlot[] = [1, 2, 3];

function slotKey(slot: SaveSlot): string {
  return `${SAVE_KEY}.slot${slot}`;
}

export async function saveToSlot(slot: SaveSlot, data: RunState): Promise<void> {
  return saveToKey(slotKey(slot), data);
}

export async function loadFromSlot(slot: SaveSlot): Promise<RunState | null> {
  return loadFromKey(slotKey(slot));
}

export async function clearSlot(slot: SaveSlot): Promise<void> {
  return clearKey(slotKey(slot));
}
