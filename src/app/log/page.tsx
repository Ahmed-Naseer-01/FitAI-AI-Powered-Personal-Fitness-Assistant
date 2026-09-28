import { redirect } from 'next/navigation'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import { isAiEnabled } from '@/lib/ai/client'
import { buildDaySummary, getDayLogs } from '@/lib/foodLog'
import { MEAL_SLOTS, type MealSlot } from '@/lib/types'
import DailySummary from '@/components/DailySummary'
import FoodSearch from '@/components/FoodSearch'
import NaturalLanguageEntry from '@/components/NaturalLanguageEntry'
import LogRowItem from '@/components/LogRowItem'

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snacks',
  dinner: 'Dinner',
}

export default async function LogPage() {
  const userId = await requireUserId()
  const result = await getProfileWithMetrics(userId)
  if (!result) redirect('/onboarding')

  const rows = await getDayLogs(userId, new Date())
  const summary = buildDaySummary(rows, result.metrics.calorieTarget, result.metrics.proteinTarget)

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="mt-1 text-sm text-gray-600">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </div>

      <DailySummary summary={summary} />
      <FoodSearch />
      <NaturalLanguageEntry aiEnabled={isAiEnabled()} />

      {MEAL_SLOTS.map((slot) => (
        <section key={slot}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{SLOT_LABEL[slot]}</h2>
            <span className="text-sm text-gray-500">
              {Math.round(summary.slotTotals[slot].kcal)} kcal
            </span>
          </div>

          {summary.bySlot[slot].length === 0 ? (
            <p className="mt-1 text-sm text-gray-400">Nothing logged.</p>
          ) : (
            <ul className="mt-1 divide-y divide-gray-100 rounded-lg border border-gray-200">
              {summary.bySlot[slot].map((row) => (
                <LogRowItem key={row.id} row={row} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  )
}
