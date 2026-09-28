export interface ChunkCoordinate { x: number; y: number }
export interface CacheEntry<T> extends ChunkCoordinate { value: T; bytes: number }
export interface CacheBudget { maxBytes: number; maxEntries: number; maxDistance: number }
export const chunkKey = (x: number, y: number) => `${x},${y}`;
/** Bounded LRU with pinned active chunks and distance expiry. Costs include owned metadata. */
export class ChunkCache<T> {
  private entries = new Map<string, CacheEntry<T>>(); bytes = 0; expired = 0; hits = 0;
  constructor(readonly budget: CacheBudget) {
    if (budget.maxBytes <= 0 || budget.maxEntries < 1 || budget.maxDistance < 0) throw new Error('Invalid cache budget');
  }
  get size(): number { return this.entries.size; }
  get(x: number, y: number): T | undefined {
    const key = chunkKey(x, y), entry = this.entries.get(key); if (!entry) return;
    this.entries.delete(key); this.entries.set(key, entry); this.hits++; return entry.value;
  }
  peek(x: number, y: number): T | undefined { return this.entries.get(chunkKey(x, y))?.value; }
  put(x: number, y: number, value: T, bytes: number, pinned: ReadonlySet<string>): void {
    if (bytes > this.budget.maxBytes || bytes < 0) throw new Error('Chunk exceeds memory budget');
    const key = chunkKey(x, y), old = this.entries.get(key);
    const incoming = bytes - (old?.bytes ?? 0);
    // Evict before admitting, so capacity is never silently exceeded by active chunks.
    for (const [candidate, entry] of this.entries) {
      if (this.bytes + incoming <= this.budget.maxBytes && this.size + Number(!old) <= this.budget.maxEntries) break;
      if (candidate !== key && !pinned.has(candidate)) this.remove(candidate, entry);
    }
    if (this.bytes + incoming > this.budget.maxBytes || this.size + Number(!old) > this.budget.maxEntries) throw new Error('Active chunks exceed cache budget');
    if (old) { this.bytes -= old.bytes; this.entries.delete(key); }
    this.entries.set(key, { x, y, value, bytes }); this.bytes += bytes;
  }
  private remove(key: string, entry: CacheEntry<T>): void { this.entries.delete(key); this.bytes -= entry.bytes; this.expired++; }
  expire(center: ChunkCoordinate, pinned: ReadonlySet<string>): void {
    for (const [key, entry] of this.entries) if (!pinned.has(key) && Math.max(Math.abs(entry.x - center.x), Math.abs(entry.y - center.y)) > this.budget.maxDistance) this.remove(key, entry);
  }
  values(): IterableIterator<CacheEntry<T>> { return this.entries.values(); }
}
