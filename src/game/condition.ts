// Tiny, safe condition-expression evaluator for content-authored gates. No eval().
// Grammar: terms joined by "&&" (AND). Each term is one of:
//   stat.<key><op><number>          e.g. "stat.harmony>=30"
//   relationship.<id><op><number>   e.g. "relationship.mira>=20"
//   localLove.<cityId><op><number>  e.g. "localLove.lisbon>=10"
//   flag:<name>  |  !flag:<name>

export interface ConditionContext {
  stats: Record<string, number>;
  relationships: Record<string, number>;
  localLove: Record<string, number>;
  flags: string[];
}

const OPS: Record<string, (a: number, b: number) => boolean> = {
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '==': (a, b) => a === b,
};

const FLAG_RE = /^(!)?flag:([\w:-]+)$/;
const CMP_RE = /^(stat|relationship|localLove)\.([\w-]+)\s*(>=|<=|>|<|==)\s*(-?\d+(?:\.\d+)?)$/;

function evalTerm(rawTerm: string, ctx: ConditionContext): boolean {
  const term = rawTerm.trim();
  if (!term) return true;

  const flagMatch = term.match(FLAG_RE);
  if (flagMatch) {
    const negate = !!flagMatch[1];
    const has = ctx.flags.includes(flagMatch[2]);
    return negate ? !has : has;
  }

  const cmpMatch = term.match(CMP_RE);
  if (cmpMatch) {
    const [, bucket, key, op, valStr] = cmpMatch;
    const source = bucket === 'stat' ? ctx.stats : bucket === 'relationship' ? ctx.relationships : ctx.localLove;
    const actual = source[key] ?? 0;
    return OPS[op](actual, parseFloat(valStr));
  }

  console.warn(`[condition] unparseable term: "${term}" — treating as false`);
  return false;
}

export function evaluateCondition(condition: string | undefined, ctx: ConditionContext): boolean {
  if (!condition) return true;
  return condition.split('&&').every((term) => evalTerm(term, ctx));
}
