import { angle, LM, midpoint, verticalAngle, type Pt } from './angles'

export type ExerciseKey = 'squat' | 'bicep_curl'

/** Form signals accumulated across the frames of one repetition. */
export type RepStats = {
  minPrimary: number
  maxPrimary: number
  maxTorsoLean: number
  maxKneeInset: number
  maxArmDrift: number
}

export function emptyStats(): RepStats {
  return {
    minPrimary: Number.POSITIVE_INFINITY,
    maxPrimary: Number.NEGATIVE_INFINITY,
    maxTorsoLean: 0,
    maxKneeInset: 0,
    maxArmDrift: 0,
  }
}

export type FormRule = {
  id: string
  message: string
  violated(stats: RepStats): boolean
}

export type ExerciseConfig = {
  key: ExerciseKey
  displayName: string
  setupHint: string
  /** Landmark indices that must be visible before analysis runs. */
  required: number[]
  enterBottom: number
  enterTop: number
  /** The angle that drives rep counting. */
  primaryAngle(lm: Pt[]): number
  /** Folds this frame's form signals into the running stats for the rep. */
  observe(lm: Pt[], stats: RepStats): RepStats
  /** Ordered by priority — the first violated rule is the one shown. */
  rules: FormRule[]
}

export function allVisible(lm: Pt[], required: number[], threshold = 0.5): boolean {
  return required.every((i) => (lm[i]?.visibility ?? 0) > threshold)
}

/** The highest-priority violated rule, or null when the rep was clean. */
export function worstViolation(stats: RepStats, rules: FormRule[]): FormRule | null {
  return rules.find((r) => r.violated(stats)) ?? null
}

const SQUAT: ExerciseConfig = {
  key: 'squat',
  displayName: 'Squat',
  setupHint:
    'Stand 2-3 metres back, side-on to the camera, with your whole body in frame and good lighting.',
  required: [
    LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP,
    LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_ANKLE,
  ],
  // Rep thresholds detect that a squat was ATTEMPTED; the depth rule below
  // judges whether it was deep enough. They must not be the same number:
  // counting only below 100 while faulting only above 100 would make the
  // depth rule unreachable.
  enterBottom: 120,
  enterTop: 160,

  primaryAngle(lm) {
    // Averaging left and right via midpoints is steadier than either side
    // alone, and tolerates one leg being partly occluded.
    const hip = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP])
    const knee = midpoint(lm[LM.LEFT_KNEE], lm[LM.RIGHT_KNEE])
    const ankle = midpoint(lm[LM.LEFT_ANKLE], lm[LM.RIGHT_ANKLE])
    return angle(hip, knee, ankle)
  },

  observe(lm, stats) {
    const primary = this.primaryAngle(lm)

    const shoulder = midpoint(lm[LM.LEFT_SHOULDER], lm[LM.RIGHT_SHOULDER])
    const hip = midpoint(lm[LM.LEFT_HIP], lm[LM.RIGHT_HIP])
    const torsoLean = verticalAngle(shoulder, hip)

    // Knees narrower than ankles means the knees are caving inward.
    // Comparing spreads rather than absolute positions keeps this
    // independent of where in the frame the user stands.
    const kneeSpread = Math.abs(lm[LM.LEFT_KNEE].x - lm[LM.RIGHT_KNEE].x)
    const ankleSpread = Math.abs(lm[LM.LEFT_ANKLE].x - lm[LM.RIGHT_ANKLE].x)
    const inset = Math.max(0, ankleSpread - kneeSpread)

    return {
      ...stats,
      minPrimary: Math.min(stats.minPrimary, primary),
      maxPrimary: Math.max(stats.maxPrimary, primary),
      maxTorsoLean: Math.max(stats.maxTorsoLean, torsoLean),
      maxKneeInset: Math.max(stats.maxKneeInset, inset),
    }
  },

  rules: [
    { id: 'depth', message: 'Go slightly lower', violated: (s) => s.minPrimary > 100 },
    { id: 'back_angle', message: 'Keep your back straighter', violated: (s) => s.maxTorsoLean > 45 },
    { id: 'knee_valgus', message: 'Push your knees out', violated: (s) => s.maxKneeInset > 0.08 },
  ],
}

const BICEP_CURL: ExerciseConfig = {
  key: 'bicep_curl',
  displayName: 'Bicep Curl',
  setupHint:
    'Stand 2 metres back, facing the camera, with your head, shoulders and hands in frame.',
  required: [
    LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW, LM.RIGHT_ELBOW,
    LM.LEFT_WRIST, LM.RIGHT_WRIST,
  ],
  // As with the squat: counting a rep is generous, judging it is strict.
  // enterBottom sits above the 60 degree range rule and enterTop below the
  // 150 degree extension rule, so both rules can actually fire.
  enterBottom: 80,
  enterTop: 140,

  primaryAngle(lm) {
    const left = angle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST])
    const right = angle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST])
    return (left + right) / 2
  },

  observe(lm, stats) {
    const primary = this.primaryAngle(lm)

    // An anchored upper arm hangs straight down; swinging it is cheating.
    const drift = Math.max(
      verticalAngle(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW]),
      verticalAngle(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW]),
    )

    return {
      ...stats,
      minPrimary: Math.min(stats.minPrimary, primary),
      maxPrimary: Math.max(stats.maxPrimary, primary),
      maxArmDrift: Math.max(stats.maxArmDrift, drift),
    }
  },

  rules: [
    { id: 'range', message: 'Curl all the way up', violated: (s) => s.minPrimary > 60 },
    { id: 'extension', message: 'Fully extend at the bottom', violated: (s) => s.maxPrimary < 150 },
    { id: 'elbow_drift', message: 'Keep your elbow tucked in', violated: (s) => s.maxArmDrift > 20 },
  ],
}

export const EXERCISE_CONFIGS: Record<ExerciseKey, ExerciseConfig> = {
  squat: SQUAT,
  bicep_curl: BICEP_CURL,
}
