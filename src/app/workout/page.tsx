import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import { weekStart } from '@/lib/week'
import { isAiEnabled } from '@/lib/ai/client'
import WorkoutDayCard from '@/components/WorkoutDayCard'
import GenerateWorkoutButton from '@/components/GenerateWorkoutButton'
import { Badge, EmptyState, Notice, Page, PageHeader } from '@/components/ui'

export default async function WorkoutPage() {
  const userId = await requireUserId()
  const result = await getProfileWithMetrics(userId)
  if (!result) redirect('/onboarding')

  const start = weekStart(new Date())

  const plan = await db.workoutPlan.findFirst({
    where: { userId, weekStart: start },
    include: {
      items: { include: { exercise: true }, orderBy: [{ dayOfWeek: 'asc' }, { id: 'asc' }] },
    },
  })

  const completed = await db.workoutSession.findMany({
    where: { userId, completedAt: { gte: start } },
    select: { workoutPlanItemId: true },
  })
  const completedIds = completed
    .map((c) => c.workoutPlanItemId)
    .filter((id): id is number => id !== null)

  const dayNumbers = [...new Set(plan?.items.map((i) => i.dayOfWeek) ?? [])].sort((a, b) => a - b)

  return (
    <Page>
      <PageHeader
        title="This week's workout"
        subtitle={
          <>
            <span className="tabular">{result.profile.workoutDays}</span> days · about{' '}
            <span className="tabular">{result.profile.sessionMinutes}</span> minutes each ·{' '}
            {result.profile.experience}
          </>
        }
        action={<GenerateWorkoutButton hasPlan={Boolean(plan)} />}
      />

      {!isAiEnabled() && (
        <Notice tone="info">
          No AI key configured, so the plan comes from the built-in template.
        </Notice>
      )}

      {isAiEnabled() && plan?.source === 'fallback' && (
        <Notice tone="warning">
          The AI service did not respond, so this plan came from the built-in template. The free
          Gemini tier allows 20 requests per day per model.
        </Notice>
      )}

      {!plan ? (
        <EmptyState
          title="No plan for this week yet"
          description="Generate one and we'll spread your sessions across the week with recovery between muscle groups."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={plan.source === 'ai' ? 'info' : 'neutral'}>
              {plan.source === 'ai' ? 'AI generated' : 'Generated offline'}
            </Badge>
            {plan.aiNotes && <span className="text-xs text-fg-muted">{plan.aiNotes}</span>}
          </div>

          <div className="stagger flex flex-col gap-3">
            {dayNumbers.map((day) => (
              <WorkoutDayCard
                key={day}
                dayOfWeek={day}
                items={plan.items.filter((i) => i.dayOfWeek === day)}
                completedItemIds={completedIds}
              />
            ))}
          </div>
        </>
      )}
    </Page>
  )
}
