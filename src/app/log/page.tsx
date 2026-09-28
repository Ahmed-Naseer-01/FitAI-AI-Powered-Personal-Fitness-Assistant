import { redirect } from 'next/navigation'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import { buildDaySummary, getDayLogs } from '@/lib/foodLog'
import { isAiEnabled } from '@/lib/ai/client'
import { MEAL_SLOTS, type MealSlot } from '@/lib/types'
import DailySummary from '@/components/DailySummary'
import FoodSearch from '@/components/FoodSearch'
import LogRowItem from '@/components/LogRowItem'
import NaturalLanguageEntry from '@/components/NaturalLanguageEntry'
import { Card, CardBody, Page, PageHeader } from '@/components/ui'

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snacks', dinner: 'Dinner',
}

export default async function LogPage() {
  const userId = await requireUserId()
  const result = await getProfileWithMetrics(userId)
  if (!result) redirect('/onboarding')

  const rows = await getDayLogs(userId, new Date())
  const summary = buildDaySummary(rows, result.metrics.calorieTarget, result.metrics.proteinTarget)

  return (
    <Page>
      <PageHeader
        title="Today"
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: 'long', day: 'numeric', month: 'long',
        })}
      />

      <div className="stagger flex flex-col gap-4">
        <DailySummary summary={summary} />
        <FoodSearch />
        <NaturalLanguageEntry aiEnabled={isAiEnabled()} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-fg-subtle">
          Meals
        </h2>

        <div className="stagger flex flex-col gap-3">
          {MEAL_SLOTS.map((slot) => {
            const items = summary.bySlot[slot]
            return (
              <Card key={slot}>
                <CardBody className="p-0">
                  <div className="flex items-baseline justify-between px-3.5 py-3">
                    <h3 className="text-sm font-semibold text-fg">{SLOT_LABEL[slot]}</h3>
                    <span className="tabular text-xs font-medium text-fg-muted">
                      {Math.round(summary.slotTotals[slot].kcal)} kcal
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <p className="border-t border-border-base px-3.5 py-4 text-sm text-fg-subtle">
                      Nothing logged.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--border)] border-t border-border-base">
                      {items.map((row) => (
                        <LogRowItem key={row.id} row={row} />
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      </section>
    </Page>
  )
}
