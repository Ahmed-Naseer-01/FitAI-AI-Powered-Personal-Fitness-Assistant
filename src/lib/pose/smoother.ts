/**
 * Exponential moving average: smoothed = (1-alpha)*previous + alpha*current.
 *
 * MediaPipe landmarks wobble a few pixels per frame, and a wobbling landmark
 * means a wobbling angle. alpha 0.3 matches the design's 0.7/0.3 weighting
 * and removes the jitter that would otherwise produce phantom reps.
 */
export class Ema {
  private current: number | null = null

  constructor(private readonly alpha: number = 0.3) {}

  push(value: number): number {
    this.current =
      this.current === null ? value : (1 - this.alpha) * this.current + this.alpha * value
    return this.current
  }

  get value(): number | null {
    return this.current
  }

  reset(): void {
    this.current = null
  }
}
