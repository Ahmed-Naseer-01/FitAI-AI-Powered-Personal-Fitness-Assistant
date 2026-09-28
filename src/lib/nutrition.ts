import { MEAL_SLOTS, type MealSlot } from './types'

// All nutrition arithmetic. Food rows store per-serving values; nothing here
// ever reads a number produced by the language model.

export type Macros = {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

// Round at every step so repeated addition cannot accumulate binary float
// drift into a user-visible number.
const round1 = (n: number) => Math.round(n * 10) / 10

export function scaleMacros(food: Macros, servings: number): Macros {
  return {
    kcal: round1(food.kcal * servings),
    proteinG: round1(food.proteinG * servings),
    carbsG: round1(food.carbsG * servings),
    fatG: round1(food.fatG * servings),
  }
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce<Macros>(
    (acc, m) => ({
      kcal: round1(acc.kcal + m.kcal),
      proteinG: round1(acc.proteinG + m.proteinG),
      carbsG: round1(acc.carbsG + m.carbsG),
      fatG: round1(acc.fatG + m.fatG),
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )
}

export type LoggedItem = { servings: number; food: Macros }

export function totalFor(items: LoggedItem[]): Macros {
  return sumMacros(items.map((i) => scaleMacros(i.food, i.servings)))
}

/** Buckets rows by meal slot, always returning all four keys. */
export function groupBySlot<T extends { mealSlot: MealSlot }>(
  items: T[],
): Record<MealSlot, T[]> {
  const out = Object.fromEntries(MEAL_SLOTS.map((s) => [s, [] as T[]])) as Record<MealSlot, T[]>
  for (const item of items) out[item.mealSlot].push(item)
  return out
}

/** MET x bodyweight x hours — the standard estimate, not a measurement. */
export function estimateKcalBurned(
  metValue: number,
  weightKg: number,
  durationSec: number,
): number {
  return Math.round(metValue * weightKg * (durationSec / 3600))
}
