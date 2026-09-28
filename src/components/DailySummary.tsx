import type { DaySummary } from '@/lib/foodLog'
import { Card, CardBody, ProgressBar, ProgressRing, cn } from '@/components/ui'

export default function DailySummary({ summary }: { summary: DaySummary }) {
  const over = summary.remaining < 0

  return (
    <Card>
      <CardBody className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative shrink-0">
          <ProgressRing value={summary.consumed.kcal} target={summary.target} size={124} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="tabular text-2xl font-semibold leading-none text-fg">
              {Math.round(summary.consumed.kcal)}
            </span>
            <span className="mt-1 text-[0.7rem] text-fg-muted">of {summary.target}</span>
          </div>
        </div>

        <div className="w-full min-w-0 flex-1">
          <p className={cn('tabular text-sm font-semibold', over ? 'text-danger' : 'text-success')}>
            {over
              ? `${Math.abs(summary.remaining)} kcal over target`
              : `${summary.remaining} kcal remaining`}
          </p>

          <div className="mt-3 flex flex-col gap-2.5">
            <ProgressBar
              label="Protein"
              value={summary.consumed.proteinG}
              target={summary.proteinTarget}
              unit="g"
            />
            <ProgressBar
              label="Carbs"
              value={summary.consumed.carbsG}
              target={(summary.target * 0.45) / 4}
              unit="g"
            />
            <ProgressBar
              label="Fat"
              value={summary.consumed.fatG}
              target={(summary.target * 0.28) / 9}
              unit="g"
            />
          </div>

          <p className="mt-2.5 text-[0.7rem] leading-relaxed text-fg-subtle">
            Carb and fat bars use a 45% / 28% share of your calorie target as a reference, not a
            hard goal.
          </p>
        </div>
      </CardBody>
    </Card>
  )
}
