import { describe, it, expect } from 'vitest'
import { weekStart } from './week'

describe('weekStart', () => {
  it('returns the Monday of that week at local midnight', () => {
    // 2026-09-29 is a Tuesday; its Monday is 2026-09-28.
    const monday = weekStart(new Date(2026, 8, 29, 14, 30))
    expect(monday.getFullYear()).toBe(2026)
    expect(monday.getMonth()).toBe(8)
    expect(monday.getDate()).toBe(28)
    expect(monday.getHours()).toBe(0)
  })

  it('treats Sunday as belonging to the week that started six days earlier', () => {
    // 2026-10-04 is a Sunday; its Monday is 2026-09-28.
    const monday = weekStart(new Date(2026, 9, 4, 9, 0))
    expect(monday.getDate()).toBe(28)
    expect(monday.getMonth()).toBe(8)
  })

  it('returns the same date when given a Monday', () => {
    const monday = weekStart(new Date(2026, 8, 28, 23, 59))
    expect(monday.getDate()).toBe(28)
    expect(monday.getHours()).toBe(0)
  })

  it('gives the same Monday for every day of one week', () => {
    const mondays = [28, 29, 30].map((d) => weekStart(new Date(2026, 8, d)).getTime())
    const octoberDays = [1, 2, 3, 4].map((d) => weekStart(new Date(2026, 9, d)).getTime())
    expect(new Set([...mondays, ...octoberDays]).size).toBe(1)
  })
})
