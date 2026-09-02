// Weather was seed-picked per city (game/route.ts) and used only for the rain-particle visual
// effect and flavor text — nothing ever read the value back mechanically. This gives it the one
// small stat-delta consequence the close-out plan's item 5 asked for ("weather has teeth"),
// applied once per city arrival, same shape as HubScene's COMPLICATION_EFFECTS giving the
// mid-tour complication its own mechanical consequence.

import type { StatDeltas } from '../../content/schema';

export const WEATHER_EFFECTS: Record<string, StatDeltas> = {
  cold_neon_rain: { energy: -2, inspiration: 2 },
  clear_industrial_night: { harmony: 1 },
  soft_rain: { energy: -2, inspiration: 1 },
  golden_hour: { harmony: 2 },
  afternoon_sun: { energy: 2 },
  evening_thunderstorm: { energy: -3, inspiration: 2 },
  neon_drizzle: { energy: -1, inspiration: 2 },
  clear_electric: { energy: 2, harmony: 1 },
};

export function weatherAppliedFlag(cityId: string): string {
  return `weather_applied_${cityId}`;
}
