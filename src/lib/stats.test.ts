import { describe, it, expect } from 'vitest'
import { dailyCalorieSeries, averageOfLogged } from './stats'

const roti = { kcal: 120, proteinG: 3.5, carbsG: 25, fatG: 1.5 }
const today = new Date(2026, 8, 29) // 29 Sep 2026

describe('dailyCalorieSeries', () => {
  it('returns one point per day, oldest first', () => {
    const series = dailyCalorieSeries([], 7, today)
    expect(series).toHaveLength(7)
    expect(series[6].date).toBe('2026-09-29')
    expect(series[0].date).toBe('2026-09-23')
  })

  it('sums all entries logged on the same day', () => {
    const series = dailyCalorieSeries(
      [
        { consumedAt: new Date(2026, 8, 29, 8), servings: 2, food: roti },
        { consumedAt: new Date(2026, 8, 29, 13), servings: 1, food: roti },
      ],
      7,
      today,
    )
    expect(series[6].kcal).toBe(360)
  })

  it('reports an unlogged day as null, not zero', () => {
    // A zero asserts "ate nothing"; null asserts "no data" and renders as a gap.
    const series = dailyCalorieSeries(
      [{ consumedAt: new Date(2026, 8, 29, 8), servings: 1, food: roti }],
      7,
      today,
    )
    expect(series[6].kcal).toBe(120)
    expect(series[5].kcal).toBeNull()
    expect(series[0].kcal).toBeNull()
  })

  it('ignores entries outside the window', () => {
    const series = dailyCalorieSeries(
      [{ consumedAt: new Date(2026, 7, 1), servings: 5, food: roti }],
      7,
      today,
    )
    expect(series.every((p) => p.kcal === null)).toBe(true)
  })

  it('handles a 30-day window', () => {
    const series = dailyCalorieSeries([], 30, today)
    expect(series).toHaveLength(30)
    expect(series[0].date).toBe('2026-08-31')
  })

  it('pads month numbers so dates sort lexically', () => {
    const series = dailyCalorieSeries([], 3, new Date(2026, 0, 5))
    expect(series.map((p) => p.date)).toEqual(['2026-01-03', '2026-01-04', '2026-01-05'])
  })
})

describe('averageOfLogged', () => {
  it('averages only the days with data', () => {
    expect(
      averageOfLogged([
        { date: 'a', kcal: null },
        { date: 'b', kcal: 2000 },
        { date: 'c', kcal: null },
        { date: 'd', kcal: 1000 },
      ]),
    ).toBe(1500)
  })

  it('returns null when nothing was logged', () => {
    expect(averageOfLogged([{ date: 'a', kcal: null }])).toBeNull()
  })

  it('returns null for an empty series', () => {
    expect(averageOfLogged([])).toBeNull()
  })

  it('is not dragged down by unlogged days', () => {
    const sparse = [
      { date: 'a', kcal: 2000 },
      ...Array.from({ length: 6 }, (_, i) => ({ date: `x${i}`, kcal: null })),
    ]
    expect(averageOfLogged(sparse)).toBe(2000)
  })
})
