import { BinaryReader, BinaryWriter, ease, type Agent, type AgentEnvironment } from '../../agents';
import { lerp } from '../../iso/math';
import { plantAppearance, TREE_FORMS, PLANT_FORMS } from '../botany';
export interface PlantSpec { type: number; name: string; kind: 'tree' | 'plant'; variant: number; windResponse: number; moisture: number }
export const PLANT_SPECS: readonly PlantSpec[] = [
  { type: 1, name: 'umbrella tree', kind: 'tree', variant: 0, windResponse: .9, moisture: .6 },
  { type: 2, name: 'palm', kind: 'tree', variant: 1, windResponse: 1.15, moisture: .8 },
  { type: 3, name: 'banana', kind: 'tree', variant: 2, windResponse: 1.2, moisture: .9 },
  { type: 4, name: 'flowering tree', kind: 'tree', variant: 3, windResponse: .85, moisture: .5 },
  { type: 5, name: 'bush', kind: 'plant', variant: 0, windResponse: 1, moisture: .5 },
  { type: 6, name: 'fern', kind: 'plant', variant: 1, windResponse: 1.2, moisture: .8 },
  { type: 7, name: 'bromeliad', kind: 'plant', variant: 2, windResponse: .9, moisture: .7 },
  { type: 8, name: 'mushroom rock', kind: 'plant', variant: 3, windResponse: .55, moisture: .8 },
];
export class PlantAgent implements Agent {
  readonly type: number; readonly kind: 'tree' | 'plant'; readonly variant: number;
  morphology = 0;
  private gene = 0;
  appearance = plantAppearance(0);
  get genotype(): number { return this.gene; }
  set genotype(value: number) { if(!Number.isInteger(value)||value<0||value>65535)throw new Error('Invalid plant genotype'); this.gene = value; this.appearance = plantAppearance(value); }
  previousPhase: number; windRate = 1; vigor = 1;
  constructor(readonly id: string, public x: number, public y: number, readonly spec: PlantSpec, public phase: number, public scale: number) { this.previousPhase = phase; this.type = spec.type; this.kind = spec.kind; this.variant = spec.variant; }
  update(dt: number, environment: AgentEnvironment): void {
    this.previousPhase = this.phase;
    const local = environment.sample(this.x, this.y);
    this.windRate = ease(this.windRate, local.wind * this.spec.windResponse, .6, dt);
    this.phase += dt * this.windRate;
    this.vigor = ease(this.vigor, .75 + .25 * Math.min(1, local.moisture / this.spec.moisture), 5, dt);
  }
  animationPhase(alpha: number): number { return lerp(this.previousPhase, this.phase, alpha); }
  write(w: BinaryWriter): void {
    w.string(this.id); w.u8(this.morphology); w.u8(this.genotype & 255); w.u8(this.genotype >>> 8); for (const n of [this.x, this.y, this.phase, this.scale, this.previousPhase, this.windRate, this.vigor]) w.f64(n);
  }
}
// Concrete species give future behavior overrides a stable home; sprites/frames remain shared data.
export class UmbrellaTreeAgent extends PlantAgent { constructor(id: string, x: number, y: number, phase = 0, scale = 1) { super(id, x, y, PLANT_SPECS[0]!, phase, scale); } }
export class PalmAgent extends PlantAgent { constructor(id: string, x: number, y: number, phase = 0, scale = 1) { super(id, x, y, PLANT_SPECS[1]!, phase, scale); } }
export class BananaAgent extends PlantAgent { constructor(id: string, x: number, y: number, phase = 0, scale = 1) { super(id, x, y, PLANT_SPECS[2]!, phase, scale); } }
export class FloweringTreeAgent extends PlantAgent { constructor(id: string, x: number, y: number, phase = 0, scale = 1) { super(id, x, y, PLANT_SPECS[3]!, phase, scale); } }
export class BushAgent extends PlantAgent { constructor(id: string, x: number, y: number, phase = 0, scale = 1) { super(id, x, y, PLANT_SPECS[4]!, phase, scale); } }
export class FernAgent extends PlantAgent { constructor(id: string, x: number, y: number, phase = 0, scale = 1) { super(id, x, y, PLANT_SPECS[5]!, phase, scale); } }
export class BromeliadAgent extends PlantAgent { constructor(id: string, x: number, y: number, phase = 0, scale = 1) { super(id, x, y, PLANT_SPECS[6]!, phase, scale); } }
export class MushroomRockAgent extends PlantAgent { constructor(id: string, x: number, y: number, phase = 0, scale = 1) { super(id, x, y, PLANT_SPECS[7]!, phase, scale); } }
const constructors = [UmbrellaTreeAgent, PalmAgent, BananaAgent, FloweringTreeAgent, BushAgent, FernAgent, BromeliadAgent, MushroomRockAgent];
export function createPlant(type: number, id: string, x: number, y: number, phase: number, scale: number): PlantAgent {
  const Constructor = constructors[type - 1]; if (!Constructor) throw new Error(`Unknown plant type ${type}`);
  return new Constructor(id, x, y, phase, scale);
}
export function readPlant(type: number, r: BinaryReader): PlantAgent {
  const id = r.string(), morphology = r.u8(), genotype = r.u8() | r.u8() << 8;
  if (morphology >= (type <= 4 ? TREE_FORMS[type - 1]! : PLANT_FORMS[type - 5]!)) throw new Error('Invalid plant morphology');
  const p = createPlant(type, id, r.f64(), r.f64(), r.f64(), r.f64()); p.morphology = morphology; p.genotype = genotype;
  p.previousPhase = r.f64(); p.windRate = r.f64(); p.vigor = r.f64(); return p;
}
export class WaterAgent implements Agent {
  readonly type: number = 21; readonly kind: string = 'water'; previousPhase: number; rate = 1;
  constructor(readonly id: string, public x: number, public y: number, public phase = 0) { this.previousPhase = phase; }
  update(dt: number, environment: AgentEnvironment): void {
    this.previousPhase = this.phase; this.rate = ease(this.rate, environment.sample(this.x, this.y).wind, 1, dt); this.phase += dt * this.rate;
  }
  write(w: BinaryWriter): void { w.string(this.id); for (const n of [this.x, this.y, this.phase, this.previousPhase, this.rate]) w.f64(n); }
  static read(r: BinaryReader): WaterAgent {
    const a = new WaterAgent(r.string(), r.f64(), r.f64(), r.f64()); a.previousPhase = r.f64(); a.rate = r.f64(); return a;
  }
}

export class MoteAgent extends WaterAgent {
  override readonly type = 22; override readonly kind = 'mote';
  static override read(r: BinaryReader): MoteAgent {
    const a = new MoteAgent(r.string(), r.f64(), r.f64(), r.f64()); a.previousPhase = r.f64(); a.rate = r.f64(); return a;
  }
}
