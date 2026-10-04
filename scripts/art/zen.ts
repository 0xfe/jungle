import sharp from 'sharp';
import { ellipsoid, bone, unit, cross, sub, type Mesh, type V3, type RGB } from '../../src/iso/bake/mesh';
import { bakeMesh } from '../../src/iso/bake/rasterize';
import { trimClip, type BakeSprite } from '../../src/iso/bake/atlas';
import { windFrames } from './wind';
import type { ZenKind } from '../../src/jungle/agents/zen';
const tau=Math.PI*2,wood:RGB=[147,63,47],cream:RGB=[240,216,163],dark:RGB=[39,59,62];
/** Architectural surfaces are authored independently from the organic garden art. */
function face(m:Mesh,a:V3,b:V3,c:V3,d:V3,color:RGB){const normal=unit(cross(sub(b,a),sub(c,a)));const v=(position:V3)=>({position,normal});m.push({vertices:[v(a),v(b),v(c)],color},{vertices:[v(c),v(b),v(d)],color});}
function box(m:Mesh,x:number,y:number,z:number,w:number,d:number,h:number,c:RGB){
 for(const side of [-1,1]){face(m,[x-w,y+side*d,z],[x+w,y+side*d,z],[x-w,y+side*d,z+h],[x+w,y+side*d,z+h],c);face(m,[x+side*w,y-d,z],[x+side*w,y+d,z],[x+side*w,y-d,z+h],[x+side*w,y+d,z+h],c);}
 face(m,[x-w,y-d,z+h],[x+w,y-d,z+h],[x-w,y+d,z+h],[x+w,y+d,z+h],c);
}
export function pagodaMesh(form:number):Mesh{
 const m:Mesh=[],roof:RGB=([[47,105,100],[68,77,97],[127,61,57]] as RGB[])[form]!;
 box(m,0,0,0,1.2,1.2,.18,[175,168,140]);
 for(let i=0;i<3;i++)box(m,1.25+i*.18,0,0,.15,.5,.15-i*.04,[199,191,156]);
 const levels=form===1?3:2;
 for(let floor=0;floor<levels;floor++){
  const size=1-floor*.23,z=.18+floor*1.16;
  box(m,0,0,z,size,size,.78,cream);
  // A dark open door faces +X; lattice windows line the other walls.
  box(m,size+.012,0,z,.016,.27,.65,dark);
  for(const side of [-1,1])for(let i=-2;i<=2;i++){
   box(m,i*size*.3,side*(size+.018),z+.2,.018,.019,.38,wood);
   box(m,side*(size+.018),i*size*.3,z+.21,.019,.018,.36,wood);
  }
  for(const x of [-size,size])for(const y of [-size,size])bone(m,[x,y,z],[x,y,z+.94],.065,wood);
  // Curved tile roof: concave eaves with individually traced terracotta ridges.
  const outer=size+.43;
  const roofZ=(x:number,y:number)=>{const r=Math.max(Math.abs(x),Math.abs(y))/outer;return z+1.32-.55*r+.25*r**5;};
  for(let ix=0;ix<12;ix++)for(let iy=0;iy<12;iy++){
   const x=-outer+ix*outer/6,y=-outer+iy*outer/6,dx=outer/6;
   face(m,[x,y,roofZ(x,y)],[x+dx,y,roofZ(x+dx,y)],[x,y+dx,roofZ(x,y+dx)],[x+dx,y+dx,roofZ(x+dx,y+dx)],roof);
  }
  for(const side of [-1,1])for(let i=-6;i<=6;i++){
   const x=i*outer/6;bone(m,[x,side*outer,roofZ(x,outer)+.025],[x,side*outer*.65,roofZ(x,outer*.65)+.025],.014,[104,145,133]);
   bone(m,[side*outer,x,roofZ(outer,x)+.025],[side*outer*.65,x,roofZ(outer*.65,x)+.025],.014,[104,145,133]);
  }
 }
 const top=.18+(levels-1)*1.16+1.32;
 bone(m,[0,0,top],[0,0,top+.56],.04,[197,163,87]);
 for(let i=0;i<3;i++)ellipsoid(m,[0,0,top+.12+i*.14],[.12-i*.025,.12-i*.025,.065],[219,183,97]);
 return m;
}
/** Separate +X rigs: robes and sandals, koi fins, duck paddles and pelican throat pouch. */
export function zenMesh(kind:ZenKind,action:string,phase:number,variant=0):Mesh{
 const m:Mesh=[],wave=Math.sin(phase*tau),skin:RGB=[196+variant*12,148+variant*10,108+variant*8];
 if(kind==='monk'){
  const robe:RGB=([[211,135,63],[165,112,77],[123,144,135]] as RGB[])[variant]!,sit=action==='sit',walk=action==='walk',water=action==='water';
  const z=sit?.32:.55,bob=walk?Math.sin(phase*tau*2)*.01:Math.sin(phase*tau)*.008;
  ellipsoid(m,[0,0,z+bob],[.17,.19,sit?.21:.35],robe);
  ellipsoid(m,[.025,0,z+.4+bob],[.135,.12,.16],skin);
  bone(m,[.08,-.16,z+.24],[.13,.15,z-.08],.035,cream);
  for(const side of [-1,1]){
   const t=(phase+(side===1?.5:0))%1,u=Math.max(0,(t-.6)/.4),step=walk?(t<.6?.5-t/.6:-.5+u*u*(3-2*u))*.326:0;
   if(sit)ellipsoid(m,[.07,side*.18,.14],[.24,.15,.09],robe);
   else{bone(m,[0,side*.1,.3],[step,side*.1,.04+(walk?Math.sin(u*Math.PI)*.06:0)],.05,robe);ellipsoid(m,[step+.025,side*.1,.035],[.095,.064,.03],dark);}
   const hand:V3=[water?.3:sit?.19:-step*.45,side*.17,water?.36+wave*.025:sit?.3:.37];
   bone(m,[0,side*.15,z+.15],hand,.057,robe);ellipsoid(m,hand,[.055,.04,.04],skin);
  }
  if(water){ellipsoid(m,[.36,0,.31],[.13,.15,.12],[90,148,137]);bone(m,[.4,0,.31],[.65,0,.23+wave*.02],.035,[144,177,154]);}
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
 for(let form=0;form<3;form++)out.push({id:`zen-pagoda-${form}`,anchor:[100,173],frames:[bakeMesh(pagodaMesh(form),0,{width:200,height:208,anchor:[100,173],scale:39})]});
 for(const [i,name] of ['cherry','maple','pine'].entries()){
  const normalized=await sharp(`assets/source/zen-${name}.png`).trim().resize(88,108,{fit:'contain',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}}).ensureAlpha().raw().toBuffer();
  const frames=windFrames({width:88,height:108,data:normalized},88,108,'tree',0);
  out.push({id:`zen-tree-${i}`,anchor:[44,104],frames});
 }
 for(const kind of ['monk','koi','duck','pelican'] as const){
  const actions=kind==='monk'?['idle','walk','sit','water']:kind==='koi'?['swim']:['swim','dip','preen'];
  for(const action of actions){const count=action==='walk'?12:action==='idle'?4:8;
   for(let d=0;d<8;d++)out.push({id:`zen-${kind}-${action}-${d}`,anchor:[24,37],frames:Array.from({length:count},(_,i)=>bakeMesh(zenMesh(kind,action,i/count),d*tau/8,{width:48,height:48,anchor:[24,37],scale:kind==='monk'?24:kind==='pelican'?25:23}))});
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
