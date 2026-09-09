// What the tour remembers about each city it has played.
//
// Written as things happen (the show ends, a minigame resolves), read when the route books the
// band back into a city for the return leg. Kept deliberately tiny — see CityMemory — because the
// point is a reputation, not a replay: enough for a town to have an opinion, not enough to
// reconstruct the night.
import { State, type CityMemory } from '../core/state';

/** The memory for a city, or undefined if the band has not played there yet. */
export function memoryFor(cityId: string): CityMemory | undefined {
  return (State.data.cityMemories ?? []).find((m) => m.cityId === cityId);
}

/** True once a city has a memory — i.e. this arrival is a RETURN, not a first night. */
export function hasPlayed(cityId: string): boolean {
  return memoryFor(cityId) !== undefined;
}

function upsert(cityId: string, patch: Partial<CityMemory>): void {
  const list = State.data.cityMemories ?? (State.data.cityMemories = []);
  const existing = list.find((m) => m.cityId === cityId);
  if (existing) {
    Object.assign(existing, patch);
    return;
  }
  // Defaults describe "played, unremarkable" so a partial write (a minigame recorded before the
  // show) is still a valid memory rather than a half-object the feed has to guard against.
  list.push({ cityId, show: 'solid', love: 0, ...patch });
}

/** Records a show. The FIRST show for a city is its lasting reputation and is never overwritten;
 *  a second show in the same city (the return leg) is recorded alongside it, and the comparison
 *  between the two is flagged so the epilogue can tell that story. */
export function recordShow(cityId: string, show: CityMemory['show'], love: number): void {
  const existing = memoryFor(cityId);
  // A memory can already exist WITHOUT a show having been played — recordMinigame() creates one,
  // and the minigame always resolves before the show. Only a genuinely recorded first show makes
  // the next one a return leg; `show` alone cannot tell them apart, because it carries a default.
  if (!existing?.firstShowRecorded) {
    upsert(cityId, { show, love, firstShowRecorded: true });
    return;
  }
  upsert(cityId, { secondShow: show, love });
  State.addFlag(returnLegFlag(existing.show, show));
}

const RANK: Record<CityMemory['show'], number> = { rough: 0, solid: 1, triumph: 2 };

/** How the return leg went RELATIVE to the first night — the only comparison the epilogue needs.
 *  Coming back to a town that saw you struggle and winning it over is a different story from
 *  being great twice, and both are different from slipping. */
export function returnLegFlag(first: CityMemory['show'], second: CityMemory['show']): string {
  if (RANK[second] > RANK[first]) return 'return_redeemed';
  if (RANK[second] < RANK[first]) return 'return_slipped';
  return 'return_held';
}

/** Records how the city's minigame went, so the return leg can be specific about it. */
export function recordMinigame(cityId: string, good: boolean, title: string): void {
  upsert(cityId, { minigameGood: good, minigameTitle: title });
}

/** Flag marking that a city's return-leg feed has already been shown, so resuming a save mid-city
 *  does not replay it. Same "flag names a one-time event" pattern the scene pool already uses. */
export function returnFeedFlag(cityId: string): string {
  return `social_feed_seen_${cityId}`;
}
