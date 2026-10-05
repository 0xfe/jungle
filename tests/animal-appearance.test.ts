import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ANIMAL_FORMS,animalForm,animalForms } from '../src/jungle/animal-appearance';
import { ECO_SPECS,type EcoKind } from '../src/jungle/ecology';
import { deerMesh } from '../scripts/art/deer-model';
import { wildlifeMesh } from '../scripts/art/wildlife-model';
import { ecologyMesh } from '../scripts/art/ecology-model';
import { zenMesh } from '../scripts/art/zen';
import { bakeMesh } from '../src/iso/bake/rasterize';
import { KoiAgent,DuckAgent,PelicanAgent,jungleAgents,SeagullAgent } from '../src/jungle/agents';
import type { AgentEnvironment } from '../src/agents';
const digest=(a:Uint8Array)=>createHash('sha256').update(a).digest('hex');

test('all 31 animal types have visibly distinct authored forms at delivered resolution',()=>{
 for(const kind of [...Object.keys(ANIMAL_FORMS),'koi','duck','pelican']){
  const pond=['koi','duck','pelican'].includes(kind),spec=ECO_SPECS[kind as EcoKind];
  const hashes=(pond?[0,1,2]:animalForms(kind)).map(form=>{
   const mesh=kind==='deer'?deerMesh('look',0,form):['toucan','orangutan','jaguar'].includes(kind)?wildlifeMesh(kind as 'toucan','rest',0,form):pond?zenMesh(kind as 'koi','swim',0,form):ecologyMesh(kind as EcoKind,kind==='whale'?'travel':'rest',0,form);
   return digest(bakeMesh(mesh,Math.PI*.625,{width:160,height:160,anchor:[80,125],scale:spec?.cameraScale??25}).data);
  });
  assert.equal(new Set(hashes).size,hashes.length,kind);
 }
});

test('young forms and pond size/appearance survive exact binary continuation',()=>{
 for(const kind of ['deer','orangutan','giraffe','elephant','wolf','monkey']){
  assert.equal(animalForm(kind,0,true),2);assert.equal(animalForm(kind,2,false),0);
 }
 const env:AgentEnvironment={time:0,canMove:()=>true,nearby:()=>[],sample:()=>({water:true,bank:true,beach:true,depth:.3,moisture:.4,light:.8,wind:1,elevation:0})};
 for(const C of [KoiAgent,DuckAgent,PelicanAgent]){
  const a=new C('pond',0,0,22),b=jungleAgents.decode(jungleAgents.encode([a]))[0]!;
  for(let i=0;i<600;i++){a.update(1/60,env);b.update(1/60,env);}
  assert.deepEqual(jungleAgents.encode([a]),jungleAgents.encode([b]));
 }
 const gull=new SeagullAgent('fly-through',0,0,17);gull.state='travel';gull.altitude=32;gull.target={x:0,y:0};gull.timer=30;
 gull.update(1/60,env);assert.ok(Math.hypot(gull.target.x,gull.target.y)>.15);assert.notEqual(gull.state,'land');
});
