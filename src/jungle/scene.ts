import type { VolcanoLavaArt } from './volcano-animation';
import { restingSprite } from './resting';
import { PlantAgent } from './agents';
import { project, hash, lerp, clamp } from '../iso/math';
import { color, sortCommands, type DrawCommand, type Frame, type Region } from '../iso/render';
import { TILE, waterAt, type World, type Deer, type DeerSample, type Plant, HABITATS, WORLD_SIZE } from './world';
import { DEER_CLIPS, directionIndex, PLANT_FPS, HEAD_SECONDS, angleDelta } from './animation';
import { SpatialGrid } from '../iso/spatial';
export interface Sprite { frames: Region[]; width: number; height: number; anchor: [number, number] }
export interface AtlasManifest {
  spacecraftParts?:Record<string,string[]>; volcanoLava?:VolcanoLavaArt[]; version: number; width: number; height: number; sprites: Record<string, Sprite>; stats?: { frames: number; uniqueFrames: number; rgbaBytes: number; occupiedPixels: number } }
export interface View { width: number; height: number; panX: number; panY: number; zoom: number; grid: boolean }

/** Presentation is one fixed tick behind simulation; no prediction or frame-rate-dependent physics. */
export function sampleDeer(d: Deer, alpha: number): DeerSample {
  const p = d.previous, t = clamp(alpha, 0, 1), same = p.state === d.state;
  return { x: lerp(p.x, d.x, t), y: lerp(p.y, d.y, t), heading: p.heading + angleDelta(p.heading, d.heading) * t,
    gait: same ? lerp(p.gait, d.gait, t) : t < 1 ? p.gait : d.gait,
    state: t < 1 ? p.state : d.state, actionTime: same ? lerp(p.actionTime, d.actionTime, t) : t < 1 ? p.actionTime : d.actionTime };
}
interface PreparedPlant { plant: Plant; sprite: Sprite; x: number; y: number }
interface StaticScene { version: number; atlas: AtlasManifest; plants: SpatialGrid<PreparedPlant>; margin: number; ripples: { x: number; y: number; i: number }[]; habitat: string }
const scenes = new WeakMap<World, StaticScene>();
function prepareScene(world: World, atlas: AtlasManifest): StaticScene {
  const cached = scenes.get(world);
  if (cached && cached.version === world.layoutVersion && cached.atlas === atlas && cached.habitat === world.habitat) return cached;
  const plants = new SpatialGrid<PreparedPlant>(96); let margin = 0;
  for (const p of world.plants) {
    const sprite = atlas.sprites[`${p.kind}-${p.variant}`]; if (!sprite) throw new Error(`Unknown sprite: ${p.kind}-${p.variant}`);
    const point = project(p, TILE);
    plants.insert(point.x, point.y, { plant: p, sprite, ...point });
    margin = Math.max(margin, (sprite.width + Math.abs(sprite.anchor[0]) + sprite.height + Math.abs(sprite.anchor[1])) * p.scale, 64);
  }
  const ripples = [];
  for (let i = 0; i < 90; i++) {
    const x = .55 + hash(i, 0, 33) * 2.9, y = .13 + hash(i, 2, 66) * 1.55;
    if (waterAt(x, y, world.habitat) >= .15) ripples.push({ x, y, i });
  }
  const scene = { version: world.layoutVersion, habitat: world.habitat, atlas, plants, margin, ripples }; scenes.set(world, scene); return scene;
}

export function composeScene(world: World, atlas: AtlasManifest, view: View, alpha = 1): Frame {
  const prepared = prepareScene(world, atlas);
  const time = lerp(world.previousTime, world.time, clamp(alpha, 0, 1));
  const windTime = lerp(world.previousWindTime, world.windTime, clamp(alpha, 0, 1));
  const commands: DrawCommand[] = [];
  const footprintWidth = (WORLD_SIZE.width + WORLD_SIZE.height) * TILE.width / 2;
  const footprintHeight = (WORLD_SIZE.width + WORLD_SIZE.height) * TILE.height / 2;
  const fit = Math.min(view.width / (footprintWidth + 90), view.height / (footprintHeight + 125)) * view.zoom;
  const center = project({ x: WORLD_SIZE.width / 2, y: WORLD_SIZE.height / 2 }, TILE);
  const origin = { x: view.width / 2 - center.x * fit + view.panX, y: view.height / 2 - (center.y - 32) * fit + view.panY };
  const screen = (x: number, y: number) => { const p = project({ x, y }, TILE); return { x: origin.x + p.x * fit, y: origin.y + p.y * fit }; };
  const rect = (id: string, x: number, y: number, w: number, h: number, hex: string, alpha: number, layer: number, depth = 0) => {
    if (x + w > 0 && y + h > 0 && x < view.width && y < view.height)
      commands.push({ id, x, y, width: w, height: h, color: color(hex, alpha), layer, depth });
  };
  const sprite = (id: string, name: string, x: number, y: number, scale: number, frame: number, layer: number, depth: number, flip = false, alpha = 1) => {
    const s = atlas.sprites[name]; if (!s) throw new Error(`Unknown sprite: ${name}`);
    const p = screen(x, y), z = scale * fit;
    drawSprite(id, s, p.x, p.y, z, frame, layer, depth, flip, alpha);
  };
  const drawSprite = (id: string, s: Sprite, px: number, py: number, z: number, frame: number, layer: number, depth: number, flip = false, alpha = 1) => {
    const x = px - s.anchor[0] * z, y = py - s.anchor[1] * z, width = s.width * z, height = s.height * z;
    // Cull before constructing a command or choosing its animation frame.
    if (x + width <= 0 || y + height <= 0 || x >= view.width || y >= view.height) return;
    commands.push({ id, x, y, width, height, region: s.frames[frame % s.frames.length], color: [255, 255, 255, Math.round(alpha * 255)], layer, depth, flip });
  };
  sprite('island-shadow', 'island-shadow', WORLD_SIZE.width / 2, WORLD_SIZE.height / 2, 1, 0, -2, 0);
  for (const tile of world.tiles) {
    sprite(`tile-${tile.x}-${tile.y}`, `ground-${HABITATS.indexOf(world.habitat)}-${tile.x}-${tile.y}`, tile.x, tile.y, 1, 0, 0, tile.x + tile.y);
    if (view.grid) {
      for (let i = 0; i < 32; i++) {
        for (const edge of [{ x: tile.x + i / 32, y: tile.y }, { x: tile.x, y: tile.y + i / 32 }]) {
          const p = screen(edge.x, edge.y); rect(`grid-${tile.x}-${tile.y}-${i}-${edge.x}`, p.x, p.y, 3 * fit, fit, '#e1efa2', .65, 1);
        }
      }
    }
  }
  // Shimmer is sampled in world space so a pond continues over tile seams.
  for (const { x, y, i } of prepared.ripples) {
    const p = screen(x, y), pulse = .15 + .5 * Math.max(0, Math.sin(time * 1.4 + i * 2));
    rect(`ripple-${i}`, p.x + Math.sin(time + i) * fit, p.y, (3 + i % 5) * fit, fit, '#aff5cf', pulse, 1);
  }
  const margin = prepared.margin;
  prepared.plants.visit(-origin.x / fit - margin, -origin.y / fit - margin,
    (view.width - origin.x) / fit + margin, (view.height - origin.y) / fit + margin, item => {
    const p = item.plant, px = origin.x + item.x * fit, py = origin.y + item.y * fit;
    // Integrated wind phase stays continuous when weather changes; offsets avoid lockstep.
    const wind = .92 + .12 * Math.sin(p.phase);
    const phase = Math.floor((p instanceof PlantAgent ? p.animationPhase(alpha) : windTime * wind + p.phase) * PLANT_FPS);
    const shadow = atlas.sprites.shadow; if (!shadow) throw new Error('Unknown sprite: shadow');
    drawSprite(`${p.id}-shadow`, shadow, px, py, (p.kind === 'tree' ? .9 : .4) * fit, 0, 1, p.x + p.y, false, .35);
    drawSprite(p.id, item.sprite, px, py, p.scale * fit, phase, 2, p.x + p.y);
  });
  for (const deer of world.deer) {
    const d = sampleDeer(deer, alpha);
    if(deer.repose.active){
      const rest=restingSprite('deer',deer.repose,d.heading,alpha);
      sprite(deer.id,rest.name,d.x,d.y,1.05*deer.size,rest.frame,2,d.x+d.y);continue;
    }
    sprite(`${deer.id}-shadow`, 'shadow', d.x, d.y, .4*deer.size, 0, 1, d.x + d.y, false, .35);
    const clip = d.state === 'lower' ? 'raise' : d.state, count = DEER_CLIPS[clip];
    let phase = d.state === 'walk' || d.state === 'run' || d.state === 'turn' ? d.gait % 1 : ((time + deer.phase) / 1.2) % 1;
    let frame = Math.floor(phase * count);
    if (clip === 'raise') {
      phase = clamp(d.actionTime / HEAD_SECONDS, 0, 1);
      if (d.state === 'lower') phase = 1 - phase;
      frame = Math.round(phase * (count - 1));
    }
    sprite(deer.id, `deer-${clip}-${directionIndex(d.heading)}`, d.x, d.y, 1.05*deer.size, frame, 2, d.x + d.y);
  }
  // Fireflies and falling leaves: deterministic particles, independent of frame rate.
  for (let i = 0; i < 18; i++) {
    const t = time * .13 + i * 13.2;
    const p = screen(.15 + hash(i, 9, world.seed) * (WORLD_SIZE.width - .3), .15 + hash(i, 3, world.seed) * (WORLD_SIZE.height - .3));
    const alpha = (world.weather === 'dusk' ? .85 : .45) * (.4 + .6 * Math.sin(t * 3) ** 2);
    rect(`mote-${i}`, p.x + Math.sin(t) * 13 * fit, p.y - (15 + Math.cos(t * .6) * 12) * fit, fit * 1.5, fit, '#e9ea9e', alpha, 3);
  }
  if (world.weather === 'dusk') rect('dusk-tint', 0, 0, view.width, view.height, '#302047', .27, 4);
  if (world.weather === 'rain') {
    rect('rain-tint', 0, 0, view.width, view.height, '#16354d', .15, 4);
    for (let i = 0; i < 95; i++) {
      const x = (hash(i, 0, 778) * view.width + time * 35) % view.width;
      const y = (hash(i, 1, 778) * view.height + time * 230) % view.height;
      rect(`rain-${i}`, x, y, fit * .65, fit * 6, '#b5e2df', .3, 5);
    }
  }
  return { width: view.width, height: view.height, clear: [0, 0, 0, 0],
    commands: sortCommands(commands) };
}
