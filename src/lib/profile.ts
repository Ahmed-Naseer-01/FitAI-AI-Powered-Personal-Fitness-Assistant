import { z } from 'zod'
import { db } from './db'
import { deriveMetrics } from './metrics'
import { parseTags, serializeTags } from './tags'
import {
  zActivityLevel, zBudget, zDietaryPreference, zExperience, zGender, zGoal,
  type ActivityLevel, type Gender, type Goal,
} from './types'

// Six mandatory fields — the minimum for a valid BMR/TDEE. Everything else
// has a sensible default, so onboarding is one short screen.
export const zProfileInput = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  age: z.coerce.number().int().min(10).max(120),
  gender: zGender,
  heightCm: z.coerce.number().min(80).max(250),
  weightKg: z.coerce.number().min(25).max(300),
  activityLevel: zActivityLevel,
  goal: zGoal,

  experience: zExperience.default('beginner'),
  workoutDays: z.coerce.number().int().min(1).max(7).default(3),
  sessionMinutes: z.coerce.number().int().min(15).max(120).default(45),
  dietaryPreference: zDietaryPreference.default('non_veg'),
  allergies: z.array(z.string()).default([]),
  budget: zBudget.default('any'),
})

export type ProfileInput = z.infer<typeof zProfileInput>

/**
 * A weight entry is appended only on a real change. 100 g is the threshold,
 * so re-saving the profile without touching the weight does not pollute the
 * history with duplicate points.
 */
export function shouldAppendWeightEntry(previousKg: number | null, nextKg: number): boolean {
  if (previousKg === null) return true
  // Round before comparing: |72 - 72.1| is 0.09999999999999432 in binary
  // floating point, which would silently fail a bare >= 0.1 test.
  const deltaKg = Math.round(Math.abs(previousKg - nextKg) * 10) / 10
  return deltaKg >= 0.1
}

export async function saveProfile(userId: number, input: ProfileInput): Promise<void> {
  const existing = await db.profile.findUnique({ where: { userId } })

  const data = {
    name: input.name,
    age: input.age,
    gender: input.gender,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    activityLevel: input.activityLevel,
    experience: input.experience,
    goal: input.goal,
    workoutDays: input.workoutDays,
    sessionMinutes: input.sessionMinutes,
    dietaryPreference: input.dietaryPreference,
    allergies: serializeTags(input.allergies),
    budget: input.budget,
  }

  await db.profile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  })

  // Updating the profile IS logging your weight — there is no separate flow.
  if (shouldAppendWeightEntry(existing?.weightKg ?? null, input.weightKg)) {
    const { bmi } = deriveMetrics({
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      age: input.age,
      gender: input.gender,
      activityLevel: input.activityLevel,
      goal: input.goal,
    })
    await db.weightEntry.create({ data: { userId, weightKg: input.weightKg, bmi } })
  }
}

export async function getProfileWithMetrics(userId: number) {
  const profile = await db.profile.findUnique({ where: { userId } })
  if (!profile) return null

  // Metrics are always derived on read, never stored, so they can never drift
  // out of sync with the profile they came from.
  const metrics = deriveMetrics({
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
    gender: profile.gender as Gender,
    activityLevel: profile.activityLevel as ActivityLevel,
    goal: profile.goal as Goal,
  })

  return { profile, metrics, allergies: parseTags(profile.allergies) }
}
