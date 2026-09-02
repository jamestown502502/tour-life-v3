import { describe, expect, it } from 'vitest';
import { WEATHER_EFFECTS, weatherAppliedFlag } from '../game/weather';
import { CITIES } from '../game/content';

describe('weather effects (close-out item 5b: "weather has teeth")', () => {
  it('every weather value used by a shipped city has a real effect mapping', () => {
    const usedWeathers = new Set(CITIES.flatMap((c) => c.weather));
    for (const w of usedWeathers) {
      expect(WEATHER_EFFECTS[w], `no WEATHER_EFFECTS entry for "${w}"`).toBeDefined();
    }
  });

  it('every effect nudges at least one stat — no dead entries', () => {
    for (const [weather, effects] of Object.entries(WEATHER_EFFECTS)) {
      expect(Object.keys(effects).length, weather).toBeGreaterThan(0);
    }
  });

  it('the applied-flag is namespaced per city, so two cities never share it', () => {
    expect(weatherAppliedFlag('lisbon')).not.toBe(weatherAppliedFlag('tokyo'));
  });
});
