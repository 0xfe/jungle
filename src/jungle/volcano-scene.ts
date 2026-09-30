import { FIRE_COLORS, flowPhase, slopeParticle } from './volcano-animation';
import { CONFIG } from '../config';
import { clamp, hash, lerp, type Vec2 } from '../iso/math';
import { quadBounds, type QuadCorners } from '../iso/quad';
import { visible, type DrawCommand } from '../iso/render';
import type { AtlasManifest } from './scene';
import type { InfiniteWorld } from './infinite';
import { lavaSegments, lavaPoint, LAVA_SEGMENTS, VOLCANO_ART_SCALE } from './volcanoes';
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
    // The full material spans the whole river. It is never tiled into little bars.
    // Inlet height blends from the registered mountain anchor onto local terrain.
    const surface=(p:Vec2,t:number)=>screen(p.x,p.y,lerp(world.heightAt(v.x,v.y),world.heightAt(p.x,p.y),clamp(t/.28,0,1)));
    // Uneven, porous ash shoulders extend beyond the cooling crust into the soil.
    // Shared flecks follow ground height and remain fixed as the lava animates.
    for(let i=0;i<72;i++){
      const t=.16+hash(i,21,v.phase)*.84,p=lavaPoint(v,t),side=i%2?1:-1;
      const spread=.08+hash(i,22,v.phase)*.38,d=side*(p.width*1.2+spread);
      sprite(`${v.id}:bank-ash:${i}`,'volcano-ash',p.x+p.normalX*d,p.y+p.normalY*d,
        1+hash(i,23,v.phase)*1.5,0,1.3,.18+(1-spread/.46)*.36);
    }
    for(const [i,{a,b}] of lavaSegments(v).entries()){
      const ribbon=(ratio:number,layer:number,suffix:string)=>{
        const aw=a.width*ratio,bw=b.width*ratio,ta=i/LAVA_SEGMENTS,tb=(i+1)/LAVA_SEGMENTS;
        const edge=(p:typeof a,w:number,t:number)=>surface({x:p.x+p.normalX*w,y:p.y+p.normalY*w},t);
        quad(`${v.id}:lava:${i}:${suffix}`,[edge(a,-aw,ta),edge(a,aw,ta),edge(b,-bw,tb),edge(b,bw,tb)],
          [255,255,255,255],layer,v.x+v.y+(suffix==='obsidian'?.002:.003),suffix==='obsidian'?'volcano-crust':'volcano-molten',
          [{x:0,y:ta},{x:1,y:ta},{x:0,y:tb},{x:1,y:tb}]);
      };
      // Overlap the last painted slope pixels; the mountain cannot hide the join.
      ribbon(1.8,2,'obsidian');ribbon(1,2,'molten');
    }
    const tuning=CONFIG.world.volcanoes;
    const art=atlas.volcanoLava?.[v.form];
    if(!art)throw new Error('Missing registered volcano lava; run npm run build');
    const face=(p:Vec2):Vec2=>({x:center.x+(p.x-52)*VOLCANO_ART_SCALE*scale,y:center.y+(p.y-71.5)*VOLCANO_ART_SCALE*scale});
    const pixel=(id:string,p:Vec2,size:number,fire:number,opacity:number)=>{
      const side=size*scale,c=FIRE_COLORS[fire]!;
      const box={x:p.x-side/2,y:p.y-side/2,width:side,height:side};
      if(visible(box,width,height))commands.push({...box,id,layer:2,depth:v.x+v.y+.005,color:[...c,Math.round(clamp(opacity,0,1)*255)]});
    };
    const wisp=(id:string,p:Vec2,age:number)=>{
      const size=(8+age*19)*scale,x=p.x+age*12*scale,y=p.y-age*29*scale;
      quad(id,[{x:x-size/2,y:y-size},{x:x+size/2,y:y-size},{x:x-size/2,y},{x:x+size/2,y}],
        [255,255,255,Math.round(Math.sin(age*Math.PI)*140)],2,v.x+v.y+.006,'volcano-smoke');
    };
    // Several differently colored pixel trails move over the filled surface. Each
    // has its own lane, speed and phase, so the river never flashes as one unit.
    for(let i=0;i<tuning.lavaParticles;i++){
      const speed=tuning.lavaFlowSpeed*(.75+hash(i,1,v.phase)*.5);
      const t=flowPhase(time+v.phase,hash(i,2,v.phase),speed),lane=(hash(i,3,v.phase)-.5)*1.65;
      for(let tail=2;tail>=0;tail--){
        const u=t-tail*.008;if(u<0)continue;
        const p=lavaPoint(v,u),point=surface({x:p.x+p.normalX*lane*p.width,y:p.y+p.normalY*lane*p.width},u);
        const fade=clamp(Math.min(t*15,(1-t)*12),0,1)*(1-tail*.22);
        pixel(`${v.id}:flow:${i}:${tail}`,point,2.2+hash(i,4,v.phase)*2.6,(i+tail)%FIRE_COLORS.length,fade);
      }
    }
    // Source-pixel registration keeps descending embers and travelling heat waves
    // on the painted lava, including the branching channels and active crater.
    for(const [i,trail] of art.trails.entries()){
      const t=flowPhase(time+v.phase,hash(i,5,v.phase),tuning.lavaFlowSpeed*(5+hash(i,6,v.phase)*3));
      for(let tail=2;tail>=0;tail--){
        const u=t-tail*.065;if(u<0)continue;
        pixel(`${v.id}:slope-flow:${i}:${tail}`,face(slopeParticle(trail,u)),2.2+hash(i,7,v.phase)*1.6,
          (i+tail)%FIRE_COLORS.length,Math.sin(t*Math.PI)*(.95-tail*.22));
      }
    }
    for(const [i,p] of art.glow.entries()){
      const heat=Math.max(0,Math.sin((time+v.phase)*tuning.lavaFlowSpeed*40-p.y*.55+p.x*.12))**5;
      if(heat>.15)pixel(`${v.id}:slope-heat:${i}`,face(p),2.2,3+i%2,heat*.6);
    }
    for(let i=0;i<tuning.lavaSmoke;i++){
      const age=flowPhase(time+v.phase,hash(i,8,v.phase),.32),p=lavaPoint(v,.2+hash(i,9,v.phase)*.75);
      wisp(`${v.id}:flow-smoke:${i}`,surface(p,.2+hash(i,9,v.phase)*.75),age);
      const trail=art.trails[(i*11)%art.trails.length]!;
      wisp(`${v.id}:slope-smoke:${i}`,face(trail[Math.floor(trail.length/2)]!),flowPhase(time+v.phase,hash(i,10,v.phase),.27));
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
    if(a.ashRemaining>0)sprite(`${a.id}:ash`,'volcano-ash',a.ashX,a.ashY,1.4,0,2,Math.min(1,a.ashRemaining/8));
    if(a.phase==='burn'){
      const t=lerp(a.previousElapsed,a.elapsed,alpha),fade=clamp(1-t/CONFIG.world.volcanoes.burnSeconds,0,1);
      for(let i=0;i<5;i++)sprite(`${a.id}:fire:${i}`,'volcano-flame',a.x+Math.sin(i*2.4)*.06,a.y+Math.cos(i*2.4)*.06,
        .65+Math.sin(t*18+i)*.08,0,2,fade,255,6+i*7,a.x+a.y+.015);
    }
    // A single expanding cloud replaces the body, then reveals the ash beneath it.
    if(a.phase==='waiting'&&a.elapsed<1.6){
      const t=lerp(a.previousElapsed,a.elapsed,alpha),progress=clamp(t/1.6,0,1),spread=1-Math.exp(-t*5);
      for(let i=0;i<11;i++){
        const angle=i*2.4,radius=(.12+hash(i,31,a.volcano.phase)*.22)*spread;
        sprite(`${a.id}:poof:${i}`,'volcano-smoke',a.x+Math.sin(angle)*radius,a.y+Math.cos(angle)*radius,
          1.4+spread*1.7+hash(i,32,a.volcano.phase)*.5,0,2,(1-progress)**1.3*.95,255,
          18+hash(i,33,a.volcano.phase)*34+t*26,a.x+a.y+.04);
      }
    }
  }
}
