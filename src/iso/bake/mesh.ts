/** Tiny offline mesh toolkit. Nothing in this module is shipped to the browser. */
export type V3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];
export interface Vertex { position: V3; normal: V3 }
export interface Triangle { vertices: [Vertex, Vertex, Vertex]; color: RGB }
export type Mesh = Triangle[];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (a: V3): V3 => mul(a, 1 / (Math.hypot(...a) || 1));
export function rotateZ(p: V3, a: number): V3 {
  return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];
}
export function ellipsoid(mesh: Mesh, center: V3, radius: V3, color: RGB,
  basis: [V3, V3, V3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  paint?: (normal: V3) => RGB, segments = 12, rings = 8): void {
  const transform = (p: V3) => add(add(mul(basis[0], p[0]), mul(basis[1], p[1])), mul(basis[2], p[2]));
  const vertex = (i: number, j: number): Vertex => {
    const a = i / segments * Math.PI * 2, b = j / rings * Math.PI;
    const n: V3 = [Math.cos(a) * Math.sin(b), Math.sin(a) * Math.sin(b), Math.cos(b)];
    return { position: add(center, transform([n[0] * radius[0], n[1] * radius[1], n[2] * radius[2]])),
      normal: unit(transform([n[0] / radius[0], n[1] / radius[1], n[2] / radius[2]])) };
  };
  for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2, b = (j + .5) / rings * Math.PI;
    const tint = paint?.([Math.cos(a) * Math.sin(b), Math.sin(a) * Math.sin(b), Math.cos(b)]) ?? color;
    const v00 = vertex(i, j), v10 = vertex(i + 1, j), v01 = vertex(i, j + 1), v11 = vertex(i + 1, j + 1);
    if (j > 0) mesh.push({ vertices: [v00, v10, v01], color: tint });
    if (j < rings - 1) mesh.push({ vertices: [v01, v10, v11], color: tint });
  }
}
/** A tapered limb is represented by a narrow oriented ellipsoid. */
export function bone(mesh: Mesh, from: V3, to: V3, thickness: number, color: RGB): void {
  const axis = unit(sub(to, from)), across = unit(cross(axis, Math.abs(axis[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
  ellipsoid(mesh, mul(add(from, to), .5), [thickness, thickness, Math.hypot(...sub(to, from)) / 2 + thickness * .2], color,
    [across, cross(axis, across), axis], undefined, 8, 6);
}

/** Export a real colored triangle model for inspection/import, not a pretend 3D image. */
export function meshToObj(mesh: Mesh): string {
  const lines = ['# Jungle procedural deer. Vertex colors: RGB extension. Units: model units.', 'o deer'];
  let index = 1;
  for (const triangle of mesh) {
    for (const v of triangle.vertices) lines.push(`v ${v.position.map(n => n.toFixed(5)).join(' ')} ${triangle.color.map(n => (n / 255).toFixed(4)).join(' ')}`);
    lines.push(`f ${index} ${index + 1} ${index + 2}`); index += 3;
  }
  return lines.join('\n') + '\n';
}
