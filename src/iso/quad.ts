import type { Vec2 } from './math';
/** Corner order follows UVs: (0,0), (1,0), (0,1), (1,1). */
export type QuadCorners = readonly [Vec2, Vec2, Vec2, Vec2];
export function quadBounds(corners: QuadCorners): { x: number; y: number; width: number; height: number } {
  const [a,b,c,d]=corners;
  const x=Math.min(a.x,b.x,c.x,d.x),y=Math.min(a.y,b.y,c.y,d.y);
  return {x,y,width:Math.max(a.x,b.x,c.x,d.x)-x,height:Math.max(a.y,b.y,c.y,d.y)-y};
}
/** Inverse mapping of the same two affine triangles used by GL and Canvas. */
export function quadUV(points: QuadCorners, x: number, y: number, texcoords?:QuadCorners): { u: number; v: number } | undefined {
  for (let triangle = 0; triangle < 2; triangle++) {
    const a = points[triangle ? 3 : 0], b = points[triangle ? 2 : 1], c = points[triangle ? 1 : 2];
    const bx = b.x - a.x, by = b.y - a.y, cx = c.x - a.x, cy = c.y - a.y, det = bx * cy - by * cx;
    if (Math.abs(det) < 1e-10) continue;
    const u = ((x - a.x) * cy - (y - a.y) * cx) / det, v = (bx * (y - a.y) - by * (x - a.x)) / det;
    if (u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9) {
      if(texcoords){const p=texcoords[triangle?3:0],q=texcoords[triangle?2:1],r=texcoords[triangle?1:2];return {u:p.x+(q.x-p.x)*u+(r.x-p.x)*v,v:p.y+(q.y-p.y)*u+(r.y-p.y)*v};}
      return triangle ? { u: 1 - u, v: 1 - v } : { u, v };
    }
  }
}
