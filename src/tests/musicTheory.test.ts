// The two teaching minigames assert facts about music. If those facts are wrong, the game is
// worse than if it had never tried to teach anything — a player who learns "a minor third is 4
// semitones" here carries that error out with them.
//
// So the intervals and clave patterns are checked against the actual definitions rather than
// trusted. Sources for the patterns: the son clave is the 3-2 / 2-3 pair with strokes on the
// 1, the "and" of 2, the 4, then 2 and 3 of the second bar; rumba clave moves the third stroke
// one sixteenth later. Interval names are semitone counts, which are not a matter of opinion.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync('src/ui/MiniGameScene.ts', 'utf8');

/** Pulls the { semitones, name } pairs the interval game actually offers. */
function intervalClaims(): { semitones: number; name: string }[] {
  const out: { semitones: number; name: string }[] = [];
  const re = /\{ semitones: (\d+), name: '([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(SOURCE))) out.push({ semitones: Number(m[1]), name: m[2] });
  return out;
}

/** Pulls the { name, grid } pairs the clave game actually offers. */
function claveClaims(): { name: string; grid: string }[] {
  const out: { name: string; grid: string }[] = [];
  const re = /\{ name: '([^']+)', grid: '([x.]+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(SOURCE))) out.push({ name: m[1], grid: m[2] });
  return out;
}

// Semitone counts. Not negotiable.
const TRUE_INTERVALS: Record<string, number> = {
  'Unison': 0,
  'Major second': 2,
  'Minor third': 3,
  'Major third': 4,
  'Fourth': 5,
  'Fifth': 7,
  'Octave': 12,
};

describe('the interval exercise teaches correct music theory', () => {
  it('offers at least three intervals', () => {
    expect(new Set(intervalClaims().map((i) => i.name)).size).toBeGreaterThanOrEqual(3);
  });

  it('every named interval has the right number of semitones', () => {
    const wrong: string[] = [];
    for (const { semitones, name } of intervalClaims()) {
      const truth = TRUE_INTERVALS[name];
      expect(truth, `"${name}" is not a name this test knows — add it to TRUE_INTERVALS deliberately`).toBeDefined();
      if (truth !== semitones) wrong.push(`${name} claimed ${semitones}, is ${truth}`);
    }
    expect(wrong, wrong.join(' | ')).toEqual([]);
  });

  it('teaches the major/minor third distinction, which is the one that matters', () => {
    const names = intervalClaims().map((i) => i.name);
    expect(names).toContain('Major third');
    expect(names).toContain('Minor third');
  });
});

describe('the clave exercise teaches correct rhythm', () => {
  const claims = claveClaims();

  it('every pattern is exactly two bars of sixteenths', () => {
    for (const c of claims) expect(c.grid.length, `${c.name} is ${c.grid.length} slots`).toBe(16);
  });

  it('the son clave has five strokes, three then two', () => {
    const son = claims.find((c) => c.name === '3-2 son clave');
    expect(son, 'the 3-2 son clave must be offered — it is the pattern the scene is named for').toBeDefined();
    const strokes = [...son!.grid].filter((c) => c === 'x').length;
    expect(strokes, 'a son clave has five strokes').toBe(5);
    const firstBar = [...son!.grid.slice(0, 8)].filter((c) => c === 'x').length;
    const secondBar = [...son!.grid.slice(8)].filter((c) => c === 'x').length;
    expect([firstBar, secondBar], '3-2 means three strokes then two').toEqual([3, 2]);
  });

  it('the 2-3 son clave is the 3-2 with its bars swapped', () => {
    const son = claims.find((c) => c.name === '3-2 son clave')!;
    const rev = claims.find((c) => c.name === '2-3 son clave');
    expect(rev).toBeDefined();
    expect(rev!.grid.slice(0, 8) + rev!.grid.slice(8)).toHaveLength(16);
    const a = [...rev!.grid.slice(0, 8)].filter((c) => c === 'x').length;
    const b = [...rev!.grid.slice(8)].filter((c) => c === 'x').length;
    expect([a, b], '2-3 means two strokes then three').toEqual([2, 3]);
    expect([...rev!.grid].filter((c) => c === 'x').length).toBe([...son.grid].filter((c) => c === 'x').length);
  });

  it('no two offered patterns are identical, or the question has two right answers', () => {
    const grids = claims.map((c) => c.grid);
    expect(new Set(grids).size, `duplicate patterns: ${grids.join(' ')}`).toBe(grids.length);
  });
});
