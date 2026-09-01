// Seeded PRNG (mulberry32) + a seed-string generator/hasher so runs are reproducible.

export type RNG = {
  next(): number; // [0, 1)
  int(minInclusive: number, maxExclusive: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  chance(probability: number): boolean;
};

function hashStringToSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: string): RNG {
  const next = mulberry32(hashStringToSeed(seed));
  return {
    next,
    int(minInclusive, maxExclusive) {
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
    },
    pick(arr) {
      if (arr.length === 0) throw new Error('rng.pick: empty array');
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle(arr) {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
    chance(probability) {
      return next() < probability;
    },
  };
}

const SEED_WORDS = [
  'amber', 'bramble', 'cinder', 'drift', 'echo', 'fable', 'gale', 'harbor',
  'indigo', 'juniper', 'kestrel', 'lantern', 'meadow', 'nomad', 'opal', 'pilgrim',
  'quartz', 'ravel', 'sable', 'thistle', 'umber', 'vagrant', 'willow', 'zephyr',
];

export function generateSeed(): string {
  const rand = () => Math.floor(Math.random() * SEED_WORDS.length);
  const digits = Math.floor(Math.random() * 900) + 100;
  return `${SEED_WORDS[rand()]}-${SEED_WORDS[rand()]}-${digits}`;
}
