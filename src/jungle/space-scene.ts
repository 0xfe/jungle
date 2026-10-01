import { SpacecraftAgent } from './agents/spacecraft';
import { SPACE_SPECS, VISITOR_CLIPS } from './ecology';

type SpritePainter=(id:string,name:string,x:number,y:number,size:number,frame:number,layer:number,opacity?:number,tint?:number,altitude?:number,depth?:number)=>void;
const direction=(heading:number)=>(Math.round(heading/(Math.PI*2)*8)%8+8)%8;

/** Shared atlas sprites use normal ground-anchor painter ordering in all three renderers. */
export function composeSpacecraft(a:SpacecraftAgent,sprite:SpritePainter,alpha:number):void {
  if(a.state==='waiting')return;
  const p=a.presentation(alpha),opacity=Math.min(1,(420-p.altitude)/70);
  sprite(`${a.id}:shadow`,'shadow',a.x,a.y,1.9-p.altitude/420,0,1,.28*opacity);
  // Flying craft fade above the canopy; landed craft and crew share the usual depth layer.
  sprite(a.id,`ship-${a.kind}-${direction(a.heading)}`,p.x,p.y,1.5,0,2,opacity,255,p.altitude);
  if(p.hatch>.5)sprite(`${a.id}:hatch`,`ship-${a.kind}-hatch-${direction(a.heading)}`,p.x,p.y,1.5,0,2,opacity,255,p.altitude);
  for(const crew of a.crew){
    const c=crew.presentation(alpha);if(c.visibility<=0)continue;
    const clip=crew.speed>.001?'walk':crew.state==='inspect'?'inspect':'rest';
    const phase=clip==='walk'?c.gait:c.gesture,count=VISITOR_CLIPS[clip];
    const frame=Math.floor(((phase%1)+1)%1*count);
    sprite(`${crew.id}:shadow`,'shadow',c.x,c.y,.17*crew.size,0,1,.2*c.visibility);
    sprite(crew.id,`alien-${SPACE_SPECS[a.kind].alien}-${clip}-${direction(c.heading)}`,c.x,c.y,1.7*crew.size,frame,2,c.visibility,[255,237,218][crew.role]);
  }
}
