import { scatterCell } from '../iso/distribution';
import { TREE_FORMS, PLANT_FORMS, plantGene, vegetationPatch } from './botany';
import { DEFAULT_SETTINGS, normalizeSettings, SETTING_KEYS, type WorldSettings } from './settings';
import { AgentRandom, AgentSystem, BinaryReader, BinaryWriter, type Agent } from '../agents';
import { SpatialGrid } from '../iso/spatial';
import { chunkKey, ChunkCache, Cardinality, type CacheBudget } from '../streaming';
import { ECO_CLASSES, EcologicalAgent, DeerAgent, ToucanAgent, OrangutanAgent, JaguarAgent, WildlifeAgent, PlantAgent, WaterAgent, MoteAgent, createPlant, jungleAgents } from './agents';
import { CHUNK_SIZE, coordinateHash, landscape, TerrainChunk, TerrainKind, TerrainTile, terrainEnvironment } from './terrain';
import { ECO_KINDS, ECO_SPECS, habitatAllows, type EcoKind } from './ecology';
import { groveAt } from './groves';
import { hash } from '../iso/math';
import type { Habitat, Weather } from './world';
export interface WorldBounds { minX: number; minY: number; maxX: number; maxY: number }
interface ChunkRecord { terrain: Uint8Array; agents: Uint8Array }
export interface ActiveChunk { x: number; y: number; terrain: TerrainChunk; tiles: TerrainTile[]; agents: Agent[] }
export const DEFAULT_WORLD_BUDGET: CacheBudget = { maxBytes: 4 * 1024 * 1024, maxEntries: 256, maxDistance: 12 };
export function faunaPlan(cx:number,cy:number,seed:number, density=DEFAULT_SETTINGS.animals) {
  const random=new AgentRandom(coordinateHash(cx,cy,seed ^ 0x57494c44));
  const deer=random.next()<.075*density,toucan=random.next()<.045*density,orangutan=random.next()<.025*density,jaguar=random.next()<(deer?.24*density:.012*density);
  const monkey=random.next()<.06*density,wolf=random.next()<.018*density,giraffe=random.next()<.035*density,elephant=random.next()<.085*density;
  const seagull=random.next()<.30*density,fish=random.next()<.4*density,whale=random.next()<.025*density;
  const macaw=random.next()<.075*density,parakeet=random.next()<.085*density,kingfisher=random.next()<.06*density;
  return {deer,toucan,orangutan,jaguar,monkey,wolf,giraffe,elephant,seagull,fish,whale,macaw,parakeet,kingfisher,random};
}
export class InfiniteWorld {
  readonly cache: ChunkCache<ChunkRecord>; readonly active = new Map<string, ActiveChunk>();
  readonly explored = new Cardinality(); readonly drawn = new Cardinality();
  private system = new AgentSystem(); private trunks = new SpatialGrid<PlantAgent>(.5);
  groundCover: {x:number;y:number;radius:number;opacity:number;variant:number}[] = [];
  agents: Agent[] = []; tiles: TerrainTile[] = []; private tileMap = new Map<string, TerrainTile>();
  time = 0; previousTime = 0; weather: Weather = 'sun'; generated = 0; renderedNow = 0; renderedTotal = 0;
  private membership = ''; private pinned = new Set<string>();
  readonly settings:Readonly<WorldSettings>;
  constructor(readonly seed = 2718, readonly habitat: Habitat = 'rainforest', budget = DEFAULT_WORLD_BUDGET, settings:Partial<WorldSettings>=DEFAULT_SETTINGS) { this.cache = new ChunkCache(budget); this.settings=normalizeSettings(settings); }
  private generate(cx: number, cy: number, track = true): ChunkRecord {
    const terrain = TerrainChunk.generate(cx, cy, this.seed,this.settings), random = new AgentRandom(coordinateHash(cx, cy, this.seed));
    const agents: Agent[] = [], trees: PlantAgent[] = [];
    for (let y = 0; y < CHUNK_SIZE; y++) for (let x = 0; x < CHUNK_SIZE; x++) {
      const tile = terrain.tile(x, y); if(track)this.explored.add(coordinateHash(tile.x, tile.y, 671));
      if (tile.water) { agents.push(new WaterAgent(`w:${tile.x}:${tile.y}`, tile.x + .5, tile.y + .5, random.next() * 10)); continue; }
      if (random.next() < .2) agents.push(new MoteAgent(`m:${tile.x}:${tile.y}`, tile.x + .5, tile.y + .5, random.next() * 20));
      const coast=terrainEnvironment(tile.x+.5,tile.y+.5,this.seed,this.settings).beach;
      const density = coast?.025:tile.kind === TerrainKind.Forest ? .88 : tile.kind === TerrainKind.Meadow ? .24 : tile.kind === TerrainKind.Dry ? .07 : .04;
      const candidates = scatterCell(tile.x,tile.y,this.seed+601).map(p=>({...p,tree:true}));
      for(let slot=2;slot<5;slot++)candidates.push({x:tile.x+random.next(),y:tile.y+random.next(),slot,tree:false});
      for (const {x:px,y:py,slot,tree} of candidates) {
        if (tile.materialAt(px, py) >= TerrainKind.Shallow) continue;
        const patch=vegetationPatch(px,py,this.seed),grove=groveAt(px,py,this.seed);
        const probability=tree?density*patch.canopy:(coast?.025:density+.18)*patch.understory;
        if(random.next()>probability*this.settings.plants)continue;
        const dominant=this.habitat==='flowering'?3:grove.species;
        const variant=tree?(random.next()<.9?dominant:(dominant+1)%4):this.habitat==='flowering'?2:patch.fern>.56?1:patch.fern<.33?2:random.next()<.85?0:3;
        // A mix of young and mature growth without shrinking entire stands uniformly.
        const maturity=tree?(random.next()<.18?.60+random.next()*.18:.87+random.next()*.28):.48+random.next()*.48;
        const plant=createPlant((tree?1:5)+variant,`p:${tile.x}:${tile.y}:${slot}`,px,py,random.next()*20,tree?grove.scale*maturity*1.18:maturity);
        plant.genotype=plantGene(px,py,this.seed);
        if(tree){
          const forms=TREE_FORMS[variant]!;
          plant.morphology=grove.morphology===2&&random.next()<.55?2:random.next()<.06?0:random.next()<.15?1:3+Math.floor(random.next()*(forms-3));
        }else plant.morphology=Math.floor(random.next()*PLANT_FORMS[variant]!);
        agents.push(plant); if (tree) trees.push(plant);
      }
    }
    const dry = (x: number, y: number) => {
      const tx = Math.floor(x) - cx * CHUNK_SIZE, ty = Math.floor(y) - cy * CHUNK_SIZE;
      return tx >= 0 && tx < 4 && ty >= 0 && ty < 4 && terrain.tile(tx, ty).materialAt(x, y) < TerrainKind.Shallow && !trees.some(t => Math.hypot(t.x - x, t.y - y) < .18);
    };
    const bounds: [number,number,number,number] = [cx*4,cy*4,(cx+1)*4,(cy+1)*4];
    const {deer:herd,toucan:flock,orangutan:apes,jaguar:predator,random:wildlife}=faunaPlan(cx,cy,this.seed,this.settings.animals);
    const seed = () => Math.floor(wildlife.next()*0xffffffff);
    const spot = (center?: {x:number;y:number}) => {
      for(let attempt=0;attempt<50;attempt++){
        const x=center ? center.x+(wildlife.next()-.5)*1.1 : cx*4+.4+wildlife.next()*3.2;
        const y=center ? center.y+(wildlife.next()-.5)*1.1 : cy*4+.4+wildlife.next()*3.2;
        if(x>bounds[0]+.2&&y>bounds[1]+.2&&x<bounds[2]-.2&&y<bounds[3]-.2&&dry(x,y)&&!agents.some(a=>a.speed!==undefined&&Math.hypot(a.x-x,a.y-y)<.2))return{x,y};
      }
    };
    let familyCenter: {x:number;y:number}|undefined;
    if(herd){
      familyCenter=spot();const count=3+Math.floor(wildlife.next()*3),group=`herd:${cx}:${cy}`;
      if(familyCenter)for(let i=0;i<count;i++){
        const p=i===0?familyCenter:spot(familyCenter);if(!p)continue;
        const a=new DeerAgent(`${group}:${i}`,p.x,p.y,seed());a.territory=[...bounds];a.groupId=group;a.leaderId=`${group}:0`;
        a.juvenile=i>=count-1;a.motherId=a.juvenile?`${group}:0`:'';if(a.juvenile)a.size*=.57+wildlife.next()*.1;
        agents.push(a);
      }
    }
    if(flock && trees.length>1){const group=`flock:${cx}:${cy}`,first=trees[Math.floor(wildlife.next()*trees.length)]!;
      for(let i=0;i<2+Math.floor(wildlife.next()*2);i++){
        const a=new ToucanAgent(`${group}:${i}`,first.x+.08+i*.1,first.y-.08,seed());a.territory=[...bounds];a.groupId=group;a.leaderId=`${group}:0`;a.altitude=60*first.scale;a.targetAltitude=a.altitude;a.previous=a.sample();agents.push(a);
      }
    }
    if(apes && trees.length>3){const p=spot();if(p){const group=`family:${cx}:${cy}`,count=wildlife.next()<.55?2:1;
      for(let i=0;i<count;i++){const a=new OrangutanAgent(`${group}:${i}`,p.x+i*.22,p.y,seed());a.territory=[...bounds];a.groupId=group;a.leaderId=`${group}:0`;a.juvenile=i===1;if(a.juvenile){a.motherId=a.leaderId;a.size*=.58;}agents.push(a);}
    }}
    if(predator){const p=spot();if(p){const a=new JaguarAgent(`j:${cx}:${cy}`,p.x,p.y,seed());a.territory=[...bounds];a.cooldown=8+wildlife.next()*20;agents.push(a);}}
    const plan=faunaPlan(cx,cy,this.seed,this.settings.animals);
    const ecoRandom=new AgentRandom(coordinateHash(cx,cy,this.seed^0x45434f));
    const sample=(x:number,y:number)=>terrainEnvironment(x,y,this.seed,this.settings);
    const compatible=(kind:EcoKind,x:number,y:number)=>{
      if(x<bounds[0]+.18||y<bounds[1]+.18||x>bounds[2]-.18||y>bounds[3]-.18||!habitatAllows(kind,sample(x,y)))return false;
      if(ECO_SPECS[kind].mode==='ground'||kind==='crab'){
        const radius=kind==='elephant'?.3:kind==='giraffe'?.2:.13;
        for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])if(!dry(x+dx!*radius,y+dy!*radius))return false;
      }
      if(kind==='whale')for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(!habitatAllows(kind,sample(x+dx!*.7,y+dy!*.7)))return false;
      return true;
    };
    for(const kind of ECO_KINDS){
      if(!plan[kind])continue;
      const shore=kind==='elephant'&&Array.from({length:16},(_,i)=>terrain.tile(i%4,Math.floor(i/4))).some(t=>t.fields?.some(f=>f[0]<0));
      if(kind==='elephant'&&!shore&&ecoRandom.next()>.12)continue;
      const perched=['monkey','macaw','parakeet','kingfisher'].includes(kind);
      if(perched&&trees.length<2)continue;
      let center:{x:number;y:number;height?:number}|undefined;
      if(perched){const supports=trees.filter(t=>compatible(kind,t.x+.17,t.y));if(!supports.length)continue;const t=supports[Math.floor(ecoRandom.next()*supports.length)]!;center={x:t.x+.17,y:t.y,height:t.scale*60};}
      else for(let i=0;i<80;i++){const x=bounds[0]+.35+ecoRandom.next()*3.3,y=bounds[1]+.35+ecoRandom.next()*3.3;if(compatible(kind,x,y)){
       if(kind==='elephant'&&shore&&i<65&&!Array.from({length:8},(_,k)=>k*Math.PI/4).some(a=>sample(x+Math.cos(a)*.8,y+Math.sin(a)*.8).water))continue;
       center={x,y};break;
      }}
      if(!center)continue;
      const cubs=kind==='wolf'&&ecoRandom.next()<.48?1+Math.floor(ecoRandom.next()*2):0;
      const adults=kind==='wolf'?3+Math.floor(ecoRandom.next()*3):0;
      const count=kind==='wolf'?adults+cubs:kind==='whale'?1:kind==='fish'?7+Math.floor(ecoRandom.next()*5):kind==='parakeet'?3+Math.floor(ecoRandom.next()*3):2+Math.floor(ecoRandom.next()*2);
      const group=`${kind}:${cx}:${cy}`,C=ECO_CLASSES[kind];
      const commonHeading=ecoRandom.next()*Math.PI*2;
      for(let i=0;i<count;i++){
        let point:{x:number;y:number;height?:number}|undefined=i===0?center:undefined;
        if(perched){
          const supports=trees.filter(t=>compatible(kind,t.x+.28,t.y)).sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y));
          if(i>=supports.length)continue;
          const t=supports[i]!;
          point={x:t.x+.28,y:t.y,height:kind==='monkey'?(ecoRandom.next()<.65?0:Math.max(12,t.scale*60-50)):t.scale*60};
          if(kind==='monkey'&&!point.height&&!dry(point.x,point.y))continue;
        }
        for(let attempt=0;!point&&attempt<50;attempt++){
          const radius=kind==='fish'?.7:kind==='elephant'?1.5:kind==='wolf'?1.6:.9,x=center.x+(ecoRandom.next()-.5)*radius,y=center.y+(ecoRandom.next()-.5)*radius;
          if(compatible(kind,x,y)&&(kind!=='wolf'||!agents.some(a=>a.groupId===group&&Math.hypot(a.x-x,a.y-y)<.22)))point={x,y,height:center.height};
        }
        if(!point)continue;
        const a=new C(`${group}:${i}`,point.x,point.y,Math.floor(ecoRandom.next()*0xffffffff));
        a.territory=[...bounds];a.groupId=kind==='whale'?'':group;a.leaderId=`${group}:0`;a.heading=commonHeading;
        if(kind==='wolf'&&i>=adults){a.juvenile=true;a.motherId=a.leaderId;a.size=(agents.find(p=>p.id===a.leaderId) as WildlifeAgent).size*(.52+ecoRandom.next()*.12);}
        if(kind==='elephant'&&i===count-1){a.juvenile=true;a.motherId=a.leaderId;a.size*=.63;}
        a.altitude=point.height??(kind==='seagull'?40:kind==='fish'?-2:kind==='whale'?-12:0);a.targetAltitude=a.altitude;
        a.breathClock=ecoRandom.next()*a.cycleSeconds;a.previousBreath=a.breathClock;
        a.timer=kind==='monkey'?18+ecoRandom.next()*40:kind==='fish'?.1+ecoRandom.next()*.6:kind==='whale'?.1:1+ecoRandom.next()*6;a.previous=a.sample();agents.push(a);
      }
    }
    if(track)this.generated += CHUNK_SIZE ** 2;
    return { terrain: terrain.data, agents: jungleAgents.encode(agents) };
  }
  /** Synchronize only when the camera crosses chunk bounds; inactive state sleeps as bytes. */
  ensure(bounds: WorldBounds): void {
    const x0 = Math.floor(bounds.minX / CHUNK_SIZE), x1 = Math.floor(bounds.maxX / CHUNK_SIZE);
    const y0 = Math.floor(bounds.minY / CHUNK_SIZE), y1 = Math.floor(bounds.maxY / CHUNK_SIZE);
    if (![x0, x1, y0, y1].every(Number.isSafeInteger) || (x1 - x0 + 1) * (y1 - y0 + 1) > 144) throw new Error('Requested viewport exceeds active-world budget');
    const signature = `${x0},${y0},${x1},${y1}`; if (signature === this.membership) return;
    const pinned = new Set<string>(); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pinned.add(chunkKey(x, y));
    for (const [key, active] of this.active) if (!pinned.has(key)) {
      const record = { terrain: active.terrain.data, agents: jungleAgents.encode(active.agents) };
      this.cache.put(active.x, active.y, record, record.terrain.byteLength + record.agents.byteLength + 256, pinned);
      this.active.delete(key);
    }
    this.cache.expire({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, pinned);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const key = chunkKey(x, y); if (this.active.has(key)) continue;
      let record = this.cache.get(x, y);
      if (!record) {
        record = this.generate(x, y);
        this.cache.put(x, y, record, record.terrain.byteLength + record.agents.byteLength + 256, pinned);
      }
      const terrain = new TerrainChunk(x, y, record.terrain), tiles: TerrainTile[] = [];
      for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) tiles.push(terrain.tile(tx, ty));
      this.active.set(key, { x, y, terrain, tiles, agents: jungleAgents.decode(record.agents) });
    }
    this.agents = []; this.tiles = []; this.tileMap.clear(); this.trunks.clear();
    for (const chunk of this.active.values()) {
      this.agents.push(...chunk.agents); this.tiles.push(...chunk.tiles);
      for (const tile of chunk.tiles) this.tileMap.set(chunkKey(tile.x, tile.y), tile);
      for (const a of chunk.agents) if (a instanceof PlantAgent && a.kind === 'tree') this.trunks.insert(a.x, a.y, a);
    }
    this.groundCover=[];
    for(const a of this.agents)if(a instanceof PlantAgent && a.kind==='tree'){
      let neighbors=0;this.trunks.visit(a.x-1,a.y-1,a.x+1,a.y+1,p=>{if(Math.hypot(p.x-a.x,p.y-a.y)<1)neighbors++;});
      if(coordinateHash(Math.floor(a.x*20),Math.floor(a.y*20),this.seed+551)%4===0)continue;
      const radius=.16+Math.min(3,neighbors)*.025;
      const corners=[[-1,-1],[1,-1],[-1,1],[1,1]];
      if(corners.every(([dx,dy])=>{const x=a.x+dx!*radius,y=a.y+dy!*radius,t=this.tileAt(x,y);return t && t.materialAt(x,y)<TerrainKind.Shallow;}))this.groundCover.push({x:a.x,y:a.y,radius,opacity:.28+Math.min(3,neighbors)*.035,variant:coordinateHash(Math.floor(a.x*20),Math.floor(a.y*20),this.seed)%4});
    }
    this.membership = signature; this.pinned = pinned;
  }
  tileAt(x: number, y: number): TerrainTile | undefined { return this.tileMap.get(chunkKey(Math.floor(x), Math.floor(y))); }
  heightAt(x: number, y: number): number { return this.tileAt(x, y)?.heightAt(x, y) ?? landscape(x, y, this.seed,this.settings).elevation; }
  canMove(x: number, y: number): boolean {
    const tile = this.tileAt(x, y); if (!tile || tile.materialAt(x, y) >= TerrainKind.Shallow) return false;
    let blocked = false;
    this.trunks.visit(x - .13, y - .13, x + .13, y + .13, p => { if ((p.x - x) ** 2 + (p.y - y) ** 2 < .13 ** 2) blocked = true; });
    return !blocked;
  }
  update(dt: number): void {
    this.previousTime = this.time; this.time += dt;
    this.system.step(this.agents, dt, {
      perches: (x,y,radius) => {const result: {x:number;y:number;height:number}[]=[];this.trunks.visit(x-radius,y-radius,x+radius,y+radius,p=>{if(Math.hypot(p.x-x,p.y-y)<=radius)result.push({x:p.x+.17,y:p.y,height:p.scale*60});});return result.sort((a,b)=>a.x-b.x||a.y-b.y);},
      time: this.time, canMove: (x, y) => this.canMove(x, y),
      sample: (x, y) => {
        const tile = this.tileAt(x,y), material=tile?.materialAt(x,y), elevation=tile?.heightAt(x,y);
        const light=this.weather==='dusk'?.25:.8,wind=this.weather==='rain'?1.5:1;
        if(tile)return {moisture:tile.moisture,elevation:elevation!,water:material!>=TerrainKind.Shallow,
          depth:material===TerrainKind.Deep?1:material!>=TerrainKind.Shallow?.25:0,
          beach:material===TerrainKind.Dry&&tile.fieldAt(x,y,0)<.024,light,wind};
        return {...terrainEnvironment(x,y,this.seed,this.settings),light,wind};
      },
    });
  }
  markRendered(tiles: readonly TerrainTile[]): void {
    this.renderedNow = tiles.length; this.renderedTotal += tiles.length;
    for (const tile of tiles) this.drawn.add(coordinateHash(tile.x, tile.y, 671));
  }
  get stats() {
    return { worldSize: this.explored.estimate, renderedUnique: this.drawn.estimate, renderedNow: this.renderedNow, renderedTotal: this.renderedTotal,
      generated: this.generated, resident: this.cache.size * 16, active: this.tiles.length, expired: this.cache.expired * 16,
      cachedBytes: this.cache.bytes, estimatedBytes: this.cache.bytes + this.agents.length * 768 + this.tiles.length * 6144 + 8192, agents: this.agents.length, animals: this.agents.filter(a=>a.speed!==undefined).length, herds: new Set(this.agents.filter(a=>a instanceof DeerAgent && a.groupId).map(a=>(a as DeerAgent).groupId)).size };
  }
  /** Capture active state before taking a compact checkpoint. Cache eviction remains intentional. */
  checkpoint(): Uint8Array {
    for (const a of this.active.values()) {
      const record = { terrain: a.terrain.data, agents: jungleAgents.encode(a.agents) };
      this.cache.put(a.x, a.y, record, record.terrain.length + record.agents.length + 256, this.pinned);
    }
    const w = new BinaryWriter(); w.u32(0x4a4e474c); w.u8(8); w.u32(this.seed);
    for(const key of SETTING_KEYS)w.f64(this.settings[key]);
    w.u8(['rainforest', 'flowering', 'wetland'].indexOf(this.habitat)); w.u8(['sun', 'rain', 'dusk'].indexOf(this.weather));
    for (const n of [this.time, this.previousTime, this.generated, this.renderedTotal, this.cache.expired]) w.f64(n);
    w.blob(this.explored.registers); w.blob(this.drawn.registers); w.u32(this.cache.size);
    for (const c of this.cache.values()) { w.f64(c.x); w.f64(c.y); w.blob(c.value.terrain); w.blob(c.value.agents); }
    return w.finish();
  }
  static restore(bytes: Uint8Array, budget = DEFAULT_WORLD_BUDGET): InfiniteWorld {
    if (bytes.length > budget.maxBytes + 65536) throw new Error('Checkpoint exceeds memory budget');
    const r = new BinaryReader(bytes);
    if (r.u32() !== 0x4a4e474c || r.u8() !== 8) throw new Error('Unsupported world checkpoint');
    const seed = r.u32(), settings=Object.fromEntries(SETTING_KEYS.map(k=>[k,r.f64()])) as unknown as WorldSettings;
    for(const k of SETTING_KEYS)if(settings[k]!==normalizeSettings(settings)[k])throw new Error('Invalid world settings');
    const habitat = (['rainforest', 'flowering', 'wetland'] as const)[r.u8()], weather = (['sun', 'rain', 'dusk'] as const)[r.u8()];
    if (!habitat || !weather) throw new Error('Invalid world settings');
    const world = new InfiniteWorld(seed, habitat, budget,settings); world.weather = weather;
    world.time = r.f64(); world.previousTime = r.f64(); world.generated = r.f64(); world.renderedTotal = r.f64(); world.cache.expired = r.f64();
    const explored = r.blob(), drawn = r.blob();
    if (explored.length !== 4096 || drawn.length !== 4096 || explored.some(n => n > 21) || drawn.some(n => n > 21)) throw new Error('Invalid exploration sketch');
    world.explored.registers.set(explored); world.drawn.registers.set(drawn);
    const count = r.u32(), pinned = new Set<string>(); if (count > budget.maxEntries) throw new Error('Checkpoint exceeds chunk budget');
    for (let i = 0; i < count; i++) {
      const x = r.f64(), y = r.f64(), terrain = r.blob(), agents = r.blob(), key = chunkKey(x, y);
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || pinned.has(key)) throw new Error('Invalid chunk coordinate');
      new TerrainChunk(x, y, terrain); jungleAgents.decode(agents); // Reject corrupt/version-incompatible records before admitting them.
      pinned.add(key); world.cache.put(x, y, { terrain, agents }, terrain.length + agents.length + 256, pinned);
    }
    if (r.offset !== bytes.length) throw new Error('Trailing world data'); return world;
  }
  wildlifeLandmark(kind:'deer'|'toucan'|'orangutan'|'jaguar'|EcoKind,fromX=0,fromY=0):{x:number;y:number} {
    if(kind==='crab'||!this.settings.animals||(!this.settings.water&&['fish','whale','seagull','crab'].includes(kind))||(!this.settings.plants&&['monkey','macaw','parakeet','kingfisher','toucan','orangutan'].includes(kind)))return{x:fromX,y:fromY};
    const cx=Math.floor(fromX/4),cy=Math.floor(fromY/4);
    for(let r=0;r<45;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dy))!==r||!faunaPlan(cx+dx,cy+dy,this.seed,this.settings.animals)[kind])continue;
      const x=(cx+dx)*4+2,y=(cy+dy)*4+2;
      const record=this.cache.peek(cx+dx,cy+dy)??this.generate(cx+dx,cy+dy,false);
      const animals=this.active.get(chunkKey(cx+dx,cy+dy))?.agents??jungleAgents.decode(record.agents);
      const animal=animals.find(a=>a.kind===kind);if(animal)return{x:animal.x,y:animal.y};
    }
    return{x:fromX,y:fromY};
  }
  /** Find a nearby feature for quick exploration; ordinary camera travel is continuous. */
  landmark(kind: TerrainKind, fromX = 0, fromY = 0): { x: number; y: number } {
    for (let radius = 0; radius <= 160; radius += 4) for (let dy = -radius; dy <= radius; dy += 4) for (let dx = -radius; dx <= radius; dx += 4) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
      const x = fromX + dx + .5, y = fromY + dy + .5;
      const value = landscape(x, y, this.seed,this.settings);
      if (value.kind === kind && (kind !== TerrainKind.Dry || value.moisture < .33 && value.elevation > 10)) return { x, y };
    }
    return { x: fromX, y: fromY };
  }
}
