import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import { buildExerciseMenu, generateWorkoutPlan } from '@/lib/ai/workout'
import { weekStart } from '@/lib/week'

export async function POST() {
  const userId = await requireUserId()
  const result = await getProfileWithMetrics(userId)
  if (!result) return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 })

  const { profile } = result
  const menu = await buildExerciseMenu(profile.experience)

  const generated = await generateWorkoutPlan({
    menu,
    workoutDays: profile.workoutDays,
    sessionMinutes: profile.sessionMinutes,
    profileSummary:
      `${profile.age}yo ${profile.gender}, ${profile.experience}, ` +
      `goal ${profile.goal.replace('_', ' ')}`,
  })

  const start = weekStart(new Date())
  await db.workoutPlan.deleteMany({ where: { userId, weekStart: start } })

  await db.workoutPlan.create({
    data: {
      userId,
      weekStart: start,
      source: generated.source,
      aiNotes: `${profile.workoutDays} days, about ${profile.sessionMinutes} min each`,
      items: {
        create: generated.days.flatMap((d) =>
          d.items.map((i) => ({
            exerciseId: i.exerciseId,
            dayOfWeek: d.dayOfWeek,
            sets: i.sets,
            reps: i.reps,
            restSec: i.restSec,
            focus: d.focus,
            reason: d.reason,
          })),
        ),
      },
    },
  })

  return NextResponse.json({ ok: true, source: generated.source })
}
