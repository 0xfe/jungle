import type { Repose } from '../agents/repose';
/** Rest uses eight genuine headings; up/down reuse one registered clip. */
export function restingSprite(kind:string,repose:Repose,heading:number,alpha:number){
 const pose=repose.pose(alpha),direction=(Math.round(heading/(Math.PI*2)*8)%8+8)%8;
 return {name:`${kind}-${pose.clip}-${direction}`,frame:pose.clip==='lieDown'?Math.round(pose.phase*7):Math.floor(pose.phase*8)%8};
}
