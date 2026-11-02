/**
 * Deterministic pseudo-random numbers.
 *
 * Why this exists: the topology and the live feed need irregular-looking
 * timings, but `Math.random()` in render produces different values on the
 * server and the client, which React 19 reports as a hydration mismatch.
 * Everything visual is therefore seeded, so SSR and the first client render
 * agree exactly.
 */

/** mulberry32 — small, fast, good enough distribution for visual jitter. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string, for deriving a seed from an id. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngBetween(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function rngInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rngBetween(rng, min, max + 1));
}

export function rngPick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error('rngPick: empty list');
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index] as T;
}

/** Round to a fixed number of decimals so SSR/CSR strings match byte-for-byte. */
export function fixed(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
