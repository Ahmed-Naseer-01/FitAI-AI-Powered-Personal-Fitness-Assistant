import { describe, it, expect } from 'vitest'
import { zProfileInput, shouldAppendWeightEntry } from './profile'

const valid = {
  name: 'Ali',
  age: 24,
  gender: 'male',
  heightCm: 175,
  weightKg: 72,
  activityLevel: 'moderate',
  goal: 'muscle_gain',
}

describe('zProfileInput', () => {
  it('accepts the six mandatory fields and applies defaults for the rest', () => {
    const r = zProfileInput.parse(valid)
    expect(r.experience).toBe('beginner')
    expect(r.workoutDays).toBe(3)
    expect(r.sessionMinutes).toBe(45)
    expect(r.dietaryPreference).toBe('non_veg')
    expect(r.allergies).toEqual([])
    expect(r.budget).toBe('any')
  })

  it('coerces numeric strings, because HTML form fields arrive as strings', () => {
    const r = zProfileInput.parse({ ...valid, age: '24', heightCm: '175', weightKg: '72.5' })
    expect(r.age).toBe(24)
    expect(r.heightCm).toBe(175)
    expect(r.weightKg).toBe(72.5)
  })

  it('rejects an implausible age', () => {
    expect(zProfileInput.safeParse({ ...valid, age: 4 }).success).toBe(false)
    expect(zProfileInput.safeParse({ ...valid, age: 130 }).success).toBe(false)
  })

  it('rejects an implausible height or weight', () => {
    expect(zProfileInput.safeParse({ ...valid, heightCm: 40 }).success).toBe(false)
    expect(zProfileInput.safeParse({ ...valid, weightKg: 0 }).success).toBe(false)
    expect(zProfileInput.safeParse({ ...valid, weightKg: 500 }).success).toBe(false)
  })

  it('rejects an unknown goal or gender', () => {
    expect(zProfileInput.safeParse({ ...valid, goal: 'get_ripped' }).success).toBe(false)
    expect(zProfileInput.safeParse({ ...valid, gender: 'other' }).success).toBe(false)
  })

  it('rejects an empty name', () => {
    expect(zProfileInput.safeParse({ ...valid, name: '   ' }).success).toBe(false)
  })

  it('bounds workoutDays to 1-7', () => {
    expect(zProfileInput.safeParse({ ...valid, workoutDays: 0 }).success).toBe(false)
    expect(zProfileInput.safeParse({ ...valid, workoutDays: 8 }).success).toBe(false)
    expect(zProfileInput.safeParse({ ...valid, workoutDays: 7 }).success).toBe(true)
  })

  it('bounds sessionMinutes to 15-120', () => {
    expect(zProfileInput.safeParse({ ...valid, sessionMinutes: 10 }).success).toBe(false)
    expect(zProfileInput.safeParse({ ...valid, sessionMinutes: 180 }).success).toBe(false)
  })

  it('accepts an allergy list', () => {
    const r = zProfileInput.parse({ ...valid, allergies: ['dairy', 'nuts'] })
    expect(r.allergies).toEqual(['dairy', 'nuts'])
  })
})

describe('shouldAppendWeightEntry', () => {
  it('appends when there is no previous entry', () => {
    expect(shouldAppendWeightEntry(null, 72)).toBe(true)
  })

  it('appends when the weight changed', () => {
    expect(shouldAppendWeightEntry(72, 71.5)).toBe(true)
    expect(shouldAppendWeightEntry(72, 72.5)).toBe(true)
  })

  it('does not append when the weight is unchanged', () => {
    expect(shouldAppendWeightEntry(72, 72)).toBe(false)
  })

  it('treats a sub-100g difference as unchanged, so re-saving the form adds nothing', () => {
    expect(shouldAppendWeightEntry(72, 72.05)).toBe(false)
    expect(shouldAppendWeightEntry(72, 71.95)).toBe(false)
  })

  it('appends at exactly the 100g threshold', () => {
    expect(shouldAppendWeightEntry(72, 72.1)).toBe(true)
  })
})
