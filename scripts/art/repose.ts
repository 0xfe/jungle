/** Authored clips share a slow lowering amount and a brief, occasional weight shift. */
export { REPOSE_CLIPS,REPOSE_DIRECTIONS } from '../../src/agents/repose';
export function restingPose(clip:string,p:number):{amount:number;shift:number;head:number} {
 const active=clip==='lying'||clip==='shift',amount=clip==='lieDown'?p*p*(3-2*p):active?1:0;
 return {amount,shift:clip==='shift'?Math.sin(p*Math.PI*2)**2:0,head:active?Math.sin(p*Math.PI*2)*.24:0};
}
