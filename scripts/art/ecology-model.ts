import {tigerMesh,hippoMesh,bisonMesh} from './megafauna-model';
import { raptorMesh } from './raptor-model';
import { zebraMesh } from './zebra-model';
import { blackBearMesh } from './black-bear-model';
import { snakeMesh } from './snake-model';
import { riverAnimalMesh } from './river-model';
import {elephantMesh} from './elephant-model';
import { bone, ellipsoid, rotateZ, type Mesh, type RGB, type V3 } from '../../src/iso/bake/mesh';
import { MONKEY_GRIP_Z, type EcoKind } from '../../src/jungle/ecology';
const TAU=Math.PI*2,black:RGB=[35,39,37],cream:RGB=[241,225,181];
/** Small authored rigs: mesh coordinates face +X, same projection/root convention as deer. */
export function ecologyMesh(kind:EcoKind,clip:string,p:number,form=0):Mesh {
 if(kind==='tiger')return tigerMesh(clip,p);
 if(kind==='hippo')return hippoMesh(clip,p,form);
 if(kind==='bison')return bisonMesh(clip,p,form);
 if(kind==='hawk'||kind==='vulture')return raptorMesh(kind,clip,p);
 if(kind==='zebra')return zebraMesh(clip,p);
 if(kind==='blackBear')return blackBearMesh(clip,p);
 if(['squirrel','boar','beaver','crocodile','toad'].includes(kind))return riverAnimalMesh(kind,clip,p);
 if(kind==='boa'||kind==='smallSnake')return snakeMesh(kind,clip,p);
 if(kind==='elephant')return elephantMesh(clip,p);
 const m:Mesh=[],moving=clip==='travel'||clip==='swing'||clip==='run',wave=Math.sin(p*TAU);
 if(['macaw','parakeet','kingfisher','seagull'].includes(kind)){
  const gull=kind==='seagull',small=kind==='parakeet',king=kind==='kingfisher';
  const body:RGB=gull?[229,235,224]:small?[69,189,79]:king?[27,151,189]:[219,52,39];
  const wing:RGB=gull?[146,166,174]:small?[44,140,89]:king?[34,98,155]:[37,100,196];
  const chest:RGB=gull?[245,243,223]:small?[216,211,54]:king?[236,151,55]:[239,177,45];
  const beat=p<.42?p/.42*.5:.5+(p-.42)/.58*.5;
  const bob=wave*(moving?.012:.012),flap=moving?-Math.sin(beat*TAU):-.55;
  ellipsoid(m,[0,0,.34+bob],[.29,.14,.17],body);ellipsoid(m,[.22,0,.54+bob],[.14,.12,.14],body);
  ellipsoid(m,[.18,0,.33+bob],[.12,.126,.12],chest);
  if(king||gull)bone(m,[.3,0,.54+bob],[king?.62:.5,0,.53+bob],king?.025:.037,gull?[224,174,55]:black);
  else{ellipsoid(m,[.35,0,.52+bob],[.085,.061,.092],cream);bone(m,[.39,0,.51+bob],[.36,0,.42+bob],.027,black);}
  for(const side of [-1,1]){
   ellipsoid(m,[.263,side*.108,.57+bob],[.028,.014,.028],gull?chest:cream);ellipsoid(m,[.274,side*.12,.57+bob],[.014,.011,.017],black);
   const tip:V3=[-.09,side*(moving?(gull?.72:.55)*(1-.12*Math.max(0,flap)):.155),.4+flap*(moving?.34:.06)];
   bone(m,[.04,side*.1,.41+bob],tip,.052,wing);
   for(let i=0;i<5;i++)bone(m,tip,[-.33-i*.04,tip[1]+side*i*.018,tip[2]-.045],.019,i>2?black:wing);
   bone(m,[-.05,side*.06,.23],[moving?-.12:.03,side*.065,moving?.23:.028],.013,gull?[220,149,88]:black);
  }
  const tail=kind==='macaw'?.82:small?.5:.36;
  for(const side of [-1,1])bone(m,[-.18,side*.04,.3],[-tail,side*.06,.17+(moving?wave*.03:0)],.032,wing);
  return m;
 }
 if(kind==='monkey'){
  const fur:RGB=[137,86,43],face:RGB=[217,167,103],swing=clip==='swing',climb=clip==='climb',walk=clip==='travel',bob=swing?Math.cos(p*TAU)*.025:wave*.009;
  ellipsoid(m,[0,0,.5+bob],[.18,.16,.27],fur);ellipsoid(m,[.1,0,.83+bob],[.17,.155,.17],fur);ellipsoid(m,[.225,0,.82+bob],[.055,.13,.105],face);
  for(const side of [-1,1]){
   ellipsoid(m,[.263,side*.063,.87+bob],[.018,.018,.022],black);ellipsoid(m,[.07,side*.16,.84+bob],[.08,.035,.075],face);
   const phase=p*TAU+(side===1?Math.PI:0),reach=walk?Math.sin(phase)*.14:climb?Math.sin(phase)*.06:-.18;
   const hand:V3=swing?[0,side*.025,MONKEY_GRIP_Z]:[.18+reach,side*.19,climb?.87+Math.sin(phase)*.19:.28];
   bone(m,[.04,side*.15,.67+bob],[.09+reach*.4,side*.22,swing?.97:climb?.78:.42],.04,fur);
   bone(m,[.09+reach*.4,side*.22,swing?.97:climb?.78:.42],hand,.034,fur);ellipsoid(m,hand,[.04,.045,.035],face);
   const foot:V3=[swing?-.1+Math.sin(phase)*.06:walk?.06-Math.sin(phase)*.15:.06,side*.14,swing?.24:climb?.16+Math.max(0,-Math.sin(phase))*.15:walk?.06+Math.max(0,Math.cos(phase))*.07:.06];bone(m,[-.06,side*.1,.33],[-.15,side*.16,.2],.049,fur);bone(m,[-.15,side*.16,.2],foot,.034,fur);
  }
  let tail:V3=[-.14,0,.45];for(let i=0;i<8;i++){const t=i/7,to:V3=[-.2-t*.45,Math.sin(t*Math.PI)*.1,.45+Math.sin(t*Math.PI*1.3+wave*.2)*.28];bone(m,tail,to,.025,fur);tail=to;}
  return m;
 }
 if(kind==='fish'||kind==='whale'){
  const whale=kind==='whale',body:RGB=whale?[67,108,127]:[59,188,209];
  const length=whale?1.35:.27,width=whale?.42:.095,height=whale?.3:.12;
  ellipsoid(m,[.1,0,.23],[length,width,height],body,undefined,n=>n[2]<-.25?(whale?[159,182,184]:[234,211,115]):body,18,10);
  for(const side of [-1,1]){
   ellipsoid(m,[length*.78,side*width*.74,.26],[whale?.034:.013,whale?.018:.01,whale?.025:.018],black);
   bone(m,[0,side*width*.8,.18],[-length*.3,side*width*1.7,.07],whale?.055:.014,body);
  }
  const flex=wave*(whale?.06:.12),tail:V3=[-length*1.25,flex,.23+(whale?wave*.075:0)];
  bone(m,[-length*.7,0,.22],tail,whale?.11:.035,body);
  if(whale){for(const side of [-1,1])bone(m,tail,[tail[0]-.17,tail[1]+side*.45,tail[2]+.02],.075,body);bone(m,[-.4,0,.45],[-.6,0,.72],.055,body);ellipsoid(m,[.8,0,.503],[.06,.025,.015],black);}
  else{for(const side of [-1,1])bone(m,tail,[tail[0]-.1,tail[1],.23+side*.12],.025,[236,157,67]);bone(m,[-.04,0,.3],[-.1,0,.45],.024,[231,170,55]);}
  return m;
 }
 if(kind==='crab'){
  const shell:RGB=[215,95,52];ellipsoid(m,[0,0,.16],[.22,.17,.12],shell);
  for(const side of [-1,1]){
   for(let i=0;i<4;i++){
    const t=p*TAU+i*Math.PI*.7+side,base:V3=[-.15+i*.09,side*.1,.14],knee:V3=[-.21+i*.13+(moving?Math.sin(t)*.04:0),side*.25,.13],foot:V3=[-.24+i*.15,side*.38,.02+(moving?Math.max(0,Math.cos(t))*.045:0)];bone(m,base,knee,.015,shell);bone(m,knee,foot,.012,shell);
   }
   bone(m,[.16,side*.1,.18],[.3,side*.23,.22+wave*.015],.027,shell);ellipsoid(m,[.34,side*.23,.24+wave*.015],[.09,.049,.057],shell);bone(m,[.37,side*.22,.25],[.43,side*.19,.27],.023,cream);
   bone(m,[.11,side*.055,.23],[.15,side*.06,.34],.013,shell);ellipsoid(m,[.15,side*.06,.34],[.023,.023,.025],black);
  }
  // +X translation is sideways relative to a crab's face, intentionally unlike quadrupeds.
  for(const triangle of m)for(const v of triangle.vertices){v.position=rotateZ(v.position,Math.PI/2);v.normal=rotateZ(v.normal,Math.PI/2);}return m;
 }
 const giraffe=kind==='giraffe',wolf=kind==='wolf',run=wolf&&clip==='run';
 const fur:RGB=giraffe?[225,170,77]:[135,145,144];
 const legHeight=giraffe?1.05:.45,bodyHeight=legHeight+(giraffe?.32:.2),bob=run?Math.sin(p*TAU*2)*.045:moving?Math.cos(p*TAU*2)*.015:wave*.009;
 const length=giraffe?.55:.54,width=giraffe?.23:.2;
 ellipsoid(m,[0,0,bodyHeight+bob],[length,width,giraffe?.28:.24],fur,undefined,n=>n[2]<-.6?cream:fur,18,10);
 for(let i=0;i<4;i++){
  const side=i<2?-1:1,front=i%2===1,phase=(p+(run?[0,.48,.08,.56]:[0,.25,.5,.75])[i]!)%1,stance=run?.36:.68;
  const swing=Math.max(0,(phase-stance)/(1-stance)),fore=moving?(phase<stance?.5-phase/stance:-.5+swing*swing*(3-2*swing)):0;
  const lift=moving&&phase>stance?Math.sin(swing*Math.PI)*(run?.17:.075):0,x=(front?1:-1)*length*.68;
  const hip:V3=[x,side*width*.65,bodyHeight+bob],knee:V3=[x+fore*.2,side*width*.72,legHeight*.52+lift*.3],foot:V3=[x+fore*(run?.78:giraffe?.48:.5),side*width*.75,.055+lift];
  bone(m,hip,knee,giraffe?.05:.055,fur);bone(m,knee,foot,giraffe?.035:.035,fur);ellipsoid(m,foot,[.068,.044,.045],black);
 }
 if(giraffe){
  const browse=clip==='rest'?.055*wave:0,head:V3=[.78+browse,0,2.43];bone(m,[.36,0,1.44],head,.12,fur);ellipsoid(m,head,[.23,.11,.13],fur);ellipsoid(m,[1,0,2.39],[.11,.085,.065],fur);
  for(const side of [-1,1]){
   ellipsoid(m,[.86,side*.102,2.48],[.022,.012,.022],black);bone(m,[.66,side*.07,2.5],[.66,side*.12,2.71],.024,fur);ellipsoid(m,[.66,side*.12,2.72],[.039,.035,.035],black);bone(m,[.71,side*.09,2.48],[.66,side*.24,2.56],.04,fur);
   for(let row=0;row<2;row++)for(let j=0;j<5;j++)ellipsoid(m,[-.38+j*.18,side*(.22-row*.02),1.3+row*.13],[.06,.022,.06],[151,94,42],undefined,undefined,5,4);
   for(let i=0;i<6;i++)ellipsoid(m,[.4+i*.056,side*.104,1.54+i*.14],[.047,.02,.049],[151,94,42],undefined,undefined,5,4);
  }
  bone(m,[-.52,0,1.32],[-.73,wave*.04,.91],.022,fur);bone(m,[-.73,wave*.04,.91],[-.75,wave*.04,.76],.039,black);
 }else if(wolf){
  ellipsoid(m,[.43,0,.82+bob],[.23,.2,.26],fur);ellipsoid(m,[.62,0,.9+bob],[.2,.14,.17],fur);bone(m,[.68,0,.86+bob],[.96,0,.79+bob],.078,fur);ellipsoid(m,[.99,0,.79+bob],[.042,.047,.035],black);
  for(const side of [-1,1]){bone(m,[.53,side*.095,.99],[.49,side*.12,1.18],.042,fur);ellipsoid(m,[.7,side*.128,.95],[.03,.017,.019],[231,182,79]);}
  bone(m,[-.49,0,.74],[-.88,wave*.065,.52],.095,fur);bone(m,[-.88,wave*.065,.52],[-1.07,wave*.08,.39],.05,black);
 }
 const transformed=new Set<Mesh[number]['vertices'][number]>();
 if(giraffe)for(const triangle of m)for(const v of triangle.vertices){
  if(transformed.has(v))continue;transformed.add(v);
  v.position=[v.position[0],v.position[1],v.position[2]*1.16];
  const n=[v.normal[0],v.normal[1],v.normal[2]/1.16],length=Math.hypot(...n);v.normal=[n[0]!/length,n[1]!/length,n[2]!/length];
 }
 return m;
}
