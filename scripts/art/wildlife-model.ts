import { add, bone, ellipsoid, type Mesh, type RGB, type V3 } from '../../src/iso/bake/mesh';
import type { WildlifeKind } from '../../src/jungle/agents/wildlife';
export type WildlifeClip = 'rest' | 'travel' | 'chase' | 'climb';
export const WILDLIFE_CLIPS = { rest: 8, travel: 16, chase: 16, climb: 12 } as const;
const TAU=Math.PI*2;
const dark:RGB=[42,36,26],cream:RGB=[244,219,159];
/** Species-specific anatomy and stance, all oriented +X like the deer rig. */
export function wildlifeMesh(kind:WildlifeKind,clip:WildlifeClip,p:number):Mesh {
 const m:Mesh=[]; const moving=clip==='travel'||clip==='chase', running=clip==='chase';
 if(kind==='toucan') {
  const body:RGB=[31,45,44], gold:RGB=[246,184,40], bob=moving?Math.sin(p*TAU)*.015:Math.sin(p*TAU)*.005;
  ellipsoid(m,[0,0,.37+bob],[.29,.15,.21],body);
  ellipsoid(m,[.2,0,.62+bob],[.15,.125,.16],body);
  ellipsoid(m,[.27,0,.5+bob],[.08,.113,.14],[248,222,120]);
  ellipsoid(m,[.48,0,.66+bob],[.27,.089,.11],gold,undefined,n=>n[0]>.68?dark:n[2]>.4?[255,204,57]:[218,116,38]);
  bone(m,[.26,0,.585+bob],[.7,0,.625+bob],.011,dark);
  for(const side of [-1,1]) {
   ellipsoid(m,[.235,side*.12,.66+bob],[.047,.012,.047],[73,165,160]);ellipsoid(m,[.245,side*.133,.662+bob],[.021,.012,.025],dark);
   const flap=moving?Math.sin(p*TAU):-.75;
   const tip:V3=[-.18,side*(moving?.5:.17),.4+flap*(moving?.23:.04)];
   bone(m,[.02,side*.1,.44+bob],tip,.07,body);
   for(let feather=0;feather<4;feather++)bone(m,tip,[-.36-feather*.025,tip[1]+side*feather*.025,tip[2]-.02],.026,feather===3?cream:body);
   bone(m,[-.05,side*.07,.23],[.01,side*.09,.035],.016,[75,105,109]);
   for(const toe of [-1,1])bone(m,[.01,side*.09,.035],[.09,side*.09+toe*.035,.02],.009,dark);
  }
  bone(m,[-.19,0,.34],[-.55,0,.18],.065,body);ellipsoid(m,[-.19,0,.22],[.08,.07,.06],[198,55,39]);return m;
 }
 if(kind==='orangutan') {
  const fur:RGB=[170,76,28],light:RGB=[214,112,40];const climb=clip==='climb';
  const bob=moving?Math.sin(p*TAU*2)*.018:Math.sin(p*TAU)*.018;
  ellipsoid(m,[-.08,0,.58+bob],[.29,.27,.38],fur,undefined,n=>n[2]>.5?light:fur);
  ellipsoid(m,[.12,0,.99+bob],[.21,.2,.23],fur);
  ellipsoid(m,[.29,0,1+bob],[.06,.157,.16],[81,60,43]);
  ellipsoid(m,[.35,0,.94+bob],[.035,.08,.055],[132,91,64]);
  for(const side of [-1,1]) {
   ellipsoid(m,[.34,side*.071,1.035+bob],[.026,.028,.018],dark);
   const phase=(p+(side===1?.5:0))%1, swing=moving?Math.sin(phase*TAU)*.23:climb?Math.sin(phase*TAU)*.1:Math.sin(phase*TAU)*.045;
   const shoulder:V3=[.035,side*.23,.8+bob],elbow:V3=[.12+swing*.5,side*.32,.43+(climb?.35+Math.sin(phase*TAU)*.08:0)],hand:V3=[.32+swing,side*.3,.07+(climb?.9+Math.sin(phase*TAU)*.14:0)];
   bone(m,shoulder,elbow,.085,light);bone(m,elbow,hand,.064,fur);ellipsoid(m,hand,[.065,.07,.053],[79,53,34]);
   const hip:V3=[-.19,side*.18,.42],knee:V3=[-.27-swing*.3,side*.23,.22],foot:V3=[-.19-swing,side*.23,.045+Math.max(0,-swing)*.2];
   bone(m,hip,knee,.08,fur);bone(m,knee,foot,.06,fur);ellipsoid(m,foot,[.1,.057,.037],[78,53,34]);
  }
  for(let i=0;i<8;i++)bone(m,[-.2+i*.047,-.25,.64],[-.2+i*.047,-.28,.4],[.012,.02,.016][i%3]!,light);
  return m;
 }
 const fur:RGB=[207,151,61],bob=running?Math.sin(p*TAU)*.055:moving?Math.sin(p*TAU*2)*.012:0;
 ellipsoid(m,[0,0,.62+bob],[.61,.24,.25],fur,undefined,n=>n[2]<-.4?cream:fur,18,10);
 ellipsoid(m,[.44,0,.68+bob],[.25,.23,.27],fur);
 ellipsoid(m,[.65,0,.75+bob],[.25,.2,.21],fur);
 ellipsoid(m,[.83,0,.67+bob],[.14,.155,.095],cream);ellipsoid(m,[.94,0,.71+bob],[.043,.057,.031],dark);
 for(const side of [-1,1]) {
  ellipsoid(m,[.66,side*.179,.8+bob],[.055,.015,.026],[236,218,95]);ellipsoid(m,[.68,side*.192,.8+bob],[.022,.013,.025],dark);
  ellipsoid(m,[.52,side*.16,.94+bob],[.065,.045,.077],dark);ellipsoid(m,[.536,side*.17,.955+bob],[.036,.018,.035],fur);
  // Rosettes, not deer spots: dark ring around a tawny center, attached to the flank.
  for(let row=0;row<2;row++)for(let j=0;j<6;j++){
   const x=-.48+j*.17+row*.04,z=.62+bob+row*.115,yy=side*.24*Math.sqrt(Math.max(.12,1-(x/.62)**2-((z-.62-bob)/.27)**2));
   ellipsoid(m,[x,yy,z],[.048,.013,.043],dark,undefined,undefined,6,4);ellipsoid(m,[x,yy+side*.009,z],[.025,.01,.022],fur,undefined,undefined,6,4);
  }
 }
 for(let i=0;i<4;i++) {
  const front=i%2===1,side=i<2?-1:1,phase=(p+(running?[0,.45,.08,.53]:[0,.25,.5,.75])[i]!)%1;
  const stance=running?.35:.65,swing=Math.max(0,(phase-stance)/(1-stance)),fore=moving?(phase<stance?.5-phase/stance:-.5+swing*swing*(3-2*swing)):0;
  const lift=moving&&phase>stance?Math.sin(swing*Math.PI)*(running?.19:.07):0,x=front?.4:-.42;
  const hip:V3=[x,side*.17,.62+bob],knee:V3=[x+fore*.2+(front?.04:-.1),side*.18,.3+lift*.4],foot:V3=[x+fore*(running?.75:.52),side*.2,.035+lift];
  bone(m,hip,knee,.076,fur);bone(m,knee,foot,.046,fur);ellipsoid(m,foot,[.082,.06,.045],fur);
 }
 let from:V3=[-.55,0,.67+bob];
 for(let i=0;i<6;i++){const to:V3=[-.65-i*.1,Math.sin(p*TAU*.5+i*.4)*.08,.64+bob-i*.055];bone(m,from,to,.034,i%2?dark:fur);from=to;}
 return m;
}
