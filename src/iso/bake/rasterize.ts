import type { PixelImage } from '../render';
import { dot, rotateZ, unit, type Mesh, type V3 } from './mesh';
export interface BakeCamera { width: number; height: number; anchor: [number, number]; scale: number }
const light = unit([-3, -4, 7]);
/** Orthographic 2:1 ground projection, z-buffer, palette shading, no GPU/native Canvas. */
export function bakeMesh(mesh: Mesh, heading: number, camera: BakeCamera): PixelImage {
  const { width, height, anchor, scale } = camera;
  const data = new Uint8Array(width * height * 4), depth = new Float32Array(width * height).fill(-Infinity);
  const project = (p: V3) => ({ x: anchor[0] + (p[0] - p[1]) * Math.SQRT1_2 * scale,
    y: anchor[1] + ((p[0] + p[1]) * Math.SQRT1_2 * .5 - p[2] * Math.sqrt(.75)) * scale,
    depth: (p[0] + p[1]) * Math.SQRT1_2 * Math.sqrt(.75) + p[2] * .5 });
  for (const triangle of mesh) {
    const vertices = triangle.vertices.map(v => ({ ...project(rotateZ(v.position, heading)), light: Math.max(0, dot(rotateZ(v.normal, heading), light)) }));
    const [a, b, c] = vertices as [typeof vertices[number], typeof vertices[number], typeof vertices[number]];
    const area = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
    if (Math.abs(area) < 1e-6) continue;
    const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))), maxX = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))), maxY = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const wa = ((b.y - c.y) * (x + .5 - c.x) + (c.x - b.x) * (y + .5 - c.y)) / area;
      const wb = ((c.y - a.y) * (x + .5 - c.x) + (a.x - c.x) * (y + .5 - c.y)) / area;
      const wc = 1 - wa - wb;
      if (wa < 0 || wb < 0 || wc < 0) continue;
      const z = wa * a.depth + wb * b.depth + wc * c.depth, i = y * width + x;
      if (z <= depth[i]!) continue;
      depth[i] = z;
      const shade = .7 + Math.round((wa * a.light + wb * b.light + wc * c.light) * 5) / 5 * .4;
      for (let channel = 0; channel < 3; channel++) data[i * 4 + channel] = Math.min(255, Math.round(triangle.color[channel]! * shade));
      data[i * 4 + 3] = 255;
    }
  }
  // A one-pixel dark silhouette keeps the model in the existing pixel-art vocabulary.
  const outline = data.slice();
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x;
    if (data[i * 4 + 3]) continue;
    if ([-1, 1, -width, width].some(offset => data[(i + offset) * 4 + 3])) outline.set([53, 46, 30, 255], i * 4);
  }
  return { width, height, data: outline };
}
