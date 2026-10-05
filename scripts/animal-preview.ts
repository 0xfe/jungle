import sharp from 'sharp';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { animalOneShot,quietAction } from '../src/jungle/animal-actions';
import { DEER_CLIPS } from '../src/jungle/animation';
import { WILDLIFE_CLIPS } from './art/wildlife-model';
import { BIRD_FLIGHT } from '../src/jungle/flight';
import { ECO_KINDS,ECO_SPECS,ecoClips,type EcoKind } from '../src/jungle/ecology';
import { BEAR_COATS,BEAR_ONE_SHOTS } from '../src/jungle/bear-motion';
import { MemoryRenderer,spriteRegion,type DrawCommand } from '../src/iso/render';
import type { AtlasManifest } from '../src/jungle/scene';

/** Offline review of delivered atlas pieces, rather than a second rendering of source rigs. */
await mkdir('artifacts/animals',{recursive:true});
const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
const allKinds=[...ECO_KINDS,'deer','toucan','orangutan','jaguar','koi','duck','pelican'];
const selected=process.argv.slice(2).filter(k=>allKinds.includes(k));
const kinds=selected.length?selected:allKinds;
const catalog:Record<string,Record<string,{url:string;count:number;seconds:number;once:boolean}>>={};
const width=240,height=240;
for(const kind of kinds){
 const pond=['koi','duck','pelican'].includes(kind),spec=ECO_SPECS[kind as EcoKind]??{directions:pond?8:16,displayScale:1,speed:kind==='deer'?.14:kind==='orangutan'?.095:.16,stride:kind==='deer'?.125:kind==='orangutan'?.16:.18,mode:kind==='toucan'?'air':'ground',runStride:.45,runSpeed:1.05};
 const heading=Math.round(spec.directions*5/16),prefix=pond?`zen-${kind}`:kind;
 const clips:Record<string,number>=Object.fromEntries(Object.entries(atlas.animalClips??{}).filter(([name])=>name.startsWith(`${prefix}-`)&&name.endsWith(`-${heading}`)&&!name.includes('-form')).map(([name,entry])=>[name.slice(prefix.length+1,-String(heading).length-1),entry.frames]));
 if(pond)for(const [name,parts] of Object.entries(atlas.zenParts??{})){if(name.startsWith(`${prefix}-`)&&name.endsWith(`-${heading}`)&&!name.includes('-form'))clips[name.slice(prefix.length+1,-String(heading).length-1)]=Math.max(...parts.map(p=>atlas.sprites[p]!.frameIndices?.length??atlas.sprites[p]!.frames.length));}

 const entries:typeof catalog[string]={};
 for(const [clip,count] of Object.entries(clips)){
  const name=`${prefix}-${clip}-${heading}`,parts=atlas.animalClips?.[name]?.parts??atlas.zenParts?.[name]??[name];
  // Boa support sections are reviewed by snakes:preview, behind/in front of a real trunk.
  if(!atlas.sprites[parts[0]!])continue;
  let extent=1;for(const part of parts){const s=atlas.sprites[part]!;extent=Math.max(extent,s.anchor[1],Math.abs(s.anchor[0])*1.7,Math.abs(s.width-s.anchor[0])*1.7);}
  const scale=Math.min(spec.displayScale*3,185/extent);
  const panels:sharp.OverlayOptions[]=[];
  for(let frame=0;frame<count;frame++){
   const commands:DrawCommand[]=parts.map((part,i)=>{
    const s=atlas.sprites[part]!;return{id:String(i),layer:1,depth:0,x:120-s.anchor[0]*scale,y:216-s.anchor[1]*scale,width:s.width*scale,height:s.height*scale,region:spriteRegion(s,frame),color:[...(kind==='blackBear'?BEAR_COATS[0]!:[255,255,255] as const),255]};
   });
   renderer.render({width,height,clear:[220,230,206,255],commands});
   panels.push({input:Buffer.from(renderer.pixels.data),raw:{width,height,channels:4},left:frame*width,top:0});
  }
  const file=`${kind}-${clip}.png`;
  await sharp({create:{width:width*count,height,channels:4,background:'#dce6ce'}}).composite(panels).png().toFile(`artifacts/animals/${file}`);
  const once=animalOneShot(kind,clip)||['dip','settle','preen','feed'].includes(clip);
  const seconds=kind==='whale'?(clip==='surface'?54*.17:1/.36):quietAction(clip)?clip==='feed'&&kind==='elephant'?7:5:clip==='walk'?pond?1.2:.125/.14:clip==='travel'?spec.mode==='air'?1/(BIRD_FLIGHT[kind]?.beats??4):spec.stride/spec.speed:clip==='run'?(spec.runStride??.4)/(spec.runSpeed??.8):clip==='dive'?kind==='hawk'?3.4:3.2:clip==='drink'?5.4:clip==='spray'?2.8:clip==='enterWater'||clip==='leaveWater'?1.25:clip==='land'?.7:clip==='takeoff'?.5:clip==='dip'?2.5:clip==='lieDown'?1.3:once?.65:clip==='forage'?1/.7:4;
  entries[clip]={url:`animals/${file}`,count,seconds,once};
 }
 catalog[kind]=entries;
}
await writeFile('artifacts/animal-motion.html',`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Wildlife action review</title><style>body{font:16px system-ui;background:#20372c;color:#e2eddb;margin:20px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px}figure{margin:0}canvas{width:240px;height:240px;image-rendering:pixelated}select,button{padding:8px;margin:8px}</style><h1>Wildlife action review</h1><p>Delivered directional frames at nominal cadence. These isolated loops inspect artwork; habitat and social behavior are tested in simulation and the full scene.</p><select></select><button>Pause</button><main></main><script>
const catalog=${JSON.stringify(catalog)},select=document.querySelector('select');for(const k of Object.keys(catalog)){const o=document.createElement('option');o.value=o.textContent=k;select.append(o)}let cells=[],time=0,last=0,paused=false;
async function load(){cells=[];document.querySelector('main').replaceChildren();for(const [clip,meta] of Object.entries(catalog[select.value])){const image=new Image();image.src=meta.url;await image.decode();const f=document.createElement('figure'),c=document.createElement('canvas'),label=document.createElement('figcaption');c.width=c.height=240;label.textContent=clip+' · '+meta.count+' frames';f.append(c,label);document.querySelector('main').append(f);cells.push({meta,image,ctx:c.getContext('2d')})}time=0}select.onchange=load;document.querySelector('button').onclick=()=>{paused=!paused;document.querySelector('button').textContent=paused?'Resume':'Pause'};
function draw(now){if(last&&!paused)time+=(now-last)/1000;last=now;for(const {meta,image,ctx} of cells){const phase=(time/meta.seconds)%1,index=Math.min(meta.count-1,Math.floor(phase*(meta.once?meta.count-1:meta.count)));ctx.clearRect(0,0,240,240);ctx.drawImage(image,index*240,0,240,240,0,0,240,240)}requestAnimationFrame(draw)}load().then(()=>requestAnimationFrame(draw));
</script>`);
console.log(`Packed action review for ${kinds.length} species → artifacts/animal-motion.html`);
