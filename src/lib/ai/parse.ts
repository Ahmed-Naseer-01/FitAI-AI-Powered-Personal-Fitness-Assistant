import { z } from 'zod'
import { MEAL_SLOTS, type MealSlot } from '../types'
import { generateStructured, isAiEnabled, type JsonSchema } from './client'
import type { MenuItem } from './diet'

export type ParsedEntry = { foodId: number; servings: number; mealSlot: MealSlot }

const MIN_SERVINGS = 0.25
const MAX_SERVINGS = 20

/** Drops anything the model invented and clamps implausible quantities. */
export function filterToMenu(entries: ParsedEntry[], menu: MenuItem[]): ParsedEntry[] {
  const ids = new Set(menu.map((m) => m.id))
  return entries
    .filter((e) => ids.has(e.foodId))
    .map((e) => ({
      ...e,
      servings: Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, e.servings)),
    }))
}

const zParsed = z.object({
  entries: z.array(
    z.object({
      foodId: z.number().int(),
      servings: z.number(),
      mealSlot: z.enum(MEAL_SLOTS),
    }),
  ),
})

const PARSE_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          foodId: { type: 'integer' },
          servings: { type: 'number' },
          mealSlot: { type: 'string', enum: [...MEAL_SLOTS] },
        },
        required: ['foodId', 'servings', 'mealSlot'],
      },
    },
  },
  required: ['entries'],
}

/**
 * Turns free text into a DRAFT list of log entries.
 *
 * Never writes to the database. Quantity estimation from natural language is
 * inherently approximate, so the model proposes and the user confirms — that
 * framing is what makes an imprecise feature honest. Returns [] when AI is
 * unavailable, which the UI shows as "couldn't read that".
 */
export async function parseFoodText(
  text: string,
  menu: MenuItem[],
  defaultSlot: MealSlot,
): Promise<ParsedEntry[]> {
  if (text.trim().length === 0) return []
  if (!isAiEnabled()) return []

  const table = menu.map((m) => `${m.id}\t${m.name}\t${m.servingLabel}`).join('\n')

  const prompt = [
    "Map the user's description of what they ate onto rows from a fixed food database.",
    '',
    'AVAILABLE FOODS (id, name, serving):',
    table,
    '',
    `USER SAID: "${text}"`,
    '',
    'RULES:',
    '- Use only foodId values from the table. If something has no match, omit it.',
    '- servings is how many of the listed serving the user ate. "two rotis" with serving "1 medium" is 2.',
    `- If the user does not say which meal, use "${defaultSlot}".`,
    '- Return an empty entries array if nothing matches.',
  ].join('\n')

  const result = await generateStructured({
    prompt,
    zodSchema: zParsed,
    jsonSchema: PARSE_JSON_SCHEMA,
  })

  if (!result) return []
  return filterToMenu(result.entries as ParsedEntry[], menu)
}
