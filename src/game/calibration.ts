// Pure logic for the Settings "Re-calibrate" tap-along (src/ui/SettingsScene.ts runs the UI and
// the actual timer). Kept separate so the math is testable without a Phaser scene, same reason
// game/rhythm.ts is split from ui/RhythmScene.ts.

/** A tap-along needs at least this many recorded taps to trust an average. */
export const MIN_CALIBRATION_TAPS = 3;

/** Trimmed mean of tap deltas (tap time minus the beat it was aimed at), dropping the single
 *  worst-early and worst-late tap so one fumbled tap doesn't skew the result, then clamped to
 *  the accessibility field's range and rounded to a step of 5ms (matches the Settings +/- step,
 *  so the computed value always lands on a value the manual adjuster can also reach). Returns 0
 *  (no change) if there aren't enough taps to trust. */
export function computeCalibrationOffset(deltasMs: number[]): number {
  if (deltasMs.length < MIN_CALIBRATION_TAPS) return 0;
  const sorted = [...deltasMs].sort((a, b) => a - b);
  const trimmed = sorted.length > 2 ? sorted.slice(1, -1) : sorted;
  const mean = trimmed.reduce((sum, d) => sum + d, 0) / trimmed.length;
  const clamped = Math.max(-150, Math.min(150, mean));
  return Math.round(clamped / 5) * 5;
}
