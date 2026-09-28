import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { estimateKcalBurned } from '@/lib/nutrition'
import { serializeTags } from '@/lib/tags'

const zBody = z.object({
  formKey: z.enum(['squat', 'bicep_curl']),
  durationSec: z.number().int().min(1).max(7200),
  correctReps: z.number().int().min(0).max(1000),
  incorrectReps: z.number().int().min(0).max(1000),
  avgFormScore: z.number().min(0).max(100),
  feedbackTags: z.array(z.string()).max(10),
})

export async function POST(request: Request) {
  const userId = await requireUserId()
  const parsed = zBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const body = parsed.data
  const exercise = await db.exercise.findFirst({ where: { formKey: body.formKey } })
  if (!exercise) return NextResponse.json({ error: 'Unknown exercise' }, { status: 400 })

  const profile = await db.profile.findUnique({ where: { userId } })
  if (!profile) return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 })

  // One camera session produces BOTH records: the form analysis and the
  // workout itself. The dashboard reads them from different tables, which is
  // what keeps workout stats intact if the camera module is unused.
  const [formSession] = await db.$transaction([
    db.formSession.create({
      data: {
        userId,
        exerciseId: exercise.id,
        durationSec: body.durationSec,
        correctReps: body.correctReps,
        incorrectReps: body.incorrectReps,
        avgFormScore: body.avgFormScore,
        feedbackTags: serializeTags(body.feedbackTags),
      },
    }),
    db.workoutSession.create({
      data: {
        userId,
        exerciseId: exercise.id,
        durationSec: body.durationSec,
        totalReps: body.correctReps + body.incorrectReps,
        estimatedKcal: estimateKcalBurned(exercise.metValue, profile.weightKg, body.durationSec),
      },
    }),
  ])

  return NextResponse.json({ ok: true, formSession })
}
