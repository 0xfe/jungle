import { bone, ellipsoid, type Mesh, type RGB, type V3 } from '../../src/iso/bake/mesh';
import { bakeMesh } from '../../src/iso/bake/rasterize';
import type { BakeSprite } from '../../src/iso/bake/atlas';
import { SPACE_KINDS, SPACE_SPECS, VISITOR_CLIPS, VISITOR_DIRECTIONS, type SpaceKind } from '../../src/jungle/ecology';

const glass:RGB=[86,221,225], dark:RGB=[23,44,68], cream:RGB=[246,229,183];
/** Original +X-facing hulls based on the retained ImageGen concept sheet.
 * Three feet and an extending front ramp share the same fixed ground origin. */
export function spacecraftMesh(kind:SpaceKind,open:boolean):Mesh {
  const m:Mesh=[],hull:RGB=kind==='saucer'?[177,199,208]:kind==='lander'?[240,170,51]:[143,108,207];
  if(kind==='saucer'){
    ellipsoid(m,[0,0,.58],[1.62,1.38,.29],hull,undefined,undefined,24,10);
    ellipsoid(m,[-.12,0,.92],[.87,.78,.57],glass);
    ellipsoid(m,[-.12,0,1.41],[.22,.2,.06],cream);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ellipsoid(m,[Math.cos(a)*1.47,Math.sin(a)*1.22,.69],[.1,.1,.065],[253,114,103]);}
  }else if(kind==='lander'){
    ellipsoid(m,[0,0,.98],[.98,.87,.9],hull,undefined,n=>Math.abs(n[1])<.2?cream:hull,16,12);
    ellipsoid(m,[.76,0,1.29],[.3,.53,.4],glass);
    for(const side of [-1,1])ellipsoid(m,[-.13,side*.8,1.18],[.33,.12,.33],glass);
    bone(m,[-.1,0,1.79],[-.1,0,2.13],.05,dark);
    ellipsoid(m,[-.1,0,2.17],[.13,.13,.13],[255,210,78]);
  }else{
    ellipsoid(m,[.13,0,.66],[1.44,.65,.35],hull);
    ellipsoid(m,[.43,0,.94],[.69,.49,.38],glass);
    for(const side of [-1,1]){
      bone(m,[.25,side*.35,.65],[-.65,side*1.36,.57],.24,hull);
      bone(m,[-.65,side*1.36,.57],[-1.21,side*1.16,1.37],.12,hull);
      ellipsoid(m,[-.87,side*1.21,1.04],[.09,.12,.2],glass);
    }
  }
  for(const angle of [Math.PI,Math.PI/3,-Math.PI/3]){
    const hip:V3=[Math.cos(angle)*.78,Math.sin(angle)*.72,.58];
    const foot:V3=[Math.cos(angle)*1.22,Math.sin(angle)*1.1,.09];
    bone(m,hip,foot,.065,dark);ellipsoid(m,foot,[.25,.19,.075],hull);
  }
  const doorX=kind==='saucer'?1.25:kind==='lander'?.85:1.35;
  ellipsoid(m,[doorX,0,.45],[.13,.3,.27],open?dark:cream);
  if(open){
    // The ramp ends at the same .59-tile +X hatch anchor used by explorer movement.
    bone(m,[doorX,0,.29],[2.23,0,.035],.14,hull);
    for(const side of [-1,1])bone(m,[doorX,side*.19,.29],[2.23,side*.19,.035],.035,cream);
    for(let i=0;i<4;i++)bone(m,[doorX+(2.23-doorX)*(i+.3)/4,-.15,.25*(1-(i+.3)/4)],
      [doorX+(2.23-doorX)*(i+.3)/4,.15,.25*(1-(i+.3)/4)],.018,dark);
  }
  return m;
}

/** Three articulated organic species; planted stance excursion matches VISITOR_STRIDE.
 * Inspection alternates a scanner sweep, a crouching ground study and a raised greeting. */
export function explorerMesh(kind:SpaceKind,clip:string,phase:number):Mesh {
  const m:Mesh=[],walk=clip==='walk',inspect=clip==='inspect',wave=Math.sin(phase*Math.PI*2);
  const skin:RGB=kind==='saucer'?[128,207,117]:kind==='lander'?[247,147,53]:[179,141,224];
  const suit:RGB=kind==='saucer'?[137,92,165]:kind==='lander'?[47,140,182]:[112,219,211];
  const height=kind==='lander'?.79:kind==='scout'?1.13:.98,bob=walk?Math.sin(phase*Math.PI*4)*.012:0;
  const crouch=inspect?Math.max(0,-wave)*.08:0;
  ellipsoid(m,[0,0,.43+bob-crouch],[.17,kind==='lander'?.2:.13,.25],skin);
  ellipsoid(m,[0,0,.53+bob-crouch],[.18,.145,.11],suit);
  if(kind==='scout'){
    bone(m,[.01,0,.56+bob-crouch],[.02,0,.94+bob-crouch],.078,skin);
    for(const side of [-1,1]){
      const eye:V3=[.04,side*.17,height+bob-crouch];
      bone(m,[.02,0,.84+bob-crouch],eye,.036,skin);ellipsoid(m,eye,[.096,.078,.082],cream);
      ellipsoid(m,[eye[0]+.074,eye[1],eye[2]],[.025,.046,.05],dark);
    }
  }else{
    const head:V3=[.04,0,height-.16+bob-crouch];
    ellipsoid(m,head,[.2,kind==='saucer'?.22:.19,kind==='saucer'?.24:.2],skin);
    for(const side of kind==='lander'?[0]:[-1,1]){
      const eye:V3=[head[0]+.16,side*.13,head[2]+.02];
      ellipsoid(m,eye,[.075,side===0?.115:.077,side===0?.12:.085],side===0?cream:dark);
      ellipsoid(m,[eye[0]+.06,eye[1],eye[2]],[.023,side===0?.07:.025,side===0?.08:.032],side===0?dark:cream);
    }
    if(kind==='lander')for(const side of [-1,1]){
      bone(m,[0,side*.12,height],[0,side*.2,height+.18],.021,skin);
      ellipsoid(m,[0,side*.2,height+.18],[.05,.05,.05],[254,222,76]);
    }
  }
  for(const side of [-1,1]){
    const p=(phase+(side===1?.5:0))%1,stance=.6,u=Math.max(0,(p-stance)/(1-stance));
    const stride=walk?(p<stance?.5-p/stance:-.5+u*u*(3-2*u))*.28:0;
    const foot:V3=[stride+.03,side*.105,.035+(walk?Math.sin(u*Math.PI)*.08:0)];
    bone(m,[0,side*.085,.32+bob-crouch],[stride*.4,side*.1,.18],.039,skin);
    bone(m,[stride*.4,side*.1,.18],foot,.033,skin);ellipsoid(m,foot,[.088,.057,.032],skin);
    const hand:V3=[inspect?.15+wave*.07:-stride*.65,side*(inspect?.23:.19),inspect?.56+side*wave*.12:.35+bob];
    bone(m,[0,side*.13,.57+bob-crouch],[hand[0]*.5,side*.23,.44+bob],.031,skin);
    bone(m,[hand[0]*.5,side*.23,.44+bob],hand,.028,skin);ellipsoid(m,hand,[.044,.04,.047],skin);
    if(side===-1){ellipsoid(m,[hand[0]+.03,hand[1],hand[2]+.055],[.08,.06,.036],dark);ellipsoid(m,[hand[0]+.035,hand[1],hand[2]+.082],[.052,.04,.015],glass);}
  }
  return m;
}

/** Small shared clips fit the existing atlas; union trimming remains the packer's job. */
export function bakeSpaceVisitors():BakeSprite[] {
  const result:BakeSprite[]=[];
  for(const kind of SPACE_KINDS){
    const camera={width:88,height:80,anchor:[44,59] as [number,number],scale:18};
    for(let d=0;d<VISITOR_DIRECTIONS;d++){
      const [closed,open]=[false,true].map(open=>bakeMesh(spacecraftMesh(kind,open),d/VISITOR_DIRECTIONS*Math.PI*2,camera));
      const data=new Uint8Array(open!.data.length);
      // Opening only adds/recolors opaque pixels. Store that small patch separately
      // instead of duplicating an entire hull; both retain the identical root anchor.
      for(let i=0;i<data.length;i+=4){
        if(open!.data.subarray(i,i+4).every((v,j)=>v===closed!.data[i+j]))continue;
        if(!open!.data[i+3])throw new Error(`Opening ${kind} ${d} would erase hull pixels`);
        data.set(open!.data.subarray(i,i+4),i);
      }
      result.push({id:`ship-${kind}-${d}`,anchor:camera.anchor,frames:[closed!]});
      // Back-facing hatches may be fully hidden by their hull. An identical body
      // is deduplicated in that case and is safe to overpaint at the same anchor.
      result.push({id:`ship-${kind}-hatch-${d}`,anchor:camera.anchor,frames:[data.some(v=>v)?{...open!,data}:closed!]});
    }
    const alienCamera={width:36,height:36,anchor:[18,29] as [number,number],scale:15};
    for(const [clip,count] of Object.entries(VISITOR_CLIPS)){
      const poses=Array.from({length:count},(_,i)=>explorerMesh(kind,clip,i/count));
      for(let d=0;d<VISITOR_DIRECTIONS;d++)result.push({id:`alien-${SPACE_SPECS[kind].alien}-${clip}-${d}`,anchor:alienCamera.anchor,
        frames:poses.map(m=>bakeMesh(m,d/VISITOR_DIRECTIONS*Math.PI*2,alienCamera))});
    }
  }
  return result;
}
