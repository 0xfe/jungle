import { SHIP_SPIN_FRAMES, SHIP_BANK_FRAMES, SHIP_LIGHT_FRAMES } from '../../src/jungle/space-animation';
import { bone, ellipsoid, type Mesh, type RGB, type V3 } from '../../src/iso/bake/mesh';
import { bakeMesh } from '../../src/iso/bake/rasterize';
import type { BakeSprite } from '../../src/iso/bake/atlas';
import { SPACE_KINDS, SPACE_SPECS, VISITOR_CLIPS, VISITOR_DIRECTIONS, type SpaceKind } from '../../src/jungle/ecology';

const glass:RGB=[86,221,225], dark:RGB=[23,44,68], cream:RGB=[246,229,183];
/** Original +X-facing hulls based on the retained ImageGen concept sheet.
 * Three feet and an extending front ramp share the same fixed ground origin. */
export function spacecraftMesh(kind:SpaceKind,open:boolean,lights=0,bank=0):Mesh {
  const m:Mesh=[],hull:RGB=kind==='saucer'?[177,199,208]:kind==='lander'?[240,170,51]:[143,108,207];
  if(kind==='saucer'){
    ellipsoid(m,[0,0,.58],[1.62,1.38,.29],hull,undefined,undefined,24,10);
    ellipsoid(m,[-.12,0,.92],[.87,.78,.57],glass);
    ellipsoid(m,[-.12,0,1.41],[.22,.2,.06],lights===1?[255,246,164]:[67,116,132]);
    // Radial panel seams, a segmented rim and offset service pods make rotation readable.
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      bone(m,[Math.cos(a)*.97,Math.sin(a)*.84,.79],[Math.cos(a)*1.43,Math.sin(a)*1.22,.72],.018,dark);
      ellipsoid(m,[Math.cos(a)*1.52,Math.sin(a)*1.29,.55],[.09,.07,.05],i%3===0?cream:dark);
    }
    for(const side of [-1,1])ellipsoid(m,[-.85,side*.55,.85],[.19,.14,.12],cream);
    bone(m,[-.45,-.18,1.34],[.25,-.18,1.34],.023,cream);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ellipsoid(m,[Math.cos(a)*1.47,Math.sin(a)*1.22,.69],[.1,.1,.065],[253,114,103]);}
  }else if(kind==='lander'){
    ellipsoid(m,[0,0,.98],[.98,.87,.9],hull,undefined,n=>Math.abs(n[1])<.2?cream:hull,16,12);
    ellipsoid(m,[.76,0,1.29],[.3,.53,.4],glass);
    for(const side of [-1,1])ellipsoid(m,[-.13,side*.8,1.18],[.33,.12,.33],glass);
    bone(m,[-.1,0,1.79],[-.1,0,2.13],.05,dark);
    ellipsoid(m,[-.1,0,2.17],[.13,.13,.13],lights===1?[255,246,164]:[127,89,41]);
    for(const side of [-1,1]){
      bone(m,[-.65,side*.38,.6],[-.65,side*.38,1.43],.055,cream);
      ellipsoid(m,[-.78,side*.35,.98],[.17,.19,.35],dark);
      for(let j=0;j<3;j++)bone(m,[-.87,side*.35-.1,.8+j*.12],[-.87,side*.35+.1,.8+j*.12],.025,cream);
    }
    ellipsoid(m,[.34,-.56,1.6],[.13,.11,.08],lights===2?[150,253,255]:dark);
  }else{
    ellipsoid(m,[.13,0,.66],[1.44,.65,.35],hull);
    ellipsoid(m,[.43,0,.94],[.69,.49,.38],glass);
    for(const side of [-1,1]){
      bone(m,[.25,side*.35,.65],[-.65,side*1.36,.57],.24,hull);
      bone(m,[-.65,side*1.36,.57],[-1.21,side*1.16,1.37],.12,hull);
      ellipsoid(m,[-.87,side*1.21,1.04],[.09,.12,.2],lights===(side===1?1:2)?[225,252,244]:[68,120,153]);
      bone(m,[-.1,side*.42,.89],[-.8,side*1.08,.77],.025,cream);
      ellipsoid(m,[-1.01,side*.38,.6],[.31,.18,.18],dark);
      ellipsoid(m,[-1.28,side*.38,.6],[.07,.13,.13],glass);
      for(let j=0;j<3;j++)bone(m,[-.5+j*.16,side*.54,.79],[-.58+j*.16,side*.67,.75],.022,cream);
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
  // Bank the whole scout about its center; camera projection and lighting are rebaked.
  if(bank)for(const triangle of m)triangle.vertices=triangle.vertices.map(v=>{
    const rotate=(p:V3):V3=>[p[0],p[1]*Math.cos(bank)-p[2]*Math.sin(bank),p[1]*Math.sin(bank)+p[2]*Math.cos(bank)];
    const q=rotate([v.position[0],v.position[1],v.position[2]-.65]);return {position:[q[0],q[1],q[2]+.65] as V3,normal:rotate(v.normal)};
  }) as typeof triangle.vertices;
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
export function bakeSpaceVisitors(tileSize=4):BakeSprite[] {
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
      const flashes=Array.from({length:SHIP_LIGHT_FRAMES},(_,phase)=>{
        const lit=bakeMesh(spacecraftMesh(kind,false,phase),d/VISITOR_DIRECTIONS*Math.PI*2,camera),data=new Uint8Array(lit.data.length);
        for(let i=0;i<data.length;i+=4)if(lit.data.subarray(i,i+4).some((v,j)=>v!==closed!.data[i+j]))data.set(lit.data.subarray(i,i+4),i);
        return {...lit,data};
      });
      // Some beacons are occluded from behind; a transparent clip needs a retained canvas.
      if(flashes.some(f=>f.data.some(v=>v)))result.push({id:`ship-${kind}-lights-${d}`,anchor:camera.anchor,frames:flashes});
      else result.push({id:`ship-${kind}-lights-${d}`,anchor:camera.anchor,frames:[closed!]});
      // Back-facing hatches may be fully hidden by their hull. An identical body
      // is deduplicated in that case and is safe to overpaint at the same anchor.
      result.push({id:`ship-${kind}-hatch-${d}`,anchor:camera.anchor,frames:[data.some(v=>v)?{...open!,data}:closed!]});
    }
    if(kind==='scout')for(let d=0;d<VISITOR_DIRECTIONS;d++){
      const frames=Array.from({length:SHIP_BANK_FRAMES},(_,i)=>bakeMesh(spacecraftMesh(kind,false,i%SHIP_LIGHT_FRAMES,Math.sin(i/SHIP_BANK_FRAMES*Math.PI*2)*.12),d/VISITOR_DIRECTIONS*Math.PI*2,camera));
      result.push({id:`ship-scout-flight-${d}`,anchor:camera.anchor,frames});
    }else{
      const frames=Array.from({length:SHIP_SPIN_FRAMES},(_,i)=>bakeMesh(spacecraftMesh(kind,false,i%SHIP_LIGHT_FRAMES),i/SHIP_SPIN_FRAMES*Math.PI*2,camera));
      result.push({id:`ship-${kind}-flight`,anchor:camera.anchor,frames});
    }
    const alienCamera={width:36,height:36,anchor:[18,29] as [number,number],scale:15};
    for(const [clip,count] of Object.entries(VISITOR_CLIPS)){
      const poses=Array.from({length:count},(_,i)=>explorerMesh(kind,clip,i/count));
      for(let d=0;d<VISITOR_DIRECTIONS;d++)result.push({id:`alien-${SPACE_SPECS[kind].alien}-${clip}-${d}`,anchor:alienCamera.anchor,
        frames:poses.map(m=>bakeMesh(m,d/VISITOR_DIRECTIONS*Math.PI*2,alienCamera))});
    }
  }
  // Share exact little patches across headings and poses. Each tile retains the
  // original root and every phase; empty tiles are omitted, never sampled at runtime.
  return result.flatMap(sprite=>{
    if(!sprite.id.startsWith('ship-'))return [sprite];
    const parts:BakeSprite[]=[];
    for(let y=0;y<80;y+=tileSize)for(let x=0;x<88;x+=tileSize){
      const width=Math.min(tileSize,88-x),height=Math.min(tileSize,80-y);
      const frames=sprite.frames.map(f=>{
        const data=new Uint8Array(width*height*4);
        for(let row=0;row<height;row++)data.set(f.data.subarray(((y+row)*88+x)*4,((y+row)*88+x+width)*4),row*width*4);
        return {width,height,data};
      });
      const staticPart=frames.every(f=>f.data.every((v,i)=>v===frames[0]!.data[i]));
      if(frames.some(f=>f.data.some(v=>v)))parts.push({id:`${sprite.id}:tile:${x}:${y}`,anchor:[sprite.anchor[0]-x,sprite.anchor[1]-y],frames:staticPart?[frames[0]!]:frames});
    }
    return parts;
  });
}
