import { useId } from 'react'
import { cn } from './cn'

const CONTROL =
  'w-full rounded-[var(--radius-control)] border border-border-base bg-surface px-3 text-sm text-fg ' +
  'placeholder:text-fg-subtle shadow-[var(--shadow-sm)] ' +
  'transition-[border-color,box-shadow] duration-[var(--duration-fast)] ' +
  'hover:border-border-strong focus:border-accent focus:outline-none ' +
  'focus:ring-2 focus:ring-[var(--accent)]/25 disabled:opacity-60'

/** A labelled control. The label is always rendered — never a bare placeholder. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => React.ReactNode
  className?: string
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        ...(error ? { 'aria-invalid': true as const } : {}),
      })}

      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>
}

export function Input({ className, ref, ...rest }: InputProps) {
  return <input {...rest} ref={ref} className={cn(CONTROL, 'h-11', className)} />
}

export function Select({ className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cn(CONTROL, 'h-11 appearance-none bg-no-repeat pr-9', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2378716c'%3E%3Cpath fill-rule='evenodd' d='M5.2 7.3a1 1 0 0 1 1.4 0L10 10.6l3.4-3.3a1 1 0 1 1 1.4 1.4l-4.1 4a1 1 0 0 1-1.4 0l-4.1-4a1 1 0 0 1 0-1.4z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.625rem center',
        backgroundSize: '1.1rem',
        ...rest.style,
      }}
    />
  )
}
