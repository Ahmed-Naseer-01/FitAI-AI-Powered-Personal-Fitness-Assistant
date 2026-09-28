import { db } from './db'
import { scaleMacros, type Macros } from './nutrition'
import { parseTags } from './tags'

export type DayPoint = { date: string; kcal: number | null }

function isoDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/**
 * One point per day for the last `days` days, oldest first.
 *
 * A day with no logs is null, and renders as a GAP in the chart rather than
 * a zero. A zero asserts "ate nothing"; a gap asserts "no data".
 */
export function dailyCalorieSeries(
  rows: { consumedAt: Date; servings: number; food: Macros }[],
  days: number,
  today: Date = new Date(),
): DayPoint[] {
  const buckets = new Map<string, number>()
  for (const row of rows) {
    const key = isoDate(row.consumedAt)
    buckets.set(key, (buckets.get(key) ?? 0) + scaleMacros(row.food, row.servings).kcal)
  }

  const out: DayPoint[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    const value = buckets.get(isoDate(d))
    out.push({ date: isoDate(d), kcal: value === undefined ? null : Math.round(value) })
  }
  return out
}

/** Mean over the days that have data. Unlogged days are skipped, not zeroed. */
export function averageOfLogged(series: DayPoint[]): number | null {
  const logged = series.filter((p): p is { date: string; kcal: number } => p.kcal !== null)
  if (logged.length === 0) return null
  return Math.round(logged.reduce((sum, p) => sum + p.kcal, 0) / logged.length)
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>

export async function getDashboardData(userId: number, days: number) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)

  const [logs, weights, sessions, forms] = await Promise.all([
    db.foodLog.findMany({
      where: { userId, consumedAt: { gte: since } },
      include: { food: { select: { kcal: true, proteinG: true, carbsG: true, fatG: true } } },
    }),
    db.weightEntry.findMany({ where: { userId }, orderBy: { recordedAt: 'asc' } }),
    db.workoutSession.findMany({ where: { userId, completedAt: { gte: since } } }),
    db.formSession.findMany({
      where: { userId, startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      include: { exercise: { select: { name: true } } },
    }),
  ])

  const calorieSeries = dailyCalorieSeries(logs, days)

  const weightSeries = weights.map((w) => ({
    date: isoDate(w.recordedAt),
    weightKg: w.weightKg,
    bmi: w.bmi,
  }))

  // Workouts per ISO week, for the bar chart.
  const weekBuckets = new Map<string, number>()
  for (const s of sessions) {
    const d = new Date(s.completedAt)
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
    const key = isoDate(monday)
    weekBuckets.set(key, (weekBuckets.get(key) ?? 0) + 1)
  }
  const workoutsPerWeek = [...weekBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }))

  const faultCounts = new Map<string, number>()
  for (const f of forms) {
    for (const tag of parseTags(f.feedbackTags)) {
      faultCounts.set(tag, (faultCounts.get(tag) ?? 0) + 1)
    }
  }
  const commonFault = [...faultCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    calorieSeries,
    averageCalories: averageOfLogged(calorieSeries),
    weightSeries,
    startWeight: weights[0]?.weightKg ?? null,
    currentWeight: weights.at(-1)?.weightKg ?? null,
    workoutsPerWeek,
    workoutCount: sessions.length,
    totalReps: sessions.reduce((n, s) => n + s.totalReps, 0),
    kcalBurned: Math.round(sessions.reduce((n, s) => n + s.estimatedKcal, 0)),
    formSessions: forms.length,
    lastForm: forms[0] ?? null,
    correctReps: forms.reduce((n, f) => n + f.correctReps, 0),
    incorrectReps: forms.reduce((n, f) => n + f.incorrectReps, 0),
    commonFault,
  }
}
