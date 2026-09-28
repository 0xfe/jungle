import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { scatterCell } from '../src/iso/distribution';
import { rootedQuad } from '../src/iso/sprite-geometry';
import { quadUV } from '../src/iso/quad';
import { plantAppearance, TREE_FORMS, PLANT_FORMS } from '../src/jungle/botany';
import { InfiniteWorld } from '../src/jungle/infinite';
import { PlantAgent, jungleAgents } from '../src/jungle/agents';
import { isolatePlant } from '../scripts/art/foliage';
import { vineFrames } from '../scripts/art/vines';

test('scatter has a cross-boundary exclusion radius and no cell-edge planting band',()=>{
 const points=[];for(let y=-4;y<4;y++)for(let x=-4;x<4;x++){
  const p=scatterCell(x,y,2718);assert.deepEqual(scatterCell(x,y,2718),p);
  for(const a of p){assert.ok(a.x>=x&&a.x<x+1&&a.y>=y&&a.y<y+1);points.push(a);}
 }
 assert.ok(points.length>50);assert.ok(points.some(p=>p.x-Math.floor(p.x)<.06));
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)assert.ok(Math.hypot(points[i]!.x-points[j]!.x,points[i]!.y-points[j]!.y)>=.44-1e-10);
 assert.throws(()=>scatterCell(0,0,1,2),/spacing/);
});

test('plant geometry preserves asymmetric roots through mirroring, lean and scale',()=>{
 for(const mirror of [false,true])for(const lean of [-.06,0,.06]){
  const root={x:200,y:150},c=rootedQuad(root,70,100,[24,96],1.3,.9,lean,mirror);
  const uv=quadUV(c,root.x,root.y)!;
  assert.ok(Math.abs(uv.u-(mirror?46:24)/70)<1e-10);assert.ok(Math.abs(uv.v-.96)<1e-10);
  assert.ok(Math.abs(c[0].x+c[3].x-c[1].x-c[2].x)<1e-10);
 }
 for(let gene=0;gene<65536;gene+=73){const a=plantAppearance(gene);assert.ok(Math.abs(a.lean)<.018);assert.ok(a.width>=.88&&a.width<=1.12);}
});

test('forest individuals vary within stands and retain exact appearance after sleeping/checkpoints',()=>{
 const w=new InfiniteWorld(2718),bounds={minX:-4,minY:-4,maxX:4,maxY:4};w.ensure(bounds);
 const plants=w.agents.filter((a):a is PlantAgent=>a instanceof PlantAgent),trees=plants.filter(a=>a.kind==='tree');
 assert.ok(trees.length>15);
 assert.ok(new Set(trees.map(a=>a.morphology)).size>=5);
 assert.ok(new Set(trees.map(a=>a.scale.toFixed(2))).size>15);
 assert.ok(plants.some(a=>a.kind==='plant'&&a.morphology>0));
 const original=jungleAgents.encode(plants),copy=jungleAgents.decode(original) as PlantAgent[];
 assert.deepEqual(copy.map(a=>a.appearance),plants.map(a=>a.appearance));
 assert.deepEqual(jungleAgents.encode(copy),original);
 w.update(1/60);const saved=w.checkpoint(),restored=InfiniteWorld.restore(saved);restored.ensure(bounds);
 for(let i=0;i<60;i++){w.update(1/60);restored.update(1/60);}
 assert.deepEqual(jungleAgents.encode(w.agents),jungleAgents.encode(restored.agents));
 const a=new InfiniteWorld(2718),b=new InfiniteWorld(2718);
 a.ensure({minX:-4,minY:-4,maxX:-.1,maxY:-.1});b.ensure({minX:4,minY:4,maxX:7.9,maxY:7.9});b.ensure({minX:-4,minY:-4,maxX:-.1,maxY:-.1});
 assert.deepEqual(jungleAgents.encode(a.agents),jungleAgents.encode(b.agents));
});

test('all botanical forms are present inside the shared atlas budget; vines pin their attachment',async()=>{
 const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
 for(const [kind,counts] of [['tree',TREE_FORMS],['plant',PLANT_FORMS]] as const)
  for(let species=0;species<4;species++)for(let form=0;form<counts[species]!;form++)assert.ok(atlas.sprites[`${kind}-${species}${form?`-form-${form}`:''}`]);
 assert.ok(atlas.stats.rgbaBytes<=64*1048576);
 for(let v=0;v<4;v++){
  const frames=vineFrames(v),first=frames[0]!;
  for(const f of frames){
   assert.deepEqual(f.data.slice(0,18*32*4),first.data.slice(0,18*32*4));
   for(let y=0;y<88;y++)assert.equal(f.data[y*32*4+3]!+f.data[(y*32+31)*4+3]!,0);
  }
 }
});


test('source isolation removes a neighboring sprite fragment without moving the plant root',()=>{
 const image={width:24,height:24,data:new Uint8Array(24*24*4)};
 for(let y=3;y<22;y++)for(let x=10;x<14;x++)image.data.set([40,100,50,255],(y*24+x)*4);
 image.data.set([40,100,50,255],(4*24+1)*4);
 const clean=isolatePlant(image);
 assert.equal(clean.data[(4*24+1)*4+3],0);
 assert.deepEqual(clean.data.slice((21*24+10)*4,(21*24+14)*4),image.data.slice((21*24+10)*4,(21*24+14)*4));
 assert.equal(image.data[(4*24+1)*4+3],255);
});
