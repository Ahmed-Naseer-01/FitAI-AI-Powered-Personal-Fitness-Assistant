import { db } from './db'
import { groupBySlot, scaleMacros, sumMacros, totalFor, type Macros } from './nutrition'
import { MEAL_SLOTS, type MealSlot } from './types'

/** Local midnight to the next local midnight. */
export function dayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

export type LogRow = {
  id: number
  servings: number
  mealSlot: MealSlot
  food: { id: number; name: string; servingLabel: string } & Macros
}

export async function getDayLogs(userId: number, date: Date): Promise<LogRow[]> {
  const { start, end } = dayRange(date)

  const rows = await db.foodLog.findMany({
    where: { userId, consumedAt: { gte: start, lt: end } },
    orderBy: { consumedAt: 'asc' },
    include: {
      food: {
        select: {
          id: true, name: true, servingLabel: true,
          kcal: true, proteinG: true, carbsG: true, fatG: true,
        },
      },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    servings: r.servings,
    mealSlot: r.mealSlot as MealSlot,
    food: r.food,
  }))
}

export type DaySummary = {
  target: number
  proteinTarget: number
  consumed: Macros
  remaining: number
  bySlot: Record<MealSlot, LogRow[]>
  slotTotals: Record<MealSlot, Macros>
}

/**
 * Rows store servings, never calories — macros are recomputed from the Food
 * row on every read, so correcting a seed value retroactively corrects all
 * history.
 */
export function buildDaySummary(
  rows: LogRow[],
  target: number,
  proteinTarget: number,
): DaySummary {
  const consumed = totalFor(rows.map((r) => ({ servings: r.servings, food: r.food })))
  const bySlot = groupBySlot(rows)

  const slotTotals = Object.fromEntries(
    MEAL_SLOTS.map((slot) => [
      slot,
      sumMacros(bySlot[slot].map((r) => scaleMacros(r.food, r.servings))),
    ]),
  ) as Record<MealSlot, Macros>

  return {
    target,
    proteinTarget,
    consumed,
    remaining: Math.round(target - consumed.kcal),
    bySlot,
    slotTotals,
  }
}
