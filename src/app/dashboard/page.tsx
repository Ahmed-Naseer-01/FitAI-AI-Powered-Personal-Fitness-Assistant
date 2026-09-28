import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import { getDayLogs } from '@/lib/foodLog'
import { totalFor } from '@/lib/nutrition'
import { getDashboardData } from '@/lib/stats'
import StatCards from '@/components/dashboard/StatCards'
import Charts from '@/components/dashboard/Charts'
import { Page, PageHeader, cn } from '@/components/ui'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const userId = await requireUserId()
  const result = await getProfileWithMetrics(userId)
  if (!result) redirect('/onboarding')

  const days = (await searchParams).range === '30' ? 30 : 7

  const [data, todayRows] = await Promise.all([
    getDashboardData(userId, days),
    getDayLogs(userId, new Date()),
  ])
  const todayConsumed = totalFor(todayRows.map((r) => ({ servings: r.servings, food: r.food })))

  return (
    <Page width="lg">
      <PageHeader
        title={`Hi, ${result.profile.name}`}
        subtitle={
          <>
            <span className="tabular">{result.metrics.calorieTarget}</span> kcal ·{' '}
            <span className="tabular">{result.metrics.proteinTarget}</span> g protein target
            {data.averageCalories !== null && (
              <>
                {' · averaging '}
                <span className="tabular">{data.averageCalories}</span> kcal
              </>
            )}
          </>
        }
        action={
          <div
            role="group"
            aria-label="Time range"
            className="flex gap-1 rounded-[var(--radius-control)] border border-border-base bg-surface p-1"
          >
            {[7, 30].map((d) => (
              <Link
                key={d}
                href={`/dashboard?range=${d}`}
                aria-current={days === d ? 'true' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-[var(--duration-fast)]',
                  days === d
                    ? 'bg-accent text-accent-fg'
                    : 'text-fg-muted hover:bg-bg-subtle hover:text-fg',
                )}
              >
                {d} days
              </Link>
            ))}
          </div>
        }
      />

      <StatCards
        data={data}
        metrics={result.metrics}
        todayConsumed={todayConsumed}
        hasLoggedToday={todayRows.length > 0}
      />

      <Charts data={data} target={result.metrics.calorieTarget} />
    </Page>
  )
}
