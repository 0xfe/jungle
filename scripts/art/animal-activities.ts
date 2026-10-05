import { bone,ellipsoid,type Mesh,type V3 } from '../../src/iso/bake/mesh';
import { transformMesh,smooth } from './pose-tools';
import { restingPose } from './repose';
/** Secondary joint motion around species-specific shoulders/necks. Endpoints stay registered. */
export function activityPose(mesh:Mesh,kind:string,clip:string,p:number):Mesh {
 const amount=Math.sin(Math.PI*p)**2,pulse=Math.sin(p*Math.PI*8)*amount;
 const bird=['toucan','macaw','parakeet','seagull','kingfisher'].includes(kind);
 const small=kind==='squirrel'||kind==='toad',primate=kind==='monkey'||kind==='orangutan';
 const neck=bird?.16:small?.12:primate?.10:kind==='crocodile'?.45:.44;
 const headZ=bird?.4:small?.23:primate?.8:.55;
 if(clip==='feed'||clip==='sniff'||clip==='preen'||clip==='groom'||clip==='investigate'||clip==='alert'||clip==='bask'){
  transformMesh(mesh,([x,y,z])=>{
   const head=smooth((x-neck)/.24)*smooth((z-headZ+.1)/.18);
   const turn=(clip==='groom'||clip==='preen')?amount*(1.2+pulse*.12):clip==='investigate'?pulse*.35:0;
   const dx=x-neck,c=Math.cos(turn*head),s=Math.sin(turn*head);
   const down=clip==='sniff'?amount*.32:clip==='feed'?(bird?.16:primate?.09:.12)*amount:clip==='preen'?.08*amount:clip==='alert'?-.11*amount:0;
   return[neck+dx*c-y*s,dx*s+y*c,z-down*head];
  });
 }
 if(clip==='play')transformMesh(mesh,([x,y,z])=>{
  const fore=smooth((x-.05)/.25)*(1-smooth((z-.35)/.3));
  return[x+fore*amount*.12,y,z+fore*amount*(.13+.04*Math.sin(p*Math.PI*6))];
 });
 if(primate&&(clip==='feed'||clip==='groom')){
  // Reach to the mouth/shoulder with alternating hands; shoulders and planted feet stay fixed.
  transformMesh(mesh,([x,y,z])=>{
   const hand=smooth((Math.abs(y)-.12)/.1)*(1-smooth((z-.4)/.3))*smooth((x+.05)/.2);
   return[x+hand*amount*.10,y*(1-hand*amount*.6),z+hand*amount*(clip==='feed'?.42:.58)];
  });
 }
 if(kind==='squirrel'&&clip==='feed'){
  // Haunches stay planted while the chest rises and the forepaws bring food inward.
  transformMesh(mesh,([x,y,z])=>{const w=smooth((x+.18)/.35);return[x-w*amount*.10,y*(1-w*amount*.15),z+w*amount*.14];});
  if(amount>.1)ellipsoid(mesh,[.21,0,.3],[.027,.027,.038],[169,133,71]);
 }
 if(kind==='toad'&&clip==='feed'&&p>.35&&p<.6){
  const reach=Math.sin((p-.35)/.25*Math.PI)*.28;
  bone(mesh,[.22,0,.13],[.25+reach,0,.10],.013,[208,129,122]);
 }
 if(kind==='crocodile'&&amount>.001&&(clip==='bask'||clip==='alert')){
  // A narrow gape is visible beneath the upper snout, without inventing a hunt.
  ellipsoid(mesh,[.83,0,.19],[.28,.08,.016+amount*.035],[48,45,34]);
 }
 return mesh;
}
/** Fold legs under a resting body, keeping the ground contact band fixed. */
export function groundRestPose(mesh:Mesh,clip:string,p:number):Mesh {
 const rest=restingPose(clip,p);
 transformMesh(mesh,([x,y,z])=>[x+(z<.28?rest.amount*.06:0),y,z-rest.amount*.34*smooth((z-.07)/.5)]);
 return mesh;
}
