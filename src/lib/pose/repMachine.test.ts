import { describe, it, expect } from 'vitest'
import { Ema } from './smoother'
import { RepMachine } from './repMachine'

/** Squat thresholds from the design document. */
const SQUAT = { enterBottom: 100, enterTop: 160 }

/** One full squat: stand, descend, bottom out, ascend. */
function squatCycle(bottomAngle: number): number[] {
  return [170, 160, 140, 120, bottomAngle, bottomAngle, 120, 140, 165, 175]
}

describe('Ema', () => {
  it('returns the first value unchanged', () => {
    expect(new Ema(0.3).push(100)).toBe(100)
  })

  it('weights the previous value at 0.7 and the new one at 0.3', () => {
    const ema = new Ema(0.3)
    ema.push(100)
    expect(ema.push(200)).toBeCloseTo(130, 5) // 0.7*100 + 0.3*200
  })

  it('converges towards a steady signal', () => {
    const ema = new Ema(0.3)
    ema.push(0)
    for (let i = 0; i < 50; i += 1) ema.push(100)
    expect(ema.value).toBeCloseTo(100, 1)
  })

  it('damps single-frame spikes', () => {
    const ema = new Ema(0.3)
    for (let i = 0; i < 10; i += 1) ema.push(100)
    const afterSpike = ema.push(400)
    expect(afterSpike).toBeLessThan(200) // a 4x spike must not pass through
  })

  it('reset clears the state', () => {
    const ema = new Ema(0.3)
    ema.push(100)
    ema.reset()
    expect(ema.value).toBeNull()
    expect(ema.push(50)).toBe(50)
  })
})

describe('RepMachine', () => {
  it('starts at the top with zero reps', () => {
    const m = new RepMachine(SQUAT)
    expect(m.reps).toBe(0)
    expect(m.phase).toBe('top')
  })

  it('counts one rep for one full down-up cycle', () => {
    const m = new RepMachine(SQUAT)
    for (const v of squatCycle(85)) m.update(v)
    expect(m.reps).toBe(1)
    expect(m.phase).toBe('top')
  })

  it('counts ten reps for ten cycles', () => {
    const m = new RepMachine(SQUAT)
    for (let i = 0; i < 10; i += 1) for (const v of squatCycle(85)) m.update(v)
    expect(m.reps).toBe(10)
  })

  it('does not count a partial descent that never reaches the bottom threshold', () => {
    const m = new RepMachine(SQUAT)
    for (const v of [170, 150, 130, 115, 130, 150, 170]) m.update(v)
    expect(m.reps).toBe(0)
  })

  it('does not count until the user returns to the top', () => {
    const m = new RepMachine(SQUAT)
    for (const v of [170, 140, 90, 90, 110, 130]) m.update(v)
    expect(m.reps).toBe(0)
    expect(m.phase).toBe('bottom')
    m.update(165)
    expect(m.reps).toBe(1)
  })

  it('ignores jitter in the dead band between thresholds', () => {
    const m = new RepMachine(SQUAT)
    for (let i = 0; i < 200; i += 1) m.update(130 + (i % 2 === 0 ? 1 : -1))
    expect(m.reps).toBe(0)
  })

  it('ignores jitter right at a threshold', () => {
    const m = new RepMachine(SQUAT)
    // Oscillating across enterBottom without ever reaching enterTop.
    for (let i = 0; i < 100; i += 1) m.update(i % 2 === 0 ? 99 : 101)
    expect(m.reps).toBe(0)
  })

  it('reports enteredBottom exactly once per descent', () => {
    const m = new RepMachine(SQUAT)
    let entries = 0
    for (const v of squatCycle(85)) if (m.update(v).enteredBottom) entries += 1
    expect(entries).toBe(1)
  })

  it('reports repCompleted exactly once per ascent', () => {
    const m = new RepMachine(SQUAT)
    let completions = 0
    for (let i = 0; i < 4; i += 1) {
      for (const v of squatCycle(85)) if (m.update(v).repCompleted) completions += 1
    }
    expect(completions).toBe(4)
  })

  it('retains the count across a gap, as when the user leaves frame', () => {
    const m = new RepMachine(SQUAT)
    for (const v of squatCycle(85)) m.update(v)
    // Frames are simply not fed while the user is out of shot.
    for (const v of squatCycle(85)) m.update(v)
    expect(m.reps).toBe(2)
  })

  it('reset clears the count and returns to the top phase', () => {
    const m = new RepMachine(SQUAT)
    for (const v of squatCycle(85)) m.update(v)
    m.reset()
    expect(m.reps).toBe(0)
    expect(m.phase).toBe('top')
  })

  it('counts correctly on a smoothed signal at a realistic frame rate', () => {
    // A real squat takes about 2 seconds, so ~60 frames at 30fps. Sampling a
    // cosine between 170 and 80 degrees, with per-frame landmark noise.
    function realisticCycle(frames = 60): number[] {
      const out: number[] = []
      for (let i = 0; i < frames; i += 1) {
        const phase = (i / frames) * 2 * Math.PI
        const clean = 125 + 45 * Math.cos(phase) // 170 at top, 80 at bottom
        const noise = (i % 3 === 0 ? 1 : -1) * 2.5 // landmark jitter
        out.push(clean + noise)
      }
      return out
    }

    const m = new RepMachine(SQUAT)
    const ema = new Ema(0.3)
    for (let rep = 0; rep < 5; rep += 1) {
      for (const v of realisticCycle()) m.update(ema.push(v))
    }
    expect(m.reps).toBe(5)
  })

  it('smoothing suppresses a movement faster than the filter can follow', () => {
    // Documented limitation: the EMA has a time constant of roughly 3 frames,
    // so a rep completed in well under half a second at 30fps is damped below
    // the thresholds and missed. Real repetitions take 1-3 seconds.
    const m = new RepMachine(SQUAT)
    const ema = new Ema(0.3)
    const tooFast = [175, 130, 84, 130, 175] // a 5-frame rep, ~0.17s
    for (let i = 0; i < 5; i += 1) for (const v of tooFast) m.update(ema.push(v))
    expect(m.reps).toBeLessThan(5)
  })

  it('counts the same reps with and without smoothing on a clean slow signal', () => {
    function slowCycle(): number[] {
      const out: number[] = []
      for (let i = 0; i < 60; i += 1) out.push(125 + 45 * Math.cos((i / 60) * 2 * Math.PI))
      return out
    }

    const raw = new RepMachine(SQUAT)
    const smoothed = new RepMachine(SQUAT)
    const ema = new Ema(0.3)
    for (let i = 0; i < 3; i += 1) {
      for (const v of slowCycle()) {
        raw.update(v)
        smoothed.update(ema.push(v))
      }
    }
    expect(smoothed.reps).toBe(raw.reps)
    expect(raw.reps).toBe(3)
  })

  it('a noisy signal without smoothing still does not over-count, thanks to hysteresis', () => {
    const m = new RepMachine(SQUAT)
    const noisy = [175, 98, 172, 96, 175, 99, 170]
    for (const v of noisy) m.update(v)
    expect(m.reps).toBe(3) // three genuine crossings, not one per frame
  })
})

describe('RepMachine with bicep curl thresholds', () => {
  // Curl: bottom = flexed (elbow < 50), top = extended (elbow > 150).
  const CURL = { enterBottom: 50, enterTop: 150 }

  it('counts a rep on the return to full extension', () => {
    const m = new RepMachine(CURL)
    for (const v of [170, 140, 90, 45, 40, 45, 90, 140, 165]) m.update(v)
    expect(m.reps).toBe(1)
  })

  it('does not count a half curl', () => {
    const m = new RepMachine(CURL)
    for (const v of [170, 140, 100, 75, 100, 140, 170]) m.update(v)
    expect(m.reps).toBe(0)
  })

  it('does not count when the arm never fully extends again', () => {
    const m = new RepMachine(CURL)
    for (const v of [170, 40, 100, 40, 100, 40]) m.update(v)
    expect(m.reps).toBe(0)
  })
})
