import { restingPose } from './repose';
import { add, bone, ellipsoid, type Mesh, type V3, type RGB } from '../../src/iso/bake/mesh';
import { TAU, type DeerClip } from '../../src/jungle/animation';

const fur: RGB = [210, 143, 75];
const cream: RGB = [250, 228, 184], dark: RGB = [48, 40, 30], hoof: RGB = [66, 52, 36];
export interface DeerPose { head: V3; feet: V3[]; knees: V3[]; hips: V3[]; bob: number; headUp: number }
/** Four-beat walk: hind-left, fore-left, hind-right, fore-right. Grounded during stance. */
export function deerPose(clip: DeerClip | 'lieDown' | 'lying' | 'shift', phase: number): DeerPose {
  const rest=restingPose(clip,phase);
  const walk = clip === 'walk', run = clip === 'run', pivot = clip === 'turn';
  const headUp = clip === 'graze' ? 0 : clip === 'raise' ? phase * phase * (3 - 2 * phase) : 1;
  const bob = -.50*rest.amount + (run ? .045 * Math.sin(phase * TAU) : walk ? .013 * Math.cos(phase * TAU * 2) : .005 * Math.sin(phase * TAU));
  const hips: V3[] = [], feet: V3[] = [], knees: V3[] = [];
  for (const [i, [x, y]] of [[-.43, -.17], [.39, -.17], [-.43, .17], [.39, .17]].entries()) {
    const p = (phase + (run ? [0, .48, .08, .56] : [0, .25, .5, .75])[i]!) % 1;
    const stance = run ? .36 : .66;
    const stride = run ? .75 : walk ? .38 : pivot ? .08 : 0;
    const swing = Math.max(0, (p - stance) / (1 - stance));
    const fore = p < stance ? .5 - p / stance : -.5 + swing * swing * (3 - 2 * swing);
    const lift = (walk || run || pivot) && p > stance ? Math.sin((p - stance) / (1 - stance) * Math.PI) * (run ? .22 : walk ? .1 : .04) : 0;
    const hip: V3 = [x!, y!, .8 + bob];
    const foot: V3 = [x! + fore * stride, y! * 1.16, .04 + lift];
    const knee: V3 = [x! + fore * stride * .4 + (x! > 0 ? .055 : -.115), y! * 1.05, .4 + lift * .35 + bob];
    const mix=(a:V3,b:V3):V3=>a.map((v,i)=>v+(b[i]!-v)*rest.amount) as unknown as V3;
    hips.push(hip);feet.push(mix(foot,[x!>0?.12:-.18,y!*.9,.045]));
    knees.push(mix(knee,[x!>0?.53:-.54,y!*1.3,.085+rest.shift*.025]));
  }
  const chew = Math.sin(phase * TAU);
  let head: V3 = [.92 + .018 * chew + (.69 - .92 - .018 * chew) * headUp,
    .025 * Math.sin(phase * TAU)+rest.head*.35, .27 + .018 * chew + (1.34 + bob - .27 - .018 * chew) * headUp];
  const action=Math.sin(Math.PI*phase)**2;
  if(clip==='groom')head=[head[0]-action*.6,head[1]+action*.26,head[2]-action*.42];
  if(clip==='play')for(const i of [1,3]){const f=feet[i]!,k=knees[i]!;feet[i]=[f[0]+action*.18,f[1],f[2]+action*(.12+.05*Math.sin(phase*TAU*3))];knees[i]=[k[0],k[1],k[2]+action*.05];}
  return { head, feet, knees, hips, bob, headUp };
}

/** Art-directed, rigidly articulated mesh. Replace this producer with a rig importer later. */
export function deerMesh(clip: DeerClip | 'lieDown' | 'lying' | 'shift', phase: number,form=0): Mesh {
  const mesh: Mesh = [], pose = deerPose(clip, phase), b = pose.bob;
  const fur:RGB=form===1?[184,125,76]:form===2?[224,161,95]:[210,143,75];
  const bodyCenter: V3 = [-.05, 0, .88 + b];
  ellipsoid(mesh, bodyCenter, [.61, .235, .29], fur, undefined, n => n[2] < -.45 ? cream : n[2] > .75 ? [165, 99, 45] : fur, 20, 12);
  ellipsoid(mesh, [-.43, 0, .84 + b], [.235, .22, .29], fur);
  ellipsoid(mesh, [.34, 0, .84 + b], [.22, .205, .29], fur);
  // Individually modeled ivory flank spots follow the body surface at every heading.
  for (const side of [-1, 1]) for (let row = 0; row < 2; row++) for (let j = 0; j < 5; j++) {
    const x = -.43 + j * (form===2?.16:.18) + row * (form===1?.09:.055), z = .91 + row * .095 + b;
    const normalized = ((x + .05) / .61) ** 2 + ((z - bodyCenter[2]) / .29) ** 2;
    if (normalized >= .92) continue;
    const y = side * (.235 * Math.sqrt(1 - normalized) + .004);
    ellipsoid(mesh, [x, y, z], [.037, .024, .031], cream, undefined, undefined, 6, 4);
  }
  for (const side of [-1, 1]) for (let j = 0; j < 5; j++) {
    const x = -.4 + j * .175, y = side * .115;
    const z = bodyCenter[2] + .29 * Math.sqrt(Math.max(0, 1 - ((x + .05) / .61) ** 2 - (y / .235) ** 2));
    ellipsoid(mesh, [x, y, z + .008], [.035, .029, .021], cream, undefined, undefined, 6, 4);
  }
  // Light flank/chest patches stay visible from oblique top-down views.
  ellipsoid(mesh, [.28, 0, .73 + b], [.18, .207, .16], cream);
  for (let i = 0; i < 4; i++) {
    bone(mesh, pose.hips[i]!, pose.knees[i]!, i % 2 ? .06 : .075, fur);
    bone(mesh, pose.knees[i]!, pose.feet[i]!, .031, [137, 91, 48]);
    ellipsoid(mesh, add(pose.feet[i]!, [.015, 0, -.009]), [.055, .041, .038], hoof, undefined, undefined, 8, 6);
  }
  const neckBase: V3 = [.39, 0, .95 + b];
  bone(mesh, neckBase, pose.head, .1 + pose.headUp * .02, fur);
  bone(mesh, add(neckBase, [.035, -.025, -.045]), add(pose.head, [.025, -.02, -.05]), .052, cream);
  const slope = -.65 + .78 * pose.headUp;
  const forward: V3 = [Math.cos(slope), 0, Math.sin(slope)];
  const up: V3 = [-Math.sin(slope), 0, Math.cos(slope)];
  const headPoint = (x: number, y: number, z: number): V3 => add(pose.head, [forward[0] * x + up[0] * z, y, forward[2] * x + up[2] * z]);
  ellipsoid(mesh, pose.head, [form===2?.22:.2, form===2?.12:.108, form===2?.14:.125], fur, [forward, [0, 1, 0], up]);
  ellipsoid(mesh, headPoint(.17, 0, -.035), [.155, .078, .069], fur, [forward, [0, 1, 0], up]);
  ellipsoid(mesh, headPoint(.29, 0, -.037), [.047, .066, .045], dark, [forward, [0, 1, 0], up]);
  for (const side of [-1, 1]) {
    ellipsoid(mesh, headPoint(.055, side * .099, .036), [.038, .019, .038], cream);
    ellipsoid(mesh, headPoint(.066, side * .111, .04), [.022, .012, .025], dark);
    ellipsoid(mesh, headPoint(.07, side * .12, .05), [.008, .008, .009], [255, 244, 213], undefined, undefined, 6, 4);
    const twitch = .025 * Math.sin(phase * TAU + side);
    const earBase = headPoint(-.09, side * .073, .08), earTip = headPoint(-.13 + twitch, side * .22, .31);
    bone(mesh, earBase, earTip, .052, fur);
    bone(mesh, add(earBase, [.015, 0, .005]), add(earTip, [.015, 0, -.025]), .025, [217, 159, 134]);
  }
  // The mature buck has branched antlers; doe and fawn forms keep clean crowns.
  if(form===0)for(const side of [-1,1]){
    const a=headPoint(-.09,side*.065,.10),b=headPoint(-.18,side*.14,.40),c=headPoint(-.23,side*.24,.55);
    bone(mesh,a,b,.024,[133,102,63]);bone(mesh,b,c,.017,[177,144,92]);
    bone(mesh,headPoint(-.15,side*.11,.29),headPoint(-.06,side*.20,.45),.015,[177,144,92]);
  }
  bone(mesh, [-.6, 0, .91 + b], [-.77, .025 * Math.sin(phase * TAU), 1.02 + b], .065, cream);
  return mesh;
}
