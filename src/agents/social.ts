import type { Neighbor } from './core';
import type { Vec2 } from '../iso/math';
/** Stable membership survives sleeping/serialization; no global mutable herd singleton. */
export interface SocialMember extends Vec2 { id: string; groupId: string; leaderId: string; motherId: string; juvenile: boolean; heading: number }
export interface SocialIntent { target: Vec2; moving: boolean; urgency: number }
/** Cohesion + velocity alignment + personal space, biased toward a parent/leader. */
export function herdIntent(self: SocialMember, neighbors: readonly Neighbor[]): SocialIntent | undefined {
  const peers = neighbors.filter(n => n.id !== self.id && n.groupId === self.groupId).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  if (!self.groupId || !peers.length) return;
  const guide = peers.find(n => n.id === (self.motherId || self.leaderId));
  let x = 0, y = 0, vx = 0, vy = 0, sx = 0, sy = 0;
  for (const n of peers) {
    x += n.x; y += n.y; vx += Math.cos(n.heading ?? 0) * n.speed; vy += Math.sin(n.heading ?? 0) * n.speed;
    const dx = self.x - n.x, dy = self.y - n.y, d = Math.hypot(dx, dy);
    const spacing = self.juvenile ? .2 : .32;
    if (d < spacing && d > .001) { sx += dx / d * (spacing - d); sy += dy / d * (spacing - d); }
  }
  x /= peers.length; y /= peers.length; vx /= peers.length; vy /= peers.length;
  if (guide) { x = guide.x; y = guide.y; vx = Math.cos(guide.heading ?? 0) * guide.speed; vy = Math.sin(guide.heading ?? 0) * guide.speed; }
  // A leader explores independently unless stragglers have fallen far behind.
  if (self.id === self.leaderId && Math.hypot(x - self.x, y - self.y) < 1.5) return;
  const gap = self.juvenile ? .32 : .58, heading = guide?.heading ?? self.heading;
  return { target: { x: x + vx * .7 - Math.cos(heading) * gap + sx * 2, y: y + vy * .7 - Math.sin(heading) * gap + sy * 2 },
    moving: peers.some(n => n.speed > .035), urgency: Math.max(...peers.map(n => n.alarm ?? 0)) };
}
