import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {jungleSound} from '../src/jungle/sound';
import {CONFIG} from '../src/config';
import {InfiniteWorld} from '../src/jungle/infinite';
import {LandscapePatchAgent,PlantAgent,jungleAgents} from '../src/jungle/agents';
import {PATCH_KINDS,isGrove,schoolWater,patchRoots,planArrangement} from '../src/jungle/patches';
import {composeInfinite,cameraBounds} from '../src/jungle/infinite-scene';
import {mobileDevice} from '../src/platform';
import {PointerNavigation} from '../src/iso/navigation';

test('ordinary pointer presses do not navigate; drags and pinch do, including held drags',()=>{
 const p=new PointerNavigation();p.begin(1,{x:10,y:10});assert.equal(p.navigating,false);
 assert.equal(p.move(1,{x:10,y:10}),undefined);assert.equal(p.move(1,{x:11,y:10}),undefined);assert.equal(p.navigating,false);
 p.end(1);assert.equal(p.navigating,false);
 p.begin(1,{x:10,y:10});p.move(1,{x:20,y:10});assert.equal(p.navigating,true);
 p.begin(2,{x:30,y:10});assert.equal(p.move(2,{x:40,y:10})!.zoomRatio,2);
 p.end(2);assert.equal(p.navigating,true);p.end(1);assert.equal(p.navigating,false);
 p.begin(1,{x:5,y:5});assert.equal(p.navigating,false);
});
test('mobile sound defaults identify touch-first phones and desktop-UA iPads without using viewport width',()=>{
 assert.equal(CONFIG.audio.mobileEnabled,true);
 for(const [ua,touch,coarse] of [['iPhone',1,false],['Android',5,true],['Macintosh',5,false],['Windows',1,true]] as const)assert.equal(mobileDevice(ua,touch,coarse),true);
 assert.equal(mobileDevice('Macintosh',0,false),false);assert.equal(mobileDevice('Windows',1,false),false);
});
test('fish avoid small ponds but can form schools in substantial water',()=>{
 assert.equal(schoolWater(-4,-4,(x,y)=>Math.hypot(x+4,y+4)<1.5),false);
 assert.equal(schoolWater(-4,-4,(x,y)=>Math.hypot(x+4,y+4)<4),true);
 assert.equal(schoolWater(0,0,()=>false),false);
});
test('multi-tile groups reduce plant clocks and retain deterministic static trunk clearance',()=>{
 const bounds={minX:-48,minY:-12,maxX:-28,maxY:8},settings={water:0,animals:0,barren:0,meadow:0};
 const w=new InfiniteWorld(2718,'rainforest',undefined,settings);w.ensure(bounds);
 const patches=w.agents.filter((a):a is LandscapePatchAgent=>a instanceof LandscapePatchAgent);assert.ok(patches.length>25);
 assert.ok(jungleSound(w,patches[0]!.x,patches[0]!.y).canopy>0);
 const trees=w.agents.flatMap(a=>a instanceof PlantAgent&&a.kind==='tree'?[a]:a instanceof LandscapePatchAgent?[...a.supports]:[]);
 for(let i=0;i<trees.length;i++){
  assert.equal(w.canMove(trees[i]!.x,trees[i]!.y),false);
  for(let j=i+1;j<trees.length;j++)assert.ok(Math.hypot(trees[i]!.x-trees[j]!.x,trees[i]!.y-trees[j]!.y)>=.44-1e-9,`${JSON.stringify(trees[i])} / ${JSON.stringify(trees[j])}`);
 }
 assert.ok(!w.agents.some(a=>a instanceof PlantAgent||a.kind==='water'));
 const components=patches.reduce((n,a)=>n+a.pieces.length,0);assert.ok(components>patches.length*5);
 assert.ok(patches.every(a=>a.pieces.length<=64));
 const other=new InfiniteWorld(2718,'rainforest',undefined,settings);other.ensure({minX:40,minY:40,maxX:44,maxY:44});other.ensure(bounds);
 assert.deepEqual(jungleAgents.encode(w.agents),jungleAgents.encode(other.agents));
});
test('group animation and vector templates continue exactly through checkpoints',()=>{
 const w=new InfiniteWorld(2718),bounds={minX:-36,minY:-12,maxX:-24,maxY:0};w.ensure(bounds);
 for(let i=0;i<17;i++)w.update(1/60);
 const restored=InfiniteWorld.restore(w.checkpoint());restored.ensure(bounds);
 for(let i=0;i<120;i++){w.update(1/60);restored.update(1/60);}
 assert.deepEqual(jungleAgents.encode(w.agents),jungleAgents.encode(restored.agents));
 assert.deepEqual(w.agents.filter(a=>a instanceof LandscapePatchAgent),restored.agents.filter(a=>a instanceof LandscapePatchAgent));
});
test('shared masked groups cover every structural variant, keep atlas limits and sort trunks at their own depth',async()=>{
 const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
 assert.ok(atlas.stats.rgbaBytes<=64*1048576);
 for(const kind of PATCH_KINDS)for(let v=0;v<4;v++)assert.ok(atlas.sprites[`patch-${kind}-${v}-0-leaves`]);
 const w=new InfiniteWorld(),view={width:1000,height:700,pixelRatio:1,zoom:1,grid:false,cameraX:-30,cameraY:-8};w.ensure(cameraBounds(view));
 const group=w.agents.find(a=>a instanceof LandscapePatchAgent&&a.pieces.some(p=>p.style==='grove'&&p.trees===7)) as LandscapePatchAgent;assert.ok(group);
 const index=group.pieces.findIndex(p=>p.style==='grove'&&p.trees===7),piece=group.pieces[index]!;
 view.cameraX=piece.x;view.cameraY=piece.y;
 const frame=composeInfinite(w,atlas,view),parts=frame.commands.filter(c=>c.id.startsWith(`${group.id}:`));
 for(let i=0;i<3;i++){const root=patchRoots(piece.variant)[i]!;assert.ok(Math.abs(parts.find(c=>c.id===`${group.id}:${index}:grove:${i}:leaves`)!.depth-(piece.x+root.x*piece.scale+piece.y+root.y*piece.scale))<1e-9);}
 const deps=JSON.parse(await readFile('assets/derived.json','utf8')).sources;
 for(const path of ['scripts/art/black-bear-model.ts','src/jungle/agents/black-bear.ts','src/jungle/regions.ts','assets/source/landscape-color-groves.png','assets/source/landscape-color-ground.png','assets/variety-prompts.json','scripts/art/landscape-patches.ts','src/jungle/patches.ts','assets/source/landscape-groves.png','assets/source/landscape-ground.png'])assert.ok(deps[path]);
});

test('arrangements join across ownership borders and use correlated, non-grid footprints',()=>{
 const w=new InfiniteWorld(71,'rainforest',undefined,{water:0,animals:0});w.ensure({minX:-24,minY:-24,maxX:0,maxY:0});
 const groups=w.agents.filter((a):a is LandscapePatchAgent=>a instanceof LandscapePatchAgent),pieces=groups.flatMap(a=>[...a.pieces]);
 assert.ok(groups.length>10);assert.ok(groups.every(a=>a.pieces.length>4));
 // Local spacing bridges original isolated stamps; offsets fill the ownership border,
 // rather than leaving an empty planting band at 4-tile or 2-tile seams.
 const edges=pieces.filter(p=>Math.min(((p.x%4)+4)%4,4-((p.x%4)+4)%4)<.18);
 assert.ok(edges.length>10);
 assert.ok(pieces.filter(p=>p.style!=='water').every(p=>pieces.some(q=>q!==p&&Math.hypot(q.x-p.x,q.y-p.y)<2.1)));
 assert.ok(new Set(pieces.map(p=>Math.round((p.x-Math.floor(p.x))*20))).size>16);
 const ordered=new InfiniteWorld(71,'rainforest',undefined,{water:0,animals:0});
 ordered.ensure({minX:0,minY:0,maxX:4,maxY:4});ordered.ensure({minX:-24,minY:-24,maxX:0,maxY:0});
 assert.deepEqual(jungleAgents.encode(w.agents.slice().sort((a,b)=>a.id.localeCompare(b.id))),jungleAgents.encode(ordered.agents.slice().sort((a,b)=>a.id.localeCompare(b.id))));
});

test('mature forest keeps dense stands alongside occasional grassy clearings',()=>{
 for(const seed of [71,2718,2026]){
  const settings=new InfiniteWorld(seed).settings;
  let groves=0,grass=0,total=0,denseChunks=0;
  // Uniform mature habitat isolates glades from shore, climate and the opening.
  for(let cy=-12;cy<-4;cy++)for(let cx=-12;cx<-4;cx++){
   const pieces=planArrangement(cx,cy,seed,settings,{x:0,y:0},()=>({fields:[1,0,-1,-1],height:0}));
   const dense=pieces.filter(p=>isGrove(p.style)).length;
   groves+=dense;grass+=pieces.filter(p=>p.style==='grass'||p.style==='flowers').length;total+=pieces.length;
   if(dense>=pieces.length*.8)denseChunks++;
  }
  assert.ok(groves/total>.3,'retain substantial forest within mixed mature regions');
  assert.ok(grass/total>.08&&grass/total<.5,'leave visible, occasional glades');
  assert.ok(denseChunks>8,'keep many densely wooded stretches');
 }
});

test('compound wind moves between simulation ticks with fixed, registered trunk feet',async()=>{
 const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
 const w=new InfiniteWorld(2718),view={width:1000,height:700,pixelRatio:1,zoom:1,grid:false,cameraX:-30,cameraY:-8};w.ensure(cameraBounds(view));
 const group=w.agents.find(a=>a instanceof LandscapePatchAgent&&a.pieces.some(p=>p.style==='grove'&&p.trees===7)) as LandscapePatchAgent;
 const index=group.pieces.findIndex(p=>p.style==='grove'&&p.trees===7),piece=group.pieces[index]!;
 view.cameraX=piece.x;view.cameraY=piece.y;
 // Straddle the old half-second pose boundary; the atlas region must stay fixed.
 group.previousPhase=.5-piece.phase-1/120;group.phase=group.previousPhase+1/60;
 const saved=jungleAgents.encode(w.agents),feet=new Map<string,{x:number;y:number}>(),tops:number[]=[];
 for(const alpha of [0,.25,.5,.75,1]){
  const frame=composeInfinite(w,atlas,view,alpha);
  for(let part=0;part<3;part++)for(const mask of ['base','leaves']){
   const id=`${group.id}:${index}:grove:${part}:${mask}`;
   const bands=frame.commands.filter(c=>c.id===id||c.id.startsWith(`${id}:wind`));
   const c=bands.reduce((a,b)=>a.region!.y>b.region!.y?a:b);
   const s=atlas.sprites[`patch-grove-${piece.variant}-${part}-${mask}`],root=patchRoots(piece.variant)[part]!;
   const u=(s.anchor[0]+(root.x-root.y)*96)/s.width;
   const row=(s.anchor[1]+(root.x+root.y)*48)*s.frames[0].height/s.height;
   const v=(row-(c.region!.y-s.frames[0].y))/c.region!.height;
   const q=c.corners!;assert.ok(q);
   const foot={x:q[0].x+u*(q[1].x-q[0].x)+v*(q[2].x-q[0].x),y:q[0].y+u*(q[1].y-q[0].y)+v*(q[2].y-q[0].y)};
   const old=feet.get(`${part}`);if(old){assert.ok(Math.abs(old.x-foot.x)<1e-9);assert.ok(Math.abs(old.y-foot.y)<1e-9);}else feet.set(`${part}`,foot);
   assert.equal(bands.reduce((sum,b)=>sum+b.region!.height,0),s.frames[0].height);
   if(part===0&&mask==='leaves')tops.push(bands[0]!.corners![0].x);
  }
 }
 assert.equal(new Set(tops).size,5,'presentation must change between fixed ticks');
 for(let i=1;i<tops.length;i++)assert.ok(Math.abs(tops[i]!-tops[i-1]!)<.1,'no discrete multi-pixel pose jumps');
 assert.deepEqual(jungleAgents.encode(w.agents),saved,'drawing never changes simulation or RNG');
});
