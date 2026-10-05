import { createHash } from 'node:crypto';
import type { PixelImage, Region, SpriteFrames } from '../render';
/** Build-only sprite input. Anchors are measured in the untrimmed logical canvas. */
export interface BakeSprite { id: string; frames: PixelImage[]; anchor: [number, number]; trim?: boolean }
export interface PackedAtlas {
  image: PixelImage;
  manifest: { version: number; width: number; height: number;
    sprites: Record<string, { width: number; height: number; anchor: [number, number]; frames: Region[]; frameIndices?:number[] }>;
    stats: { frames: number; uniqueFrames: number; rgbaBytes: number; occupiedPixels: number } };
}

/** Union trim an entire clip: its anchor never jumps between animation frames. */
export function trimClip(sprite: BakeSprite): BakeSprite {
  const first = sprite.frames[0]; if (!first) throw new Error(`${sprite.id}: empty clip`);
  let left = first.width, top = first.height, right = -1, bottom = -1;
  for (const frame of sprite.frames) {
    if (frame.width !== first.width || frame.height !== first.height) throw new Error(`${sprite.id}: inconsistent frame size`);
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) if (frame.data[(y * frame.width + x) * 4 + 3]) {
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) throw new Error(`${sprite.id}: empty pixels`);
  if (sprite.trim === false) return sprite;
  const width = right - left + 1, height = bottom - top + 1;
  return { ...sprite, anchor: [sprite.anchor[0] - left, sprite.anchor[1] - top], frames: sprite.frames.map(frame => {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) data.set(frame.data.subarray(((y + top) * frame.width + left) * 4, ((y + top) * frame.width + left + width) * 4), y * width * 4);
    return { width, height, data };
  }) };
}

/** Deterministic shelf packer, one-pixel transparent gutters, exact RGBA frame deduplication. */
export function packAtlas(inputs: BakeSprite[], width = 2048, maxHeight = 2048): PackedAtlas {
  const sprites = inputs.map(trimClip);
  const unique = new Map<string, { image: PixelImage; region: Region }>();
  // Build-time piece interning shares image objects; hash each immutable image once.
  const imageKeys=new WeakMap<PixelImage,string>();
  const keys = new Map<string, string[]>();
  for (const s of sprites) {
    if (keys.has(s.id)) throw new Error(`Duplicate sprite ID: ${s.id}`);
    keys.set(s.id, s.frames.map(image => {
      let hash=imageKeys.get(image);
      if(!hash){hash=`${image.width}x${image.height}:${createHash('sha256').update(image.data).digest('hex')}`;imageKeys.set(image,hash);}
      if (!unique.has(hash)) unique.set(hash, { image, region: { x: 0, y: 0, width: image.width, height: image.height } });
      return hash;
    }));
  }
  const ordered = [...unique.values()].sort((a, b) => b.image.height - a.image.height || b.image.width - a.image.width);
  const shelves:{x:number;y:number;height:number}[]=[];
  // Shorter frames leave usable rectangles beneath them in a taller shelf.
  // Reclaim those gaps without rotating artwork or changing the gutter contract.
  const gaps:{x:number;y:number;width:number;height:number}[]=[];
  let bottom=2,occupiedPixels=1;
  for(const {image,region} of ordered){
    if(image.width+4>width)throw new Error('Sprite exceeds atlas width');
    occupiedPixels+=image.width*image.height;
    let gapIndex=-1,gapWaste=Infinity;
    for(let i=0;i<gaps.length;i++){
      const gap=gaps[i]!,waste=gap.width*gap.height-image.width*image.height;
      if(gap.width>=image.width&&gap.height>=image.height&&waste<gapWaste){gapIndex=i;gapWaste=waste;}
    }
    if(gapIndex>=0){
      const gap=gaps.splice(gapIndex,1)[0]!;
      region.x=gap.x;region.y=gap.y;
      const right=gap.width-image.width-1,below=gap.height-image.height-1;
      if(right>0)gaps.push({x:gap.x+image.width+1,y:gap.y,width:right,height:gap.height});
      if(below>0)gaps.push({x:gap.x,y:gap.y+image.height+1,width:image.width,height:below});
      continue;
    }
    // Nearest-neighbor sampling without mipmaps needs one fully transparent gutter.
    // Keep original artwork/poses at full resolution while sharing one texture page.
    let shelf:typeof shelves[number]|undefined,best=Infinity;
    for(const row of shelves){
      const remaining=width-row.x-image.width-2;
      if(row.height>=image.height&&remaining>=0&&remaining<best){shelf=row;best=remaining;}
    }
    if(!shelf){shelf={x:2,y:bottom,height:image.height};shelves.push(shelf);bottom+=image.height+1;}
    region.x=shelf.x;region.y=shelf.y;
    if(shelf.height-image.height>1)gaps.push({x:shelf.x,y:shelf.y+image.height+1,width:image.width,height:shelf.height-image.height-1});
    shelf.x+=image.width+1;
  }
  const height=Math.ceil(bottom/4)*4;
  if (height > maxHeight) throw new Error(`Atlas requires ${width} × ${height}; budget is ${width} × ${maxHeight}. Split pages or review frames.`);
  const data = new Uint8Array(width * height * 4); data.fill(255, 0, 4);
  for (const { image, region } of ordered) for (let row = 0; row < image.height; row++)
    data.set(image.data.subarray(row * image.width * 4, (row + 1) * image.width * 4), ((region.y + row) * width + region.x) * 4);
  const manifest: PackedAtlas['manifest'] = { version: 2, width, height, sprites: {},
    stats: { frames: sprites.reduce((n, s) => n + s.frames.length, 0), uniqueFrames: unique.size, rgbaBytes: data.length, occupiedPixels } };
  for (const s of sprites) manifest.sprites[s.id] = { width: s.frames[0]!.width, height: s.frames[0]!.height, anchor: s.anchor,
    frames: keys.get(s.id)!.map(key => unique.get(key)!.region) };
  return { image: { width, height, data }, manifest };
}

/** Build-only lossless compaction for clips made of many tiny shared pieces. */
export function compactSpriteFrames(sprite:SpriteFrames):void {
 const unique:Region[]=[],indices:number[]=[],seen=new Map<string,number>();
 for(const frame of sprite.frames){
  const key=`${frame.x},${frame.y},${frame.width},${frame.height}`;
  let index=seen.get(key);
  if(index===undefined){index=unique.length;seen.set(key,index);unique.push(frame);}
  indices.push(index);
 }
 if(unique.length<sprite.frames.length*.75){sprite.frames=unique;sprite.frameIndices=indices;}
}
