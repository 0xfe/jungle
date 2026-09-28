import {elephantTrunk,ELEPHANT_MODEL_TO_TILE,ELEPHANT_SPRAY_SECONDS} from './elephant-pose';
import { rootedQuad } from '../iso/sprite-geometry';
import { clipField, type FieldVertex } from '../iso/contour';
import { clamp, hash, lerp, project, unproject, type Vec2 } from '../iso/math';
import { color, sortCommands, visible, type DrawCommand, type Frame, type Region } from '../iso/render';
import { quadBounds, type QuadCorners } from '../iso/quad';
import type { AtlasManifest } from './scene';
import { sampleDeer } from './scene';
import { ElephantAgent, MonkeyAgent, EcologicalAgent, DeerAgent, WildlifeAgent, sampleWildlife, PlantAgent, MoteAgent, WaterAgent } from './agents';
import { DEER_CLIPS, directionIndex, HEAD_SECONDS, PLANT_FPS, PLANT_FRAMES } from './animation';
import { InfiniteWorld, type WorldBounds } from './infinite';
import { TerrainTile, TerrainKind, fieldKind, coordinateHash } from './terrain';
import { ECO_SPECS, ecoDirection } from './ecology';
import { TILE } from './world';
export interface InfiniteView { width: number; height: number; pixelRatio: number; zoom: number; grid: boolean; cameraX: number; cameraY: number }
/** Relative projection keeps GPU coordinates small far from the origin. */
export function cameraScale(view: InfiniteView): number { return Math.max(view.pixelRatio * view.zoom * .9, view.width / 2400, view.height / 1500); }
export function cameraBounds(view: InfiniteView): WorldBounds {
  const scale = cameraScale(view), radius = view.width / (2 * scale * TILE.width) + view.height / (2 * scale * TILE.height) + 2;
  return { minX: view.cameraX - radius, minY: view.cameraY - radius, maxX: view.cameraX + radius, maxY: view.cameraY + radius };
}
export function panCamera(view: InfiniteView, screenDX: number, screenDY: number): void {
  const scale = cameraScale(view), delta = unproject({ x: screenDX / scale, y: screenDY / scale }, TILE);
  view.cameraX += delta.x; view.cameraY += delta.y;
}
interface Surface { uvCorners?:QuadCorners; corners: QuadCorners; bounds: ReturnType<typeof quadBounds>; region: Region; suffix: string }
interface PreparedTerrain { atlas: AtlasManifest; surfaces: Surface[]; bounds: ReturnType<typeof quadBounds>; corners: QuadCorners; shade: number }
const terrainCache = new WeakMap<TerrainTile, PreparedTerrain>();
function prepareTerrain(tile: TerrainTile, atlas: AtlasManifest, seed: number): PreparedTerrain {
  const cached = terrainCache.get(tile); if (cached?.atlas === atlas) return cached;
  const point = (u: number, v: number): Vec2 => {
    const p = project({ x: u, y: v }, TILE); return { x: p.x, y: p.y - tile.heightAt(tile.x + u, tile.y + v) };
  };
  const corners: QuadCorners = [point(0, 0), point(1, 0), point(0, 1), point(1, 1)], surfaces: Surface[] = [];
  const add = (kind: number, x: number, y: number, size: number) => {
    const name = `terrain-${kind}-${coordinateHash(tile.x, tile.y, seed) % 4}`, texture = atlas.sprites[name];
    if (!texture) throw new Error(`Unknown sprite: ${name}`);
    const r = texture.frames[0]!, points: QuadCorners = [point(x, y), point(x + size, y), point(x, y + size), point(x + size, y + size)];
    surfaces.push({ corners: points, bounds: quadBounds(points), suffix: `${x}-${y}`, region: { x: r.x + x * r.width, y: r.y + y * r.height, width: r.width * size, height: r.height * size } });
  };
  if(tile.uniform)add(tile.materialAt(tile.x+.5,tile.y+.5),0,0,1);
  else if(tile.fields){
    const emit=(polygon:FieldVertex[],kind:TerrainKind)=>{
      const texture=atlas.sprites[`terrain-${kind}-${coordinateHash(tile.x,tile.y,seed)%4}`];
      if(!texture)throw new Error('Missing terrain material');
      for(let i=1;i<polygon.length-1;i++){
        const a=polygon[0]!,b=polygon[i]!,c=polygon[i+1]!;
        if(Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))<1e-10)continue;
        const uvCorners:QuadCorners=[a,b,c,c],corners=uvCorners.map(p=>point(p.x,p.y)) as unknown as QuadCorners;
        surfaces.push({corners,uvCorners,bounds:quadBounds(corners),region:texture.frames[0]!,suffix:String(surfaces.length)});
      }
    };
    for(let y=0;y<2;y++)for(let x=0;x<2;x++)for(const tri of [[0,1,3],[4,3,1]]){
      let polygon:FieldVertex[]=tri.map(j=>{const i=y*3+x+j;return{x:(i%3)/2,y:Math.floor(i/3)/2,fields:tile.fields![i]!};});
      // Each stage consumes one disjoint band; shared crossing points preserve seams.
      for(const [field,threshold,below,kind] of [[0,-.065,true,TerrainKind.Deep],[0,0,true,TerrainKind.Shallow],[0,.024,true,TerrainKind.Dry],[2,0,false,TerrainKind.Dry],[3,0,false,TerrainKind.Meadow]] as const){
        emit(clipField(polygon,field,threshold,below),kind);polygon=clipField(polygon,field,threshold,!below);
        if(!polygon.length)break;
      }
      emit(polygon,TerrainKind.Forest);
    }
  }else for(let y=0;y<4;y++)for(let x=0;x<4;x++)add(tile.materials[y*4+x]!,x/4,y/4,.25);
  const h = tile.heights, shade = Math.round(Math.round(clamp(1 + (h[0] - h[3]) / 60 + (h[2] - h[1]) / 100, .72, 1) * 10) / 10 * 255);
  const result = { atlas, surfaces, bounds: quadBounds(corners), corners, shade }; terrainCache.set(tile, result); return result;
}
export function composeInfinite(world: InfiniteWorld, atlas: AtlasManifest, view: InfiniteView, alpha = 1): Frame {
  const scale = cameraScale(view), commands: DrawCommand[] = [], rendered: TerrainTile[] = [];
  const time = lerp(world.previousTime, world.time, alpha);
  const screen = (x: number, y: number, height = world.heightAt(x, y)): Vec2 => {
    const p = project({ x: x - view.cameraX, y: y - view.cameraY }, TILE);
    return { x: view.width / 2 + p.x * scale, y: view.height / 2 + (p.y - height) * scale };
  };
  const sprite = (id: string, name: string, x: number, y: number, size: number, frame: number, layer: number, opacity = 1, tint = 255, altitude = 0) => {
    const s = atlas.sprites[name]; if (!s) throw new Error(`Unknown sprite: ${name}`);
    const p = screen(x, y, world.heightAt(x,y)+altitude), z = scale * size;
    const command: DrawCommand = { id, x: p.x - s.anchor[0] * z, y: p.y - s.anchor[1] * z, width: s.width * z, height: s.height * z,
      region: s.frames[frame % s.frames.length], color: [255, tint, tint, Math.round(opacity * 255)], layer, depth: x + y };
    if (visible(command, view.width, view.height)) commands.push(command);
  };
  const rect = (id: string, x: number, y: number, w: number, h: number, hex: string, opacity: number, layer: number) => {
    const command = { id, x, y, width: w, height: h, color: color(hex, opacity), layer, depth: 0 };
    if (visible(command, view.width, view.height)) commands.push(command);
  };
  for (const tile of world.tiles) {
    const { x, y } = tile, anchor = screen(x, y, 0);
    if (anchor.x + TILE.width * scale < 0 || anchor.x - TILE.width * scale > view.width || anchor.y + TILE.height * scale < 0 || anchor.y - 90 * scale > view.height) continue;
    const prepared = prepareTerrain(tile, atlas, world.seed), shade = prepared.shade;
    const transform = (p: Vec2): Vec2 => ({ x: anchor.x + p.x * scale, y: anchor.y + p.y * scale });
    let submitted = false;
    for (const surface of prepared.surfaces) {
      const b = surface.bounds, box = { x: anchor.x + b.x * scale, y: anchor.y + b.y * scale, width: b.width * scale, height: b.height * scale };
      if (box.x + box.width <= 0 || box.x >= view.width || box.y + box.height <= 0 || box.y >= view.height) continue;
      const c = surface.corners;
      commands.push({ ...box, corners: [transform(c[0]), transform(c[1]), transform(c[2]), transform(c[3])],
        uvCorners:surface.uvCorners, id: `tile-${x}-${y}-${surface.suffix}`, region: surface.region, color: [shade, shade, shade, 255], layer: 0, depth: x + y });
      submitted = true;
    }
    if (submitted) rendered.push(tile);
    if (view.grid) {
      const corners = prepared.corners.map(transform);
      for (let i = 0; i < 16; i++) for (const edge of [1, 2]) {
        const p = corners[edge]!, t = i / 16; rect(`g-${x}-${y}-${edge}-${i}`, lerp(corners[0]!.x, p.x, t), lerp(corners[0]!.y, p.y, t), 2 * scale, scale, '#dfe4a6', .65, 1);
      }
    }
  }
  for(const cover of world.groundCover){
    const anchor=screen(cover.x,cover.y,0),margin=cover.radius*TILE.width*scale;
    if(anchor.x+margin<0||anchor.x-margin>view.width||anchor.y+margin<0||anchor.y-margin-90*scale>view.height)continue;
    const r=cover.radius,corners:QuadCorners=[screen(cover.x-r,cover.y-r),screen(cover.x+r,cover.y-r),screen(cover.x-r,cover.y+r),screen(cover.x+r,cover.y+r)];
    const box=quadBounds(corners);if(box.x+box.width<0||box.x>view.width||box.y+box.height<0||box.y>view.height)continue;
    commands.push({...box,corners,id:`litter:${cover.x}:${cover.y}`,region:atlas.sprites[`litter-${cover.variant}`]!.frames[0],color:[255,255,255,Math.round(cover.opacity*255)],layer:.5,depth:cover.x+cover.y});
  }
  for (const a of world.agents) {
    // Ground-anchor rejection includes a conservative canopy margin before frame selection.
    const point = screen(a.x, a.y);
    if (point.x < -140 * scale || point.x > view.width + 140 * scale || point.y < -50 * scale || point.y > view.height + 190 * scale) continue;
    if (a instanceof PlantAgent) {
      sprite(`${a.id}-shadow`, 'shadow', a.x, a.y, a.kind === 'tree' ? a.scale*1.35 : .35, 0, 1, .24);
      const name=`${a.kind}-${a.variant}${a.morphology?`-form-${a.morphology}`:''}`,s=atlas.sprites[name];
      if(!s)throw new Error(`Unknown plant sprite: ${name}`);
      const traits=a.appearance,phase=a.animationPhase(alpha),z=scale*a.scale*(.97+.03*a.vigor);
      // Continuous crown sway carries the broad motion; registered leaf pixels only rustle.
      const lean=traits.lean+Math.sin(time*1.7+a.x*.45+a.y*.31)*.004
        +Math.sin(phase*PLANT_FPS/PLANT_FRAMES*Math.PI*2)*(a.kind==='tree'?.009:.018);
      const corners=rootedQuad(point,s.width,s.height,s.anchor,z*traits.width,z*traits.height,lean,traits.mirror);
      const box=quadBounds(corners),frame=Math.floor(phase*PLANT_FPS);
      if(visible(box,view.width,view.height))commands.push({...box,corners,id:a.id,region:s.frames[frame%s.frames.length],
        color:traits.tone?[244,255,239,255]:[255,255,255,255],flip:traits.mirror,layer:2,depth:a.x+a.y});
      if(a.kind==='tree'&&traits.vine&&a.variant!==2&&a.scale>.8){
        const v=atlas.sprites[`vine-${traits.vine-1}`]!;
        // Attachment height follows the actual trimmed crown, not a fixed world altitude.
        const vz=z*traits.height*s.anchor[1]/80;
        const vc=rootedQuad(point,v.width,v.height,v.anchor,vz*traits.width,vz,lean,traits.mirror);
        const vb=quadBounds(vc);
        if(visible(vb,view.width,view.height))commands.push({...vb,corners:vc,id:`${a.id}~vine`,region:v.frames[frame%v.frames.length],color:[255,255,255,255],flip:traits.mirror,layer:2,depth:a.x+a.y});
      }
    } else if (a instanceof DeerAgent) {
      const d = sampleDeer(a, alpha), clip = d.state === 'lower' ? 'raise' : d.state, count = DEER_CLIPS[clip];
      let phase = ['walk', 'run', 'turn'].includes(d.state) ? d.gait % 1 : ((time + a.phase) / 1.2) % 1;
      let frame = Math.floor(phase * count);
      if (clip === 'raise') { phase = clamp(d.actionTime / HEAD_SECONDS, 0, 1); if (d.state === 'lower') phase = 1 - phase; frame = Math.round(phase * (count - 1)); }
      sprite(`${a.id}-shadow`, 'shadow', d.x, d.y, .4*a.size, 0, 1, .35);
      sprite(a.id, `deer-${clip}-${directionIndex(d.heading)}`, d.x, d.y, 1.05*a.size, frame, 2, 1, [255,247,237][a.coat]);
    } else if (a instanceof EcologicalAgent) {
      const d=sampleWildlife(a,alpha),spec=ECO_SPECS[a.kind];
      const clip=a.kind==='whale'?(d.state==='surface'?'surface':'travel'):d.state;
      if(a instanceof MonkeyAgent && d.state==='swing'){
        const root=screen(a.routeX,a.routeY,world.heightAt(a.routeX,a.routeY)+a.routeHeight+a.gripHeight+24*a.size);
        const hand=screen(d.x,d.y,world.heightAt(d.x,d.y)+d.altitude+a.gripHeight);
        const dx=hand.x-root.x,dy=hand.y-root.y,len=Math.hypot(dx,dy),w=scale*.8;
        if(len>0){
          const nx=-dy/len*w,ny=dx/len*w;
          const corners:QuadCorners=[{x:root.x+nx,y:root.y+ny},{x:root.x-nx,y:root.y-ny},{x:hand.x+nx,y:hand.y+ny},{x:hand.x-nx,y:hand.y-ny}];
          commands.push({...quadBounds(corners),corners,id:`${a.id}-support`,color:[92,116,48,255],layer:2,depth:d.x+d.y});
        }
      }
      const name=`${a.kind}-${clip}-${ecoDirection(a.kind,d.heading)}`,count=atlas.sprites[name]?.frames.length;
      if(!count)throw new Error(`Unknown ecology sprite ${name}`);
      const oneShot=d.state==='drink'||d.state==='spray';
      const pose=oneShot?Math.min(count-1,Math.floor(d.gait*(count-1))):Math.min(count-1,Math.floor((d.state==='swing'?d.gait:d.gait%1)*count));
      const water=spec.mode==='water',visibility=a.kind==='whale'?clamp((d.altitude+12)/12,0,1):1;
      const heading=a.kind==='crab'?d.heading+Math.PI/2:d.heading;
      if(!water)sprite(`${a.id}-shadow`,'shadow',d.x,d.y,(spec.mode==='air'?.18:.4)*a.size,0,1,.16);
      sprite(a.id,name,d.x,d.y,a.size*spec.displayScale,pose,water?.8:2,a.kind==='fish'?.65:visibility,[255,250,243][a.coat],d.altitude);
      if(a instanceof ElephantAgent&&d.state==='spray'&&a.loaded){
        const tip=elephantTrunk('spray',pose/(count-1))[3]!,heading=ecoDirection('elephant',d.heading)/spec.directions*Math.PI*2;
        const factor=ELEPHANT_MODEL_TO_TILE*a.size,nx=d.x+(tip[0]*Math.cos(heading)-tip[1]*Math.sin(heading))*factor,ny=d.y+(tip[0]*Math.sin(heading)+tip[1]*Math.cos(heading))*factor;
        const nozzle=screen(nx,ny,world.heightAt(d.x,d.y)+tip[2]*spec.cameraScale*Math.sqrt(.75)*a.size*spec.displayScale);
        const hit=screen(a.sprayX,a.sprayY,world.heightAt(a.sprayX,a.sprayY)+7);
        for(let i=0;i<16;i++){
          const age=(d.gait-(.30+i*.023))*ELEPHANT_SPRAY_SECONDS/a.pace,t=age/.55;
          if(t<0||t>1)continue;
          const spread=(hash(i,a.x,a.y)-.5)*11*scale*t;
          const x=lerp(nozzle.x,hit.x,t)+spread,y=lerp(nozzle.y,hit.y,t)-Math.sin(t*Math.PI)*16*scale;
          commands.push({id:`${a.id}-spray-${i}`,x,y,width:scale*(i%3?1.6:2.3),height:scale*(i%2?2:3),color:i%3?[167,224,235,205]:[232,251,246,235],layer:2,depth:lerp(d.x+d.y,a.sprayX+a.sprayY,t)+.01});
        }
      }
      if(a instanceof ElephantAgent&&d.state==='drink'&&d.gait>.18&&d.gait<.45){
        const p=screen(a.waterX,a.waterY,world.heightAt(a.waterX,a.waterY));
        for(let i=0;i<4;i++){const t=(d.gait*5+i*.25)%1;rect(`${a.id}-sip-${i}`,p.x+(i-1.5)*3*scale,p.y+t*2*scale,(2+t*3)*scale,scale,'#d9f1df',(1-t)*.6,1);}
      }
      if(a.kind==='whale'&&visibility>.8){
        const p=screen(d.x+Math.cos(heading)*.15,d.y+Math.sin(heading)*.15),t=lerp(a.previousBreath,a.breathClock,alpha),cycle=t%a.cycleSeconds;
        const puff=(cycle/a.cycleSeconds-.905)/.025;
        if(puff>0&&puff<1)for(let i=0;i<7;i++)rect(`${a.id}-blow-${i}`,p.x+(i-3)*puff*3*scale,p.y-(6+Math.sin(puff*Math.PI)*20+i%2*5)*scale,2*scale,3*scale,'#d3efde',(1-puff)*.8,3);
      }
    } else if (a instanceof WildlifeAgent) {
      const d=sampleWildlife(a,alpha),clip=d.state==='run'?'chase':d.state, phase=d.gait%1;
      const name=`${a.kind}-${clip}-${directionIndex(d.heading)}`,count=atlas.sprites[name]?.frames.length;
      if(!count)throw new Error(`Unknown wildlife sprite ${name}`);
      sprite(`${a.id}-shadow`,'shadow',d.x,d.y,(a.kind==='toucan'?.2:.4)*a.size,0,1,.22);
      sprite(a.id,name,d.x,d.y,a.size,Math.floor(phase*count),2,1,[255,248,240][a.coat],d.altitude);
    } else if (a instanceof MoteAgent) {
      const t = lerp(a.previousPhase, a.phase, alpha);
      rect(a.id, point.x + Math.sin(t * .7) * 20 * scale, point.y - (20 + Math.cos(t * .4) * 13) * scale, scale, scale, '#eff4aa', (world.weather === 'dusk' ? .9 : .4) * (.6 + .4 * Math.sin(t) ** 2), 3);
    } else if (a instanceof WaterAgent) {
      const t = lerp(a.previousPhase, a.phase, alpha);
      for (let i = 0; i < 3; i++) rect(`${a.id}-${i}`, point.x + (Math.sin(t + i) * 6 + (i - 1) * 28) * scale, point.y + (i - 1) * 8 * scale,
        (4 + i * 2) * scale, scale * .6, '#b6ead4', .2 + .2 * Math.sin(t * 1.4 + i) ** 2, 1);
    }
  }
  if (world.weather === 'dusk') rect('dusk', 0, 0, view.width, view.height, '#302047', .27, 4);
  if (world.weather === 'rain') {
    rect('rain-tint', 0, 0, view.width, view.height, '#16354d', .15, 4);
    for (let i = 0; i < 130; i++) rect(`rain-${i}`, (hash(i, 0, 778) * view.width + time * 35 * scale) % view.width,
      (hash(i, 1, 778) * view.height + time * 230 * scale) % view.height, scale * .65, scale * 6, '#b5e2df', .3, 5);
  }
  world.markRendered(rendered);
  return { width: view.width, height: view.height, clear: [88, 120, 67, 255], commands: sortCommands(commands) };
}
