import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { estimateKcalBurned } from '@/lib/nutrition'

const zBody = z.object({ workoutPlanItemId: z.number().int() })

export async function POST(request: Request) {
  const userId = await requireUserId()
  const parsed = zBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const item = await db.workoutPlanItem.findUnique({
    where: { id: parsed.data.workoutPlanItemId },
    include: { exercise: true, workoutPlan: true },
  })
  if (!item || item.workoutPlan.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const profile = await db.profile.findUnique({ where: { userId } })
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 })

  // Already ticked off this week? Don't double-count it.
  const existing = await db.workoutSession.findFirst({
    where: { userId, workoutPlanItemId: item.id, completedAt: { gte: item.workoutPlan.weekStart } },
  })
  if (existing) return NextResponse.json({ ok: true, session: existing })

  const workPerSet = item.exercise.repUnit === 'seconds' ? item.reps : item.reps * 3
  const durationSec = item.sets * (workPerSet + item.restSec)
  const totalReps = item.exercise.repUnit === 'seconds' ? 0 : item.sets * item.reps

  const session = await db.workoutSession.create({
    data: {
      userId,
      workoutPlanItemId: item.id,
      exerciseId: item.exerciseId,
      durationSec,
      totalReps,
      estimatedKcal: estimateKcalBurned(item.exercise.metValue, profile.weightKg, durationSec),
    },
  })

  return NextResponse.json({ ok: true, session })
}
