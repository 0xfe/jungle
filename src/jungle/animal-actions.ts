/** Registered, planted activities. Species controllers choose when and where they apply. */
export const QUIET_ACTIONS=['feed','groom','preen','sniff','investigate','yawn','bask','alert','play'] as const;
export type QuietAction=typeof QUIET_ACTIONS[number];
export const quietAction=(state:string):state is QuietAction=>(QUIET_ACTIONS as readonly string[]).includes(state);
/** One-shot clips include both endpoints; cyclic gaits never duplicate their first pose. */
export function animalOneShot(kind:string,clip:string):boolean {
 return(quietAction(clip)&&kind!=='blackBear')||clip.startsWith('settle')||
  ['raise','feedDown','feedUp','rise','lower','enterWater','leaveWater','crouch','uncrouch','takeoff','land','turnLeft','turnRight','wrap','unwrap','hop','swing','drink','spray','lieDown'].includes(clip)||
  (clip==='dive'&&(kind==='hawk'||kind==='kingfisher'));
}
