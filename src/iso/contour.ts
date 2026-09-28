import { lerp, type Vec2 } from './math';
/** Clip a convex polygon against an interpolated scalar field, preserving all fields. */
export interface FieldVertex extends Vec2 { fields:readonly number[] }
export function clipField(polygon:readonly FieldVertex[],field:number,threshold:number,below:boolean):FieldVertex[]{
 const out:FieldVertex[]=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i]!,b=polygon[(i+1)%polygon.length]!,da=a.fields[field]!-threshold,db=b.fields[field]!-threshold;
  const inside=below?da<=0:da>=0,next=below?db<=0:db>=0;
  if(inside)out.push(a);
  if(inside!==next){const t=da/(da-db);out.push({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),fields:a.fields.map((v,j)=>lerp(v,b.fields[j]!,t))});}
 }
 return out;
}
