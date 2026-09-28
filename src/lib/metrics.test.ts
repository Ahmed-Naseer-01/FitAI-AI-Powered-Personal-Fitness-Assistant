import { describe, it, expect } from 'vitest'
import {
  bmi, bmiCategory, bmr, tdee, calorieTarget, proteinTarget, deriveMetrics, BMI_DISCLAIMER,
} from './metrics'

describe('bmi', () => {
  it('computes weight / height^2 in metres, to one decimal', () => {
    expect(bmi(72, 175)).toBe(23.5) // 72 / 1.75^2 = 23.51
    expect(bmi(50, 160)).toBe(19.5)
    expect(bmi(95, 170)).toBe(32.9)
  })
})

describe('bmiCategory', () => {
  it('uses WHO cutoffs', () => {
    expect(bmiCategory(17.0)).toBe('underweight')
    expect(bmiCategory(18.5)).toBe('normal')
    expect(bmiCategory(24.9)).toBe('normal')
    expect(bmiCategory(25.0)).toBe('overweight')
    expect(bmiCategory(29.9)).toBe('overweight')
    expect(bmiCategory(30.0)).toBe('obese')
  })
})

describe('bmr (Mifflin-St Jeor)', () => {
  it('computes male BMR', () => {
    // 10*72 + 6.25*175 - 5*24 + 5 = 720 + 1093.75 - 120 + 5 = 1698.75 -> 1699
    expect(bmr({ weightKg: 72, heightCm: 175, age: 24, gender: 'male' })).toBe(1699)
  })

  it('computes female BMR', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 600 + 1031.25 - 150 - 161 = 1320.25 -> 1320
    expect(bmr({ weightKg: 60, heightCm: 165, age: 30, gender: 'female' })).toBe(1320)
  })

  it('separates male and female by exactly 166 kcal at the same body', () => {
    const body = { weightKg: 70, heightCm: 170, age: 25 }
    const m = bmr({ ...body, gender: 'male' })
    const f = bmr({ ...body, gender: 'female' })
    expect(m - f).toBe(166)
  })
})

describe('tdee', () => {
  it('multiplies BMR by the activity factor', () => {
    expect(tdee(1699, 'sedentary')).toBe(2039) // 1699 * 1.2   = 2038.8
    expect(tdee(1699, 'light')).toBe(2336) // 1699 * 1.375 = 2336.1
    expect(tdee(1699, 'moderate')).toBe(2633) // 1699 * 1.55  = 2633.45
    expect(tdee(1699, 'active')).toBe(2931) // 1699 * 1.725 = 2930.8
    expect(tdee(1699, 'very_active')).toBe(3228) // 1699 * 1.9   = 3228.1
  })

  it('increases monotonically with activity level', () => {
    const levels = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const
    const values = levels.map((l) => tdee(1699, l))
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
  })
})

describe('calorieTarget', () => {
  it('subtracts 500 for weight loss', () => {
    expect(calorieTarget(2633, 'weight_loss', 'male')).toBe(2133)
  })

  it('adds 300 for muscle gain', () => {
    expect(calorieTarget(2633, 'muscle_gain', 'male')).toBe(2933)
  })

  it('returns TDEE unchanged for maintenance and general fitness', () => {
    expect(calorieTarget(2633, 'maintenance', 'male')).toBe(2633)
    expect(calorieTarget(2633, 'general_fitness', 'male')).toBe(2633)
  })

  it('enforces a 1500 kcal floor for males on weight loss', () => {
    expect(calorieTarget(1800, 'weight_loss', 'male')).toBe(1500)
  })

  it('enforces a 1200 kcal floor for females on weight loss', () => {
    expect(calorieTarget(1600, 'weight_loss', 'female')).toBe(1200)
  })

  it('never returns a target below the floor for any goal', () => {
    for (const goal of ['weight_loss', 'maintenance', 'muscle_gain', 'general_fitness'] as const) {
      expect(calorieTarget(1300, goal, 'female')).toBeGreaterThanOrEqual(1200)
      expect(calorieTarget(1300, goal, 'male')).toBeGreaterThanOrEqual(1500)
    }
  })
})

describe('proteinTarget', () => {
  it('uses 1.6 g/kg for weight loss', () => {
    expect(proteinTarget(72, 'weight_loss')).toBe(115)
  })

  it('uses 2.0 g/kg for muscle gain', () => {
    expect(proteinTarget(72, 'muscle_gain')).toBe(144)
  })

  it('uses 1.2 g/kg otherwise', () => {
    expect(proteinTarget(72, 'maintenance')).toBe(86)
    expect(proteinTarget(72, 'general_fitness')).toBe(86)
  })
})

describe('deriveMetrics', () => {
  it('produces the full metric set for the reference user', () => {
    const m = deriveMetrics({
      weightKg: 72, heightCm: 175, age: 24, gender: 'male',
      activityLevel: 'moderate', goal: 'muscle_gain',
    })
    expect(m).toEqual({
      bmi: 23.5,
      bmiCategory: 'normal',
      bmr: 1699,
      tdee: 2633,
      calorieTarget: 2933,
      proteinTarget: 144,
    })
  })

  it('is deterministic — the same input always gives the same output', () => {
    const input = {
      weightKg: 68, heightCm: 168, age: 31, gender: 'female',
      activityLevel: 'light', goal: 'weight_loss',
    } as const
    expect(deriveMetrics(input)).toEqual(deriveMetrics(input))
  })
})

describe('BMI_DISCLAIMER', () => {
  it('states it is not a medical diagnosis', () => {
    expect(BMI_DISCLAIMER).toContain('not a medical diagnosis')
  })

  it('mentions muscle mass, so the limitation is explicit', () => {
    expect(BMI_DISCLAIMER).toContain('muscle mass')
  })
})
