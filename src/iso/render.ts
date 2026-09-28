import { quadUV, type QuadCorners } from './quad';
export type Color = readonly [number, number, number, number];
export interface PixelImage { width: number; height: number; data: Uint8Array }
export interface Region { x: number; y: number; width: number; height: number }
export interface DrawCommand {
  id: string; layer: number; depth: number;
  x: number; y: number; width: number; height: number;
  corners?: QuadCorners; uvCorners?:QuadCorners; region?: Region; color: Color; flip?: boolean;
}
export interface Frame { width: number; height: number; clear: Color; commands: DrawCommand[] }
export interface Renderer { readonly name: string; readonly auxiliaryBytes?: number; render(frame: Frame): void; dispose(): void }
export function color(hex: string, alpha = 1): Color {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [n >>> 16 & 255, n >>> 8 & 255, n & 255, Math.round(alpha * 255)];
}
export const WHITE: Color = [255, 255, 255, 255];
export function sortCommands(commands: DrawCommand[]): DrawCommand[] {
  return commands.sort((a, b) => a.layer - b.layer || a.depth - b.depth || a.id.localeCompare(b.id));
}
export function visible(c: Pick<DrawCommand, 'x' | 'y' | 'width' | 'height'>, width: number, height: number): boolean {
  return c.x + c.width > 0 && c.y + c.height > 0 && c.x < width && c.y < height;
}

/** Real RGBA compositing, not a call-recording mock. Uses the same draw list as GL. */
export class MemoryRenderer implements Renderer {
  readonly name = 'Memory';
  pixels: PixelImage = { width: 0, height: 0, data: new Uint8Array() };
  constructor(readonly atlas: PixelImage) {}
  render(frame: Frame): void {
    const { width, height } = frame;
    if (this.pixels.width !== width || this.pixels.height !== height)
      this.pixels = { width, height, data: new Uint8Array(width * height * 4) };
    const data = this.pixels.data;
    for (let i = 0; i < data.length; i += 4) data.set(frame.clear, i);
    for (const c of frame.commands) {
      const x0 = Math.max(0, Math.ceil(c.x - .5)), y0 = Math.max(0, Math.ceil(c.y - .5));
      const x1 = Math.min(width, Math.ceil(c.x + c.width - .5));
      const y1 = Math.min(height, Math.ceil(c.y + c.height - .5));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const uv = c.corners ? quadUV(c.corners, x + .5, y + .5, c.uvCorners) : undefined;
        if (c.corners && !uv) continue;
        let r = c.color[0], g = c.color[1], b = c.color[2], a = c.color[3] / 255;
        if (c.region) {
          let u = Math.max(0, Math.min(c.region.width - 1, Math.floor((uv?.u ?? (x + .5 - c.x) / c.width) * c.region.width)));
          if (c.flip) u = c.region.width - 1 - u;
          const v = Math.max(0, Math.min(c.region.height - 1, Math.floor((uv?.v ?? (y + .5 - c.y) / c.height) * c.region.height)));
          const i = ((c.region.y + v) * this.atlas.width + c.region.x + u) * 4;
          r *= this.atlas.data[i]! / 255; g *= this.atlas.data[i + 1]! / 255;
          b *= this.atlas.data[i + 2]! / 255; a *= this.atlas.data[i + 3]! / 255;
        }
        const i = (y * width + x) * 4;
        const da = data[i + 3]! / 255, oa = a + da * (1 - a);
        if (oa === 0) continue;
        data[i] = Math.round((r * a + data[i]! * da * (1 - a)) / oa);
        data[i + 1] = Math.round((g * a + data[i + 1]! * da * (1 - a)) / oa);
        data[i + 2] = Math.round((b * a + data[i + 2]! * da * (1 - a)) / oa);
        data[i + 3] = Math.round(oa * 255);
      }
    }
  }
  dispose(): void { this.pixels = { width: 0, height: 0, data: new Uint8Array() }; }
}
