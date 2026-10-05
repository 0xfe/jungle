import test from 'node:test';
import assert from 'node:assert/strict';
import { stationarySpritePieces,spritePieces } from '../scripts/art/sprite-pieces';
import { ecologyMesh } from '../scripts/art/ecology-model';
import { bakeMesh } from '../src/iso/bake/rasterize';
import { packAtlas,trimClip } from '../src/iso/bake/atlas';
import { MemoryRenderer,spriteRegion,type DrawCommand } from '../src/iso/render';

test('static and animated layers reconstruct pixels exactly, including fractional display scales',()=>{
 let oldPieces=0,newPieces=0;const pool=new Map();
 for(const [kind,clip] of [['wolf','groom'],['elephant','feed'],['blackBear','settleRun3'],['bison','graze']] as const){
  const camera={width:112,height:112,anchor:[56,87] as [number,number],scale:24};
  const source=trimClip({id:kind,anchor:camera.anchor,frames:Array.from({length:16},(_,i)=>bakeMesh(ecologyMesh(kind,clip,i/15),Math.PI*.625,camera))});
  const pieces=stationarySpritePieces(source,3,pool);oldPieces+=spritePieces(source,3).length;newPieces+=pieces.length;
  const packed=packAtlas([source,...pieces],1024,1024),renderer=new MemoryRenderer(packed.image);
  for(let frame=0;frame<16;frame++)for(const scale of [1,1.65,2.025]){
   const commands=(names:string[]):DrawCommand[]=>names.map(id=>{const s=packed.manifest.sprites[id]!;return{id,layer:1,depth:0,x:135.17-s.anchor[0]*scale,y:235.13-s.anchor[1]*scale,width:s.width*scale,height:s.height*scale,region:spriteRegion(s,frame),color:[255,255,255,255]};});
   renderer.render({width:300,height:280,clear:[214,230,205,255],commands:commands([kind])});const expected=renderer.pixels.data.slice();
   renderer.render({width:300,height:280,clear:[214,230,205,255],commands:commands(pieces.map(p=>p.id))});assert.deepEqual(renderer.pixels.data,expected,`${kind}/${frame}/${scale}`);
  }
 }
 assert.ok(newPieces<oldPieces*.8,`${oldPieces} → ${newPieces} pieces`);
});
