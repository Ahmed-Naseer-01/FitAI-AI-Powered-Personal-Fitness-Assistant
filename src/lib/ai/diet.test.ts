import { describe, it, expect } from 'vitest'
import {
  clampServings, planTotals, validateDietPlan, fallbackDietPlan,
  type MenuItem, type PlanMeal,
} from './diet'

const MENU: MenuItem[] = [
  { id: 1, name: 'Roti', category: 'grain', servingLabel: '1 medium', kcal: 120, proteinG: 3.5, carbsG: 25, fatG: 1.5 },
  { id: 2, name: 'Chicken curry', category: 'protein', servingLabel: '1 cup', kcal: 240, proteinG: 26, carbsG: 6, fatG: 12 },
  { id: 3, name: 'Rice', category: 'grain', servingLabel: '1 cup', kcal: 200, proteinG: 4, carbsG: 44, fatG: 0.5 },
  { id: 4, name: 'Dahi', category: 'dairy', servingLabel: '1 cup', kcal: 150, proteinG: 8.5, carbsG: 11, fatG: 8 },
  { id: 5, name: 'Banana', category: 'fruit', servingLabel: '1 medium', kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4 },
  { id: 6, name: 'Almonds', category: 'snack', servingLabel: '30 g', kcal: 175, proteinG: 6, carbsG: 6, fatG: 15 },
  { id: 7, name: 'Palak', category: 'vegetable', servingLabel: '1 cup', kcal: 120, proteinG: 5, carbsG: 12, fatG: 6 },
]

const oneMeal = (items: { foodId: number; servings: number }[]): PlanMeal[] => [
  { slot: 'breakfast', items, reason: 'test' },
]

describe('clampServings', () => {
  it('raises servings below 0.25 to 0.25', () => {
    expect(clampServings(oneMeal([{ foodId: 1, servings: 0.01 }]))[0].items[0].servings).toBe(0.25)
  })

  it('lowers servings above 6 to 6', () => {
    expect(clampServings(oneMeal([{ foodId: 1, servings: 99 }]))[0].items[0].servings).toBe(6)
  })

  it('leaves in-range servings untouched', () => {
    expect(clampServings(oneMeal([{ foodId: 1, servings: 2.5 }]))[0].items[0].servings).toBe(2.5)
  })

  it('does not mutate the input', () => {
    const input = oneMeal([{ foodId: 1, servings: 99 }])
    clampServings(input)
    expect(input[0].items[0].servings).toBe(99)
  })
})

describe('planTotals', () => {
  it('sums scaled macros across every meal', () => {
    const t = planTotals(
      [
        { slot: 'breakfast', items: [{ foodId: 1, servings: 2 }], reason: '' },
        { slot: 'lunch', items: [{ foodId: 2, servings: 1 }], reason: '' },
      ],
      MENU,
    )
    expect(t.kcal).toBe(480)
    expect(t.proteinG).toBe(33)
  })

  it('ignores items whose food is not in the menu', () => {
    expect(planTotals(oneMeal([{ foodId: 999, servings: 1 }]), MENU).kcal).toBe(0)
  })

  it('returns zeros for an empty plan', () => {
    expect(planTotals([], MENU).kcal).toBe(0)
  })
})

describe('validateDietPlan', () => {
  // 8 roti (960) + 4 curry (960) = 1920 kcal, 28 + 104 = 132 g protein
  const good: PlanMeal[] = [
    { slot: 'breakfast', items: [{ foodId: 1, servings: 4 }], reason: 'a' },
    { slot: 'lunch', items: [{ foodId: 2, servings: 2 }], reason: 'b' },
    { slot: 'snack', items: [{ foodId: 1, servings: 4 }], reason: 'c' },
    { slot: 'dinner', items: [{ foodId: 2, servings: 2 }], reason: 'd' },
  ]

  it('accepts a plan on target and above the protein minimum', () => {
    expect(validateDietPlan(good, MENU, 2000, 120)).toEqual({ ok: true })
  })

  it('rejects an unknown food id, naming it', () => {
    const r = validateDietPlan(oneMeal([{ foodId: 404, servings: 1 }]), MENU, 2000, 100)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problem).toContain('404')
  })

  it('rejects a plan more than 8% under target, reporting the actual total', () => {
    const r = validateDietPlan(good, MENU, 3000, 100)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problem).toContain('1920')
  })

  it('rejects a plan more than 8% over target', () => {
    expect(validateDietPlan(good, MENU, 1000, 50).ok).toBe(false)
  })

  it('accepts a plan just inside the 8% band', () => {
    // 1920 against a 2000 target is 4% under.
    expect(validateDietPlan(good, MENU, 2000, 100).ok).toBe(true)
  })

  it('rejects a plan below the protein minimum', () => {
    const r = validateDietPlan(good, MENU, 2000, 200)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problem.toLowerCase()).toContain('protein')
  })

  it('rejects an empty plan', () => {
    expect(validateDietPlan([], MENU, 2000, 100).ok).toBe(false)
  })

  it('rejects a plan whose meals all have no items', () => {
    const empty: PlanMeal[] = [{ slot: 'breakfast', items: [], reason: '' }]
    expect(validateDietPlan(empty, MENU, 2000, 100).ok).toBe(false)
  })
})

describe('fallbackDietPlan', () => {
  it('returns one meal per slot, marked as a fallback', () => {
    const plan = fallbackDietPlan(MENU, 2000)
    expect(plan.source).toBe('fallback')
    expect(plan.meals.map((m) => m.slot)).toEqual(['breakfast', 'lunch', 'snack', 'dinner'])
  })

  it('only ever picks foods present in the menu', () => {
    const ids = new Set(MENU.map((m) => m.id))
    for (const meal of fallbackDietPlan(MENU, 2000).meals) {
      for (const item of meal.items) expect(ids.has(item.foodId)).toBe(true)
    }
  })

  it('keeps every serving between 0.5 and 3', () => {
    for (const meal of fallbackDietPlan(MENU, 2000).meals) {
      for (const item of meal.items) {
        expect(item.servings).toBeGreaterThanOrEqual(0.5)
        expect(item.servings).toBeLessThanOrEqual(3)
      }
    }
  })

  it('produces a non-trivial calorie total', () => {
    expect(planTotals(fallbackDietPlan(MENU, 2000).meals, MENU).kcal).toBeGreaterThan(800)
  })

  it('scales with the target', () => {
    const low = planTotals(fallbackDietPlan(MENU, 1500).meals, MENU).kcal
    const high = planTotals(fallbackDietPlan(MENU, 3000).meals, MENU).kcal
    expect(high).toBeGreaterThan(low)
  })

  it('is deterministic — the same input gives the same plan', () => {
    expect(fallbackDietPlan(MENU, 2000)).toEqual(fallbackDietPlan(MENU, 2000))
  })

  it('does not throw on an empty menu', () => {
    const plan = fallbackDietPlan([], 2000)
    expect(plan.meals).toHaveLength(4)
    expect(plan.meals.every((m) => m.items.length === 0)).toBe(true)
  })

  it('gives every meal a reason, so the UI never renders a blank', () => {
    for (const meal of fallbackDietPlan(MENU, 2000).meals) {
      expect(meal.reason.length).toBeGreaterThan(0)
    }
  })
})

describe('fallbackDietPlan protein top-up', () => {
  // A menu with one cheap high-protein food and one calorie-dense filler.
  const PROTEIN_MENU: MenuItem[] = [
    { id: 1, name: 'Roti', category: 'grain', servingLabel: '1', kcal: 120, proteinG: 3.5, carbsG: 25, fatG: 1.5 },
    { id: 2, name: 'Egg', category: 'protein', servingLabel: '1', kcal: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3 },
    { id: 3, name: 'Sabzi', category: 'vegetable', servingLabel: '1 cup', kcal: 90, proteinG: 3, carbsG: 14, fatG: 3 },
    { id: 4, name: 'Dahi', category: 'dairy', servingLabel: '1 cup', kcal: 150, proteinG: 8.5, carbsG: 11, fatG: 8 },
    { id: 5, name: 'Banana', category: 'fruit', servingLabel: '1', kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4 },
    { id: 6, name: 'Almonds', category: 'snack', servingLabel: '30g', kcal: 175, proteinG: 6, carbsG: 6, fatG: 15 },
  ]

  it('reaches a reasonable protein minimum that the base fill would miss', () => {
    const without = planTotals(fallbackDietPlan(PROTEIN_MENU, 2000).meals, PROTEIN_MENU)
    const withTopUp = planTotals(fallbackDietPlan(PROTEIN_MENU, 2000, 90).meals, PROTEIN_MENU)
    expect(withTopUp.proteinG).toBeGreaterThan(without.proteinG)
    expect(withTopUp.proteinG).toBeGreaterThanOrEqual(90)
  })

  it('does not blow the calorie ceiling while topping up', () => {
    const totals = planTotals(fallbackDietPlan(PROTEIN_MENU, 2000, 200).meals, PROTEIN_MENU)
    expect(totals.kcal).toBeLessThanOrEqual(2000 * 1.08)
  })

  it('terminates on an impossible protein target instead of looping', () => {
    const plan = fallbackDietPlan(PROTEIN_MENU, 2000, 9999)
    expect(plan.meals).toHaveLength(4)
  })

  it('still respects the 3-serving cap after topping up', () => {
    for (const meal of fallbackDietPlan(PROTEIN_MENU, 2000, 200).meals) {
      for (const item of meal.items) expect(item.servings).toBeLessThanOrEqual(3)
    }
  })
})

describe('fallbackDietPlan variant', () => {
  it('returns a different plan for a different variant', () => {
    const a = fallbackDietPlan(MENU, 2000, 0, 0)
    const b = fallbackDietPlan(MENU, 2000, 0, 1)
    expect(JSON.stringify(a.meals)).not.toBe(JSON.stringify(b.meals))
  })

  it('is still deterministic for a given variant', () => {
    expect(fallbackDietPlan(MENU, 2000, 0, 5)).toEqual(fallbackDietPlan(MENU, 2000, 0, 5))
  })

  it('still only picks foods from the menu at any variant', () => {
    const ids = new Set(MENU.map((m) => m.id))
    for (const variant of [0, 1, 7, 42, 996]) {
      for (const meal of fallbackDietPlan(MENU, 2000, 0, variant).meals) {
        for (const item of meal.items) expect(ids.has(item.foodId)).toBe(true)
      }
    }
  })
})
