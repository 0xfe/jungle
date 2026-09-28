import { clamp } from '../iso/math';
/** Acceleration has a bounded rate of change (jerk), giving rounded starts and stops. */
export class SpeedMotor {
  speed = 0; acceleration = 0;
  update(target: number, dt: number, maxAcceleration: number, maxJerk: number, response = .18): number {
    const desired = clamp((target - this.speed) / response, -maxAcceleration, maxAcceleration);
    this.acceleration += clamp(desired - this.acceleration, -maxJerk * dt, maxJerk * dt);
    this.speed = Math.max(0, this.speed + this.acceleration * dt);
    if (this.speed === 0 && this.acceleration < 0) this.acceleration = 0;
    return this.speed;
  }
  stop(): void { this.speed = this.acceleration = 0; }
}
/** Frame-rate-independent easing for environmental parameters and camera velocity. */
export function ease(current: number, target: number, response: number, dt: number): number {
  return target + (current - target) * Math.exp(-dt / Math.max(.001, response));
}
