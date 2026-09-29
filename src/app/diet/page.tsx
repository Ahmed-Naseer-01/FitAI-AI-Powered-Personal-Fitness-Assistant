import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import { dayRange } from '@/lib/foodLog'
import { scaleMacros, sumMacros } from '@/lib/nutrition'
import { isAiEnabled } from '@/lib/ai/client'
import { MEAL_SLOTS, type MealSlot } from '@/lib/types'
import MealCard from '@/components/MealCard'
import GeneratePlanButton from '@/components/GeneratePlanButton'
import { Badge, Card, CardBody, EmptyState, Notice, Page, PageHeader } from '@/components/ui'

const LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snacks', dinner: 'Dinner',
}

export default async function DietPage() {
  const userId = await requireUserId()
  const result = await getProfileWithMetrics(userId)
  if (!result) redirect('/onboarding')

  const { start, end } = dayRange(new Date())
  const plan = await db.mealPlan.findFirst({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { generatedAt: 'desc' },
    include: { items: { include: { food: true }, orderBy: { id: 'asc' } } },
  })

  const totals = plan ? sumMacros(plan.items.map((i) => scaleMacros(i.food, i.servings))) : null
  const { calorieTarget, proteinTarget } = result.metrics

  return (
    <Page>
      <PageHeader
        title="Today's diet plan"
        subtitle={
          <>
            Target <span className="tabular">{calorieTarget}</span> kcal ·{' '}
            <span className="tabular">{proteinTarget}</span> g protein
          </>
        }
        action={<GeneratePlanButton hasPlan={Boolean(plan)} />}
      />

      {!isAiEnabled() && (
        <Notice tone="info">
          No AI key configured, so plans come from the built-in planner. Add{' '}
          <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-xs dark:bg-white/10">
            GEMINI_API_KEY
          </code>{' '}
          to <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-xs dark:bg-white/10">.env</code>{' '}
          for AI-written plans with explanations.
        </Notice>
      )}

      {isAiEnabled() && plan?.source === 'fallback' && (
        <Notice tone="warning">
          The AI service did not respond, so this plan came from the built-in planner. The free
          Gemini tier allows 20 requests per day per model — if you have been generating a lot,
          try again tomorrow or add a different key.
        </Notice>
      )}

      {!plan ? (
        <EmptyState
          title="No plan for today yet"
          description="Generate one and we'll build a day of meals around your calorie and protein targets."
        />
      ) : (
        <>
          {plan.aiNotes && <Notice tone="warning">{plan.aiNotes}</Notice>}

          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div className="tabular flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span className="text-lg font-semibold text-fg">
                  {Math.round(totals!.kcal)}
                  <span className="ml-1 text-sm font-normal text-fg-muted">kcal</span>
                </span>
                <span className="text-fg-muted">{Math.round(totals!.proteinG)} g protein</span>
                <span className="text-fg-muted">{Math.round(totals!.carbsG)} g carbs</span>
                <span className="text-fg-muted">{Math.round(totals!.fatG)} g fat</span>
              </div>
              <Badge tone={plan.source === 'ai' ? 'info' : 'neutral'}>
                {plan.source === 'ai' ? 'AI generated' : 'Generated offline'}
              </Badge>
            </CardBody>
          </Card>

          <div className="stagger flex flex-col gap-3">
            {MEAL_SLOTS.map((slot) => (
              <MealCard
                key={slot}
                slot={slot}
                label={LABEL[slot]}
                items={plan.items.filter((i) => i.mealSlot === slot)}
              />
            ))}
          </div>
        </>
      )}
    </Page>
  )
}
