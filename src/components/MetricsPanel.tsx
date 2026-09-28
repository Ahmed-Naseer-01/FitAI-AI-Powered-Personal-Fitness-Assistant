import { BMI_DISCLAIMER, type Metrics } from '@/lib/metrics'
import { Card, CardBody } from '@/components/ui'

const CATEGORY_LABEL: Record<Metrics['bmiCategory'], string> = {
  underweight: 'Underweight',
  normal: 'Normal',
  overweight: 'Overweight',
  obese: 'Obese',
}

function Stat({
  label, value, unit, hint,
}: {
  label: string
  value: number | string
  unit?: string
  hint?: string
}) {
  return (
    <div className="rounded-[var(--radius-control)] border border-border-base bg-surface p-4">
      <dt className="text-xs font-medium uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className="tabular mt-1.5 text-2xl font-semibold leading-none text-fg">
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-fg-muted">{unit}</span>}
      </dd>
      {hint && <p className="mt-1 text-[0.7rem] text-fg-subtle">{hint}</p>}
    </div>
  )
}

export default function MetricsPanel({ metrics }: { metrics: Metrics }) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-tight text-fg">Your numbers</h2>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="BMI" value={metrics.bmi} hint={CATEGORY_LABEL[metrics.bmiCategory]} />
          <Stat label="BMR" value={metrics.bmr} unit="kcal" hint="at complete rest" />
          <Stat label="TDEE" value={metrics.tdee} unit="kcal" hint="with your activity" />
          <Stat label="Calorie target" value={metrics.calorieTarget} unit="kcal" hint="per day" />
          <Stat label="Protein target" value={metrics.proteinTarget} unit="g" hint="per day" />
        </dl>

        {/* Required wherever BMI is shown — see the design document */}
        <p className="rounded-[var(--radius-control)] bg-warning-soft px-3.5 py-3 text-xs leading-relaxed text-warning">
          {BMI_DISCLAIMER}
        </p>
      </CardBody>
    </Card>
  )
}
