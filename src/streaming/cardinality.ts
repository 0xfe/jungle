/** Fixed-memory HyperLogLog; world exploration statistics never retain every visited key. */
export class Cardinality {
  readonly registers = new Uint8Array(4096);
  add(hash: number): void {
    hash = Math.imul(hash ^ hash >>> 16, 0x7feb352d);
    hash = Math.imul(hash ^ hash >>> 15, 0x846ca68b);
    hash = (hash ^ hash >>> 16) >>> 0;
    const index = hash & 4095, remaining = hash >>> 12;
    this.registers[index] = Math.max(this.registers[index]!, Math.min(21, Math.clz32(remaining) - 11));
  }
  get estimate(): number {
    const m = this.registers.length; let sum = 0, zeros = 0;
    for (const r of this.registers) { sum += 2 ** -r; if (r === 0) zeros++; }
    const raw = (.7213 / (1 + 1.079 / m)) * m * m / sum;
    return Math.round(raw <= 2.5 * m && zeros ? m * Math.log(m / zeros) : raw);
  }
}
