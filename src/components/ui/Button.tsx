import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const BASE =
  'relative inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-fast)] ' +
  'ease-[var(--ease-out-soft)] active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-50 ' +
  // Touch targets stay comfortable on mobile even at the small size.
  'touch-manipulation select-none'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-fg shadow-[var(--shadow-sm)] hover:bg-accent-hover hover:shadow-[var(--shadow-md)]',
  secondary:
    'border border-border-base bg-surface text-fg hover:bg-bg-subtle hover:border-border-strong',
  ghost: 'text-fg-muted hover:bg-bg-subtle hover:text-fg',
  danger: 'bg-danger text-white hover:opacity-90',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Shown instead of children while loading; falls back to children. */
  loadingText?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
    >
      {loading && <Spinner />}
      <span className={cn(loading && 'opacity-90')}>
        {loading ? (loadingText ?? children) : children}
      </span>
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-4 shrink-0 animate-[spin_0.7s_linear_infinite]', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
