import sharp from 'sharp';
import { ellipsoid, bone, type Mesh, type V3, type RGB } from '../../src/iso/bake/mesh';
import { bakeMesh } from '../../src/iso/bake/rasterize';
import { trimClip, type BakeSprite } from '../../src/iso/bake/atlas';
import { hash } from '../../src/iso/math';
import { windFrames } from './wind';
import type { ZenKind } from '../../src/jungle/agents/zen';
const tau=Math.PI*2,cream:RGB=[240,216,163],dark:RGB=[39,59,62];
/** Retained reference-inspired architecture; the three forms share exact atlas pixels. */
async function pagodaSprite(): Promise<BakeSprite> {
 const png=await sharp('assets/source/zen-pagoda.png').trim().resize(160,256,{
  fit:'contain',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0},
 }).extend({top:8,bottom:8,left:8,right:8,background:{r:0,g:0,b:0,alpha:0}})
  .png({palette:true,colours:64,dither:0}).toBuffer();
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let i=3;i<data.length;i+=4){if(data[i]!<128)data.fill(0,i-3,i+1);else data[i]=255;}
 return {id:'zen-pagoda-0',anchor:[88,248],frames:[{width:info.width,height:info.height,data}]};
}
/** Separate +X rigs: robes and sandals, koi fins, duck paddles and pelican throat pouch. */
export function zenMesh(kind:ZenKind,action:string,phase:number,variant=0):Mesh{
 const m:Mesh=[],wave=Math.sin(phase*tau),skin:RGB=[196+variant*12,148+variant*10,108+variant*8];
 if(kind==='monk'){
  const robe:RGB=([[211,135,63],[165,112,77],[123,144,135]] as RGB[])[variant]!,sit=action==='sit',walk=action==='walk',water=action==='water';
  const z=sit?.32:.55,bob=walk?Math.sin(phase*tau*2)*.01:Math.sin(phase*tau)*.008;
  ellipsoid(m,[0,0,z+bob],[.17,.19,sit?.21:.35],robe);
  ellipsoid(m,[.025,0,z+.4+bob],[.135,.12,.16],skin);
  // Asymmetric robe folds and a wrapped sash stay attached to the breathing torso.
  for(let fold=0;fold<4;fold++)bone(m,[.12,-.12+fold*.075,z+.22],[.14,-.15+fold*.085,z-.24],.018,[157,90,43]);
  bone(m,[.1,-.18,z+.24],[.15,.17,z-.06],.045,[237,177,95]);
  bone(m,[.15,-.15,z-.03],[.17,.15,z-.03],.026,[113,72,40]);
  ellipsoid(m,[.145,0,z+.41+bob],[.05,.04,.048],skin);
  for(const side of [-1,1]){
   ellipsoid(m,[.052,side*.115,z+.405+bob],[.027,.032,.046],skin);
   ellipsoid(m,[.129,side*.062,z+.445+bob],[.014,.019,.011],[47,40,34]);
  }
  bone(m,[.14,-.035,z+.36+bob],[.14,.035,z+.36+bob],.01,[116,68,47]);
  for(let bead=0;bead<9;bead++){const a=bead*Math.PI/8;ellipsoid(m,[.16+Math.sin(a)*.02,Math.cos(a)*.13,z+.15-Math.sin(a)*.14],[.016,.016,.018],[70,47,29]);}
  for(const side of [-1,1]){
   const t=(phase+(side===1?.5:0))%1,u=Math.max(0,(t-.6)/.4),step=walk?(t<.6?.5-t/.6:-.5+u*u*(3-2*u))*.270:0;
   if(sit)ellipsoid(m,[.07,side*.18,.14],[.24,.15,.09],robe);
   else{bone(m,[0,side*.1,.3],[step,side*.1,.04+(walk?Math.sin(u*Math.PI)*.06:0)],.05,robe);ellipsoid(m,[step+.025,side*.1,.035],[.095,.064,.03],dark);}
   const hand:V3=[water?.3:sit?.19:-step*.45,side*.17,water?.36+wave*.025:sit?.3:.37];
   bone(m,[0,side*.15,z+.15],hand,.057,robe);ellipsoid(m,hand,[.055,.04,.04],skin);
   ellipsoid(m,[hand[0]-.04,hand[1],hand[2]+.025],[.07,.064,.055],[235,163,75]);
  }
  if(water){bone(m,[.32,-.14,.34],[.36,0,.53],.023,[144,177,154]);bone(m,[.36,0,.53],[.4,.14,.34],.023,[144,177,154]);ellipsoid(m,[.36,0,.31],[.13,.15,.12],[90,148,137]);bone(m,[.4,0,.31],[.65,0,.23+wave*.02],.035,[144,177,154]);}
 }else if(kind==='koi'){
  const orange:RGB=variant===1?[231,187,77]:[229,112,66];
  ellipsoid(m,[0,0,.08],[.32,.105,.08],[238,229,205],undefined,n=>n[0]<-.2||n[1]>.4?orange:[238,229,205]);
  bone(m,[-.24,0,.08],[-.47,wave*.06,.085],.045,orange);
  ellipsoid(m,[-.48,wave*.06,.08],[.07,.14,.017],orange);
  for(const side of [-1,1])bone(m,[.06,side*.075,.06],[-.08,side*(.19+wave*.018),.035],.027,cream);
  ellipsoid(m,[.25,-.065,.11],[.02,.018,.017],dark);
 }else{
  const pelican=kind==='pelican',dip=action==='dip'?Math.sin(phase*Math.PI)**2:0,preen=action==='preen';
  const plumage:RGB=pelican?[239,231,202]:variant===1?[162,124,87]:[213,202,162],head:RGB=pelican?[243,228,186]:variant===1?plumage:[43,118,95];
  ellipsoid(m,[0,0,.2],[pelican?.4:.3,.19,.19],plumage);
  for(const side of [-1,1]){ellipsoid(m,[-.05,side*.13,.23],[.27,.075,.11],variant===2?dark:plumage);bone(m,[-.04,side*.12,.08],[-.14+wave*.05,side*.19,.012],.025,[211,151,63]);}
  const hx=preen?-.15:.21+dip*.2,hz=(pelican?.65:.45)-dip*.42;
  bone(m,[.17,0,.28],[hx,0,hz],pelican?.08:.07,head);
  ellipsoid(m,[hx,0,hz],[.115,.11,.12],head);
  bone(m,[hx+.08,0,hz-.01],[hx+(pelican?.48:.23),0,hz-.06-dip*.14],pelican?.044:.05,[225,166,69]);
  if(pelican)ellipsoid(m,[hx+.22,0,hz-.095],[.18,.07,.075+dip*.02],[208,165,102]);
  for(const side of [-1,1])ellipsoid(m,[hx+.057,side*.093,hz+.032],[.02,.02,.02],dark);
  bone(m,[-.2,0,.2],[-.43,0,.28],.075,plumage);
 }return m;
}
export async function bakeZen():Promise<BakeSprite[]>{
 const out:BakeSprite[]=[];
 // Shared earthy grain with a porous edge; world-space stamps supply the winding shape.
 const soil=new Uint8Array(48*48*4);
 for(let y=0;y<48;y++)for(let x=0;x<48;x++){
  const u=(x-23.5)/23.5,v=(y-23.5)/23.5,n=hash(x,y,9361),edge=Math.max(0,1-u*u-v*v+(hash(Math.floor(x/3),Math.floor(y/3),91)-.5)*.14);
  if(edge>0)soil.set([114+n*34,87+n*31,58+n*22,Math.min(1,edge*3)*(n>.9?.8:1)*255],(y*48+x)*4);
 }
 for(let i=3;i<soil.length;i+=4)if(!soil[i])soil.fill(0,i-3,i+1);
 out.push({id:'zen-path',anchor:[24,24],trim:false,frames:[{width:48,height:48,data:soil}]});
 const temple=await pagodaSprite();
 for(let form=0;form<3;form++)out.push({...temple,id:`zen-pagoda-${form}`});
 for(let form=0;form<3;form++){
  const m:Mesh=[];ellipsoid(m,[0,0,.08],[.24+form*.04,.19,.12+form*.03],[123+form*11,129+form*8,113+form*7],undefined,n=>n[2]>.3?[166,173,147]:[97,109,89],7,4);
  out.push({id:`zen-stone-${form}`,anchor:[12,16],frames:[bakeMesh(m,form*.7,{width:24,height:24,anchor:[12,16],scale:25})]});
 }
 for(const [i,name] of ['cherry','maple','pine'].entries()){
  const normalized=await sharp(`assets/source/zen-${name}.png`).trim().resize(88,108,{fit:'contain',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer();
  const frames=windFrames({width:88,height:108,data:normalized},88,108,'tree',0);
  out.push({id:`zen-tree-${i}`,anchor:[44,104],frames});
 }
 for(const kind of ['monk','koi','duck','pelican'] as const){
  const actions=kind==='monk'?['idle','walk','sit','water']:kind==='koi'?['swim']:['swim','dip','preen'];
  for(const action of actions){const count=action==='walk'?12:action==='idle'?4:8;
   for(let d=0;d<8;d++)out.push({id:`zen-${kind}-${action}-${d}`,anchor:[24,37],frames:Array.from({length:count},(_,i)=>bakeMesh(zenMesh(kind,action,i/count),d*tau/8,{width:48,height:48,anchor:[24,37],scale:kind==='monk'?29:kind==='pelican'?25:23}))});
  }
 }
 // Three lotus colonies with optional folded/open blossoms, gentle pad lift.
 for(let v=0;v<3;v++)out.push({id:`zen-lotus-${v}`,anchor:[20,17],frames:Array.from({length:8},(_,i)=>{
  const m:Mesh=[],p=i/8*tau;
  ellipsoid(m,[0,0,.03],[.4,.3,.016],[57+v*12,137+v*6,91],undefined,n=>n[0]>.5&&n[1]<-.2?[29,98,77]:[69,149,98]);
  if(v!==2)for(let j=0;j<7;j++){const a=j*tau/7,open=.13+.02*Math.sin(p);ellipsoid(m,[Math.cos(a)*open,Math.sin(a)*open,.12],[.09,.07,.09+Math.cos(p)*.01],j%2?[246,176,188]:[250,218,202]);}
  if(v!==2)ellipsoid(m,[0,0,.16],[.065,.065,.04],[241,208,91]);
  return bakeMesh(m,0,{width:40,height:30,anchor:[20,17],scale:27});
 })});
 return out.map(trimClip);
}
