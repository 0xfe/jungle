import type { Color, Frame, PixelImage, Region, Renderer } from './render';
/** Canvas fallback uses the same atlas and commands, with nearest-neighbor sampling. */
export class CanvasRenderer implements Renderer {
  readonly name = 'Canvas 2D';
  private ctx: CanvasRenderingContext2D;
  private sheet: HTMLCanvasElement;
  private tintBytes = 0;
  get auxiliaryBytes(): number { return this.tintBytes; }
  private tinted = new Map<string, HTMLCanvasElement>();
  constructor(private canvas: HTMLCanvasElement, private atlas: PixelImage, private tintBudget={maxEntries:512,maxBytes:8*1048576}) {
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx; this.sheet = document.createElement('canvas');
    this.sheet.width = atlas.width; this.sheet.height = atlas.height;
    this.sheet.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(atlas.data), atlas.width, atlas.height), 0, 0);
  }
  private tint(region: Region, color: Color): HTMLCanvasElement {
    const key = `${region.x},${region.y},${region.width},${region.height}:${color.slice(0, 3)}`;
    const cached = this.tinted.get(key); if (cached) { this.tinted.delete(key); this.tinted.set(key, cached); return cached; }
    const sheet = document.createElement('canvas'); sheet.width = region.width; sheet.height = region.height;
    const pixels = new Uint8ClampedArray(region.width * region.height * 4);
    for (let y = 0; y < region.height; y++) for (let x = 0; x < region.width; x++) {
      const src = ((region.y + y) * this.atlas.width + region.x + x) * 4, dst = (y * region.width + x) * 4;
      for (let c = 0; c < 3; c++) pixels[dst + c] = Math.round(this.atlas.data[src + c]! * color[c]! / 255);
      pixels[dst + 3] = this.atlas.data[src + 3]!;
    }
    sheet.getContext('2d')!.putImageData(new ImageData(pixels, region.width, region.height), 0, 0);
    const cost = region.width * region.height * 4 + 256;
    while (this.tinted.size && (this.tinted.size >= this.tintBudget.maxEntries || this.tintBytes + cost > this.tintBudget.maxBytes)) {
      const oldest = this.tinted.keys().next().value!, removed = this.tinted.get(oldest)!;
      this.tintBytes -= removed.width * removed.height * 4 + 256; this.tinted.delete(oldest);
      removed.width = removed.height = 0;
    }
    if (cost <= this.tintBudget.maxBytes) { this.tinted.set(key, sheet); this.tintBytes += cost; }
    return sheet;
  }
  render(frame: Frame): void {
    const ctx = this.ctx;
    if (this.canvas.width !== frame.width || this.canvas.height !== frame.height) {
      this.canvas.width = frame.width; this.canvas.height = frame.height;
    }
    ctx.clearRect(0, 0, frame.width, frame.height); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = `rgba(${frame.clear.slice(0, 3).join(',')},${frame.clear[3] / 255})`;
    ctx.fillRect(0, 0, frame.width, frame.height);
    for (const c of frame.commands) {
      ctx.globalAlpha = c.color[3] / 255;
      if (c.corners && !c.region) {
        ctx.fillStyle = `rgb(${c.color.slice(0, 3).join(',')})`;
        ctx.beginPath(); ctx.moveTo(c.corners[0].x, c.corners[0].y);
        for (const index of [1, 3, 2]) ctx.lineTo(c.corners[index]!.x, c.corners[index]!.y);
        ctx.closePath(); ctx.fill();
      } else if (c.region && c.corners) {
        const points = c.corners, r = c.region;
        // Small cached sources avoid repeatedly transforming the full large atlas through clips.
        // Rooted vegetation quads are affine: one draw, no diagonal clipping seam.
        if (!c.uvCorners && Math.abs(points[0].x+points[3].x-points[1].x-points[2].x)<1e-6 &&
            Math.abs(points[0].y+points[3].y-points[1].y-points[2].y)<1e-6) {
          ctx.save();ctx.transform(points[1].x-points[0].x,points[1].y-points[0].y,
            points[2].x-points[0].x,points[2].y-points[0].y,points[0].x,points[0].y);
          if(c.flip){ctx.translate(1,0);ctx.scale(-1,1);}
          if(c.color[0]===255&&c.color[1]===255&&c.color[2]===255)
            ctx.drawImage(this.sheet,r.x,r.y,r.width,r.height,0,0,1,1);
          else ctx.drawImage(this.tint(r,c.color),0,0,r.width,r.height,0,0,1,1);
          ctx.restore();continue;
        }
        const source = this.tint(r, c.color);
        for (let triangle = 0; triangle < 2; triangle++) {
          const a = points[triangle ? 3 : 0], b = points[triangle ? 2 : 1], d = points[triangle ? 1 : 2];
          const uv=c.uvCorners??[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}];
          const p=uv[triangle?3:0]!,q=uv[triangle?2:1]!,s=uv[triangle?1:2]!;
          const ux=q.x-p.x,uy=q.y-p.y,vx=s.x-p.x,vy=s.y-p.y,det=ux*vy-uy*vx;
          if(Math.abs(det)<1e-10)continue;
          const ax=((b.x-a.x)*vy-(d.x-a.x)*uy)/det,ay=((b.y-a.y)*vy-(d.y-a.y)*uy)/det;
          const bx=((d.x-a.x)*ux-(b.x-a.x)*vx)/det,by=((d.y-a.y)*ux-(b.y-a.y)*vx)/det;
          ctx.save(); ctx.beginPath(); ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.clip();
          ctx.transform(ax,ay,bx,by,a.x-ax*p.x-bx*p.y,a.y-ay*p.x-by*p.y);
          if (c.flip) { ctx.translate(1, 0); ctx.scale(-1, 1); }
          ctx.drawImage(source, 0, 0, r.width, r.height, 0, 0, 1, 1); ctx.restore();
        }
      } else if (c.region) {
        ctx.save(); ctx.translate(c.x + (c.flip ? c.width : 0), c.y); ctx.scale(c.flip ? -1 : 1, 1);
        const r = c.region;
        if (c.color[0] === 255 && c.color[1] === 255 && c.color[2] === 255)
          ctx.drawImage(this.sheet, r.x, r.y, r.width, r.height, 0, 0, c.width, c.height);
        else ctx.drawImage(this.tint(r, c.color), 0, 0, c.width, c.height);
        ctx.restore();
      } else {
        ctx.fillStyle = `rgb(${c.color.slice(0, 3).join(',')})`; ctx.fillRect(c.x, c.y, c.width, c.height);
      }
    }
    ctx.globalAlpha = 1;
  }
  dispose(): void { this.sheet.width = this.sheet.height = 0; this.tinted.clear(); this.tintBytes = 0; }
}
