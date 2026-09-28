/** Sparse world-space index. Rebuild when static geometry changes, never per frame. */
export class SpatialGrid<T> {
  private cells = new Map<string, T[]>();
  constructor(readonly cellSize = 1) {
    if (!(cellSize > 0)) throw new Error('Cell size must be positive');
  }
  clear(): void { this.cells.clear(); }
  insert(x: number, y: number, value: T): void {
    const key = `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    const bucket = this.cells.get(key);
    if (bucket) bucket.push(value); else this.cells.set(key, [value]);
  }
  visit(x0: number, y0: number, x1: number, y1: number, visit: (value: T) => void): void {
    for (let y = Math.floor(y0 / this.cellSize); y <= Math.floor(y1 / this.cellSize); y++)
      for (let x = Math.floor(x0 / this.cellSize); x <= Math.floor(x1 / this.cellSize); x++) {
        const bucket = this.cells.get(`${x},${y}`);
        if (bucket) for (const value of bucket) visit(value);
      }
  }
}
