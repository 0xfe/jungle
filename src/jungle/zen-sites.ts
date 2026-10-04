import { zenEntrance, zenPixelPosition, ZEN_HEDGE_RING, ZEN_TEMPLE } from './zen-layout';
import type { Vec2 } from '../iso/math';
import { CONFIG } from '../config';
import { hash, clamp } from '../iso/math';
import { riverPaths } from './rivers';
import { volcanoesIn } from './volcanoes';
import { DEFAULT_SETTINGS, type WorldSettings } from './settings';
/** A stateless, widely spaced sanctuary. Geometry is shared by terrain and actors. */
export interface ZenSite { id:string; x:number; y:number; form:number; seed:number; pondX:number; pondY:number }
const siteCache=new Map<string,ZenSite|undefined>();
export function zenSite(cx:number,cy:number,seed:number,settings:Readonly<WorldSettings>=DEFAULT_SETTINGS):ZenSite|undefined {
 const c=CONFIG.world.zen;
 const key=[cx,cy,seed,settings.chance_pagoda,settings.chance_volcano,settings.water,settings.waterSize,c.spacing,c.frequency,CONFIG.world.volcanoes.frequency,CONFIG.world.volcanoes.spacing,CONFIG.world.rivers.spacing,CONFIG.world.rivers.width].join(':');
 if(siteCache.has(key))return siteCache.get(key);
 const site=makeZenSite(cx,cy,seed,settings);if(siteCache.size>=128)siteCache.delete(siteCache.keys().next().value!);siteCache.set(key,site);return site;
}
function makeZenSite(cx:number,cy:number,seed:number,settings:Readonly<WorldSettings>):ZenSite|undefined {
 const c=CONFIG.world.zen;
 if(hash(cx,cy,seed+9201)>=c.frequency*settings.chance_pagoda)return;
 const x=(cx+.3+hash(cx,cy,seed+9202)*.4)*c.spacing,y=(cy+.3+hash(cx,cy,seed+9203)*.4)*c.spacing;
 if(Math.hypot(x,y)<32||volcanoesIn({minX:x,minY:y,maxX:x,maxY:y},seed,22,settings.chance_volcano).length)return;
 // Do not dam a pre-existing river to create a garden. Check whole segments,
 // including endpoints outside the site bounds; the query is bounded and memoized.
 for(const path of riverPaths({minX:x-10,minY:y-10,maxX:x+10,maxY:y+10},seed,settings))for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1]!,b=path.points[i]!,dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy),0,1);
  if(Math.hypot(x-a.x-dx*t,y-a.y-dy*t)<9)return;
 }
 const form=Math.floor(hash(cx,cy,seed+9204)*3);
 return {id:`zen:${cx}:${cy}`,x,y,form,seed:Math.floor(hash(cx,cy,seed+9205)*0xffffffff),pondX:x+3,pondY:y-2+(form-1)*.35};
}
export function zenSitesIn(b:{minX:number;minY:number;maxX:number;maxY:number},seed:number,settings:Readonly<WorldSettings>=DEFAULT_SETTINGS,halo=8):ZenSite[]{
 if(!settings.chance_pagoda)return [];
 const s=CONFIG.world.zen.spacing,out:ZenSite[]=[];
 for(let cy=Math.floor((b.minY-halo)/s);cy<=Math.floor((b.maxY+halo)/s);cy++)for(let cx=Math.floor((b.minX-halo)/s);cx<=Math.floor((b.maxX+halo)/s);cx++){
  const v=zenSite(cx,cy,seed,settings);if(v&&v.x>=b.minX-halo&&v.x<=b.maxX+halo&&v.y>=b.minY-halo&&v.y<=b.maxY+halo)out.push(v);
 }return out;
}
export function zenAt(x:number,y:number,seed:number,settings:Readonly<WorldSettings>=DEFAULT_SETTINGS):ZenSite|undefined {
 return zenSitesIn({minX:x,minY:y,maxX:x,maxY:y},seed,settings).find(s=>Math.hypot(x-s.x,y-s.y)<8);
}
/** The inner garden is level; a two-tile smooth belt reconnects existing terrain. */
export function zenBlend(s:ZenSite,x:number,y:number):number {const t=clamp((8-Math.hypot(x-s.x,y-s.y))/2,0,1);return t*t*(3-2*t);}
export function pondRadius(s:ZenSite,x:number,y:number):number {return Math.hypot((x-s.pondX)/2.1,(y-s.pondY)/1.5);}
export function nearestZen(seed:number,x:number,y:number,settings:Readonly<WorldSettings>=DEFAULT_SETTINGS):ZenSite|undefined {
 const size=CONFIG.world.zen.spacing,cx=Math.floor(x/size),cy=Math.floor(y/size);let best:ZenSite|undefined;
 if(!settings.chance_pagoda)return;
 for(let r=0;r<12;r++){
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===r){const s=zenSite(cx+dx,cy+dy,seed,settings);if(s&&(!best||Math.hypot(s.x-x,s.y-y)<Math.hypot(best.x-x,best.y-y)))best=s;}
  if(best&&r*size>Math.hypot(best.x-x,best.y-y)+size)return best;
 }return best;
}
/** Shared landmarks keep residents, the planted grove and paths registered. */
export function zenLayout(s: ZenSite) {
 const point = (x: number, y: number) => ({ x: s.x + x, y: s.y + y });
 return {
  ...zenEntrance(s.x,s.y), grove: point(-1.8, 4.15),
  dock: {x:s.pondX,y:s.pondY+1.3}, dockEntry: {x:s.pondX,y:s.pondY+1.7},
  beds: [[.15,2.25],[1.8,2.9],[3.5,1.7],[5.1,2.8],[4.8,-.1],[.4,4.8],[2.5,5.2],[4.8,4.9]].map(([x,y]) => point(x!,y!)),
  seats: [[.5,1.5],[1.9,4.3],[4.7,1.8],[.4,3.9],[3.4,.7],[3.5,5.8],[5.7,4.1],[1.1,5.8]].map(([x,y]) => point(x!,y!)),
 };
}
export interface ZenPathPoint extends Vec2 { radius:number; branch:number; normal:Vec2 }
/** Shared smooth centrelines meet exactly at the fork and at the two built entrances. */
export function zenPaths(s: ZenSite): ZenPathPoint[] {
 const layout=zenLayout(s),out:ZenPathPoint[]=[];
 const bezier=(a:Vec2,b:Vec2,c:Vec2,d:Vec2,t:number):Vec2=>{
  const u=1-t;return{x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,y:u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y};
 };
 const main=[layout.steps,{x:s.x+.9,y:layout.steps.y},{x:s.x+3.9,y:s.y+.95},{x:s.x+6.2,y:s.y+.9}] as const;
 const fork=bezier(...main,.5),dock=layout.dockEntry;
 const branch=[fork,{x:fork.x+.3,y:fork.y-.15},{x:dock.x,y:dock.y+.4},dock] as const;
 for(const [index,curve] of [main,branch].entries()){
  const count=index?20:64;
  for(let i=0;i<=count;i++){
   const t=i/count,p=bezier(...curve,t),before=bezier(...curve,Math.max(0,t-.001)),after=bezier(...curve,Math.min(1,t+.001));
   const dx=after.x-before.x,dy=after.y-before.y,length=Math.hypot(dx,dy);
   out.push({...p,radius:(index?.27:.29)*(1+.018*Math.sin(t*Math.PI*2+s.form)),branch:index,normal:{x:-dy/length,y:dx/length}});
  }
 }
 return out;
}
export type ZenPlantKind = 'tree'|'flower'|'lotus'|'grass'|'edgegrass'|'shrub'|'hedge'|'stone'|'path'|'dock';
export interface ZenPlant { x:number; y:number; kind:ZenPlantKind; variant:number; scale:number; phase:number; corners?:readonly [Vec2,Vec2,Vec2,Vec2]; opacity?:number }
/** Bounded site-owned planting pockets; no per-frame layout work or per-plant agents. */
export function zenPlants(s: ZenSite, settings: Readonly<WorldSettings>): ZenPlant[] {
 const out: ZenPlant[] = [], layout=zenLayout(s), paths=zenPaths(s);
 const pathDistance = (x:number,y:number) => Math.min(...paths.map(p=>Math.hypot(x-p.x,y-p.y)-p.radius));
 const building = (x:number,y:number,margin=0) => Math.abs(x-s.x-ZEN_TEMPLE.rootX)<1.05+margin && Math.abs(y-s.y-ZEN_TEMPLE.rootY)<1.05+margin;
 const land = (x:number,y:number) => pondRadius(s,x,y)>1.12;
 const add = (kind:ZenPlantKind,x:number,y:number,variant:number,scale:number,phase=0) => out.push({kind,x,y,variant,scale,phase});
 // A dense, varied outer grove, with a narrow facade view corridor and clear paths.
 for (let i=0;i<65;i++) {
  const a=i*2.399963+hash(i,1,s.seed)*.35, r=3+hash(i,2,s.seed)*4;
  const x=s.x+Math.cos(a)*r, y=s.y+Math.sin(a)*r;
  if(hash(i,3,s.seed)>.8*settings.chance_zenTree || !land(x,y) || building(x,y,.8) || pathDistance(x,y)<.65)continue;
  if(x+y>s.x+s.y && Math.abs(x-y-s.x+s.y)<1.6)continue;
  if(Math.hypot(x-layout.grove.x,y-layout.grove.y)<1.9 || layout.beds.some(b=>Math.hypot(x-b.x,y-b.y)<.85))continue;
  if(out.some(p=>p.kind==='tree'&&Math.hypot(x-p.x,y-p.y)<.9))continue;
  add('tree',x,y,i%7<4?0:i%7<6?1:2,.75+hash(i,4,s.seed)*.4,hash(i,5,s.seed)*20);
 }
 // Close-set mixed hedges hug the stone terrace; the stairs keep a generous opening.
 for(let side=0;side<4;side++)for(let i=0;i<8;i++){
  const a=ZEN_HEDGE_RING[side]!,b=ZEN_HEDGE_RING[(side+1)%4]!,t=i/8;
  const {x,y}=zenPixelPosition(s.x,s.y,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
  if(pathDistance(x,y)<.24||Math.hypot(x-layout.steps.x,y-layout.steps.y)<.65)continue;
  const n=side*8+i,flower=n%5>=2,rate=flower?settings.chance_zenFlowers:settings.chance_bush;
  if(hash(n,71,s.seed)>rate)continue;
  add('hedge',x,y,n%5,.8+hash(n,72,s.seed)*.15,hash(n,73,s.seed)*20);
 }
 // Three smaller trees make a real centre for the separate walking meditation group.
 if(settings.chance_zenTree>0)for(const [i,[dx,dy]] of [[-.28,-.2],[.32,-.14],[.02,.32]].entries())
  add('tree',layout.grove.x+dx!,layout.grove.y+dy!,i===2?2:0,.48+i*.045,i*2.3);
 // Reuse jungle grass and understory art, broken by paths, water and the foundation.
 for(let i=0;i<340;i++) {
  const a=i*2.399963,r=Math.sqrt(hash(i,20,s.seed))*7.4;
  const x=s.x+Math.cos(a)*r,y=s.y+Math.sin(a)*r;
  if(!land(x,y)||building(x,y,.05)||pathDistance(x,y)<.08)continue;
  const shrine= Math.hypot(x-layout.grove.x,y-layout.grove.y), onWalk=shrine>.75&&shrine<1.65;
  if(settings.chance_grass>hash(i,21,s.seed))add('grass',x,y,i%4,.58+hash(i,22,s.seed)*.35,i*.37);
  if(i%5===0&&!onWalk&&pathDistance(x,y)>.4&&settings.chance_bush>hash(i,23,s.seed))add('shrub',x,y,i%3,.6+hash(i,24,s.seed)*.3,i*.29);
  if(i%7===0&&!onWalk&&pathDistance(x,y)>.35&&settings.chance_zenFlowers>hash(i,25,s.seed))add('flower',x,y,i%3,.5+hash(i,26,s.seed)*.3,i*.4);
 }
 // Distinct, stable beds: each independent monk owns a different watering destination.
 for(const [i,b] of layout.beds.entries())if(hash(i,10,s.seed)<.9*settings.chance_zenFlowers)add('flower',b.x,b.y,i%3,.75,i);
 for(let i=0;settings.water>0&&i<14;i++) {
  const a=i*2.4,r=.32+hash(i,6,s.seed)*.4;
  if(hash(i,7,s.seed)>.7*settings.chance_lotus)continue;
  add('lotus',s.pondX+Math.cos(a)*r*2.1,s.pondY+Math.sin(a)*r*1.5,i%3,.75+hash(i,8,s.seed)*.4,hash(i,9,s.seed)*20);
 }
 if(settings.water>0)add('dock',layout.dock.x,layout.dock.y,0,1);
 for(const [i,p] of paths.entries()) {
  if(p.branch&&!settings.water)continue;
  const next=paths[i+1];
  if(settings.chance_mud>0&&next&&next.branch===p.branch){
   const edge=(q:ZenPathPoint,side:number)=>({x:q.x+q.normal.x*q.radius*side,y:q.y+q.normal.y*q.radius*side});
   out.push({kind:'path',x:p.x,y:p.y,variant:p.branch,scale:p.radius,phase:0,
    corners:[edge(p,-1),edge(p,1),edge(next,-1),edge(next,1)],
    opacity:p.branch?1:Math.min(1,(64-i)/7)});
  }
  if(i%4===0&&settings.chance_mud>0) {
   const side=i%8?1:-1,d=p.radius*(1+hash(i,31,s.seed)*.35);
   const x=p.x+p.normal.x*d*side,y=p.y+p.normal.y*d*side;
   if(land(x,y)&&!building(x,y))add('stone',x,y,i%3,.7+hash(i,32,s.seed)*.7);
   if(settings.chance_grass>hash(i,33,s.seed)&&land(x,y)&&!building(x,y))add('edgegrass',x,y,i%4,.10+hash(i,34,s.seed)*.06,i*.3);
  }
 }

 return out;
}
