import { CONFIG } from '../config';
import { SpatialGrid } from '../iso/spatial';
import { clamp, hash, noise, random, type Vec2 } from '../iso/math';
import { AgentSystem } from '../agents';
import { DeerAgent, PlantAgent, createPlant } from './agents';
export type { DeerState, DeerSample } from './agents';
export type Deer = DeerAgent;
export type Habitat = 'rainforest' | 'flowering' | 'wetland';
export type Weather = 'sun' | 'rain' | 'dusk';
export interface Climate { moisture: number; sunlight: number; wind: number }
export interface Tile { x: number; y: number; climate: Climate }
export interface Plant extends Vec2 { id: string; kind: 'tree' | 'plant'; variant: number; phase: number; scale: number }
export interface World { seed: number; habitat: Habitat; weather: Weather; tiles: Tile[]; plants: Plant[]; deer: Deer[]; time: number; previousTime: number; windTime: number; previousWindTime: number; layoutVersion: number; rng: () => number }
import { TILE } from './geometry';
export { TILE } from './geometry';
export const WORLD_SIZE = { width: 4, height: 4 };
export const HABITATS: Habitat[] = ['rainforest', 'flowering', 'wetland'];
export function climateAt(x: number, y: number, seed: number): Climate {
  return { moisture: noise(x / 5, y / 5, seed), sunlight: .6 + .4 * noise(x / 4, y / 4, seed + 5), wind: .4 + .6 * noise(x / 6, y / 6, seed + 8) };
}
/** Continuous ponds cross tile boundaries; terrain and collision use the same field. */
export function waterAt(x: number, y: number, habitat: Habitat): number {
  const radius = habitat === 'wetland' ? 1.35 : 1;
  const dx = (x - 1.17) / (.4 * radius), dy = (y - .71) / (.32 * radius);
  const dx2 = (x - 2.85) / (.38 * radius), dy2 = (y - 1.15) / (.29 * radius);
  return Math.max(1 - dx * dx - dy * dy, .85 - dx2 * dx2 - dy2 * dy2) + .13 * Math.sin(x * 24) * Math.cos(y * 21);
}
const collisionIndices = new WeakMap<World, { version: number; grid: SpatialGrid<Plant> }>();
/** Bump after changing static layout; animation/animal motion does not invalidate it. */
export function invalidateLayout(world: World): void { world.layoutVersion++; }
export function walkable(world: World, x: number, y: number): boolean {
  let cached = collisionIndices.get(world);
  if (!cached || cached.version !== world.layoutVersion) {
    const grid = new SpatialGrid<Plant>(.5);
    for (const p of world.plants) if (p.kind === 'tree') grid.insert(p.x, p.y, p);
    cached = { version: world.layoutVersion, grid }; collisionIndices.set(world, cached);
  }
  let blocked = false;
  cached.grid.visit(x - .13, y - .13, x + .13, y + .13, p => { if ((p.x - x) ** 2 + (p.y - y) ** 2 < .13 ** 2) blocked = true; });
  return x > .12 && x < WORLD_SIZE.width - .12 && y > .12 && y < WORLD_SIZE.height - .12 && waterAt(x, y, world.habitat) < -.12 &&
    !blocked;
}
export function createWorld(seed = CONFIG.startup.seed, habitat: Habitat = CONFIG.startup.habitat): World {
  const rng = random(seed);
  const tiles: Tile[] = [];
  for (let y = 0; y < WORLD_SIZE.height; y++) for (let x = 0; x < WORLD_SIZE.width; x++) tiles.push({ x, y, climate: climateAt(x, y, seed) });
  const world: World = { seed, habitat, weather: CONFIG.startup.weather, tiles, plants: [], deer: [], time: 0, previousTime: 0, windTime: 0, previousWindTime: 0, layoutVersion: 0, rng };
  const trees = [[.23, .25], [.74, .17], [1.57, .23], [.23, .9], [.22, 1.52], [1.75, 1.12], [2.2, .22], [2.96, .23], [3.65, .27], [2.04, 1.58], [3.65, 1.58], [.25, 2.22], [1.12, 2.18], [2.25, 2.32], [3.6, 2.35], [.23, 3.15], [1.42, 3.45], [2.62, 3.5], [3.67, 3.35]];
  trees.forEach(([x, y], i) => {
    const px = x! + (rng() - .5) * .13, py = y! + (rng() - .5) * .13;
    world.plants.push({ id: `tree-${i}`, kind: 'tree', x: px, y: py,
      variant: habitat === 'flowering' ? [3, 0, 3, 2][i % 4]! : habitat === 'wetland' ? [1, 2, 1, 0][i % 4]! : Math.floor(rng() * 4),
      phase: rng() * 8, scale: .85 + rng() * .2 });
  });
  for (let i = 0; i < 76; i++) {
    const x = .12 + rng() * (WORLD_SIZE.width - .24), y = .12 + rng() * (WORLD_SIZE.height - .24);
    if (waterAt(x, y, habitat) > -.25 || world.plants.some(p => Math.hypot(p.x - x, p.y - y) < .19)) continue;
    world.plants.push({ id: `plant-${i}`, kind: 'plant', x, y,
      variant: habitat === 'flowering' && i % 2 === 0 ? 2 : Math.floor(rng() * 4), phase: rng() * 10, scale: .65 + rng() * .3 });
  }
  for (const [i, p] of [{ x: .81, y: 1.21 }, { x: 1.4, y: 1.53 }, { x: 2.4, y: .65 }, { x: 3.35, y: 1.63 }, { x: 3.45, y: .65 }, { x: .75, y: 2.65 }, { x: 1.9, y: 2.95 }, { x: 3.25, y: 2.8 }].entries()) {
    const deer = new DeerAgent(`deer-${i}`, p.x, p.y, Math.floor(rng() * 0xffffffff));
    deer.territory = [0, 0, WORLD_SIZE.width, WORLD_SIZE.height]; world.deer.push(deer);
  }
  world.plants = world.plants.map(p => createPlant((p.kind === 'tree' ? 1 : 5) + p.variant, p.id, p.x, p.y, p.phase, p.scale));
  return world;
}
const systems = new WeakMap<World, AgentSystem>();
/** Finite fixture adapter; the streaming demo uses the same independent agent classes. */
export function updateWorld(world: World, dt: number): void {
  world.previousTime = world.time; world.time += dt;
  world.previousWindTime = world.windTime; world.windTime += dt * (world.weather === 'rain' ? 1.35 : 1);
  let system = systems.get(world); if (!system) { system = new AgentSystem(); systems.set(world, system); }
  system.step([...world.plants.filter((p): p is PlantAgent => p instanceof PlantAgent), ...world.deer], dt, {
    time: world.time,
    sample: (x, y) => ({ moisture: climateAt(x, y, world.seed).moisture, light: world.weather === 'dusk' ? .25 : .8,
      wind: world.weather === 'rain' ? 1.5 : 1, elevation: 0, water: waterAt(x, y, world.habitat) > 0 }),
    canMove: (x, y) => walkable(world, x, y),
  });
}
export const tileSeed = (x: number, y: number, seed: number) => Math.floor(hash(x, y, seed) * 0xffffffff);
