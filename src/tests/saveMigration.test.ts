// Workstream 2 (navigation fix pass), item 2c(ii): old-schema and new-schema saves must both
// still resume. save.ts's actual IndexedDB path can't be exercised here (openDb() reaches for
// `window`/`indexedDB`, which don't exist in this project's node-environment vitest config —
// the same reason src/ui/*.ts files aren't imported directly, see contrast.test.ts's header) but
// migrate()/isValidRunState() are pure and are exactly the two functions that decide whether a
// save resumes at all — loadFromKey (src/core/save.ts) treats a save that fails either as no
// save, which is the actual behavior under test here.
import { describe, expect, it } from 'vitest';
import { isValidRunState, migrate } from '../core/save';
import { freshAccessibility, freshMeta, freshRun } from '../core/state';

describe('save migration/validation (Workstream 2: a structurally-invalid save must resume as "no save", not partial state)', () => {
  it('a fresh, fully-current save round-trips through migrate + isValidRunState', () => {
    const run = freshRun('seed-a', freshMeta(), freshAccessibility());
    const migrated = migrate(structuredClone(run));
    expect(migrated).not.toBeNull();
    expect(isValidRunState(migrated)).toBe(true);
  });

  it('an old save missing fields added within schemaVersion 1 (haptics/tapSoundEnabled/audioOffsetMs) is backfilled by migrate and still validates', () => {
    const run = freshRun('seed-b', freshMeta(), freshAccessibility()) as any;
    delete run.accessibility.haptics;
    delete run.accessibility.tapSoundEnabled;
    delete run.accessibility.audioOffsetMs;
    delete run.accessibility.volumes.metronome;
    const migrated = migrate(run);
    expect(migrated).not.toBeNull();
    expect(isValidRunState(migrated)).toBe(true);
    expect(typeof migrated!.accessibility.haptics).toBe('boolean');
    expect(typeof migrated!.accessibility.tapSoundEnabled).toBe('boolean');
    expect(typeof migrated!.accessibility.audioOffsetMs).toBe('number');
    expect(typeof migrated!.accessibility.volumes.metronome).toBe('number');
  });

  it('a save with a mismatched schemaVersion is rejected by migrate (returns null) rather than coerced', () => {
    const run = freshRun('seed-c', freshMeta(), freshAccessibility()) as any;
    run.schemaVersion = 999;
    expect(migrate(run)).toBeNull();
  });

  it('a structurally-corrupt save (missing required top-level fields) fails isValidRunState even after migrate — this is what makes loadRun() treat it as "no save"', () => {
    const run = freshRun('seed-d', freshMeta(), freshAccessibility()) as any;
    delete run.stats; // e.g. a truncated write, or hand-edited storage
    const migrated = migrate(run);
    expect(isValidRunState(migrated)).toBe(false);
  });

  it('a plain corrupted blob (not even close to a RunState) fails isValidRunState outright', () => {
    expect(isValidRunState({ hello: 'world' })).toBe(false);
    expect(isValidRunState(null)).toBe(false);
    expect(isValidRunState('not an object')).toBe(false);
  });
});
