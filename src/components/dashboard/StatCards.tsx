import Link from 'next/link'
import type { Macros } from '@/lib/nutrition'
import type { Metrics } from '@/lib/metrics'
import type { DashboardData } from '@/lib/stats'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h3 className="text-xs uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Empty({ message, href, action }: { message: string; href: string; action: string }) {
  return (
    <p className="text-sm text-gray-500">
      {message}{' '}
      <Link href={href} className="font-medium underline">
        {action}
      </Link>
    </p>
  )
}

const FAULT_LABEL: Record<string, string> = {
  depth: 'not going low enough',
  back_angle: 'leaning too far forward',
  knee_valgus: 'knees caving in',
  range: 'not curling all the way up',
  extension: 'not fully extending',
  elbow_drift: 'elbow drifting',
}

export default function StatCards({
  data,
  metrics,
  todayConsumed,
  hasLoggedToday,
}: {
  data: DashboardData
  metrics: Metrics
  todayConsumed: Macros
  hasLoggedToday: boolean
}) {
  const remaining = Math.round(metrics.calorieTarget - todayConsumed.kcal)
  const weightChange =
    data.startWeight !== null && data.currentWeight !== null
      ? Math.round((data.currentWeight - data.startWeight) * 10) / 10
      : null

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card title="Today">
        {!hasLoggedToday ? (
          <Empty message="Nothing logged yet." href="/log" action="Log your first meal" />
        ) : (
          <>
            <div className="text-2xl font-semibold">
              {Math.round(todayConsumed.kcal)}
              <span className="text-sm font-normal text-gray-500">
                {' '}
                / {metrics.calorieTarget} kcal
              </span>
            </div>
            <p className={`mt-1 text-sm ${remaining < 0 ? 'text-red-600' : 'text-green-700'}`}>
              {remaining < 0 ? `${Math.abs(remaining)} kcal over` : `${remaining} kcal remaining`}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {Math.round(todayConsumed.proteinG)} g protein ·{' '}
              {Math.round(todayConsumed.carbsG)} g carbs · {Math.round(todayConsumed.fatG)} g fat
            </p>
          </>
        )}
      </Card>

      <Card title="Weight">
        <div className="text-2xl font-semibold">
          {data.currentWeight ?? '—'}
          <span className="text-sm font-normal text-gray-500"> kg</span>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {weightChange === null || weightChange === 0
            ? 'No change yet'
            : `${weightChange > 0 ? '+' : ''}${weightChange} kg since you started`}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          BMI {metrics.bmi} · {metrics.bmiCategory}
        </p>
      </Card>

      <Card title="This period">
        {data.workoutCount === 0 ? (
          <Empty message="No workouts yet." href="/workout" action="Generate a plan" />
        ) : (
          <>
            <div className="text-2xl font-semibold">
              {data.workoutCount}
              <span className="text-sm font-normal text-gray-500"> workouts</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {data.totalReps} reps · about {data.kcalBurned} kcal burned
            </p>
          </>
        )}
      </Card>

      <Card title="Form analysis">
        {data.lastForm === null ? (
          <Empty message="No camera sessions yet." href="/train" action="Try the trainer" />
        ) : (
          <>
            <div className="text-2xl font-semibold">
              {Math.round(data.lastForm.avgFormScore)}
              <span className="text-sm font-normal text-gray-500"> / 100</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {data.correctReps} correct · {data.incorrectReps} needing work ·{' '}
              {data.formSessions} session{data.formSessions === 1 ? '' : 's'}
            </p>
            {data.commonFault && (
              <p className="mt-1 text-xs text-amber-700">
                Most common: {FAULT_LABEL[data.commonFault] ?? data.commonFault}
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
