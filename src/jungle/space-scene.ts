import { SHIP_LIGHT_FRAMES, shipFlightFrame } from './space-animation';
import { quadBounds, type QuadCorners } from '../iso/quad';
import type { DrawCommand } from '../iso/render';
import type { Vec2 } from '../iso/math';
import { SpacecraftAgent } from './agents/spacecraft';
import { SPACE_SPECS, VISITOR_CLIPS } from './ecology';

type SpritePainter=(id:string,name:string,x:number,y:number,size:number,frame:number,layer:number,opacity?:number,tint?:number,altitude?:number,depth?:number)=>void;
const direction=(heading:number)=>(Math.round(heading/(Math.PI*2)*8)%8+8)%8;

/** Shared atlas sprites use normal ground-anchor painter ordering in all three renderers. */
export function composeSpacecraft(a:SpacecraftAgent,sprite:SpritePainter,alpha:number,time=0,parts:Record<string,string[]>={}):void {
  if(a.state==='waiting')return;
  const hull:SpritePainter=(id,name,x,y,size,frame,layer,opacity,tint,altitude,depth)=>{
    const tiles=parts[name];if(!tiles)throw new Error(`Missing spacecraft clip: ${name}; rebuild assets`);
    tiles.forEach((tile,i)=>sprite(i?`${id}:0:tile:${i}`:id,tile,x,y,size,frame,layer,opacity,tint,altitude,depth));
  };
  const p=a.presentation(alpha),opacity=Math.min(1,(420-p.altitude)/70);
  sprite(`${a.id}:shadow`,'shadow',a.x,a.y,1.9-p.altitude/420,0,1,.28*opacity);
  const flying=(a.state==='approach'||a.state==='depart')&&p.altitude>10;
  const heading=direction(a.heading),frame=flying?shipFlightFrame(a.kind,a.heading,p.altitude,time):0;
  const name=flying?`ship-${a.kind}-flight${a.kind==='scout'?`-${heading}`:''}`:`ship-${a.kind}-${heading}`;
  // Less than a quarter logical pixel of grounded motor tremor; ramps share the offset.
  const vibration=flying?0:Math.sin(time*73)*.14+Math.sin(time*109)*.07;
  // Flying craft fade above the canopy; landed craft and crew share the usual depth layer.
  hull(a.id,name,p.x,p.y,1.5,frame,2,opacity,255,p.altitude+vibration);
  if(!flying)hull(`${a.id}:lights`,`ship-${a.kind}-lights-${heading}`,p.x,p.y,1.5,Math.floor(time*4)%SHIP_LIGHT_FRAMES,2,opacity,255,p.altitude+vibration);
  if(p.hatch>.5)hull(`${a.id}:hatch`,`ship-${a.kind}-hatch-${direction(a.heading)}`,p.x,p.y,1.5,0,2,opacity,255,p.altitude+vibration);
  for(const crew of a.crew){
    const c=crew.presentation(alpha);if(c.visibility<=0)continue;
    const clip=crew.speed>.001?'walk':crew.state==='inspect'?'inspect':'rest';
    const phase=clip==='walk'?c.gait:c.gesture,count=VISITOR_CLIPS[clip];
    const frame=Math.floor(((phase%1)+1)%1*count);
    sprite(`${crew.id}:shadow`,'shadow',c.x,c.y,.17*crew.size,0,1,.2*c.visibility);
    sprite(crew.id,`alien-${SPACE_SPECS[a.kind].alien}-${clip}-${direction(c.heading)}`,c.x,c.y,1.7*crew.size,frame,2,c.visibility,[255,237,218][crew.role]);
  }
}

/** Flight-only energy field: translucent nested bands suggest a trembling space ripple.
 * Pure presentation time, shared solid quads, and a fixed 96-command ceiling per craft.
 * Keeping the rear/front halves at the hull depth preserves canopy occlusion. */
export function composeFlightField(a:SpacecraftAgent,time:number,alpha:number,center:Vec2,scale:number):DrawCommand[] {
  if(a.state!=='approach'&&a.state!=='depart')return [];
  const altitude=a.presentation(alpha).altitude;
  const strength=Math.min(1,altitude/18)*Math.max(0,Math.min(1,(420-altitude)/70));
  if(strength<=0)return [];
  const palette={saucer:[110,238,255],lander:[255,211,120],scout:[192,165,255]}[a.kind]!;
  const commands:DrawCommand[]=[],p=a.presentation(alpha),depth=p.x+p.y;
  const buzz=.86+.09*Math.sin(time*47)+.05*Math.sin(time*71);
  // Two soft engine bands and two expanding, faint refractive-looking outlines.
  for(let band=0;band<4;band++){
    const phase=((time*.85+band*.37)%1+1)%1;
    const radius=band<2?36+band*18:68+phase*22;
    const thickness=band<2?20:1.3;
    const opacity=strength*buzz*(band<2?.14:(1-phase)*.18);
    for(let segment=0;segment<24;segment++){
      const angle=segment/24*Math.PI*2,next=(segment+1)/24*Math.PI*2;
      const point=(t:number,r:number):Vec2=>({
        x:center.x+(Math.cos(t)*r+Math.sin(t*3+time*9)*.8)*scale,
        y:center.y+(Math.sin(t)*r*.38-6+Math.sin(t*4-time*11)*.55)*scale,
      });
      const corners:QuadCorners=[point(angle,radius),point(next,radius),point(angle,radius+thickness),point(next,radius+thickness)];
      commands.push({id:`${a.id}:field:${band}:${segment}`,layer:2,depth:depth+(Math.sin(angle)<0?-.001:.001),
        ...quadBounds(corners),corners,color:[palette[0]!,palette[1]!,palette[2]!,Math.round(opacity*255)]});
    }
  }
  return commands;
}
