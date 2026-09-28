import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import { buildMenu, generateDietPlan, planTotals } from '@/lib/ai/diet'
import { dayRange } from '@/lib/foodLog'
import { zMealSlot, type MealSlot } from '@/lib/types'

// Mirrors SLOT_SHARE in lib/ai/diet.ts — used to budget a single-meal regen.
const SLOT_SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  snack: 0.15,
  dinner: 0.3,
}

async function loadPlan(userId: number) {
  const { start, end } = dayRange(new Date())
  return db.mealPlan.findFirst({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { generatedAt: 'desc' },
    include: { items: { include: { food: true }, orderBy: { id: 'asc' } } },
  })
}

export async function GET() {
  const userId = await requireUserId()
  return NextResponse.json({ plan: await loadPlan(userId) })
}

export async function POST(request: Request) {
  const userId = await requireUserId()
  const result = await getProfileWithMetrics(userId)
  if (!result) return NextResponse.json({ error: 'Complete your profile first' }, { status: 400 })

  const { profile, metrics, allergies } = result

  // An empty body means "generate the whole day"; { slot } regenerates one meal.
  const body = await request.json().catch(() => ({}))
  const slotParsed = z.object({ slot: zMealSlot }).safeParse(body)
  const onlySlot = slotParsed.success ? slotParsed.data.slot : undefined

  const menu = await buildMenu({
    dietaryPreference: profile.dietaryPreference,
    allergies,
    budget: profile.budget,
  })

  const summary =
    `${profile.age}yo ${profile.gender}, ${profile.weightKg}kg, ` +
    `${profile.activityLevel.replace('_', ' ')}, goal ${profile.goal.replace('_', ' ')}`

  const generated = await generateDietPlan({
    menu,
    target: metrics.calorieTarget,
    proteinMin: metrics.proteinTarget,
    profileSummary: summary,
    onlySlot,
    slotBudget: onlySlot ? metrics.calorieTarget * SLOT_SHARE[onlySlot] : undefined,
    // Without an API key the fallback is deterministic, so Regenerate would
    // return an identical plan. A rotating seed makes the button do something
    // visible offline.
    variant: Math.floor(Math.random() * 997),
  })

  const existing = await loadPlan(userId)

  if (onlySlot && existing) {
    // Swap out just this slot; the rest of the day is untouched.
    await db.mealPlanItem.deleteMany({ where: { mealPlanId: existing.id, mealSlot: onlySlot } })
    await db.mealPlanItem.createMany({
      data: generated.meals.flatMap((m) =>
        m.items.map((i) => ({
          mealPlanId: existing.id,
          foodId: i.foodId,
          servings: i.servings,
          mealSlot: m.slot,
          reason: m.reason,
        })),
      ),
    })
  } else {
    if (existing) await db.mealPlan.delete({ where: { id: existing.id } })
    await db.mealPlan.create({
      data: {
        userId,
        date: dayRange(new Date()).start,
        source: generated.source,
        aiNotes: `Target ${metrics.calorieTarget} kcal, protein ${metrics.proteinTarget} g`,
        items: {
          create: generated.meals.flatMap((m) =>
            m.items.map((i) => ({
              foodId: i.foodId,
              servings: i.servings,
              mealSlot: m.slot,
              reason: m.reason,
            })),
          ),
        },
      },
    })
  }

  return NextResponse.json({
    ok: true,
    source: generated.source,
    totals: planTotals(generated.meals, menu),
  })
}

const zSwap = z.object({ itemId: z.number().int(), foodId: z.number().int() })

/** Swap one item's food. Deliberately no AI call — instant and works offline. */
export async function PATCH(request: Request) {
  const userId = await requireUserId()
  const parsed = zSwap.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid swap' }, { status: 400 })

  const item = await db.mealPlanItem.findUnique({
    where: { id: parsed.data.itemId },
    include: { mealPlan: true },
  })
  if (!item || item.mealPlan.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!(await db.food.findUnique({ where: { id: parsed.data.foodId } }))) {
    return NextResponse.json({ error: 'Unknown food' }, { status: 400 })
  }

  await db.mealPlanItem.update({
    where: { id: item.id },
    data: { foodId: parsed.data.foodId, reason: 'Swapped by you.' },
  })

  return NextResponse.json({ ok: true })
}
