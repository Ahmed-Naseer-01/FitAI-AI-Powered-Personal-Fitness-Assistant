import type { Macros } from '@/lib/nutrition'
import type { Metrics } from '@/lib/metrics'
import type { DashboardData } from '@/lib/stats'
import { Card, CardBody, EmptyState, ProgressBar, ProgressRing, cn } from '@/components/ui'

const FAULT_LABEL: Record<string, string> = {
  depth: 'not going low enough',
  back_angle: 'leaning too far forward',
  knee_valgus: 'knees caving in',
  range: 'not curling all the way up',
  extension: 'not fully extending',
  elbow_drift: 'elbow drifting',
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-fg-subtle">{children}</h2>
  )
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
  const over = remaining < 0
  const weightChange =
    data.startWeight !== null && data.currentWeight !== null
      ? Math.round((data.currentWeight - data.startWeight) * 10) / 10
      : null

  return (
    <div className="stagger grid gap-4 sm:grid-cols-2">
      {/* Today — the ring makes the single most important number unmissable */}
      <Card className="sm:col-span-2">
        <CardBody>
          <Label>Today</Label>
          {!hasLoggedToday ? (
            <EmptyState
              className="mt-3 border-0 px-0 py-6"
              title="Nothing logged yet"
              description="Add your first meal to start tracking against your target."
              actionLabel="Log a meal"
              actionHref="/log"
            />
          ) : (
            <div className="mt-3 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                <ProgressRing value={todayConsumed.kcal} target={metrics.calorieTarget} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="tabular text-3xl font-semibold leading-none text-fg">
                    {Math.round(todayConsumed.kcal)}
                  </span>
                  <span className="mt-1 text-xs text-fg-muted">
                    of {metrics.calorieTarget} kcal
                  </span>
                </div>
              </div>

              <div className="w-full min-w-0 flex-1">
                <p
                  className={cn(
                    'tabular text-sm font-medium',
                    over ? 'text-danger' : 'text-success',
                  )}
                >
                  {over
                    ? `${Math.abs(remaining)} kcal over target`
                    : `${remaining} kcal remaining`}
                </p>
                <div className="mt-3 flex flex-col gap-2.5">
                  <ProgressBar
                    label="Protein"
                    value={todayConsumed.proteinG}
                    target={metrics.proteinTarget}
                    unit="g"
                  />
                  <ProgressBar
                    label="Carbs"
                    value={todayConsumed.carbsG}
                    target={(metrics.calorieTarget * 0.45) / 4}
                    unit="g"
                  />
                  <ProgressBar
                    label="Fat"
                    value={todayConsumed.fatG}
                    target={(metrics.calorieTarget * 0.28) / 9}
                    unit="g"
                  />
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Label>Weight</Label>
          <p className="tabular mt-2 text-3xl font-semibold text-fg">
            {data.currentWeight ?? '—'}
            <span className="ml-1 text-base font-normal text-fg-muted">kg</span>
          </p>
          <p
            className={cn(
              'mt-1 text-sm font-medium',
              weightChange === null || weightChange === 0
                ? 'text-fg-muted'
                : weightChange < 0
                  ? 'text-success'
                  : 'text-fg',
            )}
          >
            {weightChange === null || weightChange === 0
              ? 'No change yet'
              : `${weightChange > 0 ? '+' : ''}${weightChange} kg since you started`}
          </p>
          <p className="tabular mt-2 text-xs text-fg-subtle">
            BMI {metrics.bmi} · {metrics.bmiCategory}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <Label>This period</Label>
          {data.workoutCount === 0 ? (
            <EmptyState
              className="mt-2 border-0 px-0 py-4"
              title="No workouts yet"
              actionLabel="Generate a plan"
              actionHref="/workout"
            />
          ) : (
            <>
              <p className="tabular mt-2 text-3xl font-semibold text-fg">
                {data.workoutCount}
                <span className="ml-1 text-base font-normal text-fg-muted">
                  workout{data.workoutCount === 1 ? '' : 's'}
                </span>
              </p>
              <p className="tabular mt-1 text-sm text-fg-muted">
                {data.totalReps} reps logged
              </p>
              <p className="tabular mt-2 text-xs text-fg-subtle">
                about {data.kcalBurned} kcal burned
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <Card className="sm:col-span-2">
        <CardBody>
          <Label>Form analysis</Label>
          {data.lastForm === null ? (
            <EmptyState
              className="mt-2 border-0 px-0 py-4"
              title="No camera sessions yet"
              description="Use the webcam trainer to count reps and check your squat or curl form."
              actionLabel="Try the trainer"
              actionHref="/train"
            />
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4">
              <div>
                <p className="tabular text-3xl font-semibold text-fg">
                  {Math.round(data.lastForm.avgFormScore)}
                  <span className="ml-1 text-base font-normal text-fg-muted">/ 100</span>
                </p>
                <p className="mt-0.5 text-xs text-fg-subtle">last session score</p>
              </div>

              <div className="flex gap-6">
                <div>
                  <p className="tabular text-xl font-semibold text-success">
                    {data.correctReps}
                  </p>
                  <p className="text-xs text-fg-subtle">correct</p>
                </div>
                <div>
                  <p className="tabular text-xl font-semibold text-warning">
                    {data.incorrectReps}
                  </p>
                  <p className="text-xs text-fg-subtle">need work</p>
                </div>
                <div>
                  <p className="tabular text-xl font-semibold text-fg">{data.formSessions}</p>
                  <p className="text-xs text-fg-subtle">
                    session{data.formSessions === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              {data.commonFault && (
                <p className="w-full text-sm text-warning">
                  Most common fault:{' '}
                  <span className="font-medium">
                    {FAULT_LABEL[data.commonFault] ?? data.commonFault}
                  </span>
                </p>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
