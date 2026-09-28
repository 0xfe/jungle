import { hash } from './math';
export interface ScatterPoint { x: number; y: number; slot: number }
/** Stateless local priority thinning. The halo gives identical spacing across chunks,
 * even if neighbors have never been loaded. Bounds are half-open integer cells. */
export function scatterCell(x: number, y: number, seed: number, spacing = .44): ScatterPoint[] {
  const candidate = (cx: number, cy: number, slot: number) => ({
    x: cx + hash(cx, cy, seed + slot * 97), y: cy + hash(cx, cy, seed + slot * 97 + 31),
    rank: hash(cx, cy, seed + slot * 97 + 63), slot,
  });
  if (!(spacing > 0 && spacing <= 1)) throw new Error('Scatter spacing must be in (0, 1]');
  const result: ScatterPoint[] = [];
  for (let slot = 0; slot < 2; slot++) {
    const p = candidate(x, y, slot); let keep = true;
    for (let cy = y - 1; cy <= y + 1 && keep; cy++) for (let cx = x - 1; cx <= x + 1 && keep; cx++) for (let s = 0; s < 2; s++) {
      if (cx === x && cy === y && s === slot) continue;
      const q = candidate(cx, cy, s);
      // Lexical tie-break keeps the spacing guarantee even on a hash collision.
      const earlier = q.rank < p.rank || (q.rank === p.rank && (cy < y || cy === y && (cx < x || cx === x && s < slot)));
      if (earlier && (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < spacing ** 2) { keep = false; break; }
    }
    if (keep) result.push({ x: p.x, y: p.y, slot });
  }
  return result;
}
