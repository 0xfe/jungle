import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AnimationBudget } from '../src/iso/animation-budget';
import { crownBands, rustleWeight } from '../src/jungle/landscape-wind';
import { rootedQuad } from '../src/iso/sprite-geometry';
import type { DrawCommand } from '../src/iso/render';
import { InfiniteWorld } from '../src/jungle/infinite';
import { LandscapePatchAgent, jungleAgents } from '../src/jungle/agents';
import { composeInfinite } from '../src/jungle/infinite-scene';
import { PATCH_KINDS, isGrove } from '../src/jungle/patches';

test('crown bands keep roots and mask registration, contiguous UVs and affine Canvas geometry', () => {
  const make = (height: number, anchor: number): DrawCommand => ({
    id: 'tree', x: 0, y: 0, width: 100, height, layer: 2, depth: 0, color: [255,255,255,255],
    region: {x: 2, y: 2, width: 100, height}, corners: rootedQuad({x: 100,y: 200},100,height,[50,anchor],1,1,.02),
  });
  const full = crownBands(make(180,160),160,180,1,2), cropped = crownBands(make(110,140),140,110,1,2);
  const at = (bands: DrawCommand[], anchor: number, height: number) => {
    const row = anchor-height;
    const c = bands.find(c=>row>=c.region!.y-2&&row<=c.region!.y-2+c.region!.height)!;
    const t=(row-c.region!.y+2)/c.region!.height,q=c.corners!;
    return {x:q[0].x+(q[2].x-q[0].x)*t,y:q[0].y+(q[2].y-q[0].y)*t};
  };
  assert.deepEqual(at(full,160,0),{x:50,y:200});
  for(const h of [32,48,64,96,112,130])assert.deepEqual(at(full,160,h),at(cropped,140,h));
  for(const bands of [full,cropped])for(let i=0;i<bands.length;i++){
    const c=bands[i]!,q=c.corners!;
    assert.ok(Math.abs(q[0].x+q[3].x-q[1].x-q[2].x)<1e-10);
    if(i){const previous=bands[i-1]!;assert.equal(previous.region!.y+previous.region!.height,c.region!.y);assert.deepEqual(previous.corners![2],q[0]);}
  }
});

test('all landscape foliage moves, flower heads follow stems, and ground soil stays fixed', async () => {
  const atlas=JSON.parse(await readFile('public/assets/jungle.json','utf8'));
  const world=new InfiniteWorld(2718),view={width:900,height:700,pixelRatio:1,zoom:1,grid:false,cameraX:0,cameraY:0};
  for(const style of PATCH_KINDS){
    const patch=new LandscapePatchAgent('wind',0,0,[{style,variant:0,tint:0,trees:isGrove(style)?7:0,x:0,y:0,scale:1,opacity:1,phase:0}]);
    world.agents=[patch];patch.previousPhase=patch.phase=.2;
    const before=composeInfinite(world,atlas,view,1,0);
    patch.previousPhase=patch.phase=1.2;
    const state=jungleAgents.encode(world.agents),after=composeInfinite(world,atlas,view,1,0);
    const id=`wind:0:${style}:0:`,get=(frame:typeof before,mask:string)=>frame.commands.find(c=>c.id===id+mask)!;
    assert.notDeepEqual(get(before,'leaves').corners,get(after,'leaves').corners,`${style} must stay lively even at minimum detail`);
    if(['grass','flowers','mud'].includes(style))assert.deepEqual(get(before,'base'),get(after,'base'),'soil remains stationary');
    if(style==='flowers'){
      assert.notDeepEqual(get(before,'petals').corners,get(after,'petals').corners);
      assert.deepEqual(get(after,'petals').color,[255,255,255,255]);
      const skirt=after.commands.find(c=>c.id==='wind:0:grass:0:leaves')!;
      assert.ok(skirt.layer<get(after,'petals').layer,'grass skirts must not paint over flowers');
    }
    assert.deepEqual(jungleAgents.encode(world.agents),state);
    assert.deepEqual(after,composeInfinite(world,atlas,view,1,0),'pause redraw holds every motion');
  }
});

test('animation detail responds gradually to sustained CPU load and recovers without stopping the breeze', () => {
  const budget=new AnimationBudget({targetMs:14,minimum:.3,responseSeconds:1.5});
  budget.record(200,1/60);assert.ok(budget.detail>.99,'one streaming spike must not drop quality');
  for(let i=0;i<600;i++)budget.record(40,1/60);
  assert.ok(budget.detail>=.3&&budget.detail<.32);
  const low=budget.detail;
  for(let i=0;i<900;i++)budget.record(5,1/60);
  assert.ok(budget.detail>.99&&budget.detail>low);
  const saved=budget.detail;budget.record(NaN,1/60);budget.record(50,0);assert.equal(budget.detail,saved);
  assert.ok(rustleWeight(.02,.45,.3)>0,'retain some local rustling under load');
  assert.equal(rustleWeight(.9,.45,1),0);
  assert.ok(Math.abs(rustleWeight(.2,.45,.7)-rustleWeight(.2,.45,.701))<.01);
});
