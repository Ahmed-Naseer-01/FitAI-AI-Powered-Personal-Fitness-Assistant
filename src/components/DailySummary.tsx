import type { DaySummary } from '@/lib/foodLog'

function Bar({
  label, value, target, unit,
}: { label: string; value: number; target: number; unit: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span>
          {Math.round(value)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div className="mt-1 h-2 w-full rounded bg-gray-200">
        <div className="h-2 rounded bg-black" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function DailySummary({ summary }: { summary: DaySummary }) {
  const over = summary.remaining < 0

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Consumed</div>
          <div className="text-2xl font-semibold">{Math.round(summary.consumed.kcal)} kcal</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Target</div>
          <div className="text-2xl font-semibold">{summary.target} kcal</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">
            {over ? 'Over by' : 'Remaining'}
          </div>
          <div className={`text-2xl font-semibold ${over ? 'text-red-600' : 'text-green-700'}`}>
            {Math.abs(summary.remaining)} kcal
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Bar label="Protein" value={summary.consumed.proteinG} target={summary.proteinTarget} unit="g" />
        <Bar label="Carbs" value={summary.consumed.carbsG} target={(summary.target * 0.45) / 4} unit="g" />
        <Bar label="Fat" value={summary.consumed.fatG} target={(summary.target * 0.28) / 9} unit="g" />
      </div>

      <p className="mt-2 text-xs text-gray-500">
        Carb and fat bars use a 45% / 28% share of your calorie target as a reference, not a hard goal.
      </p>
    </section>
  )
}
