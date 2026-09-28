import { cn } from './cn'

/** Horizontal progress bar with an accessible value. */
export function ProgressBar({
  label,
  value,
  target,
  unit,
  tone = 'accent',
}: {
  label: string
  value: number
  target: number
  unit: string
  tone?: 'accent' | 'warning' | 'danger'
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0
  const fill =
    tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-accent'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-fg-muted">{label}</span>
        <span className="tabular text-fg-muted">
          {Math.round(value)} / {Math.round(target)} {unit}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(target)}
        className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-bg-subtle"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out-soft)]',
            fill,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Circular calorie gauge. Purely decorative — the number beside it is the data. */
export function ProgressRing({
  value,
  target,
  size = 132,
}: {
  value: number
  target: number
  size?: number
}) {
  const pct = target > 0 ? Math.min(1, value / target) : 0
  const over = value > target
  const stroke = 10
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--bg-subtle)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={over ? 'var(--danger)' : 'var(--accent)'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          transition: 'stroke-dashoffset var(--duration-slow) var(--ease-out-soft)',
        }}
      />
    </svg>
  )
}
