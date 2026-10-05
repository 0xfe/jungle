export const TAU = Math.PI * 2;
export const DEER_DIRECTIONS = 16;
export const DEER_CLIPS = { walk: 24, run: 24, graze: 16, look: 12, turn: 12, raise: 12, groom:24,play:24 } as const;
export type DeerClip = keyof typeof DEER_CLIPS;
/** Full stride (all four legs), measured in tile units. Animation advances by distance. */
export const DEER_STRIDE = .125;
export const DEER_RUN_STRIDE = .45;
export const HEAD_SECONDS = .7;
export const DEER_TURN_RATE = Math.PI * .8;
export const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
export const directionIndex = (heading: number) => (Math.round(heading / TAU * DEER_DIRECTIONS) % DEER_DIRECTIONS + DEER_DIRECTIONS) % DEER_DIRECTIONS;
export function turnToward(heading: number, target: number, maxStep: number): number {
  return heading + Math.max(-maxStep, Math.min(maxStep, angleDelta(heading, target)));
}
export const PLANT_FRAMES = 32;
export const PLANT_FPS = 24;
