import { describe, it, expect } from 'vitest'
import {
  estimateDayDurationSec, validateWorkoutPlan, fallbackWorkoutPlan,
  type ExerciseMenuItem, type WorkoutDay,
} from './workout'

const MENU: ExerciseMenuItem[] = [
  { id: 1, name: 'Squat', muscleGroup: 'legs', equipment: 'bodyweight', difficulty: 'beginner', defaultSets: 3, defaultReps: 12, repUnit: 'reps' },
  { id: 2, name: 'Push-up', muscleGroup: 'chest', equipment: 'bodyweight', difficulty: 'beginner', defaultSets: 3, defaultReps: 12, repUnit: 'reps' },
  { id: 3, name: 'Dumbbell Row', muscleGroup: 'back', equipment: 'dumbbell', difficulty: 'beginner', defaultSets: 3, defaultReps: 12, repUnit: 'reps' },
  { id: 4, name: 'Bicep Curl', muscleGroup: 'arms', equipment: 'dumbbell', difficulty: 'beginner', defaultSets: 3, defaultReps: 12, repUnit: 'reps' },
  { id: 5, name: 'Plank', muscleGroup: 'core', equipment: 'bodyweight', difficulty: 'beginner', defaultSets: 3, defaultReps: 30, repUnit: 'seconds' },
  { id: 6, name: 'Lunge', muscleGroup: 'legs', equipment: 'bodyweight', difficulty: 'beginner', defaultSets: 3, defaultReps: 10, repUnit: 'reps' },
  { id: 7, name: 'Jumping Jack', muscleGroup: 'fullbody', equipment: 'bodyweight', difficulty: 'beginner', defaultSets: 3, defaultReps: 30, repUnit: 'reps' },
  { id: 8, name: 'Shoulder Press', muscleGroup: 'shoulders', equipment: 'dumbbell', difficulty: 'intermediate', defaultSets: 3, defaultReps: 10, repUnit: 'reps' },
]

describe('estimateDayDurationSec', () => {
  it('counts 3 seconds per rep plus rest, per set', () => {
    // 3 sets x (12 reps x 3s + 60s rest) = 3 x 96 = 288
    expect(estimateDayDurationSec([{ exerciseId: 1, sets: 3, reps: 12, restSec: 60 }], MENU)).toBe(288)
  })

  it('treats a seconds-unit exercise as a hold, not as reps', () => {
    // Plank: 3 sets x (30s hold + 60s rest) = 270
    expect(estimateDayDurationSec([{ exerciseId: 5, sets: 3, reps: 30, restSec: 60 }], MENU)).toBe(270)
  })

  it('sums across multiple exercises', () => {
    expect(estimateDayDurationSec(
      [{ exerciseId: 1, sets: 3, reps: 12, restSec: 60 }, { exerciseId: 2, sets: 3, reps: 12, restSec: 60 }],
      MENU,
    )).toBe(576)
  })

  it('ignores exercises not in the menu', () => {
    expect(estimateDayDurationSec([{ exerciseId: 99, sets: 3, reps: 12, restSec: 60 }], MENU)).toBe(0)
  })

  it('is zero for an empty day', () => {
    expect(estimateDayDurationSec([], MENU)).toBe(0)
  })
})

describe('validateWorkoutPlan', () => {
  const day = (dayOfWeek: number, ids: number[]): WorkoutDay => ({
    dayOfWeek,
    focus: 'Test',
    reason: 'test',
    items: ids.map((id) => ({ exerciseId: id, sets: 5, reps: 12, restSec: 60 })),
  })

  it('accepts a plan with the right day count and duration', () => {
    // 2 exercises x 5 sets x 96s = 960s = 16 min
    expect(validateWorkoutPlan([day(1, [1, 5]), day(3, [2, 3])], MENU, 2, 16)).toEqual({ ok: true })
  })

  it('rejects the wrong number of days', () => {
    const r = validateWorkoutPlan([day(1, [1])], MENU, 3, 16)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problem).toContain('3')
  })

  it('rejects an unknown exercise id, naming it', () => {
    const r = validateWorkoutPlan([day(1, [99]), day(3, [2])], MENU, 2, 16)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problem).toContain('99')
  })

  it('rejects a day far outside the session length', () => {
    const r = validateWorkoutPlan([day(1, [1, 2]), day(3, [3, 4])], MENU, 2, 90)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problem.toLowerCase()).toContain('minutes')
  })

  it('rejects the same muscle group on consecutive days', () => {
    // Day 1 legs+core, day 2 legs+chest -> legs twice in a row
    const r = validateWorkoutPlan([day(1, [1, 5]), day(2, [6, 2])], MENU, 2, 16)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.problem.toLowerCase()).toContain('legs')
  })

  it('allows the same muscle group on non-consecutive days', () => {
    expect(validateWorkoutPlan([day(1, [1, 5]), day(3, [6, 2])], MENU, 2, 16).ok).toBe(true)
  })

  it('rejects a day with no exercises', () => {
    const empty: WorkoutDay = { dayOfWeek: 1, focus: '', reason: '', items: [] }
    expect(validateWorkoutPlan([empty, day(3, [2])], MENU, 2, 16).ok).toBe(false)
  })
})

describe('fallbackWorkoutPlan', () => {
  it('produces exactly the requested number of days', () => {
    expect(fallbackWorkoutPlan(MENU, 4).days).toHaveLength(4)
    expect(fallbackWorkoutPlan(MENU, 1).days).toHaveLength(1)
    expect(fallbackWorkoutPlan(MENU, 7).days).toHaveLength(7)
  })

  it('is marked as a fallback', () => {
    expect(fallbackWorkoutPlan(MENU, 3).source).toBe('fallback')
  })

  it('spreads days across the week without repeating a day number', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      const days = fallbackWorkoutPlan(MENU, n).days.map((d) => d.dayOfWeek)
      expect(new Set(days).size, `${n} days`).toBe(n)
      for (const d of days) {
        expect(d).toBeGreaterThanOrEqual(1)
        expect(d).toBeLessThanOrEqual(7)
      }
    }
  })

  it('only uses exercises from the menu, and never leaves a day empty', () => {
    const ids = new Set(MENU.map((m) => m.id))
    for (const d of fallbackWorkoutPlan(MENU, 5).days) {
      expect(d.items.length).toBeGreaterThan(0)
      for (const i of d.items) expect(ids.has(i.exerciseId)).toBe(true)
    }
  })

  it('gives every day a focus label and a reason', () => {
    for (const d of fallbackWorkoutPlan(MENU, 4).days) {
      expect(d.focus.length).toBeGreaterThan(0)
      expect(d.reason.length).toBeGreaterThan(0)
    }
  })

  it('is deterministic', () => {
    expect(fallbackWorkoutPlan(MENU, 4)).toEqual(fallbackWorkoutPlan(MENU, 4))
  })

  it('does not throw on an empty menu', () => {
    const plan = fallbackWorkoutPlan([], 3)
    expect(plan.days).toHaveLength(3)
    expect(plan.days.every((d) => d.items.length === 0)).toBe(true)
  })
})

describe('fallbackWorkoutPlan day sizing', () => {
  // The real beginner menu has only one chest movement, which previously
  // produced a one-exercise, five-minute "Push" day.
  const BEGINNER_ONLY = MENU.filter((m) => m.difficulty === 'beginner')

  it('never produces a day with fewer than three exercises', () => {
    for (const d of fallbackWorkoutPlan(BEGINNER_ONLY, 4, 45).days) {
      expect(d.items.length, `day ${d.dayOfWeek}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('lands every day within a reasonable band of the session length', () => {
    for (const minutes of [30, 45, 60]) {
      for (const d of fallbackWorkoutPlan(BEGINNER_ONLY, 3, minutes).days) {
        const actual = estimateDayDurationSec(d.items, BEGINNER_ONLY) / 60
        expect(actual, `${minutes}min target, day ${d.dayOfWeek}`).toBeGreaterThan(minutes * 0.5)
        expect(actual, `${minutes}min target, day ${d.dayOfWeek}`).toBeLessThan(minutes * 1.6)
      }
    }
  })

  it('never repeats an exercise within a day', () => {
    for (const d of fallbackWorkoutPlan(BEGINNER_ONLY, 4, 45).days) {
      const ids = d.items.map((i) => i.exerciseId)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('caps sets at 5', () => {
    for (const d of fallbackWorkoutPlan(BEGINNER_ONLY, 3, 120).days) {
      for (const i of d.items) expect(i.sets).toBeLessThanOrEqual(5)
    }
  })

  it('still terminates on a single-exercise menu', () => {
    const plan = fallbackWorkoutPlan([BEGINNER_ONLY[0]], 3, 45)
    expect(plan.days).toHaveLength(3)
  })
})
