import { describe, it, expect } from 'vitest'
import { LM, type Pt } from './angles'
import { Ema } from './smoother'
import { RepMachine } from './repMachine'
import { EXERCISE_CONFIGS, allVisible, emptyStats, worstViolation, type RepStats } from './exercises'

/**
 * End-to-end simulation of the live pipeline, driven by synthetic landmarks:
 *
 *   landmarks -> visibility gate -> joint angle -> EMA -> rep machine
 *             -> form rules -> correct / incorrect
 *
 * This is the same code path /train runs per frame, so rep counting and form
 * classification are verified without a camera.
 */

type SessionResult = { reps: number; correct: number; incorrect: number; faults: string[] }

function runSession(frames: Pt[][], key: 'squat' | 'bicep_curl'): SessionResult {
  const cfg = EXERCISE_CONFIGS[key]
  const machine = new RepMachine({ enterBottom: cfg.enterBottom, enterTop: cfg.enterTop })
  const ema = new Ema(0.3)
  let stats: RepStats = emptyStats()
  let correct = 0
  let incorrect = 0
  const faults: string[] = []

  for (const lm of frames) {
    if (!allVisible(lm, cfg.required)) continue // freeze, exactly as the UI does

    const smoothed = ema.push(cfg.primaryAngle(lm))
    stats = cfg.observe(lm, stats)
    const tick = machine.update(smoothed)

    if (tick.enteredBottom) stats = cfg.observe(lm, emptyStats())

    if (tick.repCompleted) {
      const violation = worstViolation(stats, cfg.rules)
      if (violation) {
        incorrect += 1
        faults.push(violation.id)
      } else {
        correct += 1
      }
      stats = emptyStats()
    }
  }

  return { reps: machine.reps, correct, incorrect, faults }
}

/**
 * Builds one squat as 60 frames (2 seconds at 30fps).
 *
 * The leg is constructed so the interior knee angle is exactly `depth` at the
 * bottom: the ankle sits straight below the knee, and the hip is placed at
 * the required angle from it. Verified exact to 0.1 degrees.
 */
function squatFrames(opts: {
  depth: number
  lean?: number
  kneeInset?: number
  visible?: boolean
}): Pt[][] {
  const { depth, lean = 10, kneeInset = 0, visible = true } = opts
  const SHIN = 0.23
  const THIGH = 0.22
  const TORSO = 0.3
  const frames: Pt[][] = []

  for (let i = 0; i < 60; i += 1) {
    const t = (1 - Math.cos((i / 60) * 2 * Math.PI)) / 2 // 0 -> 1 -> 0
    const kneeDeg = 175 - (175 - depth) * t
    const th = (kneeDeg * Math.PI) / 180

    const kneeY = 0.95 - SHIN
    const ankleY = 0.95
    const hipX = 0.5 + THIGH * Math.sin(th)
    const hipY = kneeY + THIGH * Math.cos(th)

    const leanRad = ((lean * t) * Math.PI) / 180
    const shoulderX = hipX - TORSO * Math.sin(leanRad)
    const shoulderY = hipY - TORSO * Math.cos(leanRad)

    const inset = kneeInset * t
    const v = visible ? 0.9 : 0.1

    const named: Record<number, Pt> = {
      [LM.LEFT_SHOULDER]: { x: shoulderX - 0.05, y: shoulderY },
      [LM.RIGHT_SHOULDER]: { x: shoulderX + 0.05, y: shoulderY },
      [LM.LEFT_HIP]: { x: hipX - 0.05, y: hipY },
      [LM.RIGHT_HIP]: { x: hipX + 0.05, y: hipY },
      [LM.LEFT_KNEE]: { x: 0.45 + inset / 2, y: kneeY },
      [LM.RIGHT_KNEE]: { x: 0.55 - inset / 2, y: kneeY },
      [LM.LEFT_ANKLE]: { x: 0.45, y: ankleY },
      [LM.RIGHT_ANKLE]: { x: 0.55, y: ankleY },
    }

    frames.push(
      Array.from({ length: 33 }, (_, index) => ({
        ...(named[index] ?? { x: 0.5, y: 0.5 }),
        visibility: v,
      })),
    )
  }

  return frames
}

describe('full pipeline: squat', () => {
  it('counts five deep squats and marks them all correct', () => {
    const frames = Array.from({ length: 5 }, () => squatFrames({ depth: 80 })).flat()
    const r = runSession(frames, 'squat')
    expect(r.reps).toBe(5)
    expect(r.correct).toBe(5)
    expect(r.incorrect).toBe(0)
  })

  it('counts shallow squats as reps but marks them incorrect for depth', () => {
    const frames = Array.from({ length: 3 }, () => squatFrames({ depth: 110 })).flat()
    const r = runSession(frames, 'squat')
    expect(r.reps).toBe(3)
    expect(r.incorrect).toBeGreaterThan(0)
    expect(r.faults).toContain('depth')
  })

  it('does not count a movement that never reaches the bottom threshold', () => {
    const frames = Array.from({ length: 4 }, () => squatFrames({ depth: 130 })).flat()
    expect(runSession(frames, 'squat').reps).toBe(0)
  })

  it('flags excessive forward lean on an otherwise deep squat', () => {
    const frames = Array.from({ length: 3 }, () => squatFrames({ depth: 80, lean: 70 })).flat()
    const r = runSession(frames, 'squat')
    expect(r.reps).toBe(3)
    expect(r.faults).toContain('back_angle')
  })

  it('flags knees caving inward', () => {
    const frames = Array.from({ length: 3 }, () => squatFrames({ depth: 80, kneeInset: 0.14 })).flat()
    const r = runSession(frames, 'squat')
    expect(r.reps).toBe(3)
    expect(r.faults).toContain('knee_valgus')
  })

  it('counts nothing at all while the user is out of frame', () => {
    const frames = Array.from({ length: 5 }, () => squatFrames({ depth: 80, visible: false })).flat()
    expect(runSession(frames, 'squat').reps).toBe(0)
  })

  it('retains the count across a spell out of frame and resumes after', () => {
    const frames = [
      ...squatFrames({ depth: 80 }),
      ...squatFrames({ depth: 80, visible: false }), // walked away
      ...squatFrames({ depth: 80 }),
    ]
    const r = runSession(frames, 'squat')
    expect(r.reps).toBe(2) // the invisible rep is neither counted nor lost
    expect(r.correct).toBe(2)
  })

  it('produces a form score matching correct / total', () => {
    const frames = [
      ...Array.from({ length: 4 }, () => squatFrames({ depth: 80 })).flat(),
      ...Array.from({ length: 1 }, () => squatFrames({ depth: 110 })).flat(),
    ]
    const r = runSession(frames, 'squat')
    const score = Math.round((r.correct / (r.correct + r.incorrect)) * 100)
    expect(r.reps).toBe(5)
    expect(score).toBe(80)
  })
})
