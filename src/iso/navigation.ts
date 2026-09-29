/** Pointer positions use one consistent screen coordinate system (usually CSS pixels). */
export interface PointerPosition { x: number; y: number }
export interface PointerTransform { from: PointerPosition; to: PointerPosition; zoomRatio: number }

/** One pointer pans; two pan and pinch around their midpoint. No DOM or clock dependency. */
export class PointerNavigation {
  private readonly points = new Map<number, PointerPosition>();
  private moved = false;
  get navigating(): boolean { return this.active && this.moved; }
  get active(): boolean { return this.points.size > 0; }

  begin(id: number, point: PointerPosition): boolean {
    // Additional fingers cannot displace either member of the current gesture.
    if (this.points.size >= 2 || this.points.has(id)) return false;
    if (!this.active) this.moved = false;
    this.points.set(id, point);
    return true;
  }

  move(id: number, point: PointerPosition): PointerTransform | undefined {
    if (!this.points.has(id)) return;
    const old=this.points.get(id)!;
    // A tap can jitter a little on touchscreens; only a deliberate drag starts navigation.
    if (Math.hypot(point.x-old.x,point.y-old.y)<(this.moved?.25:3)) return;
    this.moved=true;
    const before = this.sample();
    this.points.set(id, point);
    const after = this.sample();
    // Coincident fingers have no useful scale; rebase until they separate.
    const zoomRatio = before.span >= 1 && after.span >= 1 ? after.span / before.span : 1;
    return { from: before.center, to: after.center, zoomRatio };
  }

  end(id: number): boolean { return this.points.delete(id); }
  clear(): void { this.points.clear(); this.moved=false; }

  private sample(): { center: PointerPosition; span: number } {
    const [a, b] = [...this.points.values()];
    if (!a) throw new Error('Cannot sample an inactive pointer gesture');
    return b ? { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, span: Math.hypot(b.x - a.x, b.y - a.y) }
      : { center: a, span: 0 };
  }
}

/** Temporary drift suppression; callers supply monotonic seconds and keep explicit on/off separate. */
export class InteractionPause {
  private resumeAt = -Infinity;
  constructor(readonly seconds: number) {}
  touch(now: number): void { this.resumeAt = now + this.seconds; }
  blocked(now: number, held = false): boolean {
    if (held) this.touch(now);
    return held || now < this.resumeAt;
  }
}

/** Two short, nearby single-finger taps. Times are injected browser milliseconds.
 * A drag, long press, cancellation or second finger invalidates the whole pair. */
export class DoubleTap {
  private current?: {id:number;point:PointerPosition;time:number};
  private previous?: {point:PointerPosition;time:number};
  private readonly held=new Set<number>();
  begin(id:number,point:PointerPosition,time:number):void {
    this.held.add(id);
    if(this.held.size!==1){this.current=undefined;this.previous=undefined;return;}
    this.current={id,point,time};
  }
  move(id:number,point:PointerPosition):void {
    if(this.current?.id===id&&Math.hypot(point.x-this.current.point.x,point.y-this.current.point.y)>3){this.current=undefined;this.previous=undefined;}
  }
  end(id:number,time:number):boolean {
    this.held.delete(id);
    const tap=this.current;if(!tap||tap.id!==id)return false;
    this.current=undefined;
    if(time-tap.time>250){this.previous=undefined;return false;}
    const previous=this.previous;
    if(previous&&time-previous.time<=350&&Math.hypot(tap.point.x-previous.point.x,tap.point.y-previous.point.y)<=28){this.previous=undefined;return true;}
    this.previous={point:tap.point,time};return false;
  }
  cancel(id:number):void {if(this.held.has(id))this.clear();}
  clear():void {this.current=undefined;this.previous=undefined;this.held.clear();}
}
