// IndexedDB save with localStorage fallback. Schema-versioned + validated on load, with a
// migration hook for future schemaVersion bumps (e.g. when the reality-layer phase adds fields).

import type { RunState } from './state';
import { SAVE_KEY, SAVE_SCHEMA_VERSION } from '../const';

const DB_NAME = 'tourlife';
const STORE = 'saves';

function isValidRunState(v: unknown): v is RunState {
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

/** Migrates an older-schema save forward. v1 is the only version today. */
function migrate(raw: any): RunState | null {
  if (raw.schemaVersion === SAVE_SCHEMA_VERSION) return raw as RunState;
  // No prior versions exist yet — nothing to migrate from.
  return null;
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

export async function saveRun(data: RunState): Promise<void> {
  const db = await openDb();
  if (db) {
    const ok = await idbSet(db, SAVE_KEY, data);
    if (ok) return;
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable (private browsing) — play on without persistence
  }
}

export async function loadRun(): Promise<RunState | null> {
  const db = await openDb();
  if (db) {
    const raw = await idbGet<unknown>(db, SAVE_KEY);
    if (raw) {
      const migrated = migrate(raw);
      if (migrated && isValidRunState(migrated)) return migrated;
      console.warn('[save] IndexedDB save failed validation, ignoring it');
    }
  }
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed);
    if (migrated && isValidRunState(migrated)) return migrated;
    console.warn('[save] localStorage save failed validation, ignoring it');
    return null;
  } catch {
    return null;
  }
}

export async function clearSave(): Promise<void> {
  const db = await openDb();
  if (db) {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(SAVE_KEY);
    } catch {
      // ignore
    }
  }
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export async function hasSave(): Promise<boolean> {
  return (await loadRun()) !== null;
}
