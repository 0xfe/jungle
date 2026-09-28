/** World coordinates are independent of pixels and of any browser. */
export interface Vec2 { x: number; y: number }
export interface Projection { width: number; height: number }
export const project = (p: Vec2, tile: Projection): Vec2 => ({
  x: (p.x - p.y) * tile.width / 2, y: (p.x + p.y) * tile.height / 2,
});
export const unproject = (p: Vec2, tile: Projection): Vec2 => ({
  x: p.x / tile.width + p.y / tile.height,
  y: p.y / tile.height - p.x / tile.width,
});
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Integer coordinate hash: chunk visitation order never changes the world. */
function avalanche(n: number): number {
  n = Math.imul(n ^ n >>> 16, 0x7feb352d);
  n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return (n ^ n >>> 16) >>> 0;
}
export function hash(x: number, y: number, seed: number): number {
  // Mix signed axes separately: XORing their raw products aliases many (+x,+y)/(-x,-y) pairs.
  const a = avalanche((x | 0) ^ seed), b = avalanche((y | 0) ^ seed ^ 0x9e3779b9);
  return avalanche(a + Math.imul(b, 0x85ebca6b)) / 4294967296;
}
export function random(seed: number): () => number {
  let n = seed >>> 0;
  return () => { n += 0x6d2b79f5; let t = n;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/** Continuous fields avoid independent per-tile climate / shoreline seams. */
export function noise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const smooth = (v: number) => v * v * (3 - 2 * v);
  const u = smooth(x - ix), v = smooth(y - iy);
  return lerp(lerp(hash(ix, iy, seed), hash(ix + 1, iy, seed), u),
    lerp(hash(ix, iy + 1, seed), hash(ix + 1, iy + 1, seed), u), v);
}

export class FixedClock {
  private remainder = 0;
  readonly step = 1 / 60;
  get alpha(): number { return clamp(this.remainder / this.step, 0, 1); }
  reset(): void { this.remainder = 0; }
  /** Bound catch-up after a hidden tab. Pausing must happen before advance. */
  advance(elapsed: number, update: (dt: number) => void): number {
    this.remainder += clamp(elapsed, 0, 0.1);
    let steps = 0;
    while (this.remainder + 1e-10 >= this.step) {
      update(this.step); this.remainder -= this.step; steps++;
    }
    return steps;
  }
}
