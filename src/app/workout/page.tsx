import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import { weekStart } from '@/lib/week'
import { isAiEnabled } from '@/lib/ai/client'
import WorkoutDayCard from '@/components/WorkoutDayCard'
import GenerateWorkoutButton from '@/components/GenerateWorkoutButton'

export default async function WorkoutPage() {
  const userId = await requireUserId()
  const result = await getProfileWithMetrics(userId)
  if (!result) redirect('/onboarding')

  const start = weekStart(new Date())

  const plan = await db.workoutPlan.findFirst({
    where: { userId, weekStart: start },
    include: { items: { include: { exercise: true }, orderBy: [{ dayOfWeek: 'asc' }, { id: 'asc' }] } },
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
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">This week&apos;s workout</h1>
          <p className="mt-1 text-sm text-gray-600">
            {result.profile.workoutDays} days · about {result.profile.sessionMinutes} minutes each ·{' '}
            {result.profile.experience}
          </p>
        </div>
        <GenerateWorkoutButton hasPlan={Boolean(plan)} />
      </div>

      {!isAiEnabled() && (
        <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
          No AI key configured, so the plan comes from the built-in template.
        </p>
      )}

      {!plan ? (
        <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          No plan for this week yet. Generate one to get started.
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {plan.source === 'ai' ? 'AI generated' : 'Generated offline'} · {plan.aiNotes}
          </p>
          {dayNumbers.map((day) => (
            <WorkoutDayCard
              key={day}
              dayOfWeek={day}
              items={plan.items.filter((i) => i.dayOfWeek === day)}
              completedItemIds={completedIds}
            />
          ))}
        </>
      )}
    </main>
  )
}
