import type { ActivityLevel, Gender, Goal } from './types'

// Every number in this file is deterministic and unit tested. No value here
// ever comes from the language model — see the governing principle in the
// design document: AI selects and explains, deterministic code calculates.

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese'

export const BMI_DISCLAIMER =
  'BMI is a general screening metric. It does not account for muscle mass, ' +
  'bone density or body composition, and is not a medical diagnosis. ' +
  'Consult a healthcare professional for medical advice.'

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const PROTEIN_PER_KG: Record<Goal, number> = {
  weight_loss: 1.6,
  muscle_gain: 2.0,
  maintenance: 1.2,
  general_fitness: 1.2,
}

// Safety floors so an aggressive deficit on a small body cannot produce an
// unsafe target.
const CALORIE_FLOOR: Record<Gender, number> = { male: 1500, female: 1200 }

export function bmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10
}

export function bmiCategory(bmiValue: number): BmiCategory {
  if (bmiValue < 18.5) return 'underweight'
  if (bmiValue < 25) return 'normal'
  if (bmiValue < 30) return 'overweight'
  return 'obese'
}

/** Mifflin-St Jeor equation. */
export function bmr(input: {
  weightKg: number
  heightCm: number
  age: number
  gender: Gender
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age
  return Math.round(input.gender === 'male' ? base + 5 : base - 161)
}

export function tdee(bmrValue: number, activity: ActivityLevel): number {
  return Math.round(bmrValue * ACTIVITY_FACTORS[activity])
}

export function calorieTarget(tdeeValue: number, goal: Goal, gender: Gender): number {
  let target = tdeeValue
  if (goal === 'weight_loss') target = tdeeValue - 500
  if (goal === 'muscle_gain') target = tdeeValue + 300
  return Math.round(Math.max(target, CALORIE_FLOOR[gender]))
}

export function proteinTarget(weightKg: number, goal: Goal): number {
  return Math.round(weightKg * PROTEIN_PER_KG[goal])
}

export type MetricsInput = {
  weightKg: number
  heightCm: number
  age: number
  gender: Gender
  activityLevel: ActivityLevel
  goal: Goal
}

export type Metrics = {
  bmi: number
  bmiCategory: BmiCategory
  bmr: number
  tdee: number
  calorieTarget: number
  proteinTarget: number
}

export function deriveMetrics(input: MetricsInput): Metrics {
  const bmiValue = bmi(input.weightKg, input.heightCm)
  const bmrValue = bmr(input)
  const tdeeValue = tdee(bmrValue, input.activityLevel)

  return {
    bmi: bmiValue,
    bmiCategory: bmiCategory(bmiValue),
    bmr: bmrValue,
    tdee: tdeeValue,
    calorieTarget: calorieTarget(tdeeValue, input.goal, input.gender),
    proteinTarget: proteinTarget(input.weightKg, input.goal),
  }
}
