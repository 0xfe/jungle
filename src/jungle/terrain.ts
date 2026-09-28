import { DEFAULT_SETTINGS, type WorldSettings } from './settings';
import { clamp, hash, lerp, noise } from '../iso/math';
export const CHUNK_SIZE = 4;
export enum TerrainKind { Forest, Meadow, Dry, Stone, Shallow, Deep }
export const TERRAIN_NAMES = ['RAINFOREST', 'OPEN MEADOW', 'DRY SCRUBLAND', 'HIGHLAND RIDGE', 'LAKESHORE', 'OPEN WATER'];
export interface Landscape { moisture: number; elevation: number; kind: TerrainKind; water: boolean }
export type TerrainFields=readonly [number,number,number,number];
export function terrainFields(x:number,y:number,seed:number,settings:Readonly<WorldSettings>=DEFAULT_SETTINGS):TerrainFields{
 const size=4+settings.waterSize*14;
 const wx=x+(noise(x/5,y/5,seed+440)-.5)*1.2,wy=y+(noise(x/5,y/5,seed+441)-.5)*1.2;
 const lake=settings.water===0?1:noise(wx/size,wy/size,seed+12)*.8+noise(wx/2.7,wy/2.7,seed+72)*.2-(.15+settings.water*.42);
 const ridge=settings.hills===0?-1:noise(x/6,y/6,seed+271)-(.94-settings.hills*.54);
 const dry=settings.barren===0?-1:noise(x/4.5,y/4.5,seed+351)-(.93-settings.barren*.57);
 const meadow=settings.meadow===0?-1:noise(x/6,y/6,seed+91)-(.91-settings.meadow*.57);
 return [lake,ridge,dry,meadow].map(v=>Math.round(v*4096)/4096) as unknown as TerrainFields;
}
export function fieldKind(f:readonly number[]):TerrainKind{
 return f[0]!<-.065?TerrainKind.Deep:f[0]!<0?TerrainKind.Shallow:f[0]!<.024?TerrainKind.Dry:
  f[2]!>0?TerrainKind.Dry:f[3]!>0?TerrainKind.Meadow:TerrainKind.Forest;
}
/** Sample the same half-tile triangulation as contours, including outside resident chunks. */
export function interpolatedFields(x:number,y:number,seed:number,settings:Readonly<WorldSettings>=DEFAULT_SETTINGS):TerrainFields{
 const ix=Math.floor(x*2)/2,iy=Math.floor(y*2)/2,u=(x-ix)*2,v=(y-iy)*2;
 const points=u+v<=1?[[ix,iy],[ix+.5,iy],[ix,iy+.5]]:[[ix+.5,iy+.5],[ix,iy+.5],[ix+.5,iy]];
 const samples=points.map(p=>terrainFields(p[0]!,p[1]!,seed,settings)),a=u+v<=1?u:1-u,b=u+v<=1?v:1-v;
 return samples[0]!.map((n,j)=>n+(samples[1]![j]!-n)*a+(samples[2]![j]!-n)*b) as unknown as TerrainFields;
}
export function landscape(x:number,y:number,seed:number,settings:Readonly<WorldSettings>=DEFAULT_SETTINGS):Landscape{
 const f=interpolatedFields(x,y,seed,settings),kind=fieldKind(f),water=kind>=TerrainKind.Shallow;
 const elevation=Math.max(0,Math.min(f[0]*110,7+Math.max(0,f[1]+.15)*100));
 const moisture=kind===TerrainKind.Forest?.72:kind===TerrainKind.Meadow?.55:kind===TerrainKind.Dry?.3:.5;
 return {moisture,elevation,kind,water};
}
/** Compact immutable tile view into chunk bytes; corner heights are shared with neighbors. */
export class TerrainTile {
  private readonly uniformKind: TerrainKind | undefined;
  constructor(readonly x: number, readonly y: number, readonly kind: TerrainKind, readonly moisture: number, readonly heights: readonly [number, number, number, number], readonly materials: Uint8Array, readonly fields?: readonly TerrainFields[]) {
    const first=fields?fieldKind(fields[0]!):materials[0];
    const convex=fields?first===TerrainKind.Dry?
      fields.every(f=>f[0]>=0&&f[0]<.024)||fields.every(f=>f[0]>=.024&&f[2]>0):fields.every(f=>fieldKind(f)===first):materials.every(m=>m===first);
    this.uniformKind=convex?first:undefined;
  }
  get uniform(): boolean { return this.uniformKind!==undefined; }
  fieldAt(x:number,y:number,field:number):number {
    const u=clamp((x-this.x)*2,0,1.999999999),v=clamp((y-this.y)*2,0,1.999999999),ix=Math.floor(u),iy=Math.floor(v),a=u-ix,b=v-iy;
    const i=iy*3+ix,f=this.fields!,first=a+b<=1,p=f[first?i:i+4]![field]!,q=f[first?i+1:i+3]![field]!,r=f[first?i+3:i+1]![field]!;
    return p+(q-p)*(first?a:1-a)+(r-p)*(first?b:1-b);
  }
  fieldsAt(x:number,y:number):TerrainFields {return [this.fieldAt(x,y,0),this.fieldAt(x,y,1),this.fieldAt(x,y,2),this.fieldAt(x,y,3)];}
  materialAt(x:number,y:number):TerrainKind {
    if(this.uniformKind!==undefined)return this.uniformKind;
    if(this.fields){const lake=this.fieldAt(x,y,0);return lake<-.065?TerrainKind.Deep:lake<0?TerrainKind.Shallow:lake<.024?TerrainKind.Dry:
      this.fieldAt(x,y,2)>0?TerrainKind.Dry:this.fieldAt(x,y,3)>0?TerrainKind.Meadow:TerrainKind.Forest;}
    return this.materials[Math.min(3,Math.max(0,Math.floor((y-this.y)*4)))*4+Math.min(3,Math.max(0,Math.floor((x-this.x)*4)))]!;
  }
  heightAt(x: number, y: number): number {
    const u = clamp(x - this.x, 0, 1), v = clamp(y - this.y, 0, 1);
    // Same two triangles as the renderer, rather than a different bilinear ground surface.
    const [a, b, c, d] = this.heights;
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  get water(): boolean { return this.kind >= TerrainKind.Shallow; }
}
/** 338 metadata/material bytes + 81 shared vertices × four int16 fields = 986 bytes/chunk. */
export class TerrainChunk {
  static readonly byteLength = CHUNK_SIZE ** 2 * 2 + (CHUNK_SIZE + 1) ** 2 * 2 + CHUNK_SIZE ** 2 * 16 + 81*8;
  constructor(readonly x: number, readonly y: number, readonly data: Uint8Array) {
    if (data.length !== TerrainChunk.byteLength || (data.subarray(0, 16).some(n => n > TerrainKind.Deep) || data.subarray(82,338).some(n => n > TerrainKind.Deep))) throw new Error('Invalid terrain chunk size');
  }
  static generate(x: number, y: number, seed: number, settings:Readonly<WorldSettings>=DEFAULT_SETTINGS): TerrainChunk {
    const data = new Uint8Array(TerrainChunk.byteLength), view = new DataView(data.buffer);
    // Sample each shared field vertex once; all metadata/materials derive from these bytes.
    for(let vy=0;vy<9;vy++)for(let vx=0;vx<9;vx++)terrainFields(x*4+vx/2,y*4+vy/2,seed,settings).forEach((n,j)=>view.setInt16(338+((vy*9+vx)*4+j)*2,Math.round(n*4096),true));
    for(let cy=0;cy<=4;cy++)for(let cx=0;cx<=4;cx++){
      const offset=338+((cy*2*9+cx*2)*4)*2,lake=view.getInt16(offset,true)/4096,ridge=view.getInt16(offset+2,true)/4096;
      const height=Math.max(0,Math.min(lake*110,7+Math.max(0,ridge+.15)*100));
      view.setUint16(32+(cy*5+cx)*2,Math.round(height*16),true);
    }
    const chunk=new TerrainChunk(x,y,data);
    for(let ty=0;ty<4;ty++)for(let tx=0;tx<4;tx++){
      const i=ty*4+tx,tile=chunk.tile(tx,ty),kind=tile.materialAt(tile.x+.5,tile.y+.5);
      data[i]=kind;data[16+i]=Math.round((kind===TerrainKind.Forest?.72:kind===TerrainKind.Meadow?.55:kind===TerrainKind.Dry?.3:.5)*255);
      for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++)data[82+i*16+sy*4+sx]=tile.materialAt(tile.x+(sx+.5)/4,tile.y+(sy+.5)/4);
    }
    return chunk;
  }

  tile(tx: number, ty: number): TerrainTile {
    const i = ty * CHUNK_SIZE + tx, view = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
    const height = (x: number, y: number) => view.getUint16(32 + (y * 5 + x) * 2, true) / 16;
    return new TerrainTile(this.x * CHUNK_SIZE + tx, this.y * CHUNK_SIZE + ty, this.data[i]!, this.data[16 + i]! / 255,
      [height(tx, ty), height(tx + 1, ty), height(tx, ty + 1), height(tx + 1, ty + 1)], this.data.subarray(82 + i * 16, 82 + (i + 1) * 16),
      Array.from({length:9},(_,v)=>Array.from({length:4},(_,j)=>view.getInt16(338+(((ty*2+Math.floor(v/3))*9+tx*2+v%3)*4+j)*2,true)/4096) as unknown as TerrainFields));
  }
}
export const coordinateHash = (x: number, y: number, seed: number) => Math.floor(hash(x, y, seed) * 4294967296) >>> 0;

/** Match interpolated contours for spawning and nonresident habitat queries. */
export function terrainEnvironment(x:number,y:number,seed:number,settings:Readonly<WorldSettings>=DEFAULT_SETTINGS) {
 const point=landscape(x,y,seed,settings),f=interpolatedFields(x,y,seed,settings);
 return {moisture:point.moisture,light:.8,wind:1,elevation:point.elevation,water:point.water,
   depth:point.kind===TerrainKind.Deep?1:point.water?.25:0,beach:f[0]>=0&&f[0]<.024};
}
