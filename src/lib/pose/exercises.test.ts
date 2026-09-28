import { describe, it, expect } from 'vitest'
import { LM, type Pt } from './angles'
import { EXERCISE_CONFIGS, emptyStats, worstViolation, allVisible } from './exercises'

/** A 33-slot landmark array with the joints we care about overridden. */
function makeLandmarks(overrides: Record<number, Pt>): Pt[] {
  const lm: Pt[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }))
  for (const [index, point] of Object.entries(overrides)) {
    lm[Number(index)] = { visibility: 0.9, ...point }
  }
  return lm
}

/** A standing figure: knees straight, torso vertical, knees over ankles. */
function standing(): Pt[] {
  return makeLandmarks({
    [LM.LEFT_SHOULDER]: { x: 0.45, y: 0.2 }, [LM.RIGHT_SHOULDER]: { x: 0.55, y: 0.2 },
    [LM.LEFT_HIP]: { x: 0.45, y: 0.5 }, [LM.RIGHT_HIP]: { x: 0.55, y: 0.5 },
    [LM.LEFT_KNEE]: { x: 0.45, y: 0.72 }, [LM.RIGHT_KNEE]: { x: 0.55, y: 0.72 },
    [LM.LEFT_ANKLE]: { x: 0.45, y: 0.95 }, [LM.RIGHT_ANKLE]: { x: 0.55, y: 0.95 },
  })
}

describe('allVisible', () => {
  it('is true when every required landmark is above the threshold', () => {
    expect(allVisible(standing(), EXERCISE_CONFIGS.squat.required)).toBe(true)
  })

  it('is false when one required landmark is occluded', () => {
    const lm = standing()
    lm[LM.LEFT_KNEE] = { ...lm[LM.LEFT_KNEE], visibility: 0.2 }
    expect(allVisible(lm, EXERCISE_CONFIGS.squat.required)).toBe(false)
  })

  it('is false when a landmark is missing entirely', () => {
    const lm = standing()
    lm[LM.LEFT_ANKLE] = undefined as unknown as Pt
    expect(allVisible(lm, EXERCISE_CONFIGS.squat.required)).toBe(false)
  })

  it('is false when visibility is absent from the landmark', () => {
    const lm = standing()
    lm[LM.LEFT_HIP] = { x: 0.45, y: 0.5 }
    expect(allVisible(lm, EXERCISE_CONFIGS.squat.required)).toBe(false)
  })
})

describe('squat config', () => {
  const squat = EXERCISE_CONFIGS.squat

  it('reads a near-straight knee angle when standing', () => {
    expect(squat.primaryAngle(standing())).toBeGreaterThan(160)
  })

  it('reads a small knee angle at the bottom of a deep squat', () => {
    const lm = makeLandmarks({
      [LM.LEFT_SHOULDER]: { x: 0.45, y: 0.45 }, [LM.RIGHT_SHOULDER]: { x: 0.55, y: 0.45 },
      [LM.LEFT_HIP]: { x: 0.42, y: 0.7 }, [LM.RIGHT_HIP]: { x: 0.52, y: 0.7 },
      [LM.LEFT_KNEE]: { x: 0.55, y: 0.72 }, [LM.RIGHT_KNEE]: { x: 0.65, y: 0.72 },
      [LM.LEFT_ANKLE]: { x: 0.45, y: 0.95 }, [LM.RIGHT_ANKLE]: { x: 0.55, y: 0.95 },
    })
    expect(squat.primaryAngle(lm)).toBeLessThan(110)
  })

  it('records near-zero torso lean when standing upright', () => {
    expect(squat.observe(standing(), emptyStats()).maxTorsoLean).toBeLessThan(5)
  })

  it('records a large torso lean when bent forward', () => {
    const lm = standing()
    lm[LM.LEFT_SHOULDER] = { x: 0.2, y: 0.35, visibility: 0.9 }
    lm[LM.RIGHT_SHOULDER] = { x: 0.3, y: 0.35, visibility: 0.9 }
    expect(squat.observe(lm, emptyStats()).maxTorsoLean).toBeGreaterThan(45)
  })

  it('records knee inset when the knees cave inward', () => {
    const lm = standing()
    lm[LM.LEFT_KNEE] = { x: 0.49, y: 0.72, visibility: 0.9 }
    lm[LM.RIGHT_KNEE] = { x: 0.51, y: 0.72, visibility: 0.9 }
    // ankles 0.10 apart, knees 0.02 apart -> inset 0.08
    expect(squat.observe(lm, emptyStats()).maxKneeInset).toBeCloseTo(0.08, 2)
  })

  it('records no inset when the knees track wider than the ankles', () => {
    const lm = standing()
    lm[LM.LEFT_KNEE] = { x: 0.40, y: 0.72, visibility: 0.9 }
    lm[LM.RIGHT_KNEE] = { x: 0.60, y: 0.72, visibility: 0.9 }
    expect(squat.observe(lm, emptyStats()).maxKneeInset).toBe(0)
  })

  it('keeps the maximum across repeated observations', () => {
    let stats = emptyStats()
    stats = squat.observe(standing(), stats)

    const leaning = standing()
    leaning[LM.LEFT_SHOULDER] = { x: 0.2, y: 0.35, visibility: 0.9 }
    leaning[LM.RIGHT_SHOULDER] = { x: 0.3, y: 0.35, visibility: 0.9 }
    stats = squat.observe(leaning, stats)
    stats = squat.observe(standing(), stats)

    expect(stats.maxTorsoLean).toBeGreaterThan(45)
  })

  it('does not mutate the stats passed in', () => {
    const stats = emptyStats()
    squat.observe(standing(), stats)
    expect(stats.maxTorsoLean).toBe(0)
  })
})

describe('squat form rules', () => {
  const rules = EXERCISE_CONFIGS.squat.rules
  const clean = { ...emptyStats(), minPrimary: 85, maxPrimary: 172, maxTorsoLean: 20, maxKneeInset: 0.01 }

  it('finds no violation for a clean rep', () => {
    expect(worstViolation(clean, rules)).toBeNull()
  })

  it('flags insufficient depth', () => {
    const v = worstViolation({ ...clean, minPrimary: 115 }, rules)
    expect(v?.id).toBe('depth')
    expect(v?.message).toBe('Go slightly lower')
  })

  it('flags excessive forward lean', () => {
    expect(worstViolation({ ...clean, maxTorsoLean: 60 }, rules)?.id).toBe('back_angle')
  })

  it('flags knees caving in', () => {
    expect(worstViolation({ ...clean, maxKneeInset: 0.15 }, rules)?.id).toBe('knee_valgus')
  })

  it('reports only the highest-priority violation when several apply', () => {
    const v = worstViolation({ ...clean, minPrimary: 120, maxTorsoLean: 70, maxKneeInset: 0.2 }, rules)
    expect(v?.id).toBe('depth')
  })

  it('accepts a rep exactly at the depth threshold', () => {
    expect(worstViolation({ ...clean, minPrimary: 100 }, rules)).toBeNull()
  })
})

describe('bicep curl config and rules', () => {
  const curl = EXERCISE_CONFIGS.bicep_curl
  const rules = curl.rules
  const clean = { ...emptyStats(), minPrimary: 40, maxPrimary: 168, maxArmDrift: 8 }

  function extendedArm(): Pt[] {
    return makeLandmarks({
      [LM.LEFT_SHOULDER]: { x: 0.4, y: 0.3 }, [LM.RIGHT_SHOULDER]: { x: 0.6, y: 0.3 },
      [LM.LEFT_ELBOW]: { x: 0.4, y: 0.5 }, [LM.RIGHT_ELBOW]: { x: 0.6, y: 0.5 },
      [LM.LEFT_WRIST]: { x: 0.4, y: 0.7 }, [LM.RIGHT_WRIST]: { x: 0.6, y: 0.7 },
    })
  }

  it('reads a near-straight elbow angle when the arm hangs down', () => {
    expect(curl.primaryAngle(extendedArm())).toBeGreaterThan(170)
  })

  it('reads a small elbow angle when fully curled', () => {
    const lm = extendedArm()
    lm[LM.LEFT_WRIST] = { x: 0.4, y: 0.33, visibility: 0.9 }
    lm[LM.RIGHT_WRIST] = { x: 0.6, y: 0.33, visibility: 0.9 }
    expect(curl.primaryAngle(lm)).toBeLessThan(45)
  })

  it('records no arm drift when the upper arm hangs vertically', () => {
    expect(curl.observe(extendedArm(), emptyStats()).maxArmDrift).toBeLessThan(5)
  })

  it('records arm drift when the elbow swings forward', () => {
    const lm = extendedArm()
    lm[LM.LEFT_ELBOW] = { x: 0.55, y: 0.5, visibility: 0.9 }
    expect(curl.observe(lm, emptyStats()).maxArmDrift).toBeGreaterThan(20)
  })

  it('takes the worse of the two arms for drift', () => {
    const lm = extendedArm()
    lm[LM.RIGHT_ELBOW] = { x: 0.75, y: 0.5, visibility: 0.9 }
    expect(curl.observe(lm, emptyStats()).maxArmDrift).toBeGreaterThan(20)
  })

  it('finds no violation for a clean rep', () => {
    expect(worstViolation(clean, rules)).toBeNull()
  })

  it('flags an incomplete curl', () => {
    expect(worstViolation({ ...clean, minPrimary: 75 }, rules)?.id).toBe('range')
  })

  it('flags incomplete extension', () => {
    expect(worstViolation({ ...clean, maxPrimary: 130 }, rules)?.id).toBe('extension')
  })

  it('flags elbow drift', () => {
    expect(worstViolation({ ...clean, maxArmDrift: 35 }, rules)?.id).toBe('elbow_drift')
  })
})

describe('config completeness', () => {
  it('defines thresholds, landmarks, a hint and rules for every exercise', () => {
    for (const cfg of Object.values(EXERCISE_CONFIGS)) {
      expect(cfg.required.length).toBeGreaterThan(0)
      expect(cfg.enterBottom).toBeLessThan(cfg.enterTop)
      expect(cfg.setupHint.length).toBeGreaterThan(10)
      expect(cfg.rules.length).toBeGreaterThan(0)
    }
  })

  it('leaves a hysteresis gap far wider than landmark noise', () => {
    // Smoothed landmark jitter is a few degrees; 30 is ample headroom.
    for (const cfg of Object.values(EXERCISE_CONFIGS)) {
      expect(cfg.enterTop - cfg.enterBottom, cfg.key).toBeGreaterThanOrEqual(30)
    }
  })

  it('keeps every primary-angle form rule reachable inside the counted range', () => {
    // A rep is counted only when the angle drops below enterBottom and rises
    // above enterTop. A rule whose threshold falls outside that window can
    // never fire, which silently disables the feedback it provides.
    const squat = EXERCISE_CONFIGS.squat
    // 'depth' fires when minPrimary > 100, and minPrimary < enterBottom.
    expect(squat.enterBottom).toBeGreaterThan(100)

    const curl = EXERCISE_CONFIGS.bicep_curl
    // 'range' fires when minPrimary > 60, and minPrimary < enterBottom.
    expect(curl.enterBottom).toBeGreaterThan(60)
    // 'extension' fires when maxPrimary < 150, and maxPrimary > enterTop.
    expect(curl.enterTop).toBeLessThan(150)
  })

  it('keys match the formKey values in the exercise seed data', () => {
    expect(Object.keys(EXERCISE_CONFIGS).sort()).toEqual(['bicep_curl', 'squat'])
  })
})
