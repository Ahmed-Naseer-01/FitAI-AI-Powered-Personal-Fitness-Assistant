import { describe, it, expect } from 'vitest'
import { FOODS } from './data/foods'
import { EXERCISES } from './data/exercises'

describe('food seed data', () => {
  it('has at least 55 foods', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(55)
  })

  it('has no duplicate names', () => {
    const names = FOODS.map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has plausible macros: 4/4/9 kcal reconstruction within 25%', () => {
    for (const f of FOODS) {
      if (f.kcal < 20) continue // negligible items such as green tea
      const reconstructed = f.proteinG * 4 + f.carbsG * 4 + f.fatG * 9
      const drift = Math.abs(reconstructed - f.kcal) / f.kcal
      expect(drift, `${f.name}: ${f.kcal} kcal vs ${reconstructed} from macros`).toBeLessThan(0.25)
    }
  })

  it('has positive serving sizes and non-negative macros', () => {
    for (const f of FOODS) {
      expect(f.servingGrams, f.name).toBeGreaterThan(0)
      expect(f.proteinG, f.name).toBeGreaterThanOrEqual(0)
      expect(f.carbsG, f.name).toBeGreaterThanOrEqual(0)
      expect(f.fatG, f.name).toBeGreaterThanOrEqual(0)
    }
  })

  it('marks every meat, fish and egg item as non-veg', () => {
    const mustBeNonVeg = ['chicken', 'beef', 'fish', 'egg', 'kebab', 'keema', 'nihari', 'haleem', 'gosht', 'burger', 'anda']
    for (const f of FOODS) {
      const n = f.name.toLowerCase()
      if (mustBeNonVeg.some((w) => n.includes(w))) {
        expect(f.isVeg, `${f.name} should be non-veg`).toBe(false)
      }
    }
  })

  it('covers every category the fallback meal planner draws from', () => {
    const needed = ['grain', 'protein', 'dairy', 'vegetable', 'fruit', 'snack', 'drink']
    const present = new Set(FOODS.map((f) => f.category))
    for (const c of needed) expect(present.has(c as never), `missing category ${c}`).toBe(true)
  })

  it('leaves a vegetarian with a usable menu in every core category', () => {
    for (const c of ['grain', 'protein', 'vegetable', 'fruit']) {
      const count = FOODS.filter((f) => f.isVeg && f.category === c).length
      expect(count, `vegetarian ${c} options`).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('exercise seed data', () => {
  it('has 15 exercises', () => {
    expect(EXERCISES.length).toBe(15)
  })

  it('flags exactly squat and bicep curl for form tracking, each with a formKey', () => {
    const tracked = EXERCISES.filter((e) => e.hasFormTracking)
    expect(tracked.map((e) => e.name).sort()).toEqual(['Bicep Curl', 'Squat'])
    for (const e of tracked) expect(e.formKey).toBeDefined()
  })

  it('gives no formKey to untracked exercises', () => {
    for (const e of EXERCISES.filter((x) => !x.hasFormTracking)) {
      expect(e.formKey, e.name).toBeUndefined()
    }
  })

  it('gives every exercise a positive MET value', () => {
    for (const e of EXERCISES) expect(e.metValue, e.name).toBeGreaterThan(0)
  })

  it('has at least one beginner exercise per muscle group used by the fallback plan', () => {
    for (const g of ['legs', 'chest', 'back', 'arms', 'core']) {
      const count = EXERCISES.filter((e) => e.muscleGroup === g && e.difficulty === 'beginner').length
      expect(count, `beginner ${g} exercises`).toBeGreaterThanOrEqual(1)
    }
  })
})
