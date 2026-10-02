// The Van Ledger: pure financial-literacy minigame logic, kept apart from MiniGameScene (which
// imports Phaser) so every rule here is testable from plain Vitest — same split as rhythm.ts.
//
// Money in this game is the `funds` stat: it starts at 500, six Hub events nudge it by 10-20,
// and two endings read it. Nothing asked the player to make a money decision before this pass.
// Every exercise here is a real tour decision with real numbers on screen, graded on the same
// three no-fail tiers as every other minigame (rough / good / perfect), and its effect on funds
// is deliberately scaled down (about a tenth of the dollars shown) so a ledger never swings a
// run the way a show does.
import type { MiniGameDef, StatDeltas } from '../../content/schema';

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

/** The {tokens} each type's copy may use. Anything else in a copy string is an authoring error,
 *  caught by src/tests/minigameSlots.test.ts rather than rendered as a literal brace. */
export const COPY_TOKENS: Record<string, string[]> = {
  split: ['guarantee', 'doorPct', 'capacity', 'ticketPrice'],
  pricing: ['stock', 'unitCost'],
  perdiem: ['budget', 'over'],
  gearcall: ['price', 'rentPerShow', 'shows', 'rentTotal'],
  exchange: [],
  chordquality: ['round', 'rounds'],
  transpose: ['round', 'rounds', 'from', 'move'],
  meter: ['round', 'rounds'],
  tempo: ['round', 'rounds'],
};

/** Fill {token} placeholders. Unknown tokens are left as written so a test can find them. */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

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
export function resolvePerDiem(def: { budget: number }, alloc: PerDiemAlloc, overBudgetLine?: string): LedgerOutcome {
  const spent = alloc.food + alloc.lodging + alloc.rest;
  const left = def.budget - spent;
  const f = perDiemForecast(alloc);
  const starved = alloc.food < 10 || alloc.lodging < 10;
  const balanced = !starved && f.energy >= 8 && f.harmony >= 3;
  const tier: LedgerTier = left < 0 ? 'rough' : balanced && left >= 0 ? 'perfect' : !starved ? 'good' : 'rough';
  const explain = left < 0
    ? (overBudgetLine ? fillTemplate(overBudgetLine, { over: -left, budget: def.budget }) : `That's $${-left} over the $${def.budget} per diem. Rowan covers it and does not let you forget.`)
    : `$${spent} of $${def.budget} spent, $${left} back in the float. Tomorrow: energy ${f.energy >= 0 ? '+' : ''}${f.energy}, harmony ${f.harmony >= 0 ? '+' : ''}${f.harmony}.`;
  return { tier, funds: scale(Math.max(-40, left)), explain, label: `Per diem, $${left >= 0 ? left : 0} saved` };
}

// ---- gearcall: buy, rent, or pass -------------------------------------------------------------
export function resolveGearCall(def: { price: number; rentPerShow: number }, showsLeft: number, choice: 'buy' | 'rent' | 'pass', copy: { thing?: string; passLine?: string } = {}): LedgerOutcome {
  const thing = copy.thing ?? 'the synth';
  const rentTotal = def.rentPerShow * Math.max(1, showsLeft);
  const cheapestPaid: 'buy' | 'rent' = def.price <= rentTotal ? 'buy' : 'rent';
  const cost = choice === 'buy' ? def.price : choice === 'rent' ? rentTotal : 0;
  const tier: LedgerTier = choice === cheapestPaid ? 'perfect' : choice === 'pass' ? 'rough' : 'good';
  const explain = choice === 'pass'
    ? `${copy.passLine ?? 'You pass. Jun plays the old rig.'} Buying was $${def.price}; renting for the ${showsLeft} shows left was $${rentTotal}.`
    : `${choice === 'buy' ? 'Bought' : 'Rented'} for $${cost}. Over the ${showsLeft} shows left, ${cheapestPaid === 'buy' ? 'buying' : 'renting'} was the cheaper way to have it on stage${choice === cheapestPaid ? ' — which is what you did.' : '.'}`;
  return { tier, funds: cost === 0 ? 0 : -scale(cost), explain, label: choice === 'pass' ? `Passed on ${thing}` : `${choice === 'buy' ? 'Bought' : 'Rented'} ${thing}, -$${cost}` };
}

// ---- exchange: reading the fee ----------------------------------------------------------------
export function effectiveRate(r: { rate: number; feePct: number }): number { return r.rate * (1 - r.feePct / 100); }

/** One window's sum, step by step: the headline amount, the fee taken off it, what you keep.
 *  `net` is rounded exactly as resolveExchange rounds, so the working never disagrees with it. */
export function exchangeWorking(r: { label: string; rate: number; feePct: number }, amount = 200): { gross: number; fee: number; net: number; line: string; short: string } {
  const gross = Math.round(amount * r.rate);
  const net = Math.round(amount * effectiveRate(r));
  const fee = gross - net;
  return {
    gross, fee, net,
    line: `${r.label}: ${amount} × ${r.rate.toFixed(2)} = ${gross}, minus the ${r.feePct}% fee (${fee}) = ${net}`,
    // one line per window when all three are shown at once
    short: `${r.label}: ${gross} - ${fee} fee = ${net}`,
  };
}

/** The fee-calculator step (2026-10-02): work out what the window with the best HEADLINE rate
 *  really pays. That window is the trap the whole lesson is about, so the wrong answers are the
 *  two mistakes people make: reading the rate alone, and forgetting to convert at all. */
export function exchangeCalcQuestion(rates: readonly { label: string; rate: number; feePct: number }[], amount = 200): { window: { label: string; rate: number; feePct: number }; answer: number; options: number[] } {
  const window = rates.reduce((a, b) => (b.rate > a.rate ? b : a));
  const w = exchangeWorking(window, amount);
  const options = [w.net, w.gross, amount].filter((v, i, all) => all.indexOf(v) === i);
  return { window, answer: w.net, options };
}
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

// ---- echoes and lessons -----------------------------------------------------------------------
// A money decision used to be settled on the spot and never mentioned again. Now it comes back on
// the next drive (VanScene) as a line of story with a small stat effect, and every decision the
// run made is summed up in the Scrapbook with the rule of thumb behind it. Research on financial
// games is consistent that consequences and a moment of reflection are what make the lesson stick.

export type LedgerType = 'split' | 'pricing' | 'perdiem' | 'gearcall' | 'exchange';
export const LEDGER_TYPES: readonly LedgerType[] = ['split', 'pricing', 'perdiem', 'gearcall', 'exchange'];

const ECHOES: Record<LedgerType, { good: string[]; rough: string[]; goodFx: StatDeltas; roughFx: StatDeltas }> = {
  split: {
    good: ['An email from the {city} booker: the room remembered you, and they want you back.', 'Rowan reads the {city} door numbers out loud again, just to hear them.'],
    rough: ['Rowan does the {city} sums one more time in the van. "Next time we trust the break-even."'],
    goodFx: { inspiration: 2 }, roughFx: { harmony: -1 },
  },
  pricing: {
    good: ['Someone at a petrol station is wearing your {city} shirt. Mira takes a photo from behind a pump.'],
    rough: ['Half the {city} merch is still in the back of the van, and it rattles on every turn.'],
    goodFx: { inspiration: 2 }, roughFx: { harmony: -1 },
  },
  perdiem: {
    good: ['Theo slept properly in {city}, and it shows. He drives the first shift without being asked.'],
    rough: ['Theo is still tired from {city}. Nobody mentions it, which is how you know.'],
    goodFx: { energy: 3 }, roughFx: { energy: -3 },
  },
  gearcall: {
    good: ['The gear decision from {city} is paying for itself. It sounds right, and it is ours.'],
    rough: ['The borrowed gear from {city} is making a noise nobody can place. Jun keeps looking at it.'],
    goodFx: { inspiration: 2 }, roughFx: { harmony: -1 },
  },
  exchange: {
    good: ['The money changed in {city} stretched further than anyone expected. Theo counts it twice.'],
    rough: ['Theo finds the {city} exchange receipt in the glovebox and reads the fee out loud.'],
    goodFx: { funds: 2 }, roughFx: { harmony: -1 },
  },
};

/** The line and effect a past decision brings back on the next drive. `pick` chooses among
 *  variants (pass a seeded rng's pick for determinism). Perfect earns a little more than good. */
export function ledgerEcho(type: LedgerType, tier: LedgerTier, cityName: string, pick: (lines: string[]) => string = (l) => l[0]): { text: string; effects: StatDeltas } {
  const e = ECHOES[type];
  const good = tier !== 'rough';
  const effects: StatDeltas = { ...(good ? e.goodFx : e.roughFx) };
  if (tier === 'perfect') for (const k of Object.keys(effects) as (keyof StatDeltas)[]) effects[k] = (effects[k] ?? 0) + 1;
  return { text: pick(good ? e.good : e.rough).replace(/\{city\}/g, cityName), effects };
}

/** The rule of thumb behind each kind of decision, for the Scrapbook's ledger page. */
export const LEDGER_LESSONS: Record<LedgerType, string> = {
  split: 'Know your break-even. Take the guarantee when you doubt the room will pass it; take the door when you are sure it will.',
  pricing: 'Profit is margin times how many people actually buy. The highest price and the busiest table are both usually wrong.',
  perdiem: 'A budget is a plan for every dollar. Starving one line to save money still costs you, just later.',
  gearcall: 'Buy when renting for as long as you will need it costs more than the price. Otherwise rent.',
  exchange: 'Compare what you actually receive after the fee, never the headline rate.',
};
