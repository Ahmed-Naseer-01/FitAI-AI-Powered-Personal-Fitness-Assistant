/** Inline stroke icons — no icon dependency, no runtime cost. */
type P = { className?: string }
const base = (className?: string) => ({
  className: className ?? 'size-5',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const IconChart = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M7 15l3.5-4 3 2.5L20 7" />
  </svg>
)

export const IconPlate = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4" />
  </svg>
)

export const IconLeaf = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 20c0-7 5-12 16-13 0 9-4 14-11 14a5 5 0 0 1-5-1Z" />
    <path d="M9 15c1.5-2.5 3.5-4.5 6-6" />
  </svg>
)

export const IconDumbbell = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" />
  </svg>
)

export const IconCamera = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7a1 1 0 0 0 .84-.46l.72-1.1A1 1 0 0 1 9.6 4h4.8a1 1 0 0 1 .84.45l.72 1.1a1 1 0 0 0 .84.45h1.7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z" />
    <circle cx="12" cy="12.5" r="3.2" />
  </svg>
)

export const IconUser = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="8" r="3.75" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
)

export const IconSpark = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z" />
    <path d="M18 16l.7 1.8L20.5 18.5l-1.8.7L18 21l-.7-1.8L15.5 18.5l1.8-.7Z" />
  </svg>
)

export const IconLogout = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
)

export const IconCheck = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4.5 12.5l5 5 10-11" />
  </svg>
)
