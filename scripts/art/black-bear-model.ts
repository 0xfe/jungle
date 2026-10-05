import { BEAR_SETTLE_SAMPLES,bearFoot } from '../../src/jungle/bear-motion';
import { restingPose } from './repose';
import { bone, ellipsoid, type Mesh, type RGB, type V3 } from '../../src/iso/bake/mesh';
const TAU=Math.PI*2,smooth=(t:number)=>t*t*(3-2*t);
/** +X-facing plantigrade rig. Gait dimensions come from the simulation's stride
 * contract; the higher-resolution bake retains one ground anchor in every pose. */
export function blackBearMesh(clip:string,p:number,form=0):Mesh {
 if(clip==='lower')return blackBearMesh('rise',1-p,form);
 if(clip==='feedUp')return blackBearMesh('feedDown',1-p,form);
 const settle=/^settle(Run)?(\d+)?$/.exec(clip),progress=p,start=settle?Number(settle[2]??0)/BEAR_SETTLE_SAMPLES:0;
 if(settle)p=start;
 const rest=restingPose(clip,p),walking=clip==='travel'||Boolean(settle&&!settle[1]),running=clip==='run'||Boolean(settle?.[1]),moving=walking||running;
 const amount=settle?smooth(progress):0;
 const wave=Math.sin(p*TAU),playing=clip==='play',play=playing?(1-Math.cos(p*TAU))*.5:0;
 const feeding=clip==='forage'?1:clip==='feedDown'?smooth(p):0;
 const upright=clip==='rise'?smooth(p):clip==='stand'||clip==='pick'?1:0;
 const tilt=upright*1.03,c=Math.cos(tilt),sn=Math.sin(tilt);
 // Rotate around the haunches. Hind paws never slide forward during a rise.
 const liftPoint=(v:V3):V3=>[-.4+(v[0]+.4)*c-(v[2]-.4)*sn,v[1],.4+(v[0]+.4)*sn+(v[2]-.4)*c];
 const fur:RGB=[76,73,70],highlight:RGB=[91,87,80],paw:RGB=[34,33,32],muzzle:RGB=[184,154,112];
 const wool=(n:V3):RGB=>{
  const grain=Math.sin(n[0]*43+n[1]*17)*Math.cos(n[2]*37-n[1]*13),base=n[2]>.25?highlight:fur,delta=grain>.65?8:grain<-.6?-7:0;
  return [base[0]+delta,base[1]+delta,base[2]+delta];
 };
 const bob=-.31*rest.amount+(1-amount)*(running?Math.cos(p*TAU*2)*.033:walking?Math.sin(p*TAU*2)*.011:wave*.004);
 const sway=moving?(1-amount)*wave*(running?.012:.018):0;
 const m:Mesh=[];
 ellipsoid(m,[-.04,sway,.59+bob],[.58,.29,.32],fur,undefined,wool,28,16);
 ellipsoid(m,[-.34,sway*.7,.57+bob],[.29,.28,.30],fur,undefined,wool,20,12);
 ellipsoid(m,[.31,-sway*.35,.59+bob-play*.05],[.26,.27,.28],fur,undefined,wool,20,12);
 const sniff=clip==='forage'?Math.sin(p*TAU)*.025:0;
 const head:V3=[.55+feeding*.035+sniff,feeding*sniff+rest.head*.25,(.65-feeding*.25)+bob*.35-play*.10];
 bone(m,[.31,0,.65+bob],head,.18,fur);
 const headStart=m.length;
 ellipsoid(m,head,[.23,.19,.22],highlight,undefined,wool,24,14);
 ellipsoid(m,[head[0]+.18,head[1],head[2]-.07],[form===1?.18:form===2?.14:.16,.115,.09],muzzle);
 ellipsoid(m,[head[0]+.30,head[1],head[2]-.055],[.055,.079,.043],paw);
 for(const side of [-1,1]){
  const ear=clip==='stand'?Math.sin(p*TAU)*side*.012:0;
  ellipsoid(m,[head[0]-.07+ear,head[1]+side*.145,head[2]+.18],[form===2?.077:.065,.048,form===1?.061:.072],fur);
  ellipsoid(m,[head[0]-.046+ear,head[1]+side*.15,head[2]+.19],[.026,.033,.038],[126,110,90]);
  ellipsoid(m,[head[0]+.108,head[1]+side*.158,head[2]+.05],[.025,.016,.024],[18,20,20]);
  ellipsoid(m,[head[0]+.118,head[1]+side*.17,head[2]+.059],[.008,.006,.008],[222,206,158]);
  bone(m,[head[0]+.19,side*.096,head[2]-.109],[head[0]+.28,side*.063,head[2]-.098],.008,paw);
 }
 const transformed=new Set<Mesh[number]['vertices'][number]>();
 for(const [i,tri] of m.entries())for(const v of tri.vertices){
  if(transformed.has(v))continue;transformed.add(v);
  if(i>=headStart){const h=liftPoint(head);v.position=[h[0]+v.position[0]-head[0],h[1]+v.position[1]-head[1],h[2]+v.position[2]-head[2]];}
  else{v.position=liftPoint(v.position);const n=v.normal;v.normal=[n[0]*c-n[2]*sn,n[1],n[0]*sn+n[2]*c];}
 }
 for(let i=0;i<4;i++){
  const side=i<2?-1:1,front=i%2===1,step=bearFoot(p,i,running),fore=moving?step.fore:0,lift=moving?step.lift:0;
  const x=front?.36:-.4;
  const t=settle?Math.max(0,Math.min(1,progress*1.6-i*.2)):0,u=smooth(t);
  let foot:V3=[x+fore*(1-u),side*.22,.045+lift*(1-u)+(settle?Math.sin(t*Math.PI)*.055:0)],knee:V3=[x+fore*.4*(1-u)+(front?.025:-.035),side*.225,.27+lift*.3*(1-u)];
  if(rest.amount){
   foot=[foot[0]+((front?.65:-.44)-foot[0])*rest.amount,side*(.22+.10*rest.amount),foot[2]];
   knee=[knee[0],side*.29,knee[2]+(.075-knee[2])*rest.amount];
   if(front)foot=[foot[0]+rest.shift*.12,foot[1],foot[2]];
  }
  const hip=liftPoint([x,side*.18,.59+bob]);
  if(front&&upright){
   // Relaxed front paws while sniffing; only a supported pick reaches forward.
   const pick=clip==='pick'?(1-Math.cos(p*TAU))*.5:0;
   foot=[foot[0]+(.04+pick*.72-foot[0])*upright,side*.18,foot[2]+(.74+pick*.24-foot[2])*upright];
   knee=[hip[0]+.22*upright,side*.23,.27+upright*.64];
  }
  if(playing&&front&&side<0){foot=[foot[0]+play*.22,foot[1]+play*.055,foot[2]+play*.13];knee=[knee[0]+play*.08,knee[1],knee[2]+play*.035];}
  bone(m,hip,knee,.091,fur);bone(m,knee,foot,.07,fur);
  ellipsoid(m,[foot[0]+.035,foot[1],foot[2]],[.11,.077,.05],paw);
  for(let j=-1;j<=1;j++)bone(m,[foot[0]+.11,foot[1]+j*.035,foot[2]],[foot[0]+.14,foot[1]+j*.035,foot[2]-.013],.008,[158,151,128]);
 }
 ellipsoid(m,liftPoint([-.60,0,.61-.31*rest.amount]),[.085,.075,.075],fur);
 return m;
}
