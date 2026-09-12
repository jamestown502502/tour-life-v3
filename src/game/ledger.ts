// The Van Ledger: pure financial-literacy minigame logic, kept apart from MiniGameScene (which
// imports Phaser) so every rule here is testable from plain Vitest — same split as rhythm.ts.
//
// Money in this game is the `funds` stat: it starts at 500, six Hub events nudge it by 10-20,
// and two endings read it. Nothing asked the player to make a money decision before this pass.
// Every exercise here is a real tour decision with real numbers on screen, graded on the same
// three no-fail tiers as every other minigame (rough / good / perfect), and its effect on funds
// is deliberately scaled down (about a tenth of the dollars shown) so a ledger never swings a
// run the way a show does.
import type { MiniGameDef } from '../../content/schema';

export type LedgerTier = 'rough' | 'good' | 'perfect';

export interface LedgerOutcome {
  tier: LedgerTier;
  /** Funds delta to apply, already scaled. */
  funds: number;
  /** One line explaining the money, shown before the outro. */
  explain: string;
  /** Short ledger-card label for the Hub, e.g. "Door split, +$140". */
  label: string;
}

export const DEFAULT_LEDGER = {
  split: { guarantee: 300, doorPct: 70, ticketPrice: 12, capacity: 120 },
  pricing: { unitCost: 8, stock: 40, minPrice: 10, maxPrice: 40 },
  perdiem: { budget: 60 },
  gearcall: { price: 240, rentPerShow: 45 },
  exchange: { rates: [
    { label: 'Airport kiosk', rate: 1.02, feePct: 9 },
    { label: 'Street ATM', rate: 0.98, feePct: 2.5 },
    { label: 'Venue owner\'s cousin', rate: 1.05, feePct: 9.5 },
  ] },
} as const;

export type LedgerDef = MiniGameDef['ledger'];

function scale(dollars: number): number { return Math.round(dollars / 10); }

// ---- split: guarantee vs door ----------------------------------------------------------------
export function doorTake(def: { doorPct: number; ticketPrice: number; capacity: number }, turnout: number): number {
  return Math.round((def.doorPct / 100) * def.ticketPrice * def.capacity * turnout);
}
/** The turnout at which the door deal equals the guarantee — the number worth knowing. */
export function breakEvenTurnout(def: { guarantee: number; doorPct: number; ticketPrice: number; capacity: number }): number {
  const full = doorTake(def, 1);
  return full > 0 ? Math.min(1, def.guarantee / full) : 1;
}
export function resolveSplit(
  def: { guarantee: number; doorPct: number; ticketPrice: number; capacity: number },
  choice: 'guarantee' | 'door',
  estimate: number,
  actual: number,
): LedgerOutcome {
  const take = choice === 'door' ? doorTake(def, actual) : def.guarantee;
  const other = choice === 'door' ? def.guarantee : doorTake(def, actual);
  const bestChoice: 'guarantee' | 'door' = doorTake(def, estimate) >= def.guarantee ? 'door' : 'guarantee';
  const reasoned = choice === bestChoice;
  const closeEstimate = Math.abs(estimate - actual) <= 0.15;
  const tier: LedgerTier = reasoned && closeEstimate ? 'perfect' : (reasoned || take >= other) ? 'good' : 'rough';
  const pct = Math.round(actual * 100);
  const explain = choice === 'door'
    ? `The room came in at ${pct}% full. ${def.doorPct}% of the door was $${take}; the guarantee would have paid $${def.guarantee}.`
    : `You took the sure $${def.guarantee}. The room came in at ${pct}% full, so the door would have paid $${other}.`;
  return { tier, funds: scale(take - def.guarantee), explain, label: choice === 'door' ? `Door split, $${take}` : `Guarantee, $${take}` };
}

// ---- pricing: the merch table -----------------------------------------------------------------
export function demandAt(def: { stock: number; minPrice: number; maxPrice: number }, price: number): number {
  // Linear-ish demand: everyone buys at the floor price, nobody above the ceiling, curving a
  // little so the best price sits inside the range rather than at an edge.
  const t = (price - def.minPrice) / Math.max(1, def.maxPrice - def.minPrice);
  const share = Math.max(0, Math.min(1, 1 - Math.pow(Math.max(0, t), 1.25)));
  return Math.round(def.stock * share);
}
export function profitAt(def: { unitCost: number; stock: number; minPrice: number; maxPrice: number }, price: number): number {
  const sold = demandAt(def, price);
  return sold * price - def.stock * def.unitCost;
}
export function bestPrice(def: { unitCost: number; stock: number; minPrice: number; maxPrice: number }): { price: number; profit: number } {
  let best = { price: def.minPrice, profit: -Infinity };
  for (let p = def.minPrice; p <= def.maxPrice; p += 1) {
    const profit = profitAt(def, p);
    if (profit > best.profit) best = { price: p, profit };
  }
  return best;
}
export function resolvePricing(def: { unitCost: number; stock: number; minPrice: number; maxPrice: number }, price: number): LedgerOutcome {
  const sold = demandAt(def, price);
  const profit = profitAt(def, price);
  const best = bestPrice(def);
  const ratio = best.profit > 0 ? profit / best.profit : 1;
  const tier: LedgerTier = ratio >= 0.9 ? 'perfect' : ratio >= 0.6 ? 'good' : 'rough';
  const leftover = def.stock - sold;
  const explain = `$${price} each: ${sold} sold${leftover > 0 ? `, ${leftover} left in the box` : ', sold out'}. Cost $${def.stock * def.unitCost}, revenue $${sold * price}, ${profit >= 0 ? 'profit' : 'loss'} $${Math.abs(profit)}. Best price was $${best.price}.`;
  return { tier, funds: scale(profit), explain, label: `Merch, ${profit >= 0 ? '+' : '-'}$${Math.abs(profit)}` };
}

// ---- perdiem: tomorrow's budget ---------------------------------------------------------------
export interface PerDiemAlloc { food: number; lodging: number; rest: number }
export function perDiemForecast(alloc: PerDiemAlloc): { energy: number; harmony: number } {
  // Food and rest feed energy with diminishing returns; a real bed feeds harmony (nobody fights
  // after sleeping horizontally). Spending nothing on food is a real cost, not neutral.
  const energy = Math.round(Math.min(10, alloc.food / 3) + Math.min(8, alloc.rest / 2.5) - (alloc.food < 10 ? 6 : 0));
  const harmony = Math.round(Math.min(6, alloc.lodging / 5) - (alloc.lodging < 10 ? 4 : 0));
  return { energy, harmony };
}
export function resolvePerDiem(def: { budget: number }, alloc: PerDiemAlloc): LedgerOutcome {
  const spent = alloc.food + alloc.lodging + alloc.rest;
  const left = def.budget - spent;
  const f = perDiemForecast(alloc);
  const starved = alloc.food < 10 || alloc.lodging < 10;
  const balanced = !starved && f.energy >= 8 && f.harmony >= 3;
  const tier: LedgerTier = left < 0 ? 'rough' : balanced && left >= 0 ? 'perfect' : !starved ? 'good' : 'rough';
  const explain = left < 0
    ? `That's $${-left} over the $${def.budget} per diem. Rowan covers it and does not let you forget.`
    : `$${spent} of $${def.budget} spent, $${left} back in the float. Tomorrow: energy ${f.energy >= 0 ? '+' : ''}${f.energy}, harmony ${f.harmony >= 0 ? '+' : ''}${f.harmony}.`;
  return { tier, funds: scale(Math.max(-40, left)), explain, label: `Per diem, $${left >= 0 ? left : 0} saved` };
}

// ---- gearcall: buy, rent, or pass -------------------------------------------------------------
export function resolveGearCall(def: { price: number; rentPerShow: number }, showsLeft: number, choice: 'buy' | 'rent' | 'pass'): LedgerOutcome {
  const rentTotal = def.rentPerShow * Math.max(1, showsLeft);
  const cheapestPaid: 'buy' | 'rent' = def.price <= rentTotal ? 'buy' : 'rent';
  const cost = choice === 'buy' ? def.price : choice === 'rent' ? rentTotal : 0;
  const tier: LedgerTier = choice === cheapestPaid ? 'perfect' : choice === 'pass' ? 'rough' : 'good';
  const explain = choice === 'pass'
    ? `You pass. Jun plays the old rig. Buying was $${def.price}; renting for the ${showsLeft} shows left was $${rentTotal}.`
    : `${choice === 'buy' ? 'Bought' : 'Rented'} for $${cost}. Over the ${showsLeft} shows left, ${cheapestPaid === 'buy' ? 'buying' : 'renting'} was the cheaper way to have it on stage${choice === cheapestPaid ? ' — which is what you did.' : '.'}`;
  return { tier, funds: cost === 0 ? 0 : -scale(cost), explain, label: choice === 'pass' ? 'Passed on the synth' : `${choice === 'buy' ? 'Bought' : 'Rented'} the synth, -$${cost}` };
}

// ---- exchange: reading the fee ----------------------------------------------------------------
export function effectiveRate(r: { rate: number; feePct: number }): number { return r.rate * (1 - r.feePct / 100); }
export function resolveExchange(rates: readonly { label: string; rate: number; feePct: number }[], pick: number, amount = 200): LedgerOutcome {
  const eff = rates.map(effectiveRate);
  const best = Math.max(...eff);
  const mine = eff[pick];
  const gap = (best - mine) / best;
  const tier: LedgerTier = gap <= 0.001 ? 'perfect' : gap <= 0.04 ? 'good' : 'rough';
  const got = Math.round(amount * mine);
  const bestGot = Math.round(amount * best);
  const explain = `$${amount} became ${got} local at ${rates[pick].label} (rate ${rates[pick].rate.toFixed(2)}, fee ${rates[pick].feePct}%). The best window paid ${bestGot}. The fee is part of the rate.`;
  return { tier, funds: -scale(bestGot - got) + (tier === 'perfect' ? 3 : 0), explain, label: `Exchange, ${got} local` };
}

/** Which of a city's bandmate-hosted minigames this run offers (two of them, by seed), plus every
 *  non-hosted one. Deterministic per seed, so a replayed seed offers the same hosts. */
export function hostedSelection<T extends { hostBandmate?: string }>(minigames: readonly T[], pick: (n: number) => number, count = 2): T[] {
  const hosted = minigames.filter((m) => m.hostBandmate);
  const plain = minigames.filter((m) => !m.hostBandmate);
  const chosen: T[] = [];
  const pool = [...hosted];
  while (chosen.length < count && pool.length > 0) chosen.push(pool.splice(pick(pool.length), 1)[0]);
  // Keep authored order so insertion points stay predictable.
  return minigames.filter((m) => plain.includes(m) || chosen.includes(m));
}
