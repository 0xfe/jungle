import { CONFIG } from '../config';
import { hash, lerp, type Vec2 } from '../iso/math';
import { quadBounds, type QuadCorners } from '../iso/quad';
import { visible, type DrawCommand } from '../iso/render';
import type { AtlasManifest } from './scene';
import type { InfiniteWorld } from './infinite';
import { lavaSegments } from './volcanoes';
import { VolcanicWildlifeAgent } from './agents/volcanic-wildlife';

type SpriteWriter=(id:string,name:string,x:number,y:number,size:number,frame:number,layer:number,opacity?:number,tint?:number,altitude?:number,depth?:number)=>void;
/** All effects use shared art or solid quads in the existing transparent painter stream. */
export function composeVolcanoes(world:InfiniteWorld,atlas:AtlasManifest,commands:DrawCommand[],screen:(x:number,y:number,height?:number)=>Vec2,sprite:SpriteWriter,time:number,scale:number,width:number,height:number,alpha=1):void {
  const quad=(id:string,points:QuadCorners,color:DrawCommand['color'],layer:number,depth:number,material?:string,uvCorners?:QuadCorners)=>{
    if(material&&!atlas.sprites[material])throw new Error(`Missing volcano material: ${material}`);
    const box=quadBounds(points);if(visible(box,width,height))commands.push({...box,corners:points,id,color,layer,depth,region:material?atlas.sprites[material]?.frames[0]:undefined,uvCorners});
  };
  for(const v of world.volcanoes){
    const center=screen(v.x,v.y);if(center.x<-850*scale||center.x>width+850*scale||center.y<-500*scale||center.y>height+600*scale)continue;
    // Porous ground flecks fade into the sparse grass belt; no opaque circular stamp.
    for(let i=0;i<200;i++){
      const angle=hash(i,0,v.phase)*Math.PI*2,r=2.4+hash(i,1,v.phase)*5.2,x=v.x+Math.cos(angle)*r,y=v.y+Math.sin(angle)*r;
      const size=.7+hash(i,2,v.phase)*1.5;
      sprite(`${v.id}:rubble:${i}`,'volcano-ash',x,y,size,0,.8,.35+hash(i,3,v.phase)*.5);
    }
    // Continuous ribbons share endpoints and widths across all chunk boundaries.
    for(const [index,{a,b}] of lavaSegments(v,time).entries()){
      const branch=Math.floor(index/32),i=index%32;
      const ribbon=(ratio:number,layer:number,c:DrawCommand['color'],suffix:string)=>{
        const aw=a.width*ratio,bw=b.width*ratio;
        quad(`${v.id}:lava:${branch}:${i}:${suffix}`,[screen(a.x-a.normalX*aw,a.y-a.normalY*aw),screen(a.x+a.normalX*aw,a.y+a.normalY*aw),screen(b.x-b.normalX*bw,b.y-b.normalY*bw),screen(b.x+b.normalX*bw,b.y+b.normalY*bw)],c,layer,(a.x+a.y+b.x+b.y)/2,suffix==='obsidian'||suffix==='crust'?'volcano-crust':suffix==='red'?'volcano-molten':undefined,[{x:0,y:(i%4)/4},{x:1,y:(i%4)/4},{x:0,y:((i%4)+1)/4},{x:1,y:((i%4)+1)/4}]);
      };
      ribbon(1.35,.9,[255,255,255,240],'obsidian');
      const hot=(a.heat+b.heat)/2;
      ribbon(1,1,[Math.round(lerp(55,255,hot)),Math.round(lerp(48,255,hot)),Math.round(lerp(46,255,hot)),255],'red');
      if(hot>.5)ribbon(.16,1.1,[255,204,62,Math.round(hot*175)],'molten');
      // Moving cooled plates subdivide the bright channel, following its flow.
      if(i%4===Math.floor((time*1.6+branch)%4))ribbon(.48,1.15,[255,255,255,170],'crust');
    }
    sprite(v.id,`volcano-${v.form}`,v.x,v.y,1,0,2);
    // Reviewed approximate mouth positions in the normalized registered sprite.
    const mouths=[{x:-.02,y:-.02,z:326},{x:0,y:0,z:201},{x:-.50,y:.30,z:244},{x:.05,y:.05,z:206}];
    const mouth=mouths[v.form]!,mx=v.x+mouth.x,my=v.y+mouth.y;
    const clock=time+v.phase,burst=Math.floor(clock/17),explosive=hash(burst,v.form,v.phase)<.24;
    const age=clock%17,count=explosive?20:7;
    if(age<3.2)for(let i=0;i<count;i++){
      const delay=hash(i,burst,v.phase)*.6,t=age-delay;if(t<0)continue;
      const angle=hash(i,0,v.phase)*Math.PI*2,speed=(explosive?1.4:.45)*(.5+hash(i,1,v.phase)),x=mx+Math.cos(angle)*speed*t,y=my+Math.sin(angle)*speed*t;
      const altitude=mouth.z+(explosive?135:75)*t-100*t*t;
      if(altitude<0)continue;
      sprite(`${v.id}:spurt:${i}`,'volcano-flame',x,y,.16+hash(i,2,v.phase)*.20,0,2,Math.min(1,(3.2-age)*2),255,altitude,x+y);
    }
    for(let i=0;i<9;i++){
      const age=(clock*.24+i/9)%1,x=mx+age*.7,y=my-age*.45;
      sprite(`${v.id}:smoke:${i}`,'volcano-smoke',x,y,1.5+age*3.2,0,2,Math.sin(age*Math.PI)*.8,255,mouth.z+age*155,v.x+v.y+1);
    }
  }
  for(const a of world.agents)if(a instanceof VolcanicWildlifeAgent){
    if(a.ashRemaining>0)sprite(`${a.id}:ash`,'volcano-ash',a.ashX,a.ashY,.6,0,1.3,Math.min(1,a.ashRemaining/8));
    if(a.phase==='burn'){
      const t=lerp(a.previousElapsed,a.elapsed,alpha),fade=Math.min(1,(CONFIG.world.volcanoes.burnSeconds-t)*2);
      for(let i=0;i<5;i++)sprite(`${a.id}:fire:${i}`,'volcano-flame',a.x+Math.sin(t*13+i)*.07,a.y+Math.cos(t*17+i)*.07,.4+Math.sin(t*21+i)*.15,0,2,fade,255,5+i*4,a.x+a.y+.015);
      for(let i=0;i<5;i++){const age=(t*.7+i/5)%1;sprite(`${a.id}:smoke:${i}`,'volcano-smoke',a.x+age*.2,a.y-age*.2,.5+age,0,2,Math.sin(age*Math.PI)*.8,255,15+age*60,a.x+a.y+.03);}
    }
    if(a.phase==='waiting'&&a.elapsed<2)for(let i=0;i<7;i++)sprite(`${a.id}:poof:${i}`,'volcano-smoke',a.x+Math.sin(i)*a.elapsed*.12,a.y+Math.cos(i)*a.elapsed*.12,.7+a.elapsed*.7,0,2,(1-a.elapsed/2)*.8,255,15+a.elapsed*30,a.x+a.y+.04);
  }
}
