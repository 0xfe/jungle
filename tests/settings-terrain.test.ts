import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings,DEFAULT_SETTINGS} from '../src/jungle/settings';
import {TerrainChunk,TerrainKind,landscape,interpolatedFields,fieldKind} from '../src/jungle/terrain';
import {InfiniteWorld} from '../src/jungle/infinite';
import {clipField} from '../src/iso/contour';
import {quadUV} from '../src/iso/quad';
import {MemoryRenderer, type DrawCommand} from '../src/iso/render';
import {writeQuads} from '../src/iso/batch';

test('default landscape strongly favors jungle and controls alter coverage and feature scale',()=>{
 const counts=(settings=DEFAULT_SETTINGS)=>{const c=[0,0,0,0,0,0];for(let y=-150;y<150;y+=2)for(let x=-150;x<150;x+=2)c[landscape(x,y,2718,settings).kind]!++;return c;};
 const normal=counts(),wet=counts(normalizeSettings({water:.8})),dry=counts(normalizeSettings({barren:.8})),allForest=counts(normalizeSettings({water:0,barren:0,meadow:0,hills:0}));
 assert.ok(normal[0]!/22500>.75);assert.ok((normal[4]!+normal[5]!)/22500<.16);assert.ok(normal[2]!/22500<.08);
 assert.ok(wet[4]!+wet[5]!>(normal[4]!+normal[5]!)*2);assert.ok(dry[2]!>normal[2]!*2);assert.equal(allForest[0],22500);
 const transitions=(size:number)=>{let changes=0;for(let y=-80;y<80;y+=3){let previous=false;for(let x=-100;x<100;x+=.5){const water=landscape(x,y,19,normalizeSettings({water:.5,waterSize:size})).water;changes+=Number(water!==previous);previous=water;}}return changes;};
 assert.ok(transitions(0)>transitions(1)*1.4,'small lakes should create more frequent shorter water intervals');
});

test('terrain interpolation shares all fields across signed chunk seams and matches habitat classification',()=>{
 const a=TerrainChunk.generate(-1,-1,31),b=TerrainChunk.generate(0,-1,31);
 for(let y=0;y<4;y++)for(let t=0;t<=1;t+=.125){const left=a.tile(3,y),right=b.tile(0,y),wy=-4+y+t;
  const l=left.fieldsAt(0,wy),r=right.fieldsAt(0,wy);l.forEach((v,j)=>assert.ok(Math.abs(v-r[j]!)<1e-8));
 }
 for(let y=-3.9;y<-.1;y+=.19)for(let x=-3.9;x<-.1;x+=.17){const t=a.tile(Math.floor(x)+4,Math.floor(y)+4);assert.equal(t.materialAt(x,y),fieldKind(interpolatedFields(x,y,31)));}
});

test('contour crossings retain texture registration in memory and GPU triangles',()=>{
 const poly=[{x:0,y:0,fields:[-1]},{x:1,y:0,fields:[1]},{x:0,y:1,fields:[-1]}];
 const clipped=clipField(poly,0,0,true);assert.ok(clipped.some(v=>v.x===.5));
 const corners=[{x:0,y:0},{x:8,y:0},{x:0,y:8},{x:0,y:8}] as const;
 const uvCorners=[{x:.5,y:0},{x:1,y:0},{x:.5,y:1},{x:.5,y:1}] as const;
 const command:DrawCommand={id:'contour',x:0,y:0,width:8,height:8,corners,uvCorners,layer:0,depth:0,color:[255,255,255,255],region:{x:0,y:0,width:4,height:4}};
 const uv=quadUV(corners,2,2,uvCorners)!;assert.equal(uv.u,.625);assert.equal(uv.v,.25);
 const pixels=new Uint8Array(64);for(let i=0;i<16;i++)pixels.set([i*10,0,0,255],i*4);
 const renderer=new MemoryRenderer({width:4,height:4,data:pixels});renderer.render({width:8,height:8,clear:[0,0,0,255],commands:[command]});assert.equal(renderer.pixels.data[(2*8+2)*4],60);assert.equal(renderer.pixels.data[(7*8+7)*4],0);
 const buffer=new Float32Array(48);writeQuads([command],4,4,buffer);assert.equal(buffer[2],.5);assert.equal(buffer[10],1);
});

test('world settings clamp inputs, remove populations, increase default life and survive checkpoints',()=>{
 assert.equal(normalizeSettings({animals:100,water:NaN,plants:-1}).animals,5);assert.equal(normalizeSettings({plants:-1}).plants,0);
 const bounds={minX:-12,minY:-12,maxX:12,maxY:12};
 const low=new InfiniteWorld(2718,'rainforest',undefined,{animals:1}),high=new InfiniteWorld(),empty=new InfiniteWorld(2718,'rainforest',undefined,{animals:0,plants:0});
 for(const w of [low,high,empty])w.ensure(bounds);
 assert.ok(high.stats.animals>low.stats.animals*1.7);assert.equal(empty.stats.animals,0);const generated=empty.generated;assert.deepEqual(empty.wildlifeLandmark('monkey'),{x:0,y:0});assert.equal(empty.generated,generated);assert.ok(empty.agents.every(a=>!['tree','bush'].includes(a.kind)));
 const restored=InfiniteWorld.restore(empty.checkpoint());assert.deepEqual(restored.settings,empty.settings);restored.ensure(bounds);assert.equal(restored.stats.animals,0);
 const old=empty.checkpoint();old[4]=3;assert.throws(()=>InfiniteWorld.restore(old),/Unsupported/);
});
