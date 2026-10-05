import sharp from 'sharp';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {BEAR_CLIPS,BEAR_COATS,BEAR_MOTION,BEAR_ONE_SHOTS} from '../src/jungle/bear-motion';
import {MemoryRenderer,spriteRegion,type DrawCommand} from '../src/iso/render';
import type {AtlasManifest} from '../src/jungle/scene';
await mkdir('artifacts',{recursive:true});
const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
const raw=await sharp('public/assets/jungle.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const renderer=new MemoryRenderer({width:raw.info.width,height:raw.info.height,data:raw.data});
/** Preview the delivered regions, including compact frame maps, at close zoom. */
function pose(clip:string,frame:number,direction=5,coat=0,size=1):Buffer {
 const name=`blackBear-${clip}-${direction}`,parts=atlas.animalClips?.[name]?.parts??[name],scale=BEAR_MOTION.displayScale*1.5*size;
 const commands:DrawCommand[]=parts.map((part,i)=>{
  const s=atlas.sprites[part]!;return{id:String(i),layer:1,depth:0,x:80-s.anchor[0]*scale,y:142-s.anchor[1]*scale,width:s.width*scale,height:s.height*scale,region:spriteRegion(s,frame),color:[...BEAR_COATS[coat]!,255]};
 });
 renderer.render({width:160,height:160,clear:[220,230,206,255],commands});return Buffer.from(renderer.pixels.data);
}
const strips:Record<string,{url:string;count:number}>={};
for(const [clip,count] of Object.entries(BEAR_CLIPS)){
 const panels=Array.from({length:count},(_,frame)=>({input:pose(clip,frame),raw:{width:160,height:160,channels:4 as const},left:frame*160,top:0}));
 const png=await sharp({create:{width:160*count,height:160,channels:4,background:'#dce6ce'}}).composite(panels).png().toBuffer();
 await writeFile(`artifacts/bear-${clip}-strip.png`,png);strips[clip]={url:`data:image/png;base64,${png.toString('base64')}`,count};
}
const panels:sharp.OverlayOptions[]=[];
for(let row=0;row<4;row++)for(let d=0;d<16;d++)panels.push({input:pose('travel',8,d,row%3,[.9,1,1.12,.5][row]!),raw:{width:160,height:160,channels:4},left:d*160,top:row*160});
await sharp({create:{width:2560,height:640,channels:4,background:'#dce6ce'}}).composite(panels).png().toFile('artifacts/bear-coats-directions.png');
const sequences=[
 {label:'Walk · 1.22 cycles/s',steps:[['travel',BEAR_MOTION.walkStride/BEAR_MOTION.walkSpeed,1]]},
 {label:'Run · 1.77 cycles/s',steps:[['run',BEAR_MOTION.runStride/BEAR_MOTION.runSpeed,1]]},
 {label:'Feed: lower, sniff, raise',steps:[['rest',1,1],['feedDown',.5,1],['forage',5.45,3],['feedUp',.5,1]]},
 {label:'Brief upright inspection',steps:[['rest',2,1],['rise',1.1,1],['stand',2.85,1],['lower',1.1,1]]},
 {label:'Tree picking posture',steps:[['rest',2,1],['rise',1.1,1],['stand',2.85,1],['pick',3.33,2],['lower',1.1,1]]},
 {label:'Cub paw/play pose',steps:[['rest',2,1],['play',4.28,3]]},
];
await writeFile('artifacts/bear-motion.html',`<!doctype html><meta charset="utf-8"><title>Bear motion review</title><style>body{font:16px system-ui;background:#20372c;color:#e2eddb;margin:28px}main{display:grid;grid-template-columns:repeat(3,minmax(200px,1fr));gap:20px;max-width:1000px}figure{margin:0}canvas{width:100%;max-width:300px;image-rendering:pixelated}button{padding:8px}p{max-width:850px}</style><h1>Bear motion review</h1><p>Actual packed frames, at normal action cadence. Locomotion is shown in place to inspect the gait; full-world translation and social behavior are checked separately. Three coats, adult sizes and a cub appear on the direction sheet.</p><button id="pause">Pause</button><main></main><script>
const strips=${JSON.stringify(strips)},sequences=${JSON.stringify(sequences)},oneShot=${JSON.stringify(BEAR_ONE_SHOTS)};
const images=Object.fromEntries(Object.entries(strips).map(([k,v])=>{const image=new Image();image.src=v.url;return[k,image]}));
const cells=sequences.map(s=>{const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');caption.textContent=s.label;canvas.width=canvas.height=160;figure.append(canvas,caption);document.querySelector('main').append(figure);return{s,canvas,ctx:canvas.getContext('2d')}});
let paused=false,time=0,last=0;document.querySelector('button').onclick=()=>{paused=!paused;document.querySelector('button').textContent=paused?'Resume':'Pause'};
function draw(now){if(last&&!paused)time+=(now-last)/1000;last=now;for(const {s,ctx} of cells){let t=time%s.steps.reduce((n,a)=>n+a[1],0);for(const [clip,duration,loops] of s.steps){if(t>duration){t-=duration;continue;}const n=strips[clip].count,phase=oneShot.includes(clip)?t/duration:(t/duration*loops)%1,index=Math.min(n-1,Math.floor(phase*(oneShot.includes(clip)?n-1:n)));ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,160,160);ctx.drawImage(images[clip],index*160,0,160,160,0,0,160,160);break;}}requestAnimationFrame(draw)}Promise.all(Object.values(images).map(i=>i.decode())).then(()=>requestAnimationFrame(draw));
</script>`);
console.log('Packed bear poses, coats and normal-speed animation review → artifacts/bear-motion.html');
