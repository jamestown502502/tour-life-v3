// No jsdom in this project's vitest config (node environment) — a minimal in-memory
// localStorage shim is enough to exercise the real get/set/fallback logic in core/onboarding.ts
// without adding a DOM-environment dependency for one small module.
import { beforeEach, describe, expect, it } from 'vitest';

function installLocalStorageShim(): void {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
}

describe('onboarding flags (persistent, cross-run)', () => {
  beforeEach(() => {
    installLocalStorageShim();
  });

  it('starts unseen and flips to seen after marking, independently per flag', async () => {
    const {
      hasSeenHowToPlay, markHowToPlaySeen,
      hasSeenRhythmTutorial, markRhythmTutorialSeen,
    } = await import('../core/onboarding');

    expect(hasSeenHowToPlay()).toBe(false);
    expect(hasSeenRhythmTutorial()).toBe(false);

    markHowToPlaySeen();
    expect(hasSeenHowToPlay()).toBe(true);
    expect(hasSeenRhythmTutorial()).toBe(false); // unrelated flag untouched

    markRhythmTutorialSeen();
    expect(hasSeenRhythmTutorial()).toBe(true);
  });

  it('treats a broken localStorage as "always first-time" rather than throwing', async () => {
    (globalThis as any).localStorage = {
      getItem: () => { throw new Error('storage disabled'); },
      setItem: () => { throw new Error('storage disabled'); },
    };
    const { hasSeenHowToPlay, markHowToPlaySeen, hasEverOpenedSettings } = await import('../core/onboarding');
    expect(() => markHowToPlaySeen()).not.toThrow();
    expect(hasSeenHowToPlay()).toBe(false);
    expect(hasEverOpenedSettings()).toBe(false);
  });
});
