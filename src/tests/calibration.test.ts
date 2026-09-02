import { describe, expect, it } from 'vitest';
import { computeCalibrationOffset, MIN_CALIBRATION_TAPS } from '../game/calibration';

describe('audio-sync calibration math (Settings "Re-calibrate")', () => {
  it('returns 0 when there are fewer taps than the trust threshold', () => {
    expect(computeCalibrationOffset([])).toBe(0);
    expect(computeCalibrationOffset(Array(MIN_CALIBRATION_TAPS - 1).fill(50))).toBe(0);
  });

  it('trims the single worst-early and worst-late tap before averaging', () => {
    // Without trimming, the -500 outlier would drag the mean well below 50.
    expect(computeCalibrationOffset([-500, 45, 50, 55, 900])).toBe(50);
  });

  it('rounds to a 5ms step, matching the manual +/- adjuster', () => {
    expect(computeCalibrationOffset([61, 62, 63])).toBe(60);
    expect(computeCalibrationOffset([63, 64, 65])).toBe(65);
  });

  it('clamps to the accessibility field range', () => {
    expect(computeCalibrationOffset([500, 500, 500])).toBe(150);
    expect(computeCalibrationOffset([-500, -500, -500])).toBe(-150);
  });

  it('consistently late taps produce a positive offset, consistently early taps a negative one', () => {
    expect(computeCalibrationOffset([70, 75, 80])).toBeGreaterThan(0);
    expect(computeCalibrationOffset([-70, -75, -80])).toBeLessThan(0);
  });
});
