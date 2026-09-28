import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import { getDayLogs } from '@/lib/foodLog'
import { totalFor } from '@/lib/nutrition'
import { getDashboardData } from '@/lib/stats'
import StatCards from '@/components/dashboard/StatCards'
import Charts from '@/components/dashboard/Charts'

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
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hi, {result.profile.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Target {result.metrics.calorieTarget} kcal · {result.metrics.proteinTarget} g protein
            {data.averageCalories !== null && ` · averaging ${data.averageCalories} kcal`}
          </p>
        </div>

        <div className="flex gap-1 rounded-lg border border-gray-200 p-1">
          {[7, 30].map((d) => (
            <Link
              key={d}
              href={`/dashboard?range=${d}`}
              className={`rounded px-3 py-1 text-sm ${
                days === d ? 'bg-black text-white' : 'text-gray-600'
              }`}
            >
              {d} days
            </Link>
          ))}
        </div>
      </div>

      <StatCards
        data={data}
        metrics={result.metrics}
        todayConsumed={todayConsumed}
        hasLoggedToday={todayRows.length > 0}
      />

      <Charts data={data} target={result.metrics.calorieTarget} />
    </main>
  )
}
