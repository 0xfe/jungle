import type { LocalStimulus } from './startle';
import type { Vec2 } from '../iso/math';
/** Per-agent PRNG: evaluation/loading order cannot change another agent's decisions. */
export class AgentRandom {
  constructor(public state: number) { this.state >>>= 0; }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.state ^ this.state >>> 15, this.state | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
export interface EnvironmentSample { moisture: number; light: number; wind: number; elevation: number; water: boolean; depth?: number; beach?: boolean }
export interface Neighbor extends Vec2 { id: string; kind: string; speed: number; heading?: number; groupId?: string; juvenile?: boolean; alarm?: number; altitude?:number; stimulus?:LocalStimulus }
export interface AgentEnvironment {
  time: number;
  hasStimuli?:boolean;
  sample(x: number, y: number): EnvironmentSample;
  canMove(x: number, y: number): boolean;
  perches?(x: number, y: number, radius: number): readonly (Vec2 & { height: number })[];
  nearby(x: number, y: number, radius: number): readonly Neighbor[];
}
export interface Agent extends Vec2 {
  readonly id: string;
  readonly kind: string;
  readonly type: number;
  readonly speed?: number;
  readonly heading?: number;
  readonly groupId?: string;
  readonly juvenile?: boolean;
  readonly alarm?: number;
  readonly altitude?:number;
  readonly stimulus?:LocalStimulus;
  update(dt: number, environment: AgentEnvironment): void;
  write(writer: BinaryWriter): void;
}
/** Versioned little-endian records; float64 preserves exact simulation continuation. */
export class BinaryWriter {
  private data = new Uint8Array(256); private view = new DataView(this.data.buffer); length = 0;
  private reserve(n: number): void {
    if (this.length + n <= this.data.length) return;
    const next = new Uint8Array(Math.max(this.data.length * 2, this.length + n)); next.set(this.data);
    this.data = next; this.view = new DataView(next.buffer);
  }
  u8(v: number): void { this.reserve(1); this.view.setUint8(this.length++, v); }
  u32(v: number): void { this.reserve(4); this.view.setUint32(this.length, v, true); this.length += 4; }
  f64(v: number): void { this.reserve(8); this.view.setFloat64(this.length, v, true); this.length += 8; }
  string(v: string): void { const b = new TextEncoder().encode(v); this.u32(b.length); this.reserve(b.length); this.data.set(b, this.length); this.length += b.length; }
  blob(bytes: Uint8Array): void { this.u32(bytes.length); this.reserve(bytes.length); this.data.set(bytes, this.length); this.length += bytes.length; }
  finish(): Uint8Array { return this.data.slice(0, this.length); }
}
export class BinaryReader {
  private view: DataView; offset = 0;
  constructor(readonly bytes: Uint8Array) { this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  private take(n: number): number { const p = this.offset; if (n < 0 || p + n > this.bytes.length) throw new Error('Truncated agent record'); this.offset += n; return p; }
  u8(): number { return this.view.getUint8(this.take(1)); }
  u32(): number { return this.view.getUint32(this.take(4), true); }
  f64(): number { const n = this.view.getFloat64(this.take(8), true); if (!Number.isFinite(n)) throw new Error('Invalid agent number'); return n; }
  blob(): Uint8Array { const n = this.u32(), p = this.take(n); return this.bytes.slice(p, p + n); }
  string(): string { const n = this.u32(); return new TextDecoder().decode(this.bytes.subarray(this.take(n), this.offset)); }
}
export class AgentRegistry {
  constructor(readonly schema = 1) {}
  private readers = new Map<number, (reader: BinaryReader) => Agent>();
  register(type: number, read: (reader: BinaryReader) => Agent): this {
    if (type < 0 || type > 255 || !Number.isInteger(type) || this.readers.has(type)) throw new Error(`Invalid/duplicate agent type ${type}`);
    this.readers.set(type, read); return this;
  }
  encode(agents: readonly Agent[]): Uint8Array {
    const w = new BinaryWriter(); w.u8(this.schema); w.u32(agents.length);
    for (const agent of agents) { if (!this.readers.has(agent.type)) throw new Error(`Unregistered type ${agent.type}`); w.u8(agent.type); agent.write(w); }
    return w.finish();
  }
  decode(bytes: Uint8Array): Agent[] {
    const r = new BinaryReader(bytes); if (r.u8() !== this.schema) throw new Error('Unsupported agent schema');
    const n = r.u32(); if (n > bytes.length) throw new Error('Invalid agent count');
    const agents: Agent[] = [], ids = new Set<string>();
    for (let i = 0; i < n; i++) {
      const type = r.u8(), read = this.readers.get(type); if (!read) throw new Error(`Unknown agent type ${type}`);
      const agent = read(r); if (ids.has(agent.id)) throw new Error('Duplicate agent ID'); ids.add(agent.id); agents.push(agent);
    }
    if (r.offset !== bytes.length) throw new Error('Trailing agent data'); return agents;
  }
}
