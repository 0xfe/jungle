import { clamp } from '../iso/math';
import { quadBounds, type QuadCorners } from '../iso/quad';
import type { DrawCommand } from '../iso/render';

/** Split at shared source-space crown heights, moving wood/petals/leaves together.
 * Each band stays affine (the Canvas fast path); UV rows meet exactly. No new
 * texture, pixel resampling or per-leaf state is required. Lower trunks stay fixed. */
export function crownBands(command: DrawCommand, anchorY: number, logicalHeight: number,
  scale: number, flutter: number): DrawCommand[] {
  if (!command.region || !command.corners || Math.abs(flutter) < 1e-8) return [command];
  const region = command.region, pixelsPerUnit = region.height / logicalHeight;
  // Cut on actual atlas rows. The common root-relative offsets have the same
  // registration in separately trimmed base and foliage masks.
  const cuts = [0, ...[96, 48, 16].map(height => Math.round((anchorY - height) * pixelsPerUnit))
    .filter(y => y > 0 && y < region.height), region.height];
  const displacement = (row: number) => {
    const height = anchorY - row / pixelsPerUnit;
    // Piecewise linear in the common root space, including trimmed end bands.
    // Independently cropped color masks therefore cannot pull apart at the top.
    const bend = .35 * clamp((height - 16) / 32, 0, 1) + .65 * clamp((height - 48) / 48, 0, 1);
    return bend * flutter * scale;
  };
  const q = command.corners;
  const point = (row: number, right: boolean) => {
    const t = row / region.height, a = q[right ? 1 : 0], b = q[right ? 3 : 2];
    return { x: a.x + (b.x - a.x) * t + displacement(row), y: a.y + (b.y - a.y) * t };
  };
  return cuts.slice(0, -1).map((start, i) => {
    const end = cuts[i + 1]!;
    const corners: QuadCorners = [point(start, false), point(start, true), point(end, false), point(end, true)];
    return { ...command, ...quadBounds(corners), corners, id: i ? `${command.id}:wind${i}` : command.id,
      region: { ...region, y: region.y + start, height: end - start } };
  });
}

/** Stable per-component selection fades detail smoothly; no changing random set. */
export function rustleWeight(rank: number, coverage: number, detail: number): number {
  const t = clamp((coverage * detail - rank) / .12, 0, 1);
  return t * t * (3 - 2 * t);
}
