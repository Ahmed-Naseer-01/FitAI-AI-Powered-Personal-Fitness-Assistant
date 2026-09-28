import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

/**
 * Integration tests: real route handlers against a real (throwaway) database.
 * Only the session is faked, so authorisation boundaries still get exercised
 * by pointing `currentUserId` at a different user.
 */

let currentUserId = 0

vi.mock('@/lib/session', () => ({
  requireUserId: async () => currentUserId,
  getUserId: async () => currentUserId,
  createSession: async () => {},
  destroySession: async () => {},
  MissingSecretError: class extends Error {},
}))

const { POST: logPost } = await import('@/app/api/log/route')
const { PATCH: logPatch, DELETE: logDelete } = await import('@/app/api/log/[id]/route')
const { GET: foodSearch } = await import('@/app/api/foods/search/route')
const { POST: profilePost, GET: profileGet } = await import('@/app/api/profile/route')
const { POST: formSessionPost } = await import('@/app/api/form-session/route')
const { POST: workoutComplete } = await import('@/app/api/workout/complete/route')

const json = (body: unknown) =>
  new Request('http://test/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const VALID_PROFILE = {
  name: 'Test', age: 24, gender: 'male', heightCm: 175, weightKg: 72,
  activityLevel: 'moderate', goal: 'muscle_gain', allergies: [],
}

let otherUserId = 0

beforeEach(async () => {
  await db.formSession.deleteMany()
  await db.workoutSession.deleteMany()
  await db.foodLog.deleteMany()
  await db.weightEntry.deleteMany()
  await db.profile.deleteMany()
  await db.user.deleteMany()

  const hash = await hashPassword('password123')
  const user = await db.user.create({ data: { email: 'a@test.com', passwordHash: hash } })
  const other = await db.user.create({ data: { email: 'b@test.com', passwordHash: hash } })
  currentUserId = user.id
  otherUserId = other.id
})

async function seedProfile(userId = currentUserId) {
  const previous = currentUserId
  currentUserId = userId
  await profilePost(json(VALID_PROFILE))
  currentUserId = previous
}

describe('POST /api/profile', () => {
  it('saves a profile and returns derived metrics', async () => {
    const res = await profilePost(json(VALID_PROFILE))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.metrics).toEqual({
      bmi: 23.5, bmiCategory: 'normal', bmr: 1699,
      tdee: 2633, calorieTarget: 2933, proteinTarget: 144,
    })
  })

  it('rejects an invalid goal', async () => {
    const res = await profilePost(json({ ...VALID_PROFILE, goal: 'get_ripped' }))
    expect(res.status).toBe(400)
  })

  it('appends a weight entry on the first save', async () => {
    await profilePost(json(VALID_PROFILE))
    expect(await db.weightEntry.count({ where: { userId: currentUserId } })).toBe(1)
  })

  it('does not append a duplicate entry when the weight is unchanged', async () => {
    await profilePost(json(VALID_PROFILE))
    await profilePost(json(VALID_PROFILE))
    expect(await db.weightEntry.count({ where: { userId: currentUserId } })).toBe(1)
  })

  it('appends an entry when the weight changes', async () => {
    await profilePost(json(VALID_PROFILE))
    await profilePost(json({ ...VALID_PROFILE, weightKg: 71.5 }))
    expect(await db.weightEntry.count({ where: { userId: currentUserId } })).toBe(2)
  })

  it('404s for a user with no profile', async () => {
    expect((await profileGet()).status).toBe(404)
  })
})

describe('GET /api/foods/search', () => {
  it('finds a food by English name', async () => {
    const res = await foodSearch(new Request('http://test/x?q=roti'))
    const { foods } = await res.json()
    expect(foods.length).toBeGreaterThan(0)
    expect(foods[0].name).toContain('Roti')
  })

  it('finds a food by Urdu name', async () => {
    const res = await foodSearch(new Request(`http://test/x?q=${encodeURIComponent('دہی')}`))
    const { foods } = await res.json()
    expect(foods[0].name).toContain('Dahi')
  })

  it('returns nothing for an empty query', async () => {
    const res = await foodSearch(new Request('http://test/x?q='))
    expect((await res.json()).foods).toEqual([])
  })

  it('caps results at ten', async () => {
    const res = await foodSearch(new Request('http://test/x?q=a'))
    expect((await res.json()).foods.length).toBeLessThanOrEqual(10)
  })
})

describe('POST /api/log', () => {
  it('logs a single entry', async () => {
    const roti = await db.food.findFirstOrThrow({ where: { name: { contains: 'Roti' } } })
    const res = await logPost(json({ foodId: roti.id, servings: 2, mealSlot: 'breakfast' }))

    expect(res.status).toBe(200)
    const rows = await db.foodLog.findMany({ where: { userId: currentUserId } })
    expect(rows).toHaveLength(1)
    expect(rows[0].servings).toBe(2)
  })

  it('logs a batch, as "log this meal" does', async () => {
    const foods = await db.food.findMany({ take: 3 })
    const res = await logPost(
      json({ entries: foods.map((f) => ({ foodId: f.id, servings: 1, mealSlot: 'lunch' })) }),
    )

    expect((await res.json()).count).toBe(3)
    expect(await db.foodLog.count({ where: { userId: currentUserId } })).toBe(3)
  })

  it('rejects a food that does not exist', async () => {
    const res = await logPost(json({ foodId: 999999, servings: 1, mealSlot: 'lunch' }))
    expect(res.status).toBe(400)
    expect(await db.foodLog.count()).toBe(0)
  })

  it('rejects an invalid meal slot', async () => {
    const roti = await db.food.findFirstOrThrow({ where: { name: { contains: 'Roti' } } })
    expect((await logPost(json({ foodId: roti.id, servings: 1, mealSlot: 'brunch' }))).status).toBe(400)
  })

  it('rejects implausible servings', async () => {
    const roti = await db.food.findFirstOrThrow({ where: { name: { contains: 'Roti' } } })
    expect((await logPost(json({ foodId: roti.id, servings: 999, mealSlot: 'lunch' }))).status).toBe(400)
    expect((await logPost(json({ foodId: roti.id, servings: 0, mealSlot: 'lunch' }))).status).toBe(400)
  })

  it('rejects a batch containing one bad id, writing nothing', async () => {
    const roti = await db.food.findFirstOrThrow({ where: { name: { contains: 'Roti' } } })
    const res = await logPost(
      json({
        entries: [
          { foodId: roti.id, servings: 1, mealSlot: 'lunch' },
          { foodId: 999999, servings: 1, mealSlot: 'lunch' },
        ],
      }),
    )
    expect(res.status).toBe(400)
    expect(await db.foodLog.count()).toBe(0)
  })
})

describe('PATCH and DELETE /api/log/[id]', () => {
  async function makeLog(userId: number) {
    const roti = await db.food.findFirstOrThrow({ where: { name: { contains: 'Roti' } } })
    return db.foodLog.create({
      data: { userId, foodId: roti.id, servings: 1, mealSlot: 'breakfast' },
    })
  }

  it('updates servings', async () => {
    const row = await makeLog(currentUserId)
    const res = await logPatch(json({ servings: 3 }), { params: Promise.resolve({ id: String(row.id) }) })

    expect(res.status).toBe(200)
    expect((await db.foodLog.findUniqueOrThrow({ where: { id: row.id } })).servings).toBe(3)
  })

  it('deletes a row', async () => {
    const row = await makeLog(currentUserId)
    const res = await logDelete(new Request('http://test/x'), {
      params: Promise.resolve({ id: String(row.id) }),
    })

    expect(res.status).toBe(200)
    expect(await db.foodLog.count()).toBe(0)
  })

  it('404s when deleting a row that is already gone', async () => {
    const res = await logDelete(new Request('http://test/x'), {
      params: Promise.resolve({ id: '999999' }),
    })
    expect(res.status).toBe(404)
  })

  it("refuses to edit another user's row", async () => {
    const row = await makeLog(otherUserId)
    const res = await logPatch(json({ servings: 5 }), {
      params: Promise.resolve({ id: String(row.id) }),
    })

    expect(res.status).toBe(404) // not-found, never editable
    expect((await db.foodLog.findUniqueOrThrow({ where: { id: row.id } })).servings).toBe(1)
  })

  it("refuses to delete another user's row", async () => {
    const row = await makeLog(otherUserId)
    const res = await logDelete(new Request('http://test/x'), {
      params: Promise.resolve({ id: String(row.id) }),
    })

    expect(res.status).toBe(404)
    expect(await db.foodLog.count()).toBe(1)
  })
})

describe('POST /api/form-session', () => {
  it('writes both a FormSession and a WorkoutSession', async () => {
    await seedProfile()
    const res = await formSessionPost(
      json({
        formKey: 'squat', durationSec: 96, correctReps: 11,
        incorrectReps: 3, avgFormScore: 79, feedbackTags: ['depth'],
      }),
    )

    expect(res.status).toBe(200)
    expect(await db.formSession.count({ where: { userId: currentUserId } })).toBe(1)
    expect(await db.workoutSession.count({ where: { userId: currentUserId } })).toBe(1)
  })

  it('stores feedback tags as a comma-separated string', async () => {
    await seedProfile()
    await formSessionPost(
      json({
        formKey: 'squat', durationSec: 60, correctReps: 5,
        incorrectReps: 2, avgFormScore: 71, feedbackTags: ['depth', 'back_angle'],
      }),
    )
    const row = await db.formSession.findFirstOrThrow()
    expect(row.feedbackTags).toBe('depth,back_angle')
  })

  it('rejects an unknown exercise key', async () => {
    await seedProfile()
    const res = await formSessionPost(
      json({
        formKey: 'deadlift', durationSec: 60, correctReps: 5,
        incorrectReps: 0, avgFormScore: 100, feedbackTags: [],
      }),
    )
    expect(res.status).toBe(400)
  })

  it('requires a profile, since calorie burn needs bodyweight', async () => {
    const res = await formSessionPost(
      json({
        formKey: 'squat', durationSec: 60, correctReps: 5,
        incorrectReps: 0, avgFormScore: 100, feedbackTags: [],
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/workout/complete', () => {
  async function makePlanItem(userId: number) {
    const exercise = await db.exercise.findFirstOrThrow({ where: { formKey: 'squat' } })
    const plan = await db.workoutPlan.create({
      data: { userId, weekStart: new Date(), source: 'fallback' },
    })
    return db.workoutPlanItem.create({
      data: { workoutPlanId: plan.id, exerciseId: exercise.id, dayOfWeek: 1, sets: 3, reps: 12 },
    })
  }

  it('writes a workout session with an estimated calorie burn', async () => {
    await seedProfile()
    const item = await makePlanItem(currentUserId)
    const res = await workoutComplete(json({ workoutPlanItemId: item.id }))

    expect(res.status).toBe(200)
    const session = await db.workoutSession.findFirstOrThrow()
    expect(session.totalReps).toBe(36)
    expect(session.estimatedKcal).toBeGreaterThan(0)
  })

  it('is idempotent — ticking twice does not double count', async () => {
    await seedProfile()
    const item = await makePlanItem(currentUserId)
    await workoutComplete(json({ workoutPlanItemId: item.id }))
    await workoutComplete(json({ workoutPlanItemId: item.id }))

    expect(await db.workoutSession.count()).toBe(1)
  })

  it("refuses to complete another user's plan item", async () => {
    await seedProfile()
    const item = await makePlanItem(otherUserId)
    const res = await workoutComplete(json({ workoutPlanItemId: item.id }))

    expect(res.status).toBe(404)
    expect(await db.workoutSession.count()).toBe(0)
  })
})
