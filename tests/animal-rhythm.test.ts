import test from 'node:test';
import assert from 'node:assert/strict';
import {AgentRandom,AgentSystem,FlightMotion,BinaryWriter,BinaryReader,type AgentEnvironment} from '../src/agents';
import {BIRD_FLIGHT} from '../src/jungle/flight';
import {ECO_KINDS} from '../src/jungle/ecology';
import {MonkeyAgent,SeagullAgent,jungleAgents} from '../src/jungle/agents';
import {InfiniteWorld} from '../src/jungle/infinite';
import {TerrainKind,landscape} from '../src/jungle/terrain';
import {normalizeSettings} from '../src/jungle/settings';

const env:AgentEnvironment={time:0,canMove:()=>true,nearby:()=>[],sample:()=>({moisture:.6,light:.8,wind:1,elevation:0,water:false}),
 perches:(x,y,r)=>[{x:0,y:0,height:70},{x:1,y:0,height:65},{x:0,y:1,height:68}].filter(p=>Math.hypot(p.x-x,p.y-y)<=r)};

test('powered flight varies cadence, glides with level wings, and restores its exact rhythm',()=>{
 const f=new FlightMotion(),random=new AgentRandom(19);let phase=0,gliding=0,powered=0;const rates=new Set<number>();
 for(let i=0;i<900;i++){
  const before=phase;phase=f.advance(phase,1/60,0,1,random,BIRD_FLIGHT.seagull!);
  if(!f.powered){gliding++;assert.equal(phase,Math.floor(phase));}else{powered++;rates.add(Math.round(f.cadence*100));}
  assert.ok(phase>=before&&phase-before<.12);
 }
 assert.ok(gliding>200&&powered>200);assert.ok(rates.size>10);
 const bytes=new BinaryWriter();f.write(bytes);const copy=new FlightMotion();copy.read(new BinaryReader(bytes.finish()));
 const rng=new AgentRandom(random.state);let next=phase;
 for(let i=0;i<600;i++){phase=f.advance(phase,1/60,2,1,random,BIRD_FLIGHT.seagull!);next=copy.advance(next,1/60,2,1,rng,BIRD_FLIGHT.seagull!);}
 assert.equal(phase,next);assert.deepEqual(f,copy);
 const climbing=new FlightMotion(),level=new FlightMotion();for(let i=0;i<120;i++){climbing.advance(i*.08,1/60,20,1,new AgentRandom(i),BIRD_FLIGHT.seagull!);level.advance(i*.08,1/60,0,1,new AgentRandom(i),BIRD_FLIGHT.seagull!);}
 assert.ok(climbing.cadence>level.cadence*1.2);assert.ok(climbing.powered);
});

test('gulls alternate rising powered flight and descending glides with individual pacing',()=>{
 const birds=[new SeagullAgent('a',0,0,8),new SeagullAgent('b',0,0,97)];
 const sea={...env,sample:()=>({...env.sample(0,0),water:true,depth:1,beach:false})};
 for(const b of birds){b.state='travel';b.heading=0;b.target={x:10,y:0};b.targetAltitude=35;b.altitude=35;b.timer=100;}
 let up=0,down=0;
 for(let i=0;i<540;i++)for(const b of birds){const z=b.altitude;b.update(1/60,sea);up+=Number(b.flight.powered&&b.altitude>z);down+=Number(!b.flight.powered&&b.altitude<z);}
 assert.ok(up>50&&down>50);assert.ok(Math.abs(birds[0]!.x-birds[1]!.x)>.1);assert.notEqual(birds[0]!.gait,birds[1]!.gait);
 const copy=jungleAgents.decode(jungleAgents.encode(birds));
 for(let i=0;i<600;i++)for(let j=0;j<2;j++){birds[j]!.update(1/60,sea);copy[j]!.update(1/60,sea);}
 assert.deepEqual(jungleAgents.encode(birds),jungleAgents.encode(copy));
});

test('monkeys spend overwhelmingly more time grounded or in trees than swinging',()=>{
 const monkeys=Array.from({length:12},(_,i)=>{const a=new MonkeyAgent(`m${i}`,0,0,45+i);a.altitude=i%3?0:20;a.timer=10+i;return a;});
 let swing=0,ground=0,tree=0;const system=new AgentSystem();
 for(let i=0;i<10800;i++){
  system.step(monkeys,1/60,env);
  for(const a of monkeys){swing+=Number(a.state==='swing');ground+=Number(a.altitude<1);tree+=Number(a.altitude>1&&a.state==='rest');}
 }
 assert.ok(ground>20000&&tree>1000);assert.ok(swing>0&&swing/(10800*12)<.03);
});

test('active worlds contain no crabs or gray ridge materials, even with maximum hills',()=>{
 assert.ok(!(ECO_KINDS as readonly string[]).includes('crab'));
 const settings=normalizeSettings({hills:1,animals:5}),world=new InfiniteWorld(2718,'rainforest',undefined,settings);
 world.ensure({minX:-16,minY:-16,maxX:16,maxY:16});assert.ok(world.agents.every(a=>a.kind!=='crab'));
 for(const t of world.tiles){assert.notEqual(t.kind,TerrainKind.Stone);assert.ok(t.materials.every(m=>m!==TerrainKind.Stone));}
 let elevated=0;for(let y=-50;y<50;y+=2)for(let x=-50;x<50;x+=2){const l=landscape(x,y,2718,settings);assert.notEqual(l.kind,TerrainKind.Stone);elevated+=Number(l.elevation>10);}
 assert.ok(elevated>0);
});
