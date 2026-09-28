import type {AgentEnvironment} from '../agents';
import type {Vec2} from '../iso/math';
import {ELEPHANT_MODEL_TO_TILE} from './elephant-pose';
export interface DrinkingSpot extends Vec2 { waterX:number;waterY:number;heading:number }
/** Bounded, infrequent search. Both feet/route clearance and the actual trunk reach matter. */
export function drinkingSpot(origin:Vec2,size:number,env:AgentEnvironment,stand:(x:number,y:number)=>boolean,route:(x:number,y:number)=>boolean):DrinkingSpot|undefined {
 let best:DrinkingSpot|undefined,score=Infinity;
 const reach=1.95*ELEPHANT_MODEL_TO_TILE*size;
 for(let y=-4;y<=4;y++)for(let x=-4;x<=4;x++){
  const px=origin.x+x*.5,py=origin.y+y*.5,d=x*x+y*y;
  if(d>=score)continue;
  for(let k=0;k<8;k++){
   const heading=k*Math.PI/4,waterX=px+Math.cos(heading)*reach,waterY=py+Math.sin(heading)*reach;
   if(!env.sample(waterX,waterY).water||!stand(px,py)||!route(px,py))continue;
   best={x:px,y:py,waterX,waterY,heading};score=d;break;
  }
 }
 return best;
}
