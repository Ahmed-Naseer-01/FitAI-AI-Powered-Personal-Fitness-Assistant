import { BMI_DISCLAIMER, type Metrics } from '@/lib/metrics'

const CATEGORY_LABEL: Record<Metrics['bmiCategory'], string> = {
  underweight: 'Underweight',
  normal: 'Normal',
  overweight: 'Overweight',
  obese: 'Obese',
}

function Stat({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-gray-500">{unit}</span>}
      </div>
    </div>
  )
}

export default function MetricsPanel({ metrics }: { metrics: Metrics }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="BMI" value={metrics.bmi} />
        <Stat label="Category" value={CATEGORY_LABEL[metrics.bmiCategory]} />
        <Stat label="BMR" value={metrics.bmr} unit="kcal/day" />
        <Stat label="TDEE" value={metrics.tdee} unit="kcal/day" />
        <Stat label="Calorie target" value={metrics.calorieTarget} unit="kcal/day" />
        <Stat label="Protein target" value={metrics.proteinTarget} unit="g/day" />
      </div>

      {/* Required wherever BMI is shown — see the design document. */}
      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        {BMI_DISCLAIMER}
      </p>
    </section>
  )
}
