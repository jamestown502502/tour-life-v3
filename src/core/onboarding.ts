// First-time-player flags that must survive across `State.newRun()` (which wipes run-scoped
// `State.data.flags` on every new tour) — these live in localStorage instead, decoupled from
// the save system entirely, since they answer "has this player EVER seen X", not "in this run".
// Per-run onboarding beats (RoutePlan/Hub intros) intentionally use State.data.flags instead —
// see CityScene/RoutePlanScene/HubScene — because those should gently repeat once per new tour.

const KEYS = {
  howToPlay: 'tourlife.seenHowToPlay',
  rhythmTutorial: 'tourlife.seenRhythmTutorial',
  everOpenedSettings: 'tourlife.everOpenedSettings',
  seenHoldHint: 'tourlife.seenHoldHint',
  seenCueHint: 'tourlife.seenCueHint',
} as const;

function get(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false; // storage unavailable (private browsing) — treat as "always first-time"
  }
}

function set(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // ignore — worst case the hint reappears next visit
  }
}

export const hasSeenHowToPlay = (): boolean => get(KEYS.howToPlay);
export const markHowToPlaySeen = (): void => set(KEYS.howToPlay);

export const hasSeenRhythmTutorial = (): boolean => get(KEYS.rhythmTutorial);
export const markRhythmTutorialSeen = (): void => set(KEYS.rhythmTutorial);

export const hasEverOpenedSettings = (): boolean => get(KEYS.everOpenedSettings);
export const markSettingsOpened = (): void => set(KEYS.everOpenedSettings);

export const hasSeenHoldHint = (): boolean => get(KEYS.seenHoldHint);
export const markHoldHintSeen = (): void => set(KEYS.seenHoldHint);

export const hasSeenCueHint = (): boolean => get(KEYS.seenCueHint);
export const markCueHintSeen = (): void => set(KEYS.seenCueHint);
