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
/** Independent, jittered garden components. The entrance and walking court stay open. */
export interface ZenPlant {x:number;y:number;kind:'tree'|'flower'|'lotus';variant:number;scale:number;phase:number}
export function zenPlants(s:ZenSite,settings:Readonly<WorldSettings>):ZenPlant[]{
 const out:ZenPlant[]=[];
 for(let i=0;i<32;i++){
  const angle=i*2.399963+hash(i,1,s.seed)*.3,r=3.3+hash(i,2,s.seed)*2.7;
  const x=s.x+Math.cos(angle)*r,y=s.y+Math.sin(angle)*r;
  const tree=i<17,rate=tree?settings.chance_zenTree:settings.chance_zenFlowers;
  if(hash(i,3,s.seed)>.65*rate||pondRadius(s,x,y)<1.25)continue;
  if(tree&&Math.hypot(x-s.x-1.2,y-s.y-2.8)<1.5)continue;
  // A view corridor in front of the temple keeps its facade and monks readable.
  if(tree&&x+y>s.x+s.y+2&&Math.abs(x-y-s.x+s.y)<2)continue;
  out.push({x,y,kind:tree?'tree':'flower',variant:tree?(i%7<4?0:i%7<6?1:2):i%3,scale:.8+hash(i,4,s.seed)*.4,phase:hash(i,5,s.seed)*20});
 }
 for(let i=0;settings.water>0&&i<14;i++){
  const a=i*2.4,r=.32+hash(i,6,s.seed)*.4;
  if(hash(i,7,s.seed)>.7*settings.chance_lotus)continue;
  out.push({x:s.pondX+Math.cos(a)*r*2.1,y:s.pondY+Math.sin(a)*r*1.5,kind:'lotus',variant:i%3,scale:.75+hash(i,8,s.seed)*.4,phase:hash(i,9,s.seed)*20});
 }
 // Registered beds are the monks' actual watering destinations.
 for(let i=0;i<4;i++)if(hash(i,10,s.seed)<.8*settings.chance_zenFlowers)out.push({x:s.x+.6+i*.45,y:s.y+2.8,kind:'flower',variant:i%3,scale:.85,phase:i});
 return out;
}
