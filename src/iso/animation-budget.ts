import { clamp } from './math';

export interface AnimationBudgetOptions {
  /** CPU submission budget in milliseconds, not a GPU completion measurement. */
  targetMs: number;
  /** Fraction of optional motion detail retained under sustained load. */
  minimum: number;
  /** Seconds for the cost average and detail transitions to settle. */
  responseSeconds: number;
}

/** Presentation-only feedback. Never changes simulation steps, clocks or populations. */
export class AnimationBudget {
  detail = 1;
  private average = 0;
  constructor(private readonly options: AnimationBudgetOptions) {}
  record(cpuMs: number, elapsed: number): void {
    if (!Number.isFinite(cpuMs) || cpuMs < 0 || !Number.isFinite(elapsed) || elapsed <= 0) return;
    const blend = 1 - Math.exp(-Math.min(elapsed, .1) / this.options.responseSeconds);
    this.average += (cpuMs - this.average) * blend;
    // A dead band avoids oscillating detail around the budget; every patch keeps
    // its broad breeze even when the optional crown ripples become sparse.
    const target = this.average > this.options.targetMs ? this.options.minimum
      : this.average < this.options.targetMs * .7 ? 1 : this.detail;
    this.detail = clamp(this.detail + (target - this.detail) * blend, this.options.minimum, 1);
  }
}
