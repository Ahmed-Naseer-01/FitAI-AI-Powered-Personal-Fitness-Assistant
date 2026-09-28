export type Phase = 'top' | 'bottom'

export type Tick = {
  phase: Phase
  /** True on the single frame the user crossed into the bottom phase. */
  enteredBottom: boolean
  /** True on the single frame a repetition completed. */
  repCompleted: boolean
}

/**
 * Two-state machine with hysteresis.
 *
 *   top ──(value < enterBottom)──▶ bottom ──(value > enterTop)──▶ top  ✓ rep
 *
 * The gap between the thresholds is what prevents a value hovering near a
 * single cutoff from racking up phantom reps. A rep is counted only on the
 * bottom→top transition, so it necessarily represents a full movement down
 * and back up again.
 */
export class RepMachine {
  private _phase: Phase = 'top'
  private _reps = 0

  constructor(private readonly cfg: { enterBottom: number; enterTop: number }) {}

  get phase(): Phase {
    return this._phase
  }

  get reps(): number {
    return this._reps
  }

  update(value: number): Tick {
    let enteredBottom = false
    let repCompleted = false

    if (this._phase === 'top' && value < this.cfg.enterBottom) {
      this._phase = 'bottom'
      enteredBottom = true
    } else if (this._phase === 'bottom' && value > this.cfg.enterTop) {
      this._phase = 'top'
      this._reps += 1
      repCompleted = true
    }

    return { phase: this._phase, enteredBottom, repCompleted }
  }

  reset(): void {
    this._phase = 'top'
    this._reps = 0
  }
}
