import { describe, it, expect } from 'vitest'
import { dayRange, buildDaySummary, type LogRow } from './foodLog'

const roti = { id: 1, name: 'Roti', servingLabel: '1 medium', kcal: 120, proteinG: 3.5, carbsG: 25, fatG: 1.5 }
const curry = { id: 2, name: 'Chicken curry', servingLabel: '1 cup', kcal: 240, proteinG: 26, carbsG: 6, fatG: 12 }

const rows: LogRow[] = [
  { id: 10, servings: 2, mealSlot: 'breakfast', food: roti },
  { id: 11, servings: 1, mealSlot: 'lunch', food: curry },
  { id: 12, servings: 1, mealSlot: 'lunch', food: roti },
]

describe('dayRange', () => {
  it('spans local midnight to the next local midnight', () => {
    const { start, end } = dayRange(new Date(2026, 8, 29, 14, 32))
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getDate()).toBe(29)
    expect(end.getDate()).toBe(30)
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('puts a late-evening time in the same day, not the next', () => {
    const { start } = dayRange(new Date(2026, 8, 29, 23, 59))
    expect(start.getDate()).toBe(29)
  })

  it('rolls over the month boundary correctly', () => {
    const { start, end } = dayRange(new Date(2026, 8, 30, 12))
    expect(start.getDate()).toBe(30)
    expect(end.getMonth()).toBe(9) // October
    expect(end.getDate()).toBe(1)
  })
})

describe('buildDaySummary', () => {
  it('totals consumed calories across all slots', () => {
    const s = buildDaySummary(rows, 2933, 144)
    expect(s.consumed.kcal).toBe(600) // 2*120 + 240 + 120
    expect(s.consumed.proteinG).toBe(36.5) // 7 + 26 + 3.5
  })

  it('computes remaining as target minus consumed', () => {
    expect(buildDaySummary(rows, 2933, 144).remaining).toBe(2333)
  })

  it('allows remaining to go negative when over target', () => {
    expect(buildDaySummary(rows, 500, 144).remaining).toBe(-100)
  })

  it('groups rows into all four slots, with empty arrays where nothing was logged', () => {
    const s = buildDaySummary(rows, 2933, 144)
    expect(s.bySlot.breakfast).toHaveLength(1)
    expect(s.bySlot.lunch).toHaveLength(2)
    expect(s.bySlot.snack).toHaveLength(0)
    expect(s.bySlot.dinner).toHaveLength(0)
  })

  it('computes per-slot totals', () => {
    const s = buildDaySummary(rows, 2933, 144)
    expect(s.slotTotals.breakfast.kcal).toBe(240)
    expect(s.slotTotals.lunch.kcal).toBe(360)
    expect(s.slotTotals.dinner.kcal).toBe(0)
  })

  it('handles a day with no logs at all', () => {
    const s = buildDaySummary([], 2000, 100)
    expect(s.consumed.kcal).toBe(0)
    expect(s.remaining).toBe(2000)
    expect(s.bySlot.breakfast).toEqual([])
    expect(s.slotTotals.lunch.kcal).toBe(0)
  })

  it('handles fractional servings', () => {
    const s = buildDaySummary(
      [{ id: 1, servings: 1.5, mealSlot: 'breakfast', food: roti }],
      2000, 100,
    )
    expect(s.consumed.kcal).toBe(180)
  })

  it('passes the targets through unchanged', () => {
    const s = buildDaySummary(rows, 2933, 144)
    expect(s.target).toBe(2933)
    expect(s.proteinTarget).toBe(144)
  })
})
