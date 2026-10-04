import { lerp, hash } from '../iso/math';
import { rootedQuad } from '../iso/sprite-geometry';
import { quadBounds } from '../iso/quad';
import { visible, type DrawCommand } from '../iso/render';
import { ZenGardenAgent, ZenMonkAgent, type ZenResident } from './agents/zen';
import type { InfiniteWorld } from './infinite';
import type { AtlasManifest } from './scene';
/** Composed through the same transparent painter-ordered batch as the jungle. */
export function composeZen(world:InfiniteWorld,atlas:AtlasManifest,commands:DrawCommand[],screen:(x:number,y:number,z?:number)=>{x:number;y:number},scale:number,width:number,height:number,alpha:number):void{
 const globalTime=lerp(world.previousTime,world.time,alpha);
 const draw=(id:string,name:string,x:number,y:number,size:number,phase:number,layer=2,opacity=1,lift=0,lean=0,tint:number|[number,number,number]=255)=>{
  const parts=atlas.zenParts?.[name]??[name];
  for(const [part,key] of parts.entries()){
  const s=atlas.sprites[key];if(!s)throw new Error(`Missing sanctuary sprite: ${name}. Run npm run assets.`);
  const point=screen(x,y,world.heightAt(x,y)+lift),z=scale*size,corners=rootedQuad(point,s.width,s.height,s.anchor,z,z,lean),box=quadBounds(corners);
  if(visible(box,width,height))commands.push({...box,corners,id:`${id}:${part}`,layer,depth:x+y,region:s.frames[((Math.floor(phase)%s.frames.length)+s.frames.length)%s.frames.length],color:[...(typeof tint==='number'?[255,tint,tint] as const:tint),Math.round(opacity*255)]});
  }
 };
 const glint=(id:string,x:number,y:number,z:number,w:number,opacity:number,color:[number,number,number])=>{const p=screen(x,y,world.heightAt(x,y)+z);commands.push({id,x:p.x-w*scale/2,y:p.y,width:w*scale,height:scale,color:[...color,Math.round(opacity*255)],layer:1.3,depth:x+y});};
 for(const s of world.pagodas){
  const owner=world.agents.find((a):a is ZenGardenAgent=>a instanceof ZenGardenAgent&&a.id===s.id),time=owner?lerp(owner.previousClock,owner.clock,alpha):globalTime;
  draw(`${s.id}:temple`,`zen-pagoda-${s.form}`,s.x-1.2,s.y+.2,2.1,0,2,1,0,0,[255,249,241][s.form]);
  for(const [i,p] of (world.gardenPlants.get(s.id)??[]).entries()){
   const t=time+p.phase;
   if(p.kind==='tree')draw(`${s.id}:tree:${i}`,`zen-tree-${p.variant}`,p.x,p.y,1.8*p.scale,t*4,2,1,0,Math.sin(t*.6)*.009);
   if(p.kind==='flower')for(let j=0;j<4;j++){
    const a=j*2.4,r=Math.sqrt(j)*.12,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;
    draw(`${s.id}:flower:${i}:${j}`,`accent-${['hibiscus','pink-tips','bird-of-paradise'][p.variant]}`,x,y,p.scale*(1.2+hash(i,j,s.seed)*.4),t*3+j,2,1,0,Math.sin(t*.7+j)*.025);
   }
   if(p.kind==='grass'){
    draw(`${s.id}:grass:${i}:base`,`patch-grass-${p.variant}-0-base`,p.x,p.y,p.scale*.55,0,.55,.48);
    draw(`${s.id}:grass:${i}:leaves`,`patch-grass-${p.variant}-0-leaves`,p.x,p.y,p.scale*.55,0,.7,.9,0,Math.sin(t*.6)*.004,[122,165,80]);
   }
   if(p.kind==='edgegrass')draw(`${s.id}:edgegrass:${i}`,`patch-grass-${p.variant}-0-leaves`,p.x,p.y,p.scale,0,1.1,.95,0,Math.sin(t*.6)*.006,[122,165,80]);
   if(p.kind==='shrub')draw(`${s.id}:shrub:${i}`,`accent-${['feather-fern','round-shrub','low-fern'][p.variant]}`,p.x,p.y,p.scale*1.2,t*3,2,1,0,Math.sin(t*.7)*.013);
   if(p.kind==='stone')draw(`${s.id}:stone:${i}`,`zen-stone-${p.variant}`,p.x,p.y,p.scale,0,1);
   if(p.kind==='path'){
    const point=(dx:number,dy:number)=>screen(p.x+dx*p.scale,p.y+dy*p.scale,world.heightAt(p.x+dx*p.scale,p.y+dy*p.scale));
    const corners:NonNullable<DrawCommand['corners']>=[point(-1,-1),point(1,-1),point(-1,1),point(1,1)];
    const box=quadBounds(corners);
    if(visible(box,width,height))commands.push({...box,corners:corners as DrawCommand['corners'],id:`${s.id}:path:${i}`,region:atlas.sprites['zen-path']!.frames[0],color:[255,255,255,255],layer:.8,depth:p.x+p.y});
   }
   if(p.kind==='lotus')draw(`${s.id}:lotus:${i}`,`zen-lotus-${p.variant}`,p.x,p.y,p.scale,t*2,1.05,1,Math.sin(t*1.2)*.35);
  }
  // Reflecting flecks stay on the actual pond material and fade before repeating.
  for(let i=0;i<22;i++){
   const a=hash(i,1,s.seed)*Math.PI*2,r=Math.sqrt(hash(i,2,s.seed))*.86;
   const x=s.pondX+Math.cos(a)*r*2.1,y=s.pondY+Math.sin(a)*r*1.5;
   if((world.tileAt(x,y)?.materialAt(x,y)??0)>=4)glint(`${s.id}:shimmer:${i}`,x,y,.4,3+hash(i,3,s.seed)*9,.12+.27*Math.sin(time*.9+i)**4,[211,238,205]);
  }
  // Drifting petals animate the air around the planted garden.
  for(let i=0;i<12;i++){
   const t=(time*.08+i/12)%1,x=s.x+(hash(i,4,s.seed)-.5)*8+Math.sin(time*.3+i)*.15,y=s.y+(hash(i,5,s.seed)-.5)*8;
   const p=screen(x,y,world.heightAt(x,y)+65*(1-t));commands.push({id:`${s.id}:petal:${i}`,x:p.x,y:p.y,width:2*scale,height:scale,color:[249,174,189,Math.round(Math.sin(t*Math.PI)*170)],layer:2,depth:x+y});
  }
  if(owner)for(const c of owner.residents){
   const p=c.presentation(alpha);if(p.visibility<.01)continue;
   const d=((Math.round(p.heading/(Math.PI*2)*8)%8)+8)%8;
   const action=c.kind==='monk'?(c.state===2?'sit':c.state===3?'water':c.speed>.002?'walk':'idle'):c.kind==='koi'?'swim':c.state===2?'dip':c.state===1?'preen':'swim';
   const phase=action==='walk'?p.gait*12:action==='swim'?p.clock*3:action==='dip'?p.clock*5:p.clock*2;
   draw(c.id,`zen-${c.kind}-${action}-${d}`,p.x,p.y,c.kind==='monk'?1.25:1.15,phase,c.kind==='koi'?.95:2,c.kind==='koi'?.84:p.visibility,c.kind==='monk'?0:Math.sin(p.clock*1.7+c.index)*.3,0,[255,236,218][c.variant]);
   if(c instanceof ZenMonkAgent&&c.state===3)for(let i=0;i<5;i++){
    const t=(p.clock*2+i/5)%1,px=p.x+Math.cos(p.heading)*(.2+t*.18),py=p.y+Math.sin(p.heading)*(.2+t*.18),pos=screen(px,py,world.heightAt(px,py)+9*(1-t));
    commands.push({id:`${c.id}:water:${i}`,x:pos.x,y:pos.y,width:scale,height:2*scale,color:[170,221,230,180],layer:2,depth:px+py});
   }
   if(c.kind!=='monk')for(let i=0;i<2;i++)glint(`${c.id}:wake:${i}`,p.x-Math.cos(p.heading)*(.14+i*.1),p.y-Math.sin(p.heading)*(.14+i*.1),.6,5+i*4,.14,[196,229,207]);
   if(c.kind==='pelican'&&c.state===2)for(let i=0;i<5;i++){const t=(p.clock*3+i/5)%1;glint(`${c.id}:splash:${i}`,p.x+Math.cos(p.heading)*.3+Math.sin(i)*t*.1,p.y+Math.sin(p.heading)*.3,Math.sin(t*Math.PI)*7,2,(1-t)*.6,[222,244,232]);}
  }
 }
}
