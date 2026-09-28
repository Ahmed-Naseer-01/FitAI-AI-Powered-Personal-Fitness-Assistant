import { z } from 'zod'
import { db } from '../db'
import { scaleMacros, sumMacros, type Macros } from '../nutrition'
import { hasAnyTag } from '../tags'
import { MEAL_SLOTS, type MealSlot } from '../types'
import { generateStructured, type JsonSchema } from './client'

export type MenuItem = {
  id: number
  name: string
  category: string
  servingLabel: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export type PlanItem = { foodId: number; servings: number }
export type PlanMeal = { slot: MealSlot; items: PlanItem[]; reason: string }
export type PlanResult = {
  meals: PlanMeal[]
  source: 'ai' | 'fallback'
  /** Set when the plan could not reach the protein minimum, with the reason. */
  shortfall?: string
}

/**
 * Grams of protein per kcal achievable from the densest foods on this menu.
 * Used to tell an infeasible target apart from a weak plan.
 */
export function bestProteinDensity(menu: MenuItem[]): number {
  return menu.reduce((best, f) => (f.kcal > 0 ? Math.max(best, f.proteinG / f.kcal) : best), 0)
}

/**
 * A protein target is unreachable when even the densest available food
 * cannot supply it inside the calorie budget. Realistic meals use a mix, so
 * anything above ~70% of the theoretical ceiling is not achievable in
 * practice either.
 */
export function proteinTargetFeasible(
  menu: MenuItem[],
  target: number,
  proteinMin: number,
): boolean {
  const ceiling = bestProteinDensity(menu) * target * 0.7
  return proteinMin <= ceiling
}

const MIN_SERVINGS = 0.25
const MAX_SERVINGS = 6
const CALORIE_TOLERANCE = 0.08

/**
 * Constrain by query, not by prompt.
 *
 * A food the user must not eat is never shown to the model, so the model
 * cannot select it. This is what makes the dietary and allergy guarantees
 * structural rather than a matter of the prompt being obeyed.
 */
export async function buildMenu(opts: {
  dietaryPreference: string
  allergies: string[]
  budget: string
}): Promise<MenuItem[]> {
  const rows = await db.food.findMany({
    where: opts.dietaryPreference === 'vegetarian' ? { isVeg: true } : {},
    select: {
      id: true, name: true, category: true, servingLabel: true, tags: true,
      kcal: true, proteinG: true, carbsG: true, fatG: true,
    },
    orderBy: { id: 'asc' },
  })

  // SQLite cannot filter a comma-separated column; ~60 rows makes doing it
  // in JS exact and free.
  return rows
    .filter((r) => !hasAnyTag(r.tags, opts.allergies))
    .filter((r) => (opts.budget === 'low' ? hasAnyTag(r.tags, ['budget']) : true))
    .map((row) => {
      const { tags, ...rest } = row
      void tags // used for the allergy filter above, not sent to the model
      return rest
    })
}

export function clampServings(meals: PlanMeal[]): PlanMeal[] {
  return meals.map((m) => ({
    ...m,
    items: m.items.map((i) => ({
      ...i,
      servings: Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, i.servings)),
    })),
  }))
}

/** Our arithmetic, over our rows. The model's numbers are never used. */
export function planTotals(meals: PlanMeal[], menu: MenuItem[]): Macros {
  const byId = new Map(menu.map((m) => [m.id, m]))
  const scaled: Macros[] = []

  for (const meal of meals) {
    for (const item of meal.items) {
      const food = byId.get(item.foodId)
      if (food) scaled.push(scaleMacros(food, item.servings))
    }
  }

  return sumMacros(scaled)
}

export function validateDietPlan(
  meals: PlanMeal[],
  menu: MenuItem[],
  target: number,
  proteinMin: number,
): { ok: true } | { ok: false; problem: string } {
  if (meals.length === 0 || meals.every((m) => m.items.length === 0)) {
    return { ok: false, problem: 'The plan contained no food items.' }
  }

  const ids = new Set(menu.map((m) => m.id))
  for (const meal of meals) {
    for (const item of meal.items) {
      if (!ids.has(item.foodId)) {
        return { ok: false, problem: `foodId ${item.foodId} is not in the provided menu.` }
      }
    }
  }

  const totals = planTotals(meals, menu)
  const low = target * (1 - CALORIE_TOLERANCE)
  const high = target * (1 + CALORIE_TOLERANCE)

  if (totals.kcal < low || totals.kcal > high) {
    return {
      ok: false,
      problem:
        `Total is ${Math.round(totals.kcal)} kcal but the target is ${target} kcal. ` +
        `Adjust servings so the total lands between ${Math.round(low)} and ${Math.round(high)}.`,
    }
  }

  if (totals.proteinG < proteinMin) {
    return {
      ok: false,
      problem:
        `Total protein is ${Math.round(totals.proteinG)} g but the minimum is ${proteinMin} g. ` +
        'Choose higher-protein foods.',
    }
  }

  return { ok: true }
}

const SLOT_SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.3,
  snack: 0.15,
  dinner: 0.3,
}

/**
 * Which food categories make up each meal. Building a meal from one food per
 * category is what keeps the fallback producing a recognisable plate — a
 * grain, a protein and a vegetable — rather than three servings of whatever
 * scores highest on protein.
 */
const SLOT_TEMPLATE: Record<MealSlot, string[]> = {
  breakfast: ['grain', 'protein', 'dairy'],
  lunch: ['grain', 'protein', 'vegetable'],
  snack: ['fruit', 'snack'],
  dinner: ['grain', 'protein', 'vegetable'],
}

/**
 * Deterministic pick from a category, varied by slot so that lunch and
 * dinner — which share a template — do not come out identical.
 */
function pickForSlot(
  pool: MenuItem[],
  slotIndex: number,
  categoryIndex: number,
  variant: number,
): MenuItem | null {
  if (pool.length === 0) return null
  return pool[(slotIndex * 3 + categoryIndex * 5 + variant) % pool.length]
}

/** Categories whose job is to carry protein, so they are chosen for it. */
const PROTEIN_CATEGORIES = new Set(['protein', 'dairy'])

/** How many of the top protein options to rotate between — variety without losing protein. */
const PROTEIN_SHORTLIST = 4

/**
 * Deterministic fill, used when the model is unavailable or its plan fails
 * validation. It never fails and needs no network — this is what lets the
 * app work with no API key at all.
 *
 * Known limitation: on a restricted menu (budget-only) combined with an
 * aggressive protein target and a calorie deficit, it can land short on
 * protein — cheap foods are carbohydrate-dense, and hitting e.g. 115 g of
 * protein inside 1800 kcal needs roughly 0.064 g per kcal, which only eggs
 * and pulses approach. Closing that gap properly needs constraint solving,
 * which is out of scope. The plan is still returned and still hits the
 * calorie target; the protein bar on screen simply reads under.
 */
export function fallbackDietPlan(
  menu: MenuItem[],
  target: number,
  proteinMin = 0,
  /** Shifts the rotation so pressing Regenerate offline returns a different
   *  plan. Output stays deterministic for a given variant. */
  variant = 0,
): PlanResult {
  const byCategory = new Map<string, MenuItem[]>()
  for (const food of menu) {
    if (food.kcal <= 0) continue
    const list = byCategory.get(food.category) ?? []
    list.push(food)
    byCategory.set(food.category, list)
  }

  for (const [category, list] of byCategory) {
    if (PROTEIN_CATEGORIES.has(category)) {
      // Protein per calorie, so a top-up costs as few calories as possible.
      list.sort((a, b) => b.proteinG / b.kcal - a.proteinG / a.kcal || a.id - b.id)
    } else {
      list.sort((a, b) => a.id - b.id) // stable order in, stable plan out
    }
  }

  const meals: PlanMeal[] = MEAL_SLOTS.map((slot, slotIndex) => {
    const budget = target * SLOT_SHARE[slot]
    const categories = SLOT_TEMPLATE[slot].filter((c) => (byCategory.get(c)?.length ?? 0) > 0)

    if (categories.length === 0) {
      return { slot, items: [], reason: 'No suitable foods available for this meal.' }
    }

    const perCategory = budget / categories.length
    const items: PlanItem[] = []
    const chosen = new Set<number>()

    categories.forEach((category, categoryIndex) => {
      const all = (byCategory.get(category) ?? []).filter((f) => !chosen.has(f.id))
      // Protein categories rotate only among the best few, so every meal
      // still carries real protein.
      const pool = PROTEIN_CATEGORIES.has(category) ? all.slice(0, PROTEIN_SHORTLIST) : all
      const food = pickForSlot(pool, slotIndex, categoryIndex, variant)
      if (!food) return

      const servings = Math.min(3, Math.max(0.5, Math.round((perCategory / food.kcal) * 2) / 2))
      items.push({ foodId: food.id, servings })
      chosen.add(food.id)
    })

    return {
      slot,
      items,
      reason: 'Balanced automatically across food groups to meet your calorie target.',
    }
  })

  topUpProtein(meals, menu, target, proteinMin)

  const achieved = planTotals(meals, menu).proteinG
  if (proteinMin > 0 && achieved < proteinMin) {
    const feasible = proteinTargetFeasible(menu, target, proteinMin)
    return {
      meals,
      source: 'fallback',
      shortfall: feasible
        ? `This plan reaches ${Math.round(achieved)} g of protein against a ${proteinMin} g target.`
        : `A ${proteinMin} g protein target is not achievable within ${target} kcal from the foods available to you — the densest options here top out near ${Math.round(bestProteinDensity(menu) * target * 0.7)} g. Consider raising your calorie target or widening your food preferences.`,
    }
  }

  return { meals, source: 'fallback' }
}

/**
 * Raise protein-food servings in half-step increments until the protein
 * minimum is met, stopping before the calorie total leaves the +8% band.
 * Mutates `meals` in place.
 */
function topUpProtein(
  meals: PlanMeal[],
  menu: MenuItem[],
  target: number,
  proteinMin: number,
): void {
  if (proteinMin <= 0) return

  const byId = new Map(menu.map((m) => [m.id, m]))
  const ceiling = target * (1 + CALORIE_TOLERANCE)

  // Bounded so a menu that simply cannot reach the target still terminates.
  for (let pass = 0; pass < 40; pass += 1) {
    const totals = planTotals(meals, menu)
    if (totals.proteinG >= proteinMin) return

    let best: { item: PlanItem; food: MenuItem } | null = null
    for (const meal of meals) {
      for (const item of meal.items) {
        const food = byId.get(item.foodId)
        if (!food || item.servings >= 3) continue
        if (totals.kcal + food.kcal * 0.5 > ceiling) continue
        if (!best || food.proteinG / food.kcal > best.food.proteinG / best.food.kcal) {
          best = { item, food }
        }
      }
    }

    if (best) {
      best.item.servings += 0.5
      continue
    }

    // No calorie headroom. Free some by shrinking the least protein-dense
    // item, so the budget goes to food that actually carries protein.
    let worst: { item: PlanItem; food: MenuItem } | null = null
    for (const meal of meals) {
      for (const item of meal.items) {
        const food = byId.get(item.foodId)
        if (!food || item.servings <= 0.5) continue
        if (!worst || food.proteinG / food.kcal < worst.food.proteinG / worst.food.kcal) {
          worst = { item, food }
        }
      }
    }

    if (!worst) return // nothing left to trade down
    worst.item.servings -= 0.5
  }
}

// ---- LLM path ----

const zAiPlan = z.object({
  meals: z
    .array(
      z.object({
        slot: z.enum(MEAL_SLOTS),
        items: z.array(z.object({ foodId: z.number().int(), servings: z.number() })).min(1),
        reason: z.string().max(200),
      }),
    )
    .min(1),
})

const AI_PLAN_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    meals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slot: { type: 'string', enum: [...MEAL_SLOTS] },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { foodId: { type: 'integer' }, servings: { type: 'number' } },
              required: ['foodId', 'servings'],
            },
          },
          reason: { type: 'string' },
        },
        required: ['slot', 'items', 'reason'],
      },
    },
  },
  required: ['meals'],
}

function menuTable(menu: MenuItem[]): string {
  return [
    'id\tname\tcategory\tserving\tkcal\tprotein\tcarbs\tfat',
    ...menu.map(
      (m) =>
        `${m.id}\t${m.name}\t${m.category}\t${m.servingLabel}\t${m.kcal}\t${m.proteinG}\t${m.carbsG}\t${m.fatG}`,
    ),
  ].join('\n')
}

type GenerateArgs = {
  menu: MenuItem[]
  target: number
  proteinMin: number
  profileSummary: string
  onlySlot?: MealSlot
  slotBudget?: number
  /** Passed to the fallback so repeated presses of Regenerate differ. */
  variant?: number
}

function buildPrompt(args: GenerateArgs): string {
  const scope = args.onlySlot
    ? `Generate ONLY the "${args.onlySlot}" meal. It should total approximately ${Math.round(args.slotBudget ?? args.target)} kcal.`
    : `Generate all four meals: breakfast, lunch, snack, dinner. Together they must total ${args.target} kcal (within 8%) and at least ${args.proteinMin} g of protein.`

  return [
    'You are a nutrition assistant planning meals from a fixed food database.',
    '',
    'AVAILABLE FOODS (you may use ONLY these ids):',
    menuTable(args.menu),
    '',
    `USER: ${args.profileSummary}`,
    '',
    scope,
    '',
    'RULES:',
    '- Use only foodId values from the table above. Never invent an id.',
    '- Do not state calorie or macro numbers anywhere; the application computes them.',
    '- servings is a multiple of 0.5 between 0.5 and 4.',
    '- Give each meal a one-sentence reason under 25 words explaining the choice.',
    '- Prefer culturally normal Pakistani meal combinations.',
  ].join('\n')
}

export async function generateDietPlan(args: GenerateArgs): Promise<PlanResult> {
  const prompt = buildPrompt(args)

  const result = await generateStructured({
    prompt,
    zodSchema: zAiPlan,
    jsonSchema: AI_PLAN_JSON_SCHEMA,
    retryPrompt: (problem) =>
      `${prompt}\n\nYour previous answer was rejected: ${problem}\nReturn a corrected plan.`,
  })

  if (result) {
    const meals = clampServings(result.meals as PlanMeal[])

    if (args.onlySlot) {
      // A single-slot regeneration is judged only on id validity — the
      // calorie band applies to the whole day, not one meal.
      const ids = new Set(args.menu.map((m) => m.id))
      if (meals.every((m) => m.items.every((i) => ids.has(i.foodId)))) {
        return { meals, source: 'ai' }
      }
    } else if (validateDietPlan(meals, args.menu, args.target, args.proteinMin).ok) {
      return { meals, source: 'ai' }
    }
  }

  const fallback = fallbackDietPlan(args.menu, args.target, args.proteinMin, args.variant ?? 0)
  if (args.onlySlot) {
    return { meals: fallback.meals.filter((m) => m.slot === args.onlySlot), source: 'fallback' }
  }
  return fallback
}
