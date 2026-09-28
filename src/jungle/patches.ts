import { CONFIG } from '../config';
import { hash, noise, clamp, unproject } from '../iso/math';
import { journeyDensity } from './journey';
import { groundVegetation } from './ground-blend';
import type { WorldSettings } from './settings';
import { CHUNK_SIZE, type TerrainFields } from './terrain';
import { TILE } from './geometry';
import { forestRegion } from './regions';

export const PATCH_KINDS = ['grove','bush','grass','wet','water','bloom','fruit','flowers','mud'] as const;
export type PatchKind = typeof PATCH_KINDS[number];
export const isGrove=(style:PatchKind)=>style==='grove'||style==='bloom'||style==='fruit';
export const isGroundPatch=(style:PatchKind)=>style==='grass'||style==='flowers'||style==='mud'||style==='water';
/** Reviewed trunk feet in each generated 384×512 source cell. These also own draw depth. */
export const GROVE_ROOTS: readonly (readonly (readonly [number,number])[])[] = [
 [[116,414],[252,323],[292,449]], [[115,381],[212,306],[302,452]],
 [[116,453],[122,315],[278,393]], [[104,375],[257,301],[260,446]],
];
export const GROVE_ANCHOR = [192,390] as const;
export const GROVE_SOURCE_SCALE = .6;
export interface TreeSupport { x:number; y:number; scale:number; height?:number }
/** Reviewed crown ledges, in logical screen pixels above each trunk foot. */
const CROWN_HEIGHTS=[[140,118,91],[122,132,99],[91,124,113],[121,128,94]];
export const treePerchHeight=(tree:TreeSupport)=>tree.height??tree.scale*60;
export function patchRoots(variant:number): readonly TreeSupport[] { return ROOTS[variant]!; }
const ROOTS=GROVE_ROOTS.map((roots,v)=>Object.freeze(roots.map(([x,y],i)=>{
 const p=unproject({x:(x-GROVE_ANCHOR[0])*GROVE_SOURCE_SCALE,y:(y-GROVE_ANCHOR[1])*GROVE_SOURCE_SCALE},TILE);
 return Object.freeze({...p,scale:1.65,height:CROWN_HEIGHTS[v]![i]!});
})));
/** A component is immutable art/template data inside a larger compound sprite, never an agent. */
export interface LandscapePiece { x:number; y:number; style:PatchKind; variant:number; tint:number; scale:number; opacity:number; trees:number; phase:number }
export interface PatchSample { fields:TerrainFields; height:number }
export const ARRANGEMENT_SIZE=CHUNK_SIZE;
const STEP=1.35, ROW=STEP*.8660254038;
interface Candidate extends LandscapePiece { ix:number; iy:number; priority:number }
/** Warped triangular placement has no correspondence with tile/chunk edges. */
function position(ix:number,iy:number,seed:number){
 const x=(ix+.5+(iy&1)*.5)*STEP,y=(iy+.5)*ROW;
 return{x:x+(noise(x/7,y/7,seed+7180)-.5)*1.5+(hash(ix,iy,seed+7181)-.5)*.34,
  y:y+(noise(x/7,y/7,seed+7182)-.5)*1.5+(hash(ix,iy,seed+7183)-.5)*.34};
}
/** Continuous vegetation fields create stands, connecting undergrowth and porous ecotones.
 * Whole arrangements are streamed by their 4×4 ownership window; artwork is never clipped there. */
export function planArrangement(cx:number,cy:number,seed:number,settings:Readonly<WorldSettings>,origin:{x:number;y:number},sample:(x:number,y:number)=>PatchSample,halo=0):readonly LandscapePiece[] {
 if(!CONFIG.world.patches.enabled)return [];
 const candidates=new Map<string,Candidate|undefined>(),samples=new Map<string,PatchSample>();
 const at=(x:number,y:number)=>{const key=`${x}:${y}`;let p=samples.get(key);if(!p){p=sample(x,y);samples.set(key,p);}return p;};
 const candidate=(ix:number,iy:number):Candidate|undefined=>{
  const key=`${ix}:${iy}`;if(candidates.has(key))return candidates.get(key);
  const {x,y}=position(ix,iy,seed),f=at(x,y).fields,density=settings.plants*journeyDensity(x,y,origin).plants;
  let style:PatchKind,opacity=1;
  const wet=f[0],cover=groundVegetation(f),stand=noise(x/5.8,y/5.8,seed+7185);
  if(wet<0){
   // Pads are colonies with open lanes, never a regular array of little pools.
   if(noise(x/7,y/7,seed+7186)<.48){candidates.set(key,undefined);return;}
   style='water';opacity=clamp((-wet-.01)*10,0,.72);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(at(x+dx!*.85,y+dy!*.85).fields[0]>=0)opacity=0;
  }else{
   if(!density){candidates.set(key,undefined);return;}
   // Correlated stands, rather than independent per-cell lotteries. The same
   // field gradually turns a forest edge into bush, then a grassy fringe.
   const clearingField=noise(x/CONFIG.world.patches.clearingScale,y/CONFIG.world.patches.clearingScale,seed+7193);
   const edge=clamp((clearingField-.55)/.25,0,1),clearing=edge*edge*(3-2*edge);
   // Local glades ease from trees through bush into grass; most of the field
   // retains its original density. Coordinates, not chunk visits, own the gaps.
   const region=forestRegion(x,y,seed);
   const canopy=clamp(density*cover*CONFIG.world.patches.coverage,0,1.4)*(1-clearing*CONFIG.world.patches.clearingAmount)*region.canopy;
   const groveThreshold=.13+canopy*.64;
   if(wet<.13){style='wet';opacity=clamp(wet*24,0,1);}
   else if(cover>.25&&stand<groveThreshold){style='grove';}
   else if(cover>.2&&stand<groveThreshold+.18){style='bush';}
   else{style='grass';opacity=.38+.42*cover;}
   // Correlated colorful stands plus rare embedded outliers. These replace art
   // inside the compound layout, never introduce single-tile stamps or clocks.
   const accent=hash(ix,iy,seed+7194);
   if(style==='grove'){
    if(accent<.055){style='mud';opacity=.75;}
    else if(accent<.055+.58*region.flowers+.055)style='bloom';
    else if(hash(ix,iy,seed+7195)<.6*region.fruit+.075)style='fruit';
   }else if((style==='grass'||style==='bush')&&cover>.15&&accent<.72*region.flowers+.08){style='flowers';opacity=.85;}
   if(!isGrove(style))opacity*=Math.min(1,density*2.6);
  }
  if(opacity<.05){candidates.set(key,undefined);return;}
  const variant=(Math.floor(hash(ix,iy,seed+7188)*4)+((ix+iy)&3))%4;
  // Color varies over whole stands, so neighbors share compatible foliage.
  const tint=Math.min(2,Math.floor(noise(x/13,y/13,seed+7189)*3));
  const scale=isGrove(style)?.88+hash(ix,iy,seed+7190)*.17:style==='bush'?1.15+hash(ix,iy,seed+7190)*.20:style==='wet'?1.05+hash(ix,iy,seed+7190)*.18:1;
  const result:Candidate={x,y,style,variant,tint,scale,opacity,trees:isGrove(style)?7:0,phase:hash(ix,iy,seed+7191)*20,ix,iy,priority:hash(ix,iy,seed+7192)};
  candidates.set(key,result);return result;
 };
 const pieces:LandscapePiece[]=[],minX=cx*ARRANGEMENT_SIZE,minY=cy*ARRANGEMENT_SIZE,maxX=minX+ARRANGEMENT_SIZE,maxY=minY+ARRANGEMENT_SIZE;
 // Generous lattice halo accounts for staggering and domain warping. Neighbor
 // trunk priority is evaluated from original candidates, independent of visit order.
 for(let iy=Math.floor((minY-2)/ROW);iy<=Math.ceil((maxY+2)/ROW);iy++)for(let ix=Math.floor((minX-3)/STEP);ix<=Math.ceil((maxX+2)/STEP);ix++){
  const c=candidate(ix,iy);if(!c||c.x<minX-halo||c.x>=maxX+halo||c.y<minY-halo||c.y>=maxY+halo)continue;
  let trees=c.trees;
  if(isGrove(c.style))for(const [index,root] of patchRoots(c.variant).entries()){
   const x=c.x+root.x*c.scale,y=c.y+root.y*c.scale;
   if(at(x,y).fields[0]<.03){trees&=~(1<<index);continue;}
   const priority=c.priority+index*.00001;
   for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const n=candidate(ix+dx,iy+dy);if(!n||!isGrove(n.style)||n===c)continue;
    for(const [j,r] of patchRoots(n.variant).entries()){
     if(n.priority+j*.00001>=priority)continue;
     const nx=n.x+r.x*n.scale,ny=n.y+r.y*n.scale;
     if(Math.hypot(nx-x,ny-y)<.44&&at(nx,ny).fields[0]>=.03)trees&=~(1<<index);
    }
   }
  }
  pieces.push(Object.freeze({x:c.x,y:c.y,style:c.style,variant:c.variant,tint:c.tint,scale:c.scale,opacity:c.opacity,trees,phase:c.phase}));
 }
 return Object.freeze(pieces);
}

/** World-space vector template for a component's visible trunks. */
export function pieceSupports(piece:LandscapePiece):readonly TreeSupport[]{
 return isGrove(piece.style)?patchRoots(piece.variant).flatMap((p,i)=>piece.trees&(1<<i)?[{x:piece.x+p.x*piece.scale,y:piece.y+p.y*piece.scale,scale:p.scale*piece.scale,height:treePerchHeight(p)*piece.scale}]:[]):[];
}
/** Fish schools require a substantial connected-looking footprint, not a tiny isolated pool.
 * A fixed 7×7 probe grid is bounded and independent of streamed neighbors. */
export function schoolWater(x:number,y:number,isWater:(x:number,y:number)=>boolean):boolean {
 if(!isWater(x,y))return false;
 // Align the probes globally so a chunk can share repeated habitat samples.
 const gx=Math.round(x/.65),gy=Math.round(y/.65);let wet=0;
 for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(isWater((gx+dx)*.65,(gy+dy)*.65))wet++;
 return wet>=36;
}
