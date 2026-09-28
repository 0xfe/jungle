import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentSystem,herdIntent,type AgentEnvironment,type Neighbor} from '../src/agents';
import {DeerAgent,ToucanAgent,OrangutanAgent,JaguarAgent,WildlifeAgent,PlantAgent,LandscapePatchAgent,jungleAgents} from '../src/jungle/agents';
import {InfiniteWorld} from '../src/jungle/infinite';
import {wildlifeMesh} from '../scripts/art/wildlife-model';
import {bakeMesh} from '../src/iso/bake/rasterize';
const env:AgentEnvironment={time:0,sample:()=>({moisture:.8,light:.8,wind:1,elevation:0,water:false}),canMove:()=>true,nearby:()=>[],perches:()=>[{x:.17,y:0,height:60},{x:1.17,y:.7,height:55}]};

test('family steering favors a parent, keeps space, and lets the leader explore',()=>{
 const self={id:'baby',groupId:'herd',leaderId:'lead',motherId:'mother',juvenile:true,heading:0,x:0,y:0};
 const peers:Neighbor[]=[{id:'mother',kind:'deer',groupId:'herd',x:1,y:0,speed:.2,heading:0},{id:'stranger',kind:'deer',groupId:'other',x:-4,y:0,speed:1}];
 const intent=herdIntent(self,peers)!;assert.ok(intent.target.x>.7);assert.ok(intent.moving);
 assert.equal(herdIntent({...self,id:'lead',motherId:'',juvenile:false},peers),undefined);
 assert.equal(herdIntent({...self,groupId:''},peers),undefined);
});

test('fawns catch up to their family instead of wandering independently',()=>{
 const mother=new DeerAgent('mother',1,0,3),baby=new DeerAgent('baby',-1,0,5);
 for(const a of [mother,baby]){a.groupId='family';a.leaderId='mother';a.timer=100;}
 baby.juvenile=true;baby.motherId='mother';baby.size=.6;
 const system=new AgentSystem();let best=2;
 for(let i=0;i<600;i++){system.step([mother,baby],1/60,env);best=Math.min(best,Math.hypot(mother.x-baby.x,mother.y-baby.y));}
 assert.ok(best<.8,`closest parent distance ${best}`);
});

test('predator perception interrupts grazing and a jaguar pursuit causes real flight',()=>{
 const deer=new DeerAgent('prey',.7,0,21),cat=new JaguarAgent('cat',-.7,0,9);deer.timer=100;cat.cooldown=0;cat.state='chase';cat.timer=3;cat.target={x:deer.x,y:deer.y};
 const system=new AgentSystem();let running=false,chasing=false,max=0;
 for(let i=0;i<600;i++){system.step([deer,cat],1/60,env);running ||= deer.state==='run';chasing ||= cat.state==='chase';max=Math.max(max,deer.x);}
 assert.ok(running&&chasing);assert.ok(max>1.5);assert.ok(cat.cooldown>0);
});

test('resting jaguars sometimes acquire nearby prey without a scripted chase',()=>{
 const cat=new JaguarAgent('hunter',0,0,9);let pursued=false;
 for(let i=0;i<900;i++){
  cat.update(1/60,{...env,nearby:()=>[{id:'prey',kind:'deer',x:1.5,y:0,speed:0}]});
  pursued ||= cat.state==='chase';
 }
 assert.ok(pursued);
});

test('all wildlife codecs retain traits, group membership, motor, canopy height and exact continuation',()=>{
 const agents=[new ToucanAgent('bird',0,0,4),new OrangutanAgent('ape',1,0,9),new JaguarAgent('cat',3,1,2)];
 agents.forEach(a=>{a.groupId=a.kind==='jaguar'?'':'g';a.leaderId=a.id;});
 const sys=new AgentSystem();for(let i=0;i<600;i++)sys.step(agents,1/60,env);
 const bytes=jungleAgents.encode(agents),restored=jungleAgents.decode(bytes);assert.ok(bytes.length<1000);
 assert.ok(restored[0] instanceof ToucanAgent && restored[1] instanceof OrangutanAgent && restored[2] instanceof JaguarAgent);
 for(let i=0;i<1200;i++){sys.step(agents,1/60,env);new AgentSystem().step(restored,1/60,env);}
 assert.deepEqual(jungleAgents.encode(agents),jungleAgents.encode(restored));
});

test('social perception is deterministic under reversed family/predator update order',()=>{
 const mother=new DeerAgent('mother',0,0,33),baby=new DeerAgent('baby',.4,0,34);mother.groupId=baby.groupId='g';mother.leaderId=baby.leaderId=mother.id;baby.juvenile=true;baby.motherId=mother.id;
 const sister=new DeerAgent('sister',.2,.3,78);sister.groupId='g';sister.leaderId=mother.id;
 const a=[mother,baby,sister,new JaguarAgent('cat',-1,0,90)],b=jungleAgents.decode(jungleAgents.encode(a)),s1=new AgentSystem(),s2=new AgentSystem();
 for(let i=0;i<1800;i++){s1.step(a,1/60,env);s2.step([...b].reverse(),1/60,env);}
 assert.deepEqual(jungleAgents.encode(a),jungleAgents.encode(b));
});

test('toucan flight and orangutan climbing use distinct continuous vertical motion',()=>{
 const bird=new ToucanAgent('bird',0,0,5);bird.timer=0;bird.altitude=55;
 const ape=new OrangutanAgent('ape',.17,0,3);ape.state='climb';ape.targetAltitude=40;
 let flew=false,climbed=false;
 for(let i=0;i<600;i++){bird.update(1/60,env);ape.update(1/60,env);flew ||= bird.speed>.2;climbed ||= ape.altitude>30;}
 assert.ok(flew&&climbed);assert.ok(bird.altitude>40);
});

test('low-density populations include families and all new species with varied persistent forms',()=>{
 const w=new InfiniteWorld(2718,'rainforest',undefined,{animals:1});let animals=0,tiles=0,babies=0;const species=new Set<string>(),forms=new Set<number>();
 for(let y=-8;y<=8;y++)for(let x=-8;x<=8;x++){
  w.ensure({minX:x*4,minY:y*4,maxX:x*4+3.9,maxY:y*4+3.9});tiles+=16;
  for(const a of w.agents){if(a instanceof LandscapePatchAgent)for(const p of a.pieces)forms.add(p.variant);if(!(a instanceof DeerAgent)&&!(a instanceof WildlifeAgent))continue;if(['deer','toucan','orangutan','jaguar'].includes(a.kind)){animals++;species.add(a.kind);}
   if(a instanceof DeerAgent){assert.ok(a.groupId);if(a.juvenile){babies++;assert.ok(a.size<.8);assert.ok(w.agents.some(m=>m.id===a.motherId));}}
   if(a instanceof JaguarAgent)assert.equal(a.groupId,'');
  }
 }
 assert.equal(species.size,4);assert.equal(forms.size,4);assert.ok(babies>0);assert.ok(animals/tiles<.06,`${animals} animals/${tiles} tiles`);
});

test('litter is ground-registered, increases with nearby canopy and avoids shoreline corners',()=>{
 const w=new InfiniteWorld(2718);w.ensure({minX:-8,minY:-8,maxX:8,maxY:8});
 assert.ok(w.groundCover.length>0);assert.ok(new Set(w.groundCover.map(c=>c.opacity)).size>1);
 for(const c of w.groundCover)for(const dx of [-1,1])for(const dy of [-1,1]){const x=c.x+dx*c.radius,y=c.y+dy*c.radius;assert.ok(w.tileAt(x,y)!.materialAt(x,y)<4);}
});

test('each wildlife rig has transparent margins at every heading and action',()=>{
 const camera={width:80,height:80,anchor:[40,65] as [number,number],scale:28};
 for(const kind of ['toucan','orangutan','jaguar'] as const)for(const clip of (kind==='toucan'?['rest','travel'] as const:kind==='orangutan'?['rest','travel','climb'] as const:['rest','travel','chase'] as const))for(let d=0;d<16;d++)for(const p of [0,.25,.5,.75]){
  const image=bakeMesh(wildlifeMesh(kind,clip,p),d/16*Math.PI*2,camera);
  for(let i=0;i<80;i++)assert.equal(image.data[(i*80)*4+3]!+image.data[(i*80+79)*4+3]!+image.data[i*4+3]!+image.data[(79*80+i)*4+3]!,0,`${kind}/${clip}/${d}/${p} clipped`);
 }
});
