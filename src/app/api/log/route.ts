import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { zMealSlot } from '@/lib/types'

const zEntry = z.object({
  foodId: z.number().int().positive(),
  servings: z.number().min(0.25).max(20),
  mealSlot: zMealSlot,
  consumedAt: z.iso.datetime().optional(),
})

// Accepts one entry or a batch. This is the single write path for food logs:
// manual search, "log this meal" from the diet plan, and natural-language
// entry all arrive here.
const zBody = z.union([zEntry, z.object({ entries: z.array(zEntry).min(1).max(20) })])

export async function POST(request: Request) {
  const userId = await requireUserId()
  const parsed = zBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const entries = 'entries' in parsed.data ? parsed.data.entries : [parsed.data]

  const foodIds = [...new Set(entries.map((e) => e.foodId))]
  const found = await db.food.count({ where: { id: { in: foodIds } } })
  if (found !== foodIds.length) {
    return NextResponse.json({ error: 'One or more foods do not exist' }, { status: 400 })
  }

  await db.foodLog.createMany({
    data: entries.map((e) => ({
      userId,
      foodId: e.foodId,
      servings: e.servings,
      mealSlot: e.mealSlot,
      ...(e.consumedAt ? { consumedAt: new Date(e.consumedAt) } : {}),
    })),
  })

  return NextResponse.json({ ok: true, count: entries.length })
}
