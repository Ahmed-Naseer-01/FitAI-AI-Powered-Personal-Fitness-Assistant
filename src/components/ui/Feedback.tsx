import Link from 'next/link'
import { cn } from './cn'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<Tone, string> = {
  info: 'bg-accent-soft text-accent-soft-fg',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

/** Inline message. Errors announce themselves to screen readers. */
export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: Tone
  children: React.ReactNode
  className?: string
}) {
  const assertive = tone === 'danger'
  return (
    <div
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      className={cn(
        'animate-slide-down rounded-[var(--radius-control)] px-3.5 py-2.5 text-sm leading-relaxed',
        TONES[tone],
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Empty state with a single clear next action. Never a bare blank panel. */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border-strong px-6 py-10 text-center',
        className,
      )}
    >
      {icon && <div className="text-fg-subtle">{icon}</div>}
      <p className="font-medium text-fg">{title}</p>
      {description && <p className="max-w-sm text-sm text-fg-muted">{description}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-2 inline-flex h-10 items-center rounded-[var(--radius-control)] bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-[var(--duration-fast)] hover:bg-accent-hover"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}

/** Shimmering placeholder for content that is loading. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('relative overflow-hidden rounded-md bg-bg-subtle', className)}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-black/[0.04] to-transparent dark:via-white/[0.06]" />
    </div>
  )
}

export function Badge({
  tone = 'info',
  children,
  className,
}: {
  tone?: Tone | 'neutral'
  children: React.ReactNode
  className?: string
}) {
  const styles =
    tone === 'neutral' ? 'bg-bg-subtle text-fg-muted' : TONES[tone as Tone]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles,
        className,
      )}
    >
      {children}
    </span>
  )
}
