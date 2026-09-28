import { cn } from './cn'

export function Card({
  className,
  interactive = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-[var(--radius-card)] border border-border-base bg-surface shadow-[var(--shadow-sm)]',
        interactive &&
          'transition-[box-shadow,border-color,transform] duration-[var(--duration-base)] ' +
            'ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-md)]',
        className,
      )}
    />
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 p-5 pb-0', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-fg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('p-5', className)} />
}

export function CardFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn('flex flex-wrap items-center gap-2 border-t border-border-base p-5', className)}
    />
  )
}
