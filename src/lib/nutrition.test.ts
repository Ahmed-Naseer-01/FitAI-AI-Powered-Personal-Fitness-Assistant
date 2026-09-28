import { describe, it, expect } from 'vitest'
import { scaleMacros, sumMacros, totalFor, groupBySlot, estimateKcalBurned } from './nutrition'

const roti = { kcal: 120, proteinG: 3.5, carbsG: 25, fatG: 1.5 }
const curry = { kcal: 240, proteinG: 26, carbsG: 6, fatG: 12 }

describe('scaleMacros', () => {
  it('multiplies every macro by the serving count', () => {
    expect(scaleMacros(roti, 2)).toEqual({ kcal: 240, proteinG: 7, carbsG: 50, fatG: 3 })
  })

  it('handles fractional servings and rounds to one decimal', () => {
    expect(scaleMacros(roti, 1.5)).toEqual({ kcal: 180, proteinG: 5.3, carbsG: 37.5, fatG: 2.3 })
  })

  it('returns zeros for zero servings', () => {
    expect(scaleMacros(roti, 0)).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  })
})

describe('sumMacros', () => {
  it('adds a list of macro objects', () => {
    expect(sumMacros([roti, curry])).toEqual({ kcal: 360, proteinG: 29.5, carbsG: 31, fatG: 13.5 })
  })

  it('returns zeros for an empty list', () => {
    expect(sumMacros([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  })

  it('does not accumulate floating point drift over many items', () => {
    const tenth = { kcal: 0.1, proteinG: 0.1, carbsG: 0.1, fatG: 0.1 }
    expect(sumMacros(Array(10).fill(tenth)).kcal).toBe(1)
  })
})

describe('totalFor', () => {
  it('scales each item then sums', () => {
    const result = totalFor([
      { servings: 2, food: roti },
      { servings: 1, food: curry },
    ])
    expect(result).toEqual({ kcal: 480, proteinG: 33, carbsG: 56, fatG: 15 })
  })

  it('returns zeros for an empty day', () => {
    expect(totalFor([]).kcal).toBe(0)
  })
})

describe('groupBySlot', () => {
  it('buckets items into all four slots, empty ones included', () => {
    const grouped = groupBySlot([
      { id: 1, mealSlot: 'breakfast' as const },
      { id: 2, mealSlot: 'snack' as const },
      { id: 3, mealSlot: 'snack' as const },
    ])
    expect(grouped.breakfast).toHaveLength(1)
    expect(grouped.lunch).toHaveLength(0)
    expect(grouped.snack).toHaveLength(2)
    expect(grouped.dinner).toHaveLength(0)
  })

  it('preserves input order within a slot', () => {
    const grouped = groupBySlot([
      { id: 1, mealSlot: 'lunch' as const },
      { id: 2, mealSlot: 'lunch' as const },
    ])
    expect(grouped.lunch.map((i) => i.id)).toEqual([1, 2])
  })

  it('returns all four slots for an empty input', () => {
    const grouped = groupBySlot([])
    expect(Object.keys(grouped).sort()).toEqual(['breakfast', 'dinner', 'lunch', 'snack'])
  })
})

describe('estimateKcalBurned', () => {
  it('computes MET x weightKg x hours', () => {
    // 5.0 MET, 72 kg, 20 minutes = 1200s -> 5 * 72 * (1200/3600) = 120
    expect(estimateKcalBurned(5.0, 72, 1200)).toBe(120)
  })

  it('returns 0 for zero duration', () => {
    expect(estimateKcalBurned(5.0, 72, 0)).toBe(0)
  })

  it('scales linearly with bodyweight', () => {
    expect(estimateKcalBurned(5.0, 144, 1200)).toBe(2 * estimateKcalBurned(5.0, 72, 1200))
  })
})
