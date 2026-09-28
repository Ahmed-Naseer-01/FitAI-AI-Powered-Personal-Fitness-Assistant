import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const EMAIL = 'demo@fitai.test'
const PASSWORD = 'demo1234'

function daysAgo(n: number, hour = 12): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d
}

async function main() {
  await db.user.deleteMany({ where: { email: EMAIL } })

  const user = await db.user.create({
    data: { email: EMAIL, passwordHash: await bcrypt.hash(PASSWORD, 10) },
  })

  await db.profile.create({
    data: {
      userId: user.id,
      name: 'Ali',
      age: 24,
      gender: 'male',
      heightCm: 175,
      weightKg: 71.2,
      activityLevel: 'moderate',
      experience: 'beginner',
      goal: 'muscle_gain',
      workoutDays: 4,
      sessionMinutes: 45,
      dietaryPreference: 'non_veg',
      allergies: '',
      budget: 'any',
    },
  })

  // A downward trend over two weeks.
  for (const w of [
    { d: 14, kg: 72.0 }, { d: 11, kg: 71.9 }, { d: 8, kg: 71.7 },
    { d: 5, kg: 71.5 }, { d: 2, kg: 71.3 }, { d: 0, kg: 71.2 },
  ]) {
    await db.weightEntry.create({
      data: {
        userId: user.id,
        weightKg: w.kg,
        bmi: Math.round((w.kg / 1.75 ** 2) * 10) / 10,
        recordedAt: daysAgo(w.d, 7),
      },
    })
  }

  const foods = await db.food.findMany({ orderBy: { id: 'asc' } })
  if (foods.length === 0) throw new Error('Run `npm run db:seed` first — no foods in the database.')

  // Pick meal-appropriate, calorie-meaningful foods so the demo days total
  // something plausible rather than arbitrary picks like green tea.
  const byCategory = (categories: string[]) =>
    foods.filter((f) => categories.includes(f.category) && f.kcal >= 90)

  const SLOT_POOLS: Record<string, typeof foods> = {
    breakfast: byCategory(['grain', 'protein', 'dairy']),
    lunch: byCategory(['grain', 'protein', 'vegetable']),
    snack: byCategory(['snack', 'fruit', 'dairy']),
    dinner: byCategory(['grain', 'protein', 'vegetable']),
  }

  // Days 4, 8 and 11 are deliberately left unlogged, so the dashboard shows
  // gaps rather than zero bars.
  for (const day of [0, 1, 2, 3, 5, 6, 7, 9, 10, 12, 13]) {
    for (const [index, slot] of ['breakfast', 'lunch', 'snack', 'dinner'].entries()) {
      const pool = SLOT_POOLS[slot]
      // Two or three items per meal, rotated by day so no two days match.
      const itemCount = slot === 'snack' ? 2 : 3
      for (let n = 0; n < itemCount; n += 1) {
        const food = pool[(day * 5 + index * 3 + n * 7) % pool.length]
        await db.foodLog.create({
          data: {
            userId: user.id,
            foodId: food.id,
            servings: n === 0 ? 2 : 1,
            mealSlot: slot,
            consumedAt: daysAgo(day, 8 + index * 4),
          },
        })
      }
    }
  }

  const squat = await db.exercise.findFirst({ where: { formKey: 'squat' } })
  const curl = await db.exercise.findFirst({ where: { formKey: 'bicep_curl' } })
  const others = await db.exercise.findMany({ where: { hasFormTracking: false }, take: 4 })

  for (const day of [1, 3, 6, 8, 10, 13]) {
    const exercise = others[day % others.length]
    await db.workoutSession.create({
      data: {
        userId: user.id,
        exerciseId: exercise.id,
        completedAt: daysAgo(day, 18),
        durationSec: 480,
        totalReps: 36,
        estimatedKcal: Math.round(exercise.metValue * 71.2 * (480 / 3600)),
      },
    })
  }

  // Camera sessions write both tables, exactly as the live route does.
  for (const [i, day] of [1, 4, 9].entries()) {
    const exercise = i % 2 === 0 ? squat : curl
    if (!exercise) continue
    const correct = 10 + i
    const incorrect = 3 - i

    await db.$transaction([
      db.formSession.create({
        data: {
          userId: user.id,
          exerciseId: exercise.id,
          startedAt: daysAgo(day, 19),
          durationSec: 120,
          correctReps: correct,
          incorrectReps: incorrect,
          avgFormScore: Math.round((correct / (correct + incorrect)) * 100),
          feedbackTags: i % 2 === 0 ? 'depth,back_angle' : 'range',
        },
      }),
      db.workoutSession.create({
        data: {
          userId: user.id,
          exerciseId: exercise.id,
          completedAt: daysAgo(day, 19),
          durationSec: 120,
          totalReps: correct + incorrect,
          estimatedKcal: Math.round(exercise.metValue * 71.2 * (120 / 3600)),
        },
      }),
    ])
  }

  console.log(`Demo account ready — ${EMAIL} / ${PASSWORD}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
