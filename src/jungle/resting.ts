import { animalPrefix } from './animal-appearance';
import { REPOSE_CLIPS,REPOSE_DIRECTIONS,type Repose } from '../agents/repose';
/** Rest uses sixteen genuine headings; up/down reuse one registered clip. */
export function restingSprite(kind:string,repose:Repose,heading:number,alpha:number,form=0){
 const pose=repose.pose(alpha),direction=(Math.round(heading/(Math.PI*2)*REPOSE_DIRECTIONS)%REPOSE_DIRECTIONS+REPOSE_DIRECTIONS)%REPOSE_DIRECTIONS;
 return {name:`${animalPrefix(kind,form)}-${pose.clip}-${direction}`,frame:pose.clip==='lieDown'?Math.round(pose.phase*(REPOSE_CLIPS.lieDown-1)):Math.floor(pose.phase*REPOSE_CLIPS[pose.clip])%REPOSE_CLIPS[pose.clip]};
}
