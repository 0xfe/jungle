/** Resolve a URL seed without consuming entropy for explicit, reproducible worlds. */
export function startupSeed(parameter: string | null, freshSeed: () => number): number {
  const parsed = parameter?.trim() ? Number(parameter) : NaN;
  return (Number.isSafeInteger(parsed) ? parsed : freshSeed()) >>> 0;
}

/** Touch-first/mobile startup policy, kept pure so desktop viewport resizing cannot change mute. */
export function mobileDevice(userAgent:string,touchPoints:number,coarsePointer:boolean):boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent)||(touchPoints>0&&coarsePointer)||(/Macintosh/i.test(userAgent)&&touchPoints>1);
}
