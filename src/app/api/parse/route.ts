import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import { buildMenu } from '@/lib/ai/diet'
import { parseFoodText } from '@/lib/ai/parse'
import { isAiEnabled } from '@/lib/ai/client'
import { zMealSlot } from '@/lib/types'

const zBody = z.object({ text: z.string().min(1).max(500), defaultSlot: zMealSlot })

export async function POST(request: Request) {
  const userId = await requireUserId()

  if (!isAiEnabled()) {
    return NextResponse.json(
      { error: 'Text entry needs an AI key. Use search instead.' },
      { status: 503 },
    )
  }

  const parsed = zBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const result = await getProfileWithMetrics(userId)
  if (!result) return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 })

  // Same menu the planner uses, so text entry cannot introduce a food the
  // user's diet or allergies exclude.
  const menu = await buildMenu({
    dietaryPreference: result.profile.dietaryPreference,
    allergies: result.allergies,
    budget: result.profile.budget,
  })

  const entries = await parseFoodText(parsed.data.text, menu, parsed.data.defaultSlot)

  // Return names too, so the draft is reviewable without a second round trip.
  const foods = await db.food.findMany({
    where: { id: { in: entries.map((e) => e.foodId) } },
    select: { id: true, name: true, servingLabel: true, kcal: true },
  })
  const byId = new Map(foods.map((f) => [f.id, f]))

  return NextResponse.json({
    draft: entries.map((e) => ({ ...e, food: byId.get(e.foodId) })).filter((e) => e.food),
  })
}
