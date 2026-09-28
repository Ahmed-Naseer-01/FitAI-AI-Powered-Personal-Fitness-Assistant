import { z } from 'zod'
import { db } from '../db'
import { generateStructured, type JsonSchema } from './client'

export type ExerciseMenuItem = {
  id: number
  name: string
  muscleGroup: string
  equipment: string
  difficulty: string
  defaultSets: number
  defaultReps: number
  repUnit: string
}

export type WorkoutItem = { exerciseId: number; sets: number; reps: number; restSec: number }
export type WorkoutDay = { dayOfWeek: number; focus: string; items: WorkoutItem[]; reason: string }
export type WorkoutResult = { days: WorkoutDay[]; source: 'ai' | 'fallback' }

const SECONDS_PER_REP = 3
const DURATION_TOLERANCE_MIN = 10

const DIFFICULTY_RANK: Record<string, number> = { beginner: 1, intermediate: 2, advanced: 3 }

/** Exercises at or below the user's experience level. */
export async function buildExerciseMenu(experience: string): Promise<ExerciseMenuItem[]> {
  const ceiling = DIFFICULTY_RANK[experience] ?? 1

  const rows = await db.exercise.findMany({
    select: {
      id: true, name: true, muscleGroup: true, equipment: true, difficulty: true,
      defaultSets: true, defaultReps: true, repUnit: true,
    },
    orderBy: { id: 'asc' },
  })

  return rows.filter((r) => (DIFFICULTY_RANK[r.difficulty] ?? 3) <= ceiling)
}

export function estimateDayDurationSec(items: WorkoutItem[], menu: ExerciseMenuItem[]): number {
  const byId = new Map(menu.map((m) => [m.id, m]))
  let total = 0

  for (const item of items) {
    const exercise = byId.get(item.exerciseId)
    if (!exercise) continue
    // A hold's "reps" are seconds, not repetitions.
    const workPerSet = exercise.repUnit === 'seconds' ? item.reps : item.reps * SECONDS_PER_REP
    total += item.sets * (workPerSet + item.restSec)
  }

  return total
}

export function validateWorkoutPlan(
  days: WorkoutDay[],
  menu: ExerciseMenuItem[],
  workoutDays: number,
  sessionMinutes: number,
): { ok: true } | { ok: false; problem: string } {
  if (days.length !== workoutDays) {
    return {
      ok: false,
      problem: `Expected exactly ${workoutDays} training days but received ${days.length}.`,
    }
  }

  const byId = new Map(menu.map((m) => [m.id, m]))

  for (const day of days) {
    if (day.items.length === 0) {
      return { ok: false, problem: `Day ${day.dayOfWeek} has no exercises.` }
    }
    for (const item of day.items) {
      if (!byId.has(item.exerciseId)) {
        return { ok: false, problem: `exerciseId ${item.exerciseId} is not in the provided list.` }
      }
    }

    const minutes = estimateDayDurationSec(day.items, menu) / 60
    if (Math.abs(minutes - sessionMinutes) > DURATION_TOLERANCE_MIN) {
      return {
        ok: false,
        problem:
          `Day ${day.dayOfWeek} is about ${Math.round(minutes)} minutes but the target is ` +
          `${sessionMinutes} minutes (within ${DURATION_TOLERANCE_MIN}).`,
      }
    }
  }

  // Recovery: the same muscle group must not appear on back-to-back days.
  const sorted = [...days].sort((a, b) => a.dayOfWeek - b.dayOfWeek)
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].dayOfWeek - sorted[i - 1].dayOfWeek !== 1) continue

    const previous = new Set(sorted[i - 1].items.map((x) => byId.get(x.exerciseId)?.muscleGroup))
    for (const item of sorted[i].items) {
      const group = byId.get(item.exerciseId)?.muscleGroup
      if (group && previous.has(group)) {
        return {
          ok: false,
          problem:
            `Muscle group "${group}" is trained on consecutive days ` +
            `(${sorted[i - 1].dayOfWeek} and ${sorted[i].dayOfWeek}).`,
        }
      }
    }
  }

  return { ok: true }
}

const ROTATION: { focus: string; groups: string[] }[] = [
  { focus: 'Lower body', groups: ['legs', 'core'] },
  { focus: 'Push', groups: ['chest', 'shoulders'] },
  { focus: 'Pull', groups: ['back', 'arms'] },
  { focus: 'Full body', groups: ['fullbody', 'core'] },
]

const MIN_EXERCISES_PER_DAY = 3
const MAX_EXERCISES_PER_DAY = 5

/**
 * Fixed template. Always produces a usable week and needs no network.
 *
 * Days are padded from the rest of the menu until they are near the target
 * session length: a beginner menu has only one chest movement, so a "Push"
 * day built strictly from its own muscle groups would be a single exercise
 * and about five minutes long.
 */
export function fallbackWorkoutPlan(
  menu: ExerciseMenuItem[],
  workoutDays: number,
  sessionMinutes = 45,
): WorkoutResult {
  // Spread sessions across the week: 3 days -> 1,3,5; 4 days -> 1,3,5,7.
  const spacing = Math.max(1, Math.floor(7 / workoutDays))
  const dayNumbers: number[] = []
  for (let i = 0; i < workoutDays; i += 1) {
    let candidate = Math.min(7, i * spacing + 1)
    while (dayNumbers.includes(candidate) && candidate < 7) candidate += 1
    while (dayNumbers.includes(candidate) && candidate > 1) candidate -= 1
    dayNumbers.push(candidate)
  }
  dayNumbers.sort((a, b) => a - b)

  const targetSec = sessionMinutes * 60

  const days: WorkoutDay[] = dayNumbers.map((dayOfWeek, index) => {
    const slot = ROTATION[index % ROTATION.length]

    const preferred = menu.filter((m) => slot.groups.includes(m.muscleGroup))
    // Rotate the padding pool by day so different days pad differently.
    const rest = menu.filter((m) => !slot.groups.includes(m.muscleGroup))
    const padding = [...rest.slice(index % Math.max(1, rest.length)), ...rest]

    const chosen: ExerciseMenuItem[] = []
    const seen = new Set<number>()
    for (const exercise of [...preferred, ...padding]) {
      if (chosen.length >= MAX_EXERCISES_PER_DAY) break
      if (seen.has(exercise.id)) continue
      chosen.push(exercise)
      seen.add(exercise.id)
    }

    const items: WorkoutItem[] = chosen.map((e) => ({
      exerciseId: e.id,
      sets: e.defaultSets,
      reps: e.defaultReps,
      restSec: 60,
    }))

    // Trim back anything beyond the minimum that pushes well past the target.
    while (
      items.length > MIN_EXERCISES_PER_DAY &&
      estimateDayDurationSec(items, menu) > targetSec * 1.2
    ) {
      items.pop()
    }

    // Add sets rather than exercises when the day is still short.
    for (let guard = 0; guard < 20; guard += 1) {
      if (items.length === 0) break
      if (estimateDayDurationSec(items, menu) >= targetSec * 0.85) break
      const candidate = items.find((i) => i.sets < 5)
      if (!candidate) break
      candidate.sets += 1
    }

    return {
      dayOfWeek,
      focus: slot.focus,
      reason: 'Standard template covering each major muscle group across the week.',
      items,
    }
  })

  return { days, source: 'fallback' }
}

// ---- LLM path ----

const zAiWorkout = z.object({
  days: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(1).max(7),
        focus: z.string().max(40),
        items: z
          .array(
            z.object({
              exerciseId: z.number().int(),
              sets: z.number().int().min(1).max(8),
              reps: z.number().int().min(1).max(60),
              restSec: z.number().int().min(15).max(240),
            }),
          )
          .min(1),
        reason: z.string().max(200),
      }),
    )
    .min(1),
})

const AI_WORKOUT_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dayOfWeek: { type: 'integer' },
          focus: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exerciseId: { type: 'integer' },
                sets: { type: 'integer' },
                reps: { type: 'integer' },
                restSec: { type: 'integer' },
              },
              required: ['exerciseId', 'sets', 'reps', 'restSec'],
            },
          },
          reason: { type: 'string' },
        },
        required: ['dayOfWeek', 'focus', 'items', 'reason'],
      },
    },
  },
  required: ['days'],
}

export async function generateWorkoutPlan(args: {
  menu: ExerciseMenuItem[]
  workoutDays: number
  sessionMinutes: number
  profileSummary: string
}): Promise<WorkoutResult> {
  const table = [
    'id\tname\tmuscle\tequipment\tdifficulty\tdefault sets\tdefault reps\tunit',
    ...args.menu.map(
      (m) =>
        `${m.id}\t${m.name}\t${m.muscleGroup}\t${m.equipment}\t${m.difficulty}\t${m.defaultSets}\t${m.defaultReps}\t${m.repUnit}`,
    ),
  ].join('\n')

  const prompt = [
    'You are a fitness coach building a weekly training plan from a fixed exercise list.',
    '',
    'AVAILABLE EXERCISES (you may use ONLY these ids):',
    table,
    '',
    `USER: ${args.profileSummary}`,
    `TRAINING DAYS PER WEEK: ${args.workoutDays}`,
    `SESSION LENGTH: about ${args.sessionMinutes} minutes`,
    '',
    'RULES:',
    `- Return exactly ${args.workoutDays} days. dayOfWeek is 1 (Monday) to 7 (Sunday).`,
    '- Never train the same muscle group on two consecutive days.',
    `- Each day should total roughly ${args.sessionMinutes} minutes, counting 3 seconds per rep plus rest between sets.`,
    '- For exercises measured in seconds, reps means the hold duration.',
    '- Use only exerciseId values from the table. Never invent an id.',
    '- Give each day a short focus label and a one-sentence reason under 25 words.',
  ].join('\n')

  const result = await generateStructured({
    prompt,
    zodSchema: zAiWorkout,
    jsonSchema: AI_WORKOUT_JSON_SCHEMA,
    retryPrompt: (problem) =>
      `${prompt}\n\nYour previous answer was rejected: ${problem}\nReturn a corrected plan.`,
  })

  if (result) {
    const days = result.days as WorkoutDay[]
    if (validateWorkoutPlan(days, args.menu, args.workoutDays, args.sessionMinutes).ok) {
      return { days, source: 'ai' }
    }
  }

  return fallbackWorkoutPlan(args.menu, args.workoutDays, args.sessionMinutes)
}
