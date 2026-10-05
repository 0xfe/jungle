import { animalOneShot,quietAction } from './animal-actions';
import { animalForm,animalPrefix } from './animal-appearance';
import { spriteRegion } from '../iso/render';
import { bearSettleClip, BEAR_COATS, BEAR_ONE_SHOTS } from './bear-motion';
import { composeZen } from './zen-scene';
import { composeVolcanoes } from './volcano-scene';
import { VolcanicWildlifeAgent } from './agents/volcanic-wildlife';
import { SpacecraftAgent } from './agents/spacecraft';
import { composeSpacecraft, composeFlightField } from './space-scene';
import { ACCENT_FORMS } from './accents';
import { restingSprite } from './resting';
import { patchRoots, isGrove, isGroundPatch } from './patches';
import { crownBands, rustleWeight } from './landscape-wind';
import { CONFIG } from '../config';
import { LandscapePatchAgent } from './agents/patch';
import { SNAKE_MODEL_TO_TILE, SNAKE_SUPPORT_OFFSET } from './snake-pose';
import { riverParticle } from './rivers';
import { groundBlend, GROUND_STEPS } from './ground-blend';
import {elephantTrunk,ELEPHANT_MODEL_TO_TILE,ELEPHANT_SPRAY_SECONDS} from './elephant-pose';
import { rootedQuad } from '../iso/sprite-geometry';
import type { PointerTransform } from '../iso/navigation';
import { clipField, type FieldVertex } from '../iso/contour';
import { clamp, hash, lerp, project, unproject, type Vec2 } from '../iso/math';
import { color, sortCommands, visible, type DrawCommand, type Frame, type Region } from '../iso/render';
import { quadBounds, type QuadCorners } from '../iso/quad';
import type { AtlasManifest } from './scene';
import { sampleDeer } from './scene';
import { BlackBearAgent, SnakeAgent, ElephantAgent, MonkeyAgent, EcologicalAgent, DeerAgent, WildlifeAgent, sampleWildlife, PlantAgent, MoteAgent, WaterAgent } from './agents';
import { DEER_CLIPS, directionIndex, HEAD_SECONDS, PLANT_FPS, PLANT_FRAMES } from './animation';
import { InfiniteWorld, type WorldBounds } from './infinite';
import { TerrainTile, TerrainKind, coordinateHash } from './terrain';
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
/** Apply a gesture in backing pixels, keeping its old midpoint beneath its new midpoint. */
export function gestureCamera(view: InfiniteView, gesture: PointerTransform, minZoom: number, maxZoom: number): void {
  const oldScale = cameraScale(view);
  view.zoom = clamp(view.zoom * gesture.zoomRatio, minZoom, maxZoom);
  const ratio = cameraScale(view) / oldScale;
  // Use the actual projection scale, including the wide-screen floor and clamped zoom.
  panCamera(view,
    (gesture.from.x - view.width / 2) * ratio - (gesture.to.x - view.width / 2),
    (gesture.from.y - view.height / 2) * ratio - (gesture.to.y - view.height / 2));
}
/** Recompute projection from the current view: zoom/pan may change before the next composition. */
export function spawnOutsideView(world:InfiniteWorld,view:InfiniteView,x:number,y:number):boolean {
  const scale=cameraScale(view),p=project({x:x-view.cameraX,y:y-view.cameraY},TILE),margin=220*scale;
  const sx=view.width/2+p.x*scale,sy=view.height/2+(p.y-world.heightAt(x,y))*scale;
  return sx<-margin||sx>view.width+margin||sy<-margin||sy>view.height+margin;
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
  if(tile.fields){
    const values=tile.fields.map((f,i)=>groundBlend(f,tile.x+i%3/2,tile.y+Math.floor(i/3)/2,seed)*8);
    const band=(v:number)=>Math.max(0,Math.min(GROUND_STEPS,Math.round(v)));
    const texture=(step:number)=>{
      const name=`ground-blend-${step}-${coordinateHash(tile.x,tile.y,seed)%2}`;
      const sprite=atlas.sprites[name];if(!sprite)throw new Error(`Missing terrain material: ${name}`);return sprite.frames[0]!;
    };
    if(values.every(v=>band(v)===band(values[0]!))){
      surfaces.push({corners,bounds:quadBounds(corners),region:texture(band(values[0]!)),suffix:'uniform'});
    }else for(let y=0;y<2;y++)for(let x=0;x<2;x++)for(const tri of [[0,1,3],[4,3,1]]){
      let polygon:FieldVertex[]=tri.map(j=>{const i=y*3+x+j;return{x:(i%3)/2,y:Math.floor(i/3)/2,fields:[values[i]!]};});
      const low=band(Math.min(...polygon.map(p=>p.fields[0]!))),high=band(Math.max(...polygon.map(p=>p.fields[0]!)));
      for(let step=low;step<=high;step++){
        const cut=clipField(polygon,0,step+.5,true);
        for(let i=1;i<cut.length-1;i+=2){
          const a=cut[0]!,b=cut[i]!,c=cut[i+1]!,d=cut[i+2];
          const area=(p:Vec2,q:Vec2,r:Vec2)=>Math.abs((q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x));
          if(area(a,b,c)+(d?area(a,c,d):0)<1e-10)continue;
          // Two fan triangles share one painter-ordered quad. UV order b,c,a,d
          // produces b/c/a and a/c/d under the common renderer triangle contract.
          const uvCorners:QuadCorners=d?[b,c,a,d]:[a,b,c,c],corners=uvCorners.map(p=>point(p.x,p.y)) as unknown as QuadCorners;
          surfaces.push({corners,uvCorners,bounds:quadBounds(corners),region:texture(step),suffix:String(surfaces.length)});
        }
        polygon=clipField(polygon,0,step+.5,false);
      }
    }
  }else for(let y=0;y<4;y++)for(let x=0;x<4;x++)add(tile.materials[y*4+x]!,x/4,y/4,.25);
  // The shared gradient textures supply ground color. Flat per-tile slope tints
  // created sharp diamond bands across otherwise continuous shores and clearings.
  // Heights still shape the ground; removing those tints also avoids Canvas cache churn.
  const shade = 255;
  const result = { atlas, surfaces, bounds: quadBounds(corners), corners, shade }; terrainCache.set(tile, result); return result;
}
export function composeInfinite(world: InfiniteWorld, atlas: AtlasManifest, view: InfiniteView, alpha = 1, windDetail = 1): Frame {
  const scale = cameraScale(view), commands: DrawCommand[] = [], rendered: TerrainTile[] = [];
  const time = lerp(world.previousTime, world.time, alpha);
  const screen = (x: number, y: number, height = world.heightAt(x, y)): Vec2 => {
    const p = project({ x: x - view.cameraX, y: y - view.cameraY }, TILE);
    return { x: view.width / 2 + p.x * scale, y: view.height / 2 + (p.y - height) * scale };
  };
  // A full sprite margin prevents visible respawn even at the viewport edges.
  world.spawnHidden=(x,y)=>spawnOutsideView(world,view,x,y);
  let burning:VolcanicWildlifeAgent|undefined;
  const sprite = (id: string, name: string, x: number, y: number, size: number, frame: number, layer: number, opacity = 1, tint: number|readonly [number,number,number] = 255, altitude = 0, depth = x + y) => {
    const parts=atlas.animalClips?.[name]?.parts;
    const p=screen(x,y,world.heightAt(x,y)+altitude),z=scale*size;
    // Pieces share one root/depth; compute the terrain projection once per animal.
    for(let part=0;part<(parts?.length??1);part++){
      const s=atlas.sprites[parts?.[part]??name];if(!s)throw new Error(`Unknown sprite: ${name}`);
      const command:DrawCommand={id:part?`${id}:${part}`:id,x:p.x-s.anchor[0]*z,y:p.y-s.anchor[1]*z,width:s.width*z,height:s.height*z,
        region:spriteRegion(s,frame),color:[...(typeof tint==='number'?[255,tint,tint] as const:tint),Math.round(opacity*255)],layer,depth};
      if(burning&&layer===2){
        const t=lerp(burning.previousElapsed,burning.elapsed,alpha),fade=clamp(1-t/CONFIG.world.volcanoes.burnSeconds,0,1);
        command.color=[110,75,65,Math.round(opacity*fade*255)];
      }
      if(visible(command,view.width,view.height))commands.push(command);
    }
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
  // Feathered mud follows narrow channel banks; shared texture and ground heights
  // let it dissolve into soil and shallow water without straight tile-wide borders.
  for(const p of world.bankCover){
    const {x,y}=p,anchor=screen(x,y);
    if(anchor.x<-160*scale||anchor.x>view.width+160*scale||anchor.y<-100*scale||anchor.y>view.height+100*scale)continue;
    const tangent={x:Math.cos(p.heading)*.65,y:Math.sin(p.heading)*.65},normal={x:-Math.sin(p.heading)*.26,y:Math.cos(p.heading)*.26};
    const corners:QuadCorners=[screen(x-tangent.x-normal.x,y-tangent.y-normal.y),screen(x+tangent.x-normal.x,y+tangent.y-normal.y),screen(x-tangent.x+normal.x,y-tangent.y+normal.y),screen(x+tangent.x+normal.x,y+tangent.y+normal.y)];
    const box=quadBounds(corners);if(!visible(box,view.width,view.height))continue;
    commands.push({...box,corners,id:p.id,region:atlas.sprites['river-mud']!.frames[0],color:[255,255,255,255],layer:.3,depth:x+y});
  }
  // Shared solid quads carry foam and woody debris downstream; no per-river textures/agents.
  for(const path of world.rivers)for(let i=0;i<48;i++){
    const p=riverParticle(path,time,i/48),wood=i%12===0;
    const side=(hash(i,0,world.seed)-.5)*path.width*.6;
    const x=p.x-Math.sin(p.heading)*side,y=p.y+Math.cos(p.heading)*side;
    const length=wood?.10+hash(i,1,world.seed)*.16:.05+path.speed*.12;
    const line=(suffix:string,ax:number,ay:number,bx:number,by:number,width:number)=>{
      if((world.tileAt(ax,ay)?.materialAt(ax,ay)??0)<TerrainKind.Shallow||(world.tileAt(bx,by)?.materialAt(bx,by)??0)<TerrainKind.Shallow)return;
      const a=screen(ax,ay),b=screen(bx,by),dx=b.x-a.x,dy=b.y-a.y,n=Math.hypot(dx,dy)||1,w=width*scale;
      const corners:QuadCorners=[{x:a.x-dy/n*w,y:a.y+dx/n*w},{x:a.x+dy/n*w,y:a.y-dx/n*w},{x:b.x-dy/n*w,y:b.y+dx/n*w},{x:b.x+dy/n*w,y:b.y-dx/n*w}];
      const box=quadBounds(corners);if(!visible(box,view.width,view.height))return;
      commands.push({...box,corners,id:`river:${path.id}:${i}:${suffix}`,layer:1.2,depth:x+y,color:wood?[104,77,42,Math.round(230*p.fade)]:[201,235,211,Math.round((80+path.speed*160)*p.fade)]});
    };
    const bx=x+Math.cos(p.heading)*length,by=y+Math.sin(p.heading)*length;
    line('main',x,y,bx,by,wood?1.2:.7);
    if(wood)line('twig',lerp(x,bx,.6),lerp(y,by,.6),bx+Math.cos(p.heading+.8)*.07,by+Math.sin(p.heading+.8)*.07,.65);
  }
  composeZen(world,atlas,commands,screen,scale,view.width,view.height,alpha);
  composeVolcanoes(world,atlas,commands,screen,sprite,time,scale,view.width,view.height,alpha);
  for (const record of world.agents) {
    if(record instanceof SpacecraftAgent){burning=undefined;composeSpacecraft(record,sprite,alpha,time,atlas.spacecraftParts);
      const p=record.presentation(alpha),center=screen(p.x,p.y,world.heightAt(p.x,p.y)+p.altitude);
      if(center.x>-110*scale&&center.x<view.width+110*scale&&center.y>-90*scale&&center.y<view.height+90*scale)
        commands.push(...composeFlightField(record,time,alpha,center,scale));
      continue;}
    if(record instanceof VolcanicWildlifeAgent&&record.phase==='waiting')continue;
    const a=record instanceof VolcanicWildlifeAgent?record.animal:record;
    burning=record instanceof VolcanicWildlifeAgent&&record.phase==='burn'?record:undefined;
    // Ground-anchor rejection includes a conservative canopy margin before frame selection.
    const point = screen(a.x, a.y);
    if (!(a instanceof LandscapePatchAgent) && (point.x < -220 * scale || point.x > view.width + 220 * scale || point.y < -180 * scale || point.y > view.height + 300 * scale)) continue;
    if(a instanceof LandscapePatchAgent){
      const timePhase=a.animationPhase(alpha);
      for(const [index,piece] of a.pieces.entries()){
        const point=screen(piece.x,piece.y),phase=timePhase+piece.phase;
        if(point.x<-280*scale||point.x>view.width+280*scale||point.y<-170*scale||point.y>view.height+300*scale)continue;
        const drawPiece=(style:typeof piece.style,part:number,size:number,opacity:number,underlay=false)=>{
          const root=isGrove(style)&&part<3?patchRoots(piece.variant)[part]:undefined;
          const rx=piece.x+(root?.x??0)*size,ry=piece.y+(root?.y??0)*size;
          const correction=root?(world.heightAt(piece.x,piece.y)-world.heightAt(rx,ry))*scale:0;
          const offset=root?project(root,TILE):{x:0,y:0};
          const ground=underlay||isGroundPatch(style)||(isGrove(style)&&part===3);
          const cycle=(phase+part*1.73)*Math.PI*2/CONFIG.world.patches.windPeriod;
          const breeze=Math.sin(cycle)+.28*Math.sin(cycle*.63+piece.x*.2+piece.y*.14);
          const lean=(ground?(style==='water'?CONFIG.world.patches.sway*.25:0):CONFIG.world.patches.sway)*breeze;
          const weight=root?rustleWeight(hash(index,part,Math.floor(piece.phase*1e6)),CONFIG.world.patches.rustleCoverage,windDetail):0;
          const flutter=weight*CONFIG.world.patches.rustlePixels*(Math.sin(cycle*3.1)+.3*Math.sin(cycle*5.3));
          // Ground masks share the lowest visible foliage row as their stem base.
          // This moves flower heads with stems, while the soil mask stays still.
          const leaves=atlas.sprites[`patch-${style}-${piece.variant}-${part}-leaves`];
          if(!leaves)throw new Error(`Missing landscape foliage: ${style}/${piece.variant}/${part}`);
          const groundFoot=leaves.height-leaves.anchor[1];
          // A flower carpet is wide, so ordinary plant shear exaggerates its
          // motion. Bound travel in pixels and use a slower, gentler breeze.
          // The grass fringe follows the same calm rhythm instead of sliding
          // visibly behind the flowers. Trees keep their existing wind.
          const flowerBed=piece.style==='flowers';
          const petals=style==='flowers'?atlas.sprites[`patch-${style}-${piece.variant}-${part}-petals`]:undefined;
          const flowerHeight=Math.max(1,leaves.height,(petals?.anchor[1]??0)+groundFoot);
          const flowerCycle=phase*Math.PI*2/CONFIG.world.patches.flowerWindPeriod;
          const flowerLean=CONFIG.world.patches.flowerSwayPixels/flowerHeight*(.8*Math.sin(flowerCycle)+.2*Math.sin(flowerCycle*.61));
          for(const mask of (style==='flowers'?['base','leaves','petals']:['base','leaves'])){
            const foliage=mask==='leaves';
            const name=`patch-${style}-${piece.variant}-${part}-${mask}`,s=atlas.sprites[name];
            if(!s)throw new Error(`Missing landscape patch mask: ${name}`);
            const z=scale*size;
            // Both masks share one continuous transform about this tree's actual
            // foot, even though their independently trimmed rectangles differ.
            const groundMotion=ground&&style!=='water'&&((foliage)||(mask==='petals'));
            const motion=groundMotion?(flowerBed?flowerLean:CONFIG.world.patches.groundSway*breeze*(style==='grass'?.5:style==='mud'?.35:1)):lean;
            const foot=groundMotion?groundFoot:offset.y;
            const corners=(motion||root)?rootedQuad({x:point.x+offset.x*z,y:point.y+foot*z+correction},s.width,s.height,
              [s.anchor[0]+offset.x,s.anchor[1]+foot],z,z,motion):undefined;
            const box=corners?quadBounds(corners):{x:point.x-s.anchor[0]*z,y:point.y-s.anchor[1]*z+correction,width:s.width*z,height:s.height*z};
            if(!visible(box,view.width,view.height))continue;
            const tint=CONFIG.world.patches.foliage[piece.tint]!;
            // Registered soil is translucent; connected ground cover supplies the
            // border instead of an opaque little diamond around every tree group.
            const alpha=opacity*(!foliage&&ground&&style!=='water'&&style!=='flowers'&&style!=='mud'?.38:1);
            const command:DrawCommand={...box,corners,id:`${a.id}:${index}:${style}:${part}:${mask}`,region:s.frames[0],
              color:foliage?[tint[0],tint[1],tint[2],Math.round(alpha*255)]:[255,255,255,Math.round(alpha*255)],layer:underlay?.55:ground?(style==='water'?.9:.6):2,depth:rx+ry};
            if(root&&weight>0)commands.push(...crownBands(command,s.anchor[1]+offset.y,s.height,z,flutter));
            else commands.push(command);
          }
        };
        // A wide, porous grass fringe joins compatible neighboring artwork. It is
        // part of the compound sprite, sharing its clock and immutable layout.
        if(world.settings.chance_grass>0&&(isGrove(piece.style)||piece.style==='bush'||piece.style==='flowers'))drawPiece('grass',0,1.04,piece.opacity*.65,true);
        for(let part=0;part<(isGrove(piece.style)?4:1);part++){
          if(isGrove(piece.style)&&part<3&&!(piece.trees&(1<<part)))continue;
          drawPiece(piece.style,part,piece.scale,piece.opacity);
        }
        // A bounded overlay per selected component, owned by this arrangement.
        // Ground anchors preserve animal/tree occlusion; the existing interpolated
        // clock freezes on pause and resumes exactly after sleeping/checkpoints.
        const rank=hash(index,7,Math.floor(piece.phase*1e6));
        if(piece.style!=='water'&&rank<CONFIG.world.patches.accentCoverage*world.settings.chance_accents){
          const x=piece.x+(hash(index,8,world.seed)-.5)*1.3,y=piece.y+(hash(index,9,world.seed)-.5)*1.3;
          if((world.tileAt(x,y)?.materialAt(x,y)??TerrainKind.Deep)<TerrainKind.Shallow){
            const form=Math.floor(hash(index,10,Math.floor(piece.phase*1e6))*ACCENT_FORMS.length);
            const name=ACCENT_FORMS[form]!,s=atlas.sprites[`accent-${name}`];
            if(!s)throw new Error(`Missing landscape accent: ${name}`);
            const base=screen(x,y),z=scale*(.60+hash(index,11,world.seed)*.95),lean=(Math.sin(phase*(.7+form*.023))+.25*Math.sin(phase*1.9))*.045;
            const corners=rootedQuad(base,s.width,s.height,s.anchor,z,z,lean),box=quadBounds(corners);
            const rustle=Math.floor(phase*(1+form*.017)/CONFIG.world.patches.accentRustlePeriod*s.frames.length)%s.frames.length;
            if(visible(box,view.width,view.height))commands.push({...box,corners,id:`${a.id}:accent:${index}`,region:s.frames[rustle],color:[255,255,255,255],layer:2,depth:x+y});
            // Wings fold continuously; drifting leaves fade before looping. These
            // decorative insects are components, not independently ticking agents.
            if(index%3===0){
              const butterfly=index%2===0,t=phase*(butterfly?.65:.22),cycle=((t%1)+1)%1;
              const fly=atlas.sprites[`accent-${butterfly?'butterfly':'leaf'}`];
              if(!fly)throw new Error('Missing airborne landscape accent');
              const fx=x+Math.sin(t)*.18,fy=y+Math.cos(t*.73)*.13;
              const fp=screen(fx,fy,world.heightAt(fx,fy)+(butterfly?15+Math.sin(t*1.7)*5:8+(1-cycle)*30));
              const width=scale*(butterfly?.25+.65*Math.abs(Math.sin(phase*11)):.7),height=scale*.7;
              const q=rootedQuad(fp,fly.width,fly.height,fly.anchor,width,height,Math.sin(t)*.4),bounds=quadBounds(q);
              if(visible(bounds,view.width,view.height))commands.push({...bounds,corners:q,id:`${a.id}:flutter:${index}`,region:fly.frames[0],color:[255,255,255,Math.round(255*(butterfly?1:Math.sin(cycle*Math.PI)))],layer:2,depth:fx+fy});
            }
          }
        }
      }
      // Fireflies belong to the compound presentation, retaining the old quiet
      // glints without reintroducing a separately simulated mote on each tile.
      for(let i=0;i<3&&a.pieces.length;i++){
        const p=a.pieces[(i*3)%a.pieces.length]!;if(p.style==='water')continue;
        const point=screen(p.x,p.y),t=timePhase+p.phase;
        rect(`${a.id}~mote:${i}`,point.x+Math.sin(t*.7)*20*scale,point.y-(20+Math.cos(t*.4)*13)*scale,
          scale,scale,'#eff4aa',(world.weather==='dusk'?.9:.4)*(.6+.4*Math.sin(t)**2),3);
      }
    } else if (a instanceof PlantAgent) {
      sprite(`${a.id}-shadow`, 'shadow', a.x, a.y, a.kind === 'tree' ? a.scale*1.35 : .35, 0, 1, .24);
      const name=`${a.kind}-${a.variant}${a.morphology?`-form-${a.morphology}`:''}`,s=atlas.sprites[name];
      if(!s)throw new Error(`Unknown plant sprite: ${name}`);
      const traits=a.appearance,phase=a.animationPhase(alpha),z=scale*a.scale*(.97+.03*a.vigor);
      // Continuous crown sway carries the broad motion; registered leaf pixels only rustle.
      const lean=traits.lean+Math.sin(time*1.7+a.x*.45+a.y*.31)*.004
        +Math.sin(phase*PLANT_FPS/PLANT_FRAMES*Math.PI*2)*(a.kind==='tree'?.009:.018);
      const corners=rootedQuad(point,s.width,s.height,s.anchor,z*traits.width,z*traits.height,lean,traits.mirror);
      const box=quadBounds(corners),frame=Math.floor(phase*PLANT_FPS);
      if(visible(box,view.width,view.height))commands.push({...box,corners,id:a.id,region:spriteRegion(s,frame),
        color:traits.tone?[244,255,239,255]:[255,255,255,255],flip:traits.mirror,layer:2,depth:a.x+a.y});
      if(a.kind==='tree'&&traits.vine&&a.variant!==2&&a.scale>.8){
        const v=atlas.sprites[`vine-${traits.vine-1}`]!;
        // Attachment height follows the actual trimmed crown, not a fixed world altitude.
        const vz=z*traits.height*s.anchor[1]/80;
        const vc=rootedQuad(point,v.width,v.height,v.anchor,vz*traits.width,vz,lean,traits.mirror);
        const vb=quadBounds(vc);
        if(visible(vb,view.width,view.height))commands.push({...vb,corners:vc,id:`${a.id}~vine`,region:v.frames[frame%v.frames.length],color:[255,255,255,255],flip:traits.mirror,layer:2,depth:a.x+a.y});
      }
    } else if ((a instanceof DeerAgent||a instanceof WildlifeAgent)&&a.repose.active) {
      const d=a instanceof DeerAgent?sampleDeer(a,alpha):sampleWildlife(a,alpha);
      const rest=restingSprite(a.kind,a.repose,d.heading,alpha,animalForm(a.kind,a.coat,a.juvenile));
      const size=a.size*(a instanceof DeerAgent?1.05:a instanceof EcologicalAgent?a.spec.displayScale:1);
      sprite(`${a.id}-shadow`,'shadow',d.x,d.y,.4*a.size,0,1,.2);
      sprite(a.id,rest.name,d.x,d.y,size,rest.frame,2,1,a.kind==='blackBear'?BEAR_COATS[a.coat]:[255,248,240][a.coat]);
    } else if (a instanceof DeerAgent) {
      const d = sampleDeer(a, alpha), clip = d.state === 'lower' ? 'raise' : d.state, count = DEER_CLIPS[clip];
      let phase = ['walk', 'run', 'turn'].includes(d.state) ? d.gait % 1 : ((time + a.phase) / 1.2) % 1;
      let frame = Math.floor(phase * count);
      if(clip==='groom'||clip==='play')frame=Math.round(clamp(d.actionTime/4,0,1)*(count-1));
      if (clip === 'raise') { phase = clamp(d.actionTime / HEAD_SECONDS, 0, 1); if (d.state === 'lower') phase = 1 - phase; frame = Math.round(phase * (count - 1)); }
      sprite(`${a.id}-shadow`, 'shadow', d.x, d.y, .4*a.size, 0, 1, .35);
      sprite(a.id, `${animalPrefix('deer',animalForm('deer',a.coat,a.juvenile))}-${clip}-${directionIndex(d.heading)}`, d.x, d.y, 1.05*a.size, frame, 2, 1, [255,247,237][a.coat]);
    } else if (a instanceof EcologicalAgent) {
      if(a.kind==='vulture'&&'homeX' in a&&'homeY' in a)sprite(`${a.id}-remains`,'scavenging-remains',Number(a.homeX)+.16,Number(a.homeY),1,0,1.3);
      const d=sampleWildlife(a,alpha),spec=ECO_SPECS[a.kind];
      const submerged=spec.mode==='amphibious'&&world.tileAt(d.x,d.y)?.materialAt(d.x,d.y)!>=TerrainKind.Shallow;
      const clip=d.state==='settle'&&a instanceof BlackBearAgent?bearSettleClip(Boolean(a.stopRunning),Number(a.stopPhase)):d.state==='approach'?'travel':a.kind==='hippo'&&submerged&&!['enterWater','leaveWater','yawn'].includes(d.state)?(d.state==='travel'?'wade':'wallow'):a.kind==='whale'?(d.state==='surface'?'surface':'travel'):submerged&&['beaver','crocodile'].includes(a.kind)&&['travel','rest'].includes(d.state)?d.state==='travel'?'swim':'wallow':d.state;
      if(a instanceof SnakeAgent && ['wrap','coil','unwrap'].includes(d.state)){
        const action=d.state==='coil'?'coil':'wrap',heading=ecoDirection(a.kind,a.supportHeading);
        const name=`${animalPrefix('boa',animalForm('boa',a.coat))}-${action}-${heading}`,count=atlas.animalClips?.[`${name}-front`]?.frames??atlas.sprites[`${name}-front`]!.frames.length;
        const phase=d.state==='unwrap'?1-d.gait:d.state==='coil'?0:d.gait;
        const pose=Math.round(phase*(count-1));
        const angle=heading/spec.directions*Math.PI*2,offset=SNAKE_SUPPORT_OFFSET*SNAKE_MODEL_TO_TILE*a.size;
        const blend=action==='coil'?1:phase*phase*(3-2*phase);
        const x=lerp(d.x,a.supportX+Math.cos(angle)*offset,blend),y=lerp(d.y,a.supportY+Math.sin(angle)*offset,blend);
        const altitude=(world.heightAt(a.supportX,a.supportY)-world.heightAt(x,y))*blend;
        // The supporting tree remains between the two transparent body sections.
        for(const front of [false,true])sprite(`${a.id}-${front?'front':'back'}`,`${name}-${front?'front':'back'}`,
          x,y,a.size*spec.displayScale,pose,2,1,[255,250,243][a.coat],altitude,a.supportX+a.supportY+(front?.001:-.001));
        continue;
      }
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
      const name=`${animalPrefix(a.kind,animalForm(a.kind,a.coat,a.juvenile))}-${clip}-${ecoDirection(a.kind,d.heading)}`,count=atlas.animalClips?.[name]?.frames??atlas.sprites[name]?.frames.length;
      if(!count)throw new Error(`Unknown ecology sprite ${name}`);
      const oneShot=animalOneShot(a.kind,d.state);
      const pose=a.kind==='whale'&&d.state==='surface'?Math.round(clamp(((lerp(a.previousBreath,a.breathClock,alpha)%a.cycleSeconds)/a.cycleSeconds-.83)/.17,0,1)*(count-1)):a instanceof SnakeAgent&&['turnLeft','turnRight'].includes(d.state)?Math.round(lerp(a.previousTurnBend,a.turnBend,alpha)*(count-1)):oneShot?Math.min(count-1,Math.floor(d.gait*(count-1))):Math.min(count-1,Math.floor((d.state==='swing'?d.gait:d.gait%1)*count));
      const water=spec.mode==='water',visibility=a.kind==='whale'?clamp((d.altitude+12)/12,0,1):1;
      const heading=a.kind==='crab'?d.heading+Math.PI/2:d.heading;
      if(!water)sprite(`${a.id}-shadow`,'shadow',d.x,d.y,(spec.mode==='air'?.18:.4)*a.size,0,1,.16);
      sprite(a.id,name,d.x,d.y,a.size*spec.displayScale,pose,water?.8:2,a.kind==='fish'?.65:submerged?.78:visibility,a.kind==='blackBear'?BEAR_COATS[a.coat]:[255,250,243][a.coat],d.altitude);
      if(a.speed>.03&&((a.kind==='bison'&&d.state==='run'&&!submerged)||(a.kind==='beaver'&&submerged))){
        const wake=a.kind==='beaver',clock=lerp(a.previousBreath,a.breathClock,alpha);
        for(let i=0;i<4;i++){
          const t=(clock*(wake?.7:1.4)+i*.25)%1,side=i%2?1:-1;
          const x=d.x-Math.cos(d.heading)*(.12+t*.22)+Math.sin(d.heading)*side*(.06+t*.05),y=d.y-Math.sin(d.heading)*(.12+t*.22)-Math.cos(d.heading)*side*(.06+t*.05);
          const p=screen(x,y,world.heightAt(x,y)+(wake?.5:t*3));
          rect(`${a.id}-${wake?'wake':'dust'}-${i}`,p.x,p.y,(wake?4+t*7:2+t*2)*scale,scale,wake?'#d5e6ce':'#b59b6d',(1-t)*(wake?.22:.2),1.1);
        }
      }
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
      const d=sampleWildlife(a,alpha),clip=d.state==='run'?'chase':d.state, phase=(quietAction(d.state)||['takeoff','land','crouch','uncrouch'].includes(d.state))?d.gait:d.gait%1;
      const name=`${animalPrefix(a.kind,animalForm(a.kind,a.coat,a.juvenile))}-${clip}-${directionIndex(d.heading)}`,count=atlas.animalClips?.[name]?.frames??atlas.sprites[name]?.frames.length;
      if(!count)throw new Error(`Unknown wildlife sprite ${name}`);
      sprite(`${a.id}-shadow`,'shadow',d.x,d.y,(a.kind==='toucan'?.2:.4)*a.size,0,1,.22);
      sprite(a.id,name,d.x,d.y,a.size,Math.min(count-1,Math.floor(phase*((quietAction(d.state)||['takeoff','land','crouch','uncrouch'].includes(d.state))?count-1:count))),2,1,a.kind==='blackBear'?BEAR_COATS[a.coat]:[255,248,240][a.coat],d.altitude);
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
