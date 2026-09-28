import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import { hasAnyTag } from '@/lib/tags'

/** Alternatives in the same category within a similar calorie band. */
export async function GET(request: Request) {
  const userId = await requireUserId()

  const foodId = Number(new URL(request.url).searchParams.get('foodId'))
  if (!Number.isFinite(foodId)) return NextResponse.json({ foods: [] })

  const base = await db.food.findUnique({ where: { id: foodId } })
  if (!base) return NextResponse.json({ foods: [] })

  const profile = await getProfileWithMetrics(userId)

  const candidates = await db.food.findMany({
    where: {
      category: base.category,
      id: { not: base.id },
      kcal: { gte: base.kcal * 0.6, lte: base.kcal * 1.4 },
      ...(profile?.profile.dietaryPreference === 'vegetarian' ? { isVeg: true } : {}),
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, servingLabel: true, kcal: true, tags: true },
  })

  // Same allergy filter as the planner, so a swap cannot reintroduce a food
  // the user must avoid.
  const allergies = profile?.allergies ?? []
  const foods = candidates
    .filter((f) => !hasAnyTag(f.tags, allergies))
    .slice(0, 8)
    .map((row) => {
      const { tags, ...rest } = row
      void tags // used for the allergy filter above, not returned
      return rest
    })

  return NextResponse.json({ foods })
}
