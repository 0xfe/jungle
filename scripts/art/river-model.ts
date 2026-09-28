import { bone, ellipsoid, type Mesh, type RGB, type V3 } from '../../src/iso/bake/mesh';
const TAU=Math.PI*2, dark:RGB=[37,38,26], cream:RGB=[232,213,155];

/** Authored +X-facing rigs; shared feet/stance geometry is calibrated to ecology strides. */
export function riverAnimalMesh(kind:string,clip:string,p:number):Mesh {
  const m:Mesh=[],moving=clip!=='rest',wave=Math.sin(p*TAU),swim=clip==='swim';
  if(kind==='toad'){
    const stretch=clip==='hop'?Math.sin(p*Math.PI):0,skin:RGB=[119,133,62];
    ellipsoid(m,[-.03,0,.14],[.20,.15,.13],skin);
    ellipsoid(m,[.13,0,.2],[.13,.15,.095],[143,151,76]);
    for(const side of [-1,1]){
      ellipsoid(m,[.17,side*.105,.285],[.04,.044,.046],[171,166,74]);ellipsoid(m,[.19,side*.13,.295],[.017,.021,.023],dark);
      bone(m,[.09,side*.10,.16],[.17+stretch*.05,side*.18,.018],.027,skin);
      const knee:V3=[-.19-stretch*.1,side*.20,.095],foot:V3=[-.07-stretch*.35,side*.23,.025];
      bone(m,[-.1,side*.10,.13],knee,.065,skin);bone(m,knee,foot,.028,skin);
      for(let i=0;i<3;i++)bone(m,foot,[foot[0]+.045,foot[1]+side*(i-1)*.02,.015],.008,cream);
    }
    for(let i=0;i<7;i++)ellipsoid(m,[-.12+(i%3)*.06,(i%2?1:-1)*.065,.24],[.017,.017,.013],[76,99,47]);
    return m;
  }
  if(kind==='crocodile'){
    const skin:RGB=[81,115,65],ridge:RGB=[57,88,46];
    ellipsoid(m,[0,0,.24],[.53,.19,.16],skin);
    ellipsoid(m,[.53,0,.23],[.3,.14,.09],skin);ellipsoid(m,[.78,0,.20],[.22,.105,.055],[110,130,68]);
    for(const side of [-1,1]){
      ellipsoid(m,[.47,side*.095,.325],[.055,.043,.045],skin);ellipsoid(m,[.49,side*.122,.335],[.018,.012,.019],[231,187,62]);
      for(let i=0;i<2;i++){
        const phase=(p+i*.5+(side>0?.5:0))%1,stance=.62,s=phase<stance?.5-phase/stance:-.5+(phase-stance)/(1-stance);
        const x=(i?.32:-.3),foot:V3=[x+(moving?s*.58:0),side*.34,swim?.15:.03];
        bone(m,[x,side*.13,.22],[x-.12,side*.27,.15],.045,skin);bone(m,[x-.12,side*.27,.15],foot,.027,skin);
      }
    }
    let tail:V3=[-.43,0,.22];
    for(let i=1;i<=8;i++){const t=i/8,to:V3=[-.43-t*.9,(moving?wave:0)*t*t*.12,.22-t*.16];bone(m,tail,to,.13*(1-t)+.01,skin);tail=to;}
    for(let i=0;i<9;i++)for(const side of [-1,1])bone(m,[.33-i*.12,side*.075,.34],[.31-i*.12,side*.075,.41-i*.009],.025,ridge);
    return m;
  }
  const squirrel=kind==='squirrel',boar=kind==='boar',climb=clip==='climb'||clip==='descend';
  const fur:RGB=squirrel?[172,96,47]:boar?[104,81,57]:[119,83,47];
  const length=squirrel?.25:boar?.48:.34,width=squirrel?.105:boar?.23:.20;
  const height=squirrel?.24:boar?.48:.27,run=clip==='run',bob=moving&&!swim?Math.sin(p*TAU*2)*(boar?.018:.012):0;
  ellipsoid(m,[0,0,height+bob],[length,width,squirrel?.13:boar?.26:.20],fur);
  const head:V3=[length*.85,0,height+(boar?.015:.16)+bob+(boar&&clip==='rest'?wave*.07:0)];
  ellipsoid(m,head,[squirrel?.13:boar?.23:.18,width*.85,squirrel?.12:boar?.19:.15],fur);
  const snout=head[0]+(squirrel?.10:boar?.23:.13);
  ellipsoid(m,[snout,0,head[2]-.04],[boar?.13:.075,width*.65,boar?.075:.06],boar?[147,112,81]:cream);
  ellipsoid(m,[snout+(boar?.1:.055),0,head[2]-.015],[.025,width*.43,.025],dark);
  for(const side of [-1,1]){
    ellipsoid(m,[head[0]+.045,side*width*.76,head[2]+.04],[.024,.017,.025],dark);
    ellipsoid(m,[head[0]-.055,side*width*.67,head[2]+.12],[.05,.036,squirrel?.09:.065],fur);
    if(boar)bone(m,[snout-.01,side*.12,head[2]-.10],[snout+.07,side*.14,head[2]+.01],.025,cream);
    if(!squirrel&&!boar)for(const d of [-.017,.017])ellipsoid(m,[snout+.01,d,head[2]-.08],[.017,.015,.038],cream);
  }
  for(let i=0;i<4;i++){
    const side=i<2?-1:1,front=i%2===1,phase=(p+(run?[0,.48,.08,.56]:[0,.25,.5,.75])[i]!)%1;
    const stance=run?.38:boar?.65:squirrel?.60:.62,u=Math.max(0,(phase-stance)/(1-stance));
    const excursion=run?.50:boar?.45:squirrel?.50:.46,fore=moving?(phase<stance?.5-phase/stance:-.5+u*u*(3-2*u))*excursion:0;
    const x=(front?1:-1)*length*.65,foot:V3=[x+fore,side*width*.82,swim?.15:.025+(moving?Math.sin(u*Math.PI)*.07:0)];
    bone(m,[x,side*width*.6,height],foot,squirrel?.023:boar?.046:.036,fur);ellipsoid(m,foot,[.055,.035,.025],dark);
  }
  if(squirrel){
    let tail:V3=[-.2,0,.27];
    for(let i=1;i<=6;i++){const t=i/6,to:V3=[-.22-Math.sin(t*Math.PI*.85)*.27,(moving?wave:0)*.035,.27+t*.55];bone(m,tail,to,.07+Math.sin(t*Math.PI)*.045,fur);tail=to;}
    ellipsoid(m,[-.28,0,.72],[.13,.12,.16],[188,114,54]);
  }else if(boar){
    for(let i=0;i<8;i++)bone(m,[-.35+i*.09,0,.70],[-.38+i*.09,0,.79],.018,dark);
    bone(m,[-.44,0,.51],[-.61,wave*.025,.60],.015,fur);
  }else ellipsoid(m,[-.53,wave*.03,.095],[.25,.13,.035],[72,65,46]);
  // Climb around the planted rear feet: head points up/down without changing the root.
  if(climb)for(const tri of m)for(const v of tri.vertices){
    const sign=clip==='descend'?-1:1,[x,y,z]=v.position,[nx,ny,nz]=v.normal;
    v.position=[-z*.7,y,sign*x+.43];v.normal=[-nz,ny,sign*nx];
  }
  return m;
}
