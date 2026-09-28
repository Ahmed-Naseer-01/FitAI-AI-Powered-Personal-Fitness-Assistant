export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

/** Consistent page container: one place controls max width and gutters. */
export function Page({
  children,
  width = 'md',
}: {
  children: React.ReactNode
  width?: 'sm' | 'md' | 'lg'
}) {
  const max = width === 'sm' ? 'max-w-xl' : width === 'lg' ? 'max-w-4xl' : 'max-w-2xl'
  return (
    <main
      className={`mx-auto flex w-full ${max} animate-fade-in flex-col gap-6 px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-10`}
    >
      {children}
    </main>
  )
}
