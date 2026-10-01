import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AgentSystem } from '../src/agents';
import { SPACE_CLASSES, SpacecraftAgent, type SpaceEnvironment } from '../src/jungle/agents/spacecraft';
import { jungleAgents } from '../src/jungle/agents';
import { InfiniteWorld } from '../src/jungle/infinite';
import { landingClear, spacecraftCandidate } from '../src/jungle/space-sites';
import { SPACE_KINDS, VISITOR_STRIDE } from '../src/jungle/ecology';
import { bakeSpaceVisitors, spacecraftMesh } from '../scripts/art/space-visitors';
import { bakeMesh } from '../src/iso/bake/rasterize';
import { composeInfinite } from '../src/jungle/infinite-scene';
const dry=(x:number,y:number)=>({water:false,moisture:.5,light:1,wind:1,elevation:0});
const clear:SpaceEnvironment={time:0,sample:dry,canMove:()=>true,canLand:()=>true,nearby:()=>[]};

test('all three crews exit, investigate for 15–30 seconds, board before takeoff and change landing sites',()=>{
  for(const kind of SPACE_KINDS){
    const a=new SPACE_CLASSES[kind]('visitor',-2,-2,71);a.timer=0;
    const phases=new Set<string>(),sites:{x:number;y:number}[]=[];let exploring=0,sawWalk=false,sawInspect=false,lastLandings=0;
    for(let i=0;i<60*520;i++){
      const before=a.state;a.update(1/60,clear);phases.add(a.state);
      if(a.landings>lastLandings){sites.push({x:a.x,y:a.y});lastLandings=a.landings;}
      if(before==='explore')exploring+=1/60;
      if(before==='explore'&&a.state==='board'){assert.ok(exploring>=15&&exploring<=30+1/60);exploring=0;}
      if(a.state==='depart')assert.ok(a.crew.every(c=>c.state==='aboard'&&c.visibility===0));
      for(const c of a.crew){
        sawWalk||=c.speed>0;sawInspect||=c.state==='inspect';
        assert.ok(c.x>-4&&c.x<0&&c.y>-4&&c.y<0,'crew remains in its signed owner chunk');
        assert.ok(Math.hypot(c.x-a.x,c.y-a.y)<1.3);
      }
    }
    assert.ok(sawWalk&&sawInspect);
    for(const phase of ['approach','open','unload','explore','board','close','depart','waiting'])assert.ok(phases.has(phase),`${kind}: ${phase}`);
    assert.ok(sites.length>=2);for(let i=1;i<sites.length;i++)assert.ok(Math.hypot(sites[i]!.x-sites[i-1]!.x,sites[i]!.y-sites[i-1]!.y)>=.4);
  }
});

test('encounters and every prior crew sample continue exactly across registry checkpoints at each phase',()=>{
  for(const kind of SPACE_KINDS){
    const a=new SPACE_CLASSES[kind]('save-me',2,2,13);a.timer=0;const seen=new Set<string>();
    for(let i=0;i<60*90;i++){
      a.update(1/60,clear);if(seen.has(a.state))continue;seen.add(a.state);
      const original=jungleAgents.decode(jungleAgents.encode([a]))[0] as SpacecraftAgent;
      assert.deepEqual(jungleAgents.encode([original]),jungleAgents.encode([a]),'every owned field survives decoding');
      assert.deepEqual(original.presentation(.43),a.presentation(.43));
      assert.deepEqual(original.crew.map(c=>c.presentation(.43)),a.crew.map(c=>c.presentation(.43)));
      for(let j=0;j<10;j++){original.update(1/60,clear);a.update(1/60,clear);}
      assert.deepEqual(jungleAgents.encode([original]),jungleAgents.encode([a]));
    }
    assert.equal(seen.size,8);
    assert.throws(()=>jungleAgents.decode(jungleAgents.encode([a]).slice(0,-1)),/Truncated/);
  }
});

test('clearance rejects canopy, water, slopes and occupied touchdown; blocked explorers keep planted feet',()=>{
  assert.ok(landingClear(-2,-2,dry,[],()=>false));
  assert.equal(landingClear(-2,-2,(x,y)=>({...dry(x,y),water:x<-2.9}),[],()=>false),false);
  assert.equal(landingClear(-2,-2,(x,y)=>({...dry(x,y),elevation:x*10}),[],()=>false),false);
  assert.equal(landingClear(-2,-2,dry,[{x:-.5,y:-2,scale:1}],()=>false),false);
  const a=new SPACE_CLASSES.saucer('abort',2,2,22);a.timer=0;a.update(1/60,clear);
  const occupied={...clear,nearby:()=>[{id:'deer',kind:'deer',x:a.x,y:a.y,speed:0}]};
  for(let i=0;i<600;i++)a.update(1/60,occupied);
  assert.equal(a.landings,0);assert.equal(a.crew.length,0);
  const b=new SPACE_CLASSES.lander('crew',2,2,6);b.timer=0;
  for(let i=0;i<600;i++)b.update(1/60,clear);
  const c=b.crew[0]!;assert.ok(c);c.state='walk';c.targetX=c.x+1;c.targetY=c.y;c.heading=Math.PI;
  const start=[c.x,c.y,c.gait];c.update(1/60,clear);assert.deepEqual([c.x,c.y,c.gait],start);
  c.heading=0;c.update(1/60,{...clear,canMove:()=>false});assert.deepEqual([c.x,c.y,c.gait],start);
  c.update(1/60,clear);assert.ok(Math.abs((c.gait-start[2]!)*VISITOR_STRIDE*c.size-(c.x-start[0]!))<1e-12);
});

test('rare candidates are deterministic and species-local; real encounters sleep and checkpoint as one owner',()=>{
  const kinds=new Set<string>();let count=0;
  for(let y=-40;y<40;y++)for(let x=-40;x<40;x++){
    const kind=spacecraftCandidate(x,y,2718,2.5);assert.equal(kind,spacecraftCandidate(x,y,2718,2.5));
    assert.equal(spacecraftCandidate(x,y,2718,0),undefined);if(kind){count++;kinds.add(kind);}
  }
  assert.equal(kinds.size,3);assert.ok(count>60&&count<220,`rare candidates: ${count}/6400`);
  const w=new InfiniteWorld(2718),location=w.spacecraftLandmark();assert.ok(location,'real default world has landable encounters');
  assert.equal(w.cache.size,0,'landmark search does not retain probe chunks');
  const bounds={minX:location.x-3,minY:location.y-3,maxX:location.x+3,maxY:location.y+3};w.ensure(bounds);
  const ship=w.agents.find(a=>a instanceof SpacecraftAgent) as SpacecraftAgent;assert.ok(ship);assert.ok(w.canLand(ship.x,ship.y));ship.timer=0;
  for(let i=0;i<60*25;i++)w.update(1/60);
  const saved=jungleAgents.encode([ship]);
  w.ensure({minX:location.x+16,minY:location.y,maxX:location.x+20,maxY:location.y+4});
  w.ensure(bounds);const resumed=w.agents.find(a=>a.id===ship.id)!;assert.deepEqual(jungleAgents.encode([resumed]),saved);
  const copy=InfiniteWorld.restore(w.checkpoint());copy.ensure(bounds);
  for(let i=0;i<120;i++){w.update(1/60);copy.update(1/60);}
  assert.deepEqual(jungleAgents.encode(w.agents),jungleAgents.encode(copy.agents));
});

test('visitor rigs keep transparent margins, fit the shared atlas and compose registered crew sprites',async()=>{
  const baked=bakeSpaceVisitors();
  for(const kind of SPACE_KINDS)for(let d=0;d<8;d++){
    const base=baked.find(s=>s.id===`ship-${kind}-${d}`)!,hatch=baked.find(s=>s.id===`ship-${kind}-hatch-${d}`)!;
    const image=base.frames[0]!,delta=hatch.frames[0]!,combined=image.data.slice();
    for(let i=0;i<combined.length;i+=4)if(delta.data[i+3])combined.set(delta.data.subarray(i,i+4),i);
    const full=bakeMesh(spacecraftMesh(kind,true),d/8*Math.PI*2,{width:image.width,height:image.height,anchor:base.anchor,scale:18});
    assert.deepEqual(combined,full.data,'shared hull plus hatch reproduces the complete baked pose exactly');
  }
  for(const sprite of baked)for(const frame of sprite.frames){
    const alpha=(x:number,y:number)=>frame.data[(y*frame.width+x)*4+3];
    for(let x=0;x<frame.width;x++)assert.ok(!alpha(x,0)&&!alpha(x,frame.height-1),sprite.id);
    for(let y=0;y<frame.height;y++)assert.ok(!alpha(0,y)&&!alpha(frame.width-1,y),sprite.id);
  }
  const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
  assert.ok(atlas.width*atlas.height*4<=64*1024*1024);
  const derived=JSON.parse(await readFile('assets/derived.json','utf8'));
  for(const path of ['scripts/art/space-visitors.ts','src/jungle/agents/spacecraft.ts','assets/source/space-visitors-reference.png'])assert.ok(derived.sources[path]);
  const w=new InfiniteWorld(3,'rainforest',undefined,{plants:0,water:0,animals:0,hills:0});w.ensure({minX:-4,minY:-4,maxX:8,maxY:8});
  const a=new SPACE_CLASSES.scout('scene',2,2,8);a.timer=0;w.agents.push(a);
  for(let i=0;i<60*20;i++)a.update(1/60,clear);
  const frame=composeInfinite(w,atlas,{width:700,height:500,pixelRatio:1,zoom:2,grid:false,cameraX:a.x,cameraY:a.y},.4);
  assert.ok(frame.commands.some(c=>c.id===a.id));assert.ok(frame.commands.filter(c=>c.id.startsWith('scene:crew:')&&!c.id.endsWith('shadow')).length>=4);
  const system=new AgentSystem(),other=new SPACE_CLASSES.saucer('other',-2,-2,9);other.timer=0;
  const first=[a,other],second=jungleAgents.decode(jungleAgents.encode(first)).reverse();
  for(let i=0;i<30;i++){system.step(first,1/60,clear);system.step(second,1/60,clear);}
  assert.deepEqual(jungleAgents.encode(first),jungleAgents.encode(second.reverse()));
});

test('a natural clearing with wildlife at its outer margin completes a full visit',()=>{
  const w=new InfiniteWorld(2718);
  w.ensure({minX:38,minY:-37,maxX:54,maxY:-21});
  const ship=w.agents.find(a=>a.id==='ship:11:-8') as SpacecraftAgent;assert.ok(ship);
  const seen=new Set<string>();
  for(let i=0;i<60*90;i++){w.update(1/60);seen.add(ship.state);}
  assert.ok(seen.has('explore')&&seen.has('board')&&seen.has('depart'));
  assert.equal(ship.landings,1);assert.equal(ship.state,'waiting');assert.equal(ship.crew.length,0);
});
