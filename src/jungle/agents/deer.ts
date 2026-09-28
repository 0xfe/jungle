import { StartleResponse, AgentRandom, BinaryReader, BinaryWriter, SpeedMotor, ease, herdIntent, type Agent, type AgentEnvironment } from '../../agents';
import { clamp, type Vec2 } from '../../iso/math';
import { angleDelta, DEER_STRIDE, DEER_RUN_STRIDE, DEER_TURN_RATE, HEAD_SECONDS, TAU } from '../animation';
export type DeerState = 'graze' | 'raise' | 'look' | 'turn' | 'walk' | 'run' | 'lower';
export interface DeerSample extends Vec2 { state: DeerState; heading: number; gait: number; actionTime: number }
const states: DeerState[] = ['graze', 'raise', 'look', 'turn', 'walk', 'run', 'lower'];
export class DeerAgent implements Agent, DeerSample {
  readonly kind = 'deer'; readonly type = 20;
  groupId = ''; leaderId = ''; motherId = ''; juvenile = false; size = 1; coat = 0;
  startle=new StartleResponse();
  senseTimer = 0; fear = 0;
  get alarm(): number { return this.fear; }
  readonly random: AgentRandom; readonly motor = new SpeedMotor();
  state: DeerState = 'graze'; heading: number; gait = 0; actionTime = 0;
  timer: number; target: Vec2; previous: DeerSample; phase: number; pace: number; tripPace = 1;
  locomotion: 'walk' | 'run' = 'walk'; alertness = 0; curiosity: number; turnSpeed = 0;
  /** Territory bounds keep a streamed herd owned by exactly one chunk. */
  territory: [number, number, number, number] = [-1e8, -1e8, 1e8, 1e8];
  constructor(readonly id: string, public x: number, public y: number, seed: number) {
    this.random = new AgentRandom(seed); this.heading = this.random.next() * TAU;
    this.timer = 1.5 + this.random.next() * 9; this.phase = this.random.next() * 10;
    this.pace = .85 + this.random.next() * .4; this.curiosity = this.random.next();
    this.size = .9 + this.random.next() * .2; this.coat = Math.floor(this.random.next() * 3);
    this.target = { x, y }; this.previous = this.sample();
  }
  get speed(): number { return this.motor.speed; }
  set speed(v: number) { this.motor.speed = v; }
  sample(): DeerSample { return { x: this.x, y: this.y, state: this.state, heading: this.heading, gait: this.gait, actionTime: this.actionTime }; }
  private enter(state: DeerState, seconds: number): void { this.state = state; this.timer = seconds; this.actionTime = 0; }
  update(dt: number, environment: AgentEnvironment): void {
    this.startle.update(dt);
    const p = this.previous;
    p.x = this.x; p.y = this.y; p.heading = this.heading; p.gait = this.gait; p.state = this.state; p.actionTime = this.actionTime;
    this.timer -= dt; this.actionTime += dt;
    this.fear = Math.max(0, this.fear - dt * .15); this.senseTimer -= dt;
    if (this.senseTimer <= 0) { this.senseTimer = .2 + this.curiosity * .12; this.perceive(environment); }
    const local = environment.sample(this.x, this.y);
    const weather = local.wind > 1.2 ? 1.15 : local.light < .4 ? .9 : 1;
    this.alertness = ease(this.alertness, 0, 3, dt);
    if (this.state === 'turn') {
      const desired = Math.atan2(this.target.y - this.y, this.target.x - this.x), delta = angleDelta(this.heading, desired);
      this.turnSpeed = ease(this.turnSpeed, Math.min(DEER_TURN_RATE, Math.abs(delta) * 7), .1, dt);
      this.heading += Math.sign(delta) * Math.min(Math.abs(delta), this.turnSpeed * dt);
      this.gait += dt * this.turnSpeed / DEER_TURN_RATE;
      if (Math.abs(angleDelta(this.heading, desired)) < .015) {
        this.heading = desired; this.gait = 0; this.motor.stop(); this.turnSpeed = 0; this.enter(this.locomotion, 25);
      }
      return;
    }
    if (this.state === 'walk' || this.state === 'run') {
      const dx = this.target.x - this.x, dy = this.target.y - this.y, distance = Math.hypot(dx, dy);
      const desired = Math.atan2(dy, dx);
      if (distance > .002) {
        const delta = angleDelta(this.heading, desired);
        this.heading += clamp(delta, -DEER_TURN_RATE * dt, DEER_TURN_RATE * dt);
      }
      const running = this.state === 'run';
      // ~2.3 full running strides/second at nominal speed, vs the old slow-motion 0.94.
      const cruise = (running ? 1.05 : .14) * this.pace * this.tripPace * weather * (this.juvenile ? .93 : 1) * Math.max(.2, Math.cos(angleDelta(this.heading, desired)));
      const acceleration = (running ? 3.5 : .6) * weather;
      const wanted = Math.min(cruise, Math.sqrt(2 * acceleration * distance) * .75, distance / (running ? .18 : .24));
      this.motor.update(wanted, dt, acceleration, running ? 22 : 4.5, running ? .13 : .2);
      const step = Math.min(distance, this.speed * dt);
      const x = this.x + Math.cos(this.heading) * step, y = this.y + Math.sin(this.heading) * step;
      if (environment.canMove(x, y)) { this.x = x; this.y = y; this.gait += step / ((running ? DEER_RUN_STRIDE : DEER_STRIDE) * this.size); }
      else { this.motor.stop(); this.timer = 0; }
      if (distance <= .002 || step >= distance) { this.motor.stop(); this.timer = 0; }
    }
    if (this.timer > 0) return;
    if (this.state === 'graze') {
      // Neighbor reads are infrequent decisions, not an all-pairs query every animation tick.
      const rushing = environment.nearby(this.x, this.y, 1.4).some(n => n.id !== this.id && n.speed > .55);
      this.alertness = rushing ? .8 : 0; this.enter('raise', HEAD_SECONDS);
    } else if (this.state === 'raise') this.enter('look', .6 + this.random.next() * (1 + this.curiosity) * (1 - this.alertness));
    else if (this.state === 'lower') this.enter('graze', (local.light < .4 ? 8 : 3) + this.random.next() * 7);
    else if (this.state === 'look') {
      const running = this.fear > .2 || this.random.next() < (local.light < .4 ? .025 : .06) + this.alertness * .15;
      const social = herdIntent(this, environment.nearby(this.x, this.y, 5));
      let target: Vec2 | undefined;
      for (let attempt = 0; attempt < 24; attempt++) {
        const angle = this.random.next() * TAU, length = running ? 1.6 + this.random.next() * 2 : .4 + this.random.next() * 1.2;
        const x = clamp(social && attempt < 12 ? social.target.x + (this.random.next() - .5) * .3 : this.x + Math.cos(angle) * length, this.territory[0] + .14, this.territory[2] - .14);
        const y = clamp(social && attempt < 12 ? social.target.y + (this.random.next() - .5) * .3 : this.y + Math.sin(angle) * length, this.territory[1] + .14, this.territory[3] - .14);
        const distance = Math.hypot(x - this.x, y - this.y);
        if (distance < (running ? 1.1 : .2)) continue;
        if (environment.nearby(x, y, .3).some(n => n.id !== this.id)) continue;
        let clear = true;
        const samples = Math.ceil(distance / .06);
        for (let j = 1; j <= samples; j++) if (!environment.canMove(this.x + (x - this.x) * j / samples, this.y + (y - this.y) * j / samples)) { clear = false; break; }
        if (clear) { target = { x, y }; break; }
      }
      if (target) {
        this.target = target; this.tripPace = .85 + this.random.next() * .3;
        this.locomotion = running ? 'run' : 'walk'; this.gait = 0; this.enter('turn', 4);
      } else this.enter('lower', HEAD_SECONDS);
    } else { this.motor.stop(); this.enter('lower', HEAD_SECONDS); }
  }
  private perceive(env: AgentEnvironment): void {
    const neighbors = env.nearby(this.x, this.y, 5);
    if(this.startle.sense(this,neighbors)){
      this.alertness=1;this.fear=Math.max(this.fear,.4);
      for(const length of [1.5,.8,.4])for(const offset of [0,.45,-.45,.9,-.9]){
        const angle=this.startle.heading+offset,x=this.x+Math.cos(angle)*length,y=this.y+Math.sin(angle)*length;
        if(x<this.territory[0]+.15||y<this.territory[1]+.15||x>this.territory[2]-.15||y>this.territory[3]-.15||!this.clearPath(x,y,env))continue;
        this.target={x,y};this.locomotion='run';this.tripPace=1.1;this.motor.stop();this.enter('turn',4);return;
      }
      this.target={x:this.x+Math.cos(this.startle.heading)*.01,y:this.y+Math.sin(this.startle.heading)*.01};
      this.locomotion='walk';this.motor.stop();this.enter('turn',3);return;
    }
    const predator = neighbors.filter(n => n.kind === 'jaguar' || n.kind === 'wolf' || n.kind === 'boar').sort((a, b) => Math.hypot(a.x-this.x,a.y-this.y)-Math.hypot(b.x-this.x,b.y-this.y)||a.id.localeCompare(b.id))[0];
    const danger = predator && Math.hypot(predator.x-this.x,predator.y-this.y) < 2.5;
    const social = herdIntent(this, neighbors);
    if (danger || (social && social.urgency > .5)) {
      this.fear = 1; this.alertness = 1;
      const dx = danger ? this.x - predator.x : social!.target.x-this.x, dy = danger ? this.y-predator.y : social!.target.y-this.y;
      const base = Math.atan2(dy, dx);
      for (const offset of [0, .45, -.45, .9, -.9, 1.5, -1.5]) {
        const angle = base + offset, x = clamp(this.x + Math.cos(angle) * 1.8, this.territory[0]+.15, this.territory[2]-.15), y = clamp(this.y + Math.sin(angle) * 1.8, this.territory[1]+.15, this.territory[3]-.15);
        if (Math.hypot(x-this.x,y-this.y) > .35 && this.clearPath(x,y,env)) { this.target = {x,y}; this.locomotion = 'run';
          if (this.state === 'walk' || this.state === 'run') this.state = 'run';
          else if (this.state === 'graze' || this.state === 'lower') this.enter('raise', HEAD_SECONDS * .55);
          else if (this.state === 'look') this.enter('turn', 4);
          return; }
      }
    }
    if (!social || this.fear > .2) return;
    const distance = Math.hypot(social.target.x-this.x,social.target.y-this.y);
    if (distance > (this.juvenile ? .35 : .65) && this.clearPath(social.target.x,social.target.y,env)) {
      this.target = {x: clamp(social.target.x,this.territory[0]+.15,this.territory[2]-.15), y: clamp(social.target.y,this.territory[1]+.15,this.territory[3]-.15)};
      this.locomotion = distance > 1.25 ? 'run' : 'walk';
      if (this.state === 'walk' || this.state === 'run') { this.state = this.locomotion; this.timer = 25; }
      else if (this.state === 'graze') this.timer = Math.min(this.timer, this.juvenile ? .15 : .5);
      else if (this.state === 'look') { this.enter('turn',4); }
    }
  }
  private clearPath(x: number,y: number,env: AgentEnvironment): boolean {
    const count = Math.ceil(Math.hypot(x-this.x,y-this.y)/.08);
    for(let i=1;i<=count;i++) if(!env.canMove(this.x+(x-this.x)*i/count,this.y+(y-this.y)*i/count)) return false;
    return true;
  }
  write(w: BinaryWriter): void {
    w.string(this.id); w.string(this.groupId); w.string(this.leaderId); w.string(this.motherId); w.u8(Number(this.juvenile)); w.u8(this.coat);
    for(const n of [this.size,this.senseTimer,this.fear]) w.f64(n);
    w.u32(this.random.state); w.u8(states.indexOf(this.state)); w.u8(this.locomotion === 'run' ? 1 : 0);
    for (const n of [this.x, this.y, this.heading, this.gait, this.actionTime, this.timer, this.target.x, this.target.y, this.phase,
      this.pace, this.tripPace, this.speed, this.motor.acceleration, this.alertness, this.curiosity, this.turnSpeed, ...this.territory,
      this.previous.x, this.previous.y, this.previous.heading, this.previous.gait, this.previous.actionTime]) w.f64(n);
    w.u8(states.indexOf(this.previous.state));this.startle.write(w);
  }
  static read(r: BinaryReader): DeerAgent {
    const id = r.string(), group = r.string(), leader = r.string(), mother = r.string(), juvenile = r.u8(), coat = r.u8(), size = r.f64(), sense = r.f64(), fear = r.f64();
    if(juvenile > 1 || coat > 2 || size <= 0) throw new Error('Invalid deer traits');
    const seed = r.u32(), state = states[r.u8()], run = r.u8();
    if (!state || run > 1) throw new Error('Invalid deer state');
    const a = new DeerAgent(id, r.f64(), r.f64(), seed); a.groupId = group; a.leaderId = leader; a.motherId = mother; a.juvenile = Boolean(juvenile); a.coat = coat; a.size = size; a.senseTimer = sense; a.fear = fear; a.random.state = seed; a.state = state; a.locomotion = run ? 'run' : 'walk';
    a.heading = r.f64(); a.gait = r.f64(); a.actionTime = r.f64(); a.timer = r.f64(); a.target = { x: r.f64(), y: r.f64() };
    a.phase = r.f64(); a.pace = r.f64(); a.tripPace = r.f64(); a.speed = r.f64(); a.motor.acceleration = r.f64();
    a.alertness = r.f64(); a.curiosity = r.f64(); a.turnSpeed = r.f64();
    a.territory = [r.f64(), r.f64(), r.f64(), r.f64()];
    a.previous = { x: r.f64(), y: r.f64(), heading: r.f64(), gait: r.f64(), actionTime: r.f64(), state: states[r.u8()]! };
    a.startle.read(r);
    if (!a.previous.state) throw new Error('Invalid previous deer state'); return a;
  }
}
