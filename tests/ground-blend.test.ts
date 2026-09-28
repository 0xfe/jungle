import test from 'node:test';
import assert from 'node:assert/strict';
import { groundBlend, groundVegetation } from '../src/jungle/ground-blend';
import { TerrainChunk } from '../src/jungle/terrain';
import { readFile } from 'node:fs/promises';
import { InfiniteWorld } from '../src/jungle/infinite';
import { composeInfinite } from '../src/jungle/infinite-scene';
import type { AtlasManifest } from '../src/jungle/scene';

test('ground grades continuously through water, sand, dry grass and jungle; plants thin with it',()=>{
  let color=0,cover=0;
  for(let i=0;i<=1000;i++){
    const fields=[-.15+i*.0004,0,-1,-1],next=groundBlend(fields,3,-4,2718),vegetation=groundVegetation(fields);
    assert.ok(next>=color-1e-10);assert.ok(next-color<.08);assert.ok(vegetation>=cover-1e-10);
    color=next;cover=vegetation;
  }
  assert.equal(color,4);assert.equal(cover,1);
  for(const threshold of [-.10,-.025,-.018,0,.016,.105])assert.ok(Math.abs(groundBlend([threshold-1e-7,0,-1,-1],0,0,1)-groundBlend([threshold+1e-7,0,-1,-1],0,0,1))<.0001);
  assert.ok(groundVegetation([.2,0,.1,-1])<.1);assert.ok(groundVegetation([.2,0,-1,.1])<.3);
});

test('paired contour quads cover every complete tile exactly once with registered UVs',async()=>{
  const atlas:AtlasManifest=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
  const world=new InfiniteWorld(42,'rainforest',undefined,{water:.6,plants:0,animals:0});
  world.ensure({minX:-2,minY:-2,maxX:1,maxY:1});
  const frame=composeInfinite(world,atlas,{width:2200,height:1600,pixelRatio:1,zoom:1,grid:false,cameraX:0,cameraY:0});
  const area=(a:{x:number;y:number},b:{x:number;y:number},c:{x:number;y:number})=>Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/2;
  let paired=0;
  for(const tile of world.tiles){
    const commands=frame.commands.filter(c=>c.id.startsWith(`tile-${tile.x}-${tile.y}-`));
    let sum=0;
    for(const command of commands){
      const uv=command.uvCorners??[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}];
      const second=area(uv[2]!,uv[1]!,uv[3]!);
      sum+=area(uv[0]!,uv[1]!,uv[2]!)+second;
      if(command.uvCorners&&second>1e-10)paired++;
      assert.ok(uv.every(p=>p.x>=-1e-10&&p.y>=-1e-10&&p.x<=1+1e-10&&p.y<=1+1e-10));
    }
    assert.ok(Math.abs(sum-1)<1e-9,`${tile.x},${tile.y}: covered area ${sum}`);
  }
  assert.ok(paired>20);
});

test('terrain gradients and thinning agree at positive and negative chunk borders',()=>{
  for(const cx of [-2,-1,0,1])for(const cy of [-2,0,2]){
    const a=TerrainChunk.generate(cx,cy,42),b=TerrainChunk.generate(cx+1,cy,42),x=(cx+1)*4;
    for(let i=0;i<8;i++){
      const y=cy*4+i*.5,left=a.tile(3,Math.min(3,Math.floor(i/2))),right=b.tile(0,Math.min(3,Math.floor(i/2)));
      const f=left.fieldsAt(x,y),g=right.fieldsAt(x,y);
      assert.equal(groundBlend(f,x,y,42),groundBlend(g,x,y,42));assert.equal(groundVegetation(f),groundVegetation(g));
    }
  }
});
