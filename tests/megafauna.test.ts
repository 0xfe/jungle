import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AgentSystem, type AgentEnvironment } from '../src/agents';
import { TigerAgent,HippoAgent,BisonAgent,jungleAgents } from '../src/jungle/agents';
import { ECO_SPECS,ecoClips,habitatAllows } from '../src/jungle/ecology';
import { InfiniteWorld,faunaPlan } from '../src/jungle/infinite';
import { normalizeSettings } from '../src/jungle/settings';
import { ecologyMesh } from '../scripts/art/ecology-model';
import { bakeMesh } from '../src/iso/bake/rasterize';
import { spritePieces } from '../scripts/art/sprite-pieces';
import { trimClip } from '../src/iso/bake/atlas';
import { populationRange } from '../src/jungle/encounters';
import { CONFIG } from '../src/config';
import { decodePcmWav,Soundscape,SOUND_KINDS,synthesize } from '../src/audio';

const land:AgentEnvironment={time:0,canMove:()=>true,nearby:()=>[],sample:()=>({water:false,bank:true,beach:false,depth:0,moisture:.4,elevation:0,light:.8,wind:1})};
const bank:AgentEnvironment={...land,sample:(x,y)=>({...land.sample(x,y),water:y<0,bank:y>=0&&y<.9,depth:y<0?.25:0}),canMove:(_x,y)=>y>=0};
test('new species resume exactly in each action, retaining motors, RNG, groups and prior samples',()=>{
 for(const C of [TigerAgent,HippoAgent,BisonAgent])for(const state of Object.keys(ecoClips(new C('',0,0,1).kind))){
  if(state==='wade')continue;
  const a=new C('a',0,.2,87),env=a.kind==='hippo'?bank:land;
  a.state=state as typeof a.state;a.timer=1.5;a.target={x:1,y:.3};a.territory=[-3,-3,3,3];
  for(let i=0;i<83;i++)a.update(1/60,env);
  const b=jungleAgents.decode(jungleAgents.encode([a]))[0] as typeof a;
  for(let i=0;i<360;i++){a.update(1/60,env);b.update(1/60,env);}
  assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]),`${a.kind} ${state}`);
 }
});
test('tigers stalk slowly, pursue briefly, stop before contact and recover',()=>{
 const a=new TigerAgent('t',0,0,1);a.state='stalk';a.target={x:2,y:0};a.timer=8;a.heading=0;
 let preyX=2;const env={...land,nearby:(x:number,y:number,r:number)=>Math.hypot(preyX-x,y)<=r?[{id:'prey',kind:'deer',x:preyX,y:0,speed:0}]:[]};
 for(let i=0;i<60;i++)a.update(1/60,env);assert.equal(a.state,'stalk');assert.ok(a.speed<.11);
 preyX=1.2;let chased=false;for(let i=0;i<30;i++){a.update(1/60,env);chased ||= String(a.state)==='chase';}assert.ok(chased);
 for(let i=0;i<180;i++)a.update(1/60,env);
 assert.equal(a.state,'rest');assert.ok(a.cooldown>25);assert.ok(preyX-a.x>=.6);
});
test('hippos alternate bank grazing and water residence while rejecting deep water and inland ground',()=>{
 const a=new HippoAgent('h',0,.2,17);a.timer=0;a.territory=[-2,-2,2,2];const seen=new Set<string>();
 for(let i=0;i<420*60;i++){a.update(1/60,bank);seen.add(a.state);assert.ok(habitatAllows('hippo',bank.sample(a.x,a.y)));}
 assert.ok(seen.has('wallow')&&seen.has('graze')&&seen.has('travel'));
 assert.equal(habitatAllows('hippo',{...land.sample(0,0),bank:false}),false);
 assert.equal(habitatAllows('hippo',{...bank.sample(0,-1),depth:1}),false);
});
test('bison graze independently and follow herd runs without walking through blocked ground',()=>{
 const herd=Array.from({length:5},(_,i)=>{const a=new BisonAgent(`herd:${i}`,-i*.25,(i%2)*.4,20+i);a.groupId='herd';a.leaderId='herd:0';a.timer=0;a.territory=[-3,-3,3,3];return a;});
 const system=new AgentSystem();let grazed=0,ran=0,sharedRun=false;
 for(let i=0;i<600*60;i++){system.step(herd,1/60,land);grazed+=herd.filter(a=>a.state==='graze').length;ran+=herd.filter(a=>a.state==='run'&&a.speed>.3).length;sharedRun ||= herd.filter(a=>a.state==='run'&&a.speed>.3).length>=3;}
 assert.ok(grazed>1000&&ran>100);assert.ok(sharedRun);
 assert.ok(herd.every(a=>Math.hypot(a.x-herd[0]!.x,a.y-herd[0]!.y)<2.3));
 const a=herd[0]!;a.state='travel';a.heading=0;a.target={x:a.x+1,y:a.y};a.timer=10;a.decision=10;
 const before={x:a.x,y:a.y,gait:a.gait};a.update(1/60,{...land,canMove:()=>false});
 assert.deepEqual({x:a.x,y:a.y,gait:a.gait},before);assert.equal(a.speed,0);
});
test('rare solitary tigers, bank hippos and spaced bison herds are seeded and configurable',()=>{
 let cats=0;for(let x=-50;x<50;x++)for(let y=-50;y<50;y++)cats+=Number(faunaPlan(x,y,2718).tiger);
 assert.ok(cats>50&&cats<300,`${cats} cat candidates in 10000 chunks`);
 for(const kind of ['tiger','hippo','bison'] as const){
  const w=new InfiniteWorld(2718),p=w.wildlifeLandmark(kind);w.ensure({minX:p.x-3,minY:p.y-3,maxX:p.x+3,maxY:p.y+3});
  const animals=w.agents.filter(a=>a.kind===kind) as (TigerAgent|HippoAgent|BisonAgent)[];assert.ok(animals.length,kind);
  if(kind==='tiger')assert.ok(animals.every(a=>!a.groupId));
  if(kind==='bison'){assert.ok(animals.some(a=>animals.filter(b=>b.groupId===a.groupId).length>=4));assert.ok(new Set(animals.map(a=>a.coat)).size===2);assert.ok(Math.max(...animals.map(a=>a.size))-Math.min(...animals.map(a=>a.size))>.15);}
  const settings=normalizeSettings({[`chance_${kind}`]:0});
  for(let i=-30;i<30;i++)assert.equal(faunaPlan(i,-i,2718,5,1,settings)[kind],false);
 }
});
test('all new rigs fit every heading and action; shared pieces reconstruct every pixel',()=>{
 for(const kind of ['tiger','hippo','bison','blackBear'] as const)for(const form of (kind==='hippo'||kind==='bison'?[0,1]:[0])){
  const spec=ECO_SPECS[kind],camera={width:112,height:112,anchor:[56,87] as [number,number],scale:spec.cameraScale};
  for(const [clip,count] of Object.entries(ecoClips(kind)))for(let d=0;d<spec.directions;d++){
   const source=trimClip({id:`${kind}-${clip}-${d}`,anchor:camera.anchor,frames:Array.from({length:count},(_,i)=>bakeMesh(ecologyMesh(kind,clip,i/count,form),d/spec.directions*Math.PI*2,camera))});
   assert.ok(source.frames[0]!.width<100&&source.frames[0]!.height<100,source.id);
   const pieces=spritePieces(source,3);
   for(const [i,f] of source.frames.entries()){
    const joined=new Uint8Array(f.data.length);
    for(const piece of pieces){const frame=piece.frames[i%piece.frames.length]!,x=source.anchor[0]-piece.anchor[0],y=source.anchor[1]-piece.anchor[1];for(let row=0;row<frame.height;row++)joined.set(frame.data.subarray(row*frame.width*4,(row+1)*frame.width*4),((y+row)*f.width+x)*4);}
    assert.deepEqual(joined,f.data,source.id);
   }
  }
 }
});
test('recorded tiger roar is bounded, muted with wildlife, and fits the shared PCM budget',async()=>{
 const tiger=decodePcmWav(await readFile('public/assets/audio/tiger-roar.wav')),elephant=decodePcmWav(await readFile('public/assets/audio/elephant-trumpet.wav'));
 assert.equal(tiger.sampleRate,16000);assert.equal(tiger.channels.length,1);assert.equal(tiger.channels[0]!.length,32000);
 assert.equal(tiger.channels[0]![0],0);assert.equal(tiger.channels[0]!.at(-1),0);
 assert.ok(tiger.channels[0]!.every(v=>Number.isFinite(v)&&Math.abs(v)<.8));assert.ok(CONFIG.audio.sounds.elephant.gain>.7);
 const pcm=[tiger,elephant,...SOUND_KINDS.filter(k=>CONFIG.audio.sounds[k].enabled).map(k=>synthesize(k,CONFIG.audio.sampleRate,CONFIG.audio.seed,CONFIG.audio.sounds[k]))];
 assert.ok(pcm.reduce((n,p)=>n+p.channels.reduce((a,c)=>a+c.byteLength,0),0)<10*1048576);
 const planner=new Soundscape({...CONFIG.audio,chorus:false}),scene={x:0,y:0,water:0,canopy:0,rain:0,night:0,emitters:[{id:'t',x:0,y:0,bird:false,speed:0,phase:0,call:'tiger' as const}]};
 assert.equal(planner.update(scene,.1).events[0]?.kind,'tiger');
 for(let i=0;i<100;i++)assert.equal(planner.update(scene,.1).events.length,0);
 planner.reset();assert.equal(planner.update(scene,.1,{master:.6,ambience:.05,wildlife:0}).events.length,0);
 assert.equal(planner.update(scene,.1,undefined,false).events.length,0);
});


test('large herbivore ranges are sparse, mostly separate, and deterministic across signed boundaries',()=>{
 const kinds=['bison','elephant','hippo'] as const,counts=[0,0,0];let shared=0,occupied=0;
 for(let x=-120;x<120;x++)for(let y=-120;y<120;y++){
  const regions=kinds.map(k=>populationRange(k,x*4+2,y*4+2,2718));
  const n=regions.filter(Boolean).length;occupied+=Number(n>0);shared+=Number(n>1);
  const plan=faunaPlan(x,y,2718);
  for(let i=0;i<kinds.length;i++)if(regions[i]&&plan[kinds[i]!])counts[i]!++;
 }
 assert.ok(shared>0&&shared<occupied*.15,`${shared} overlapping / ${occupied} occupied regions`);
 assert.ok(counts.every(n=>n>50&&n<4000),counts.join(','));
 assert.ok(CONFIG.world.population.bison<.025&&CONFIG.world.population.hippo<.045&&CONFIG.world.population.elephant<.085);
 for(const x of [-24,-4,0,4,24])for(const k of kinds)assert.equal(populationRange(k,x-1e-8,-4,2718),populationRange(k,x+1e-8,-4,2718));
});

test('hippo travel chooses space away from nearby elephants without getting trapped',()=>{
 const a=new HippoAgent('h',0,.2,17);a.timer=0;a.cooldown=100;a.heading=Math.PI;
 const env={...bank,nearby:()=>[{id:'e',kind:'elephant',x:.5,y:.2,speed:0}]};
 for(let i=0;i<30;i++)a.update(1/60,env);
 assert.equal(a.state,'travel');
 assert.ok(Math.hypot(a.target.x-.5,a.target.y-.2)>.65);
});
