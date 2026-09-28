'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/components/ui/cn'
import { Spinner } from '@/components/ui/Button'
import {
  IconChart, IconPlate, IconLeaf, IconDumbbell, IconCamera, IconUser, IconLogout,
} from '@/components/ui/icons'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', short: 'Home', Icon: IconChart },
  { href: '/log', label: 'Log food', short: 'Log', Icon: IconPlate },
  { href: '/diet', label: 'Diet plan', short: 'Diet', Icon: IconLeaf },
  { href: '/workout', label: 'Workout', short: 'Workout', Icon: IconDumbbell },
  { href: '/train', label: 'Train', short: 'Train', Icon: IconCamera },
]

const HIDDEN_ON = ['/login', '/signup', '/onboarding']

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  if (HIDDEN_ON.includes(pathname)) return null

  async function logout() {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const isActive = (href: string) => pathname === href

  return (
    <>
      {/* Skip link — first thing a keyboard user reaches */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-fg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-border-base bg-surface/85 backdrop-blur-md supports-[backdrop-filter]:bg-surface/70">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="mr-1 flex items-center gap-2 rounded-md text-[0.95rem] font-semibold tracking-tight text-fg"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-[0.7rem] font-bold text-accent-fg">
              Fi
            </span>
            FitAI
          </Link>

          {/* Desktop links */}
          <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex">
            {LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={cn(
                  'rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium transition-colors duration-[var(--duration-fast)]',
                  isActive(href)
                    ? 'bg-bg-subtle text-fg'
                    : 'text-fg-muted hover:bg-bg-subtle hover:text-fg',
                )}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/profile"
              aria-label="Profile"
              aria-current={isActive('/profile') ? 'page' : undefined}
              className={cn(
                'grid size-10 place-items-center rounded-full transition-colors duration-[var(--duration-fast)]',
                isActive('/profile')
                  ? 'bg-accent-soft text-accent-soft-fg'
                  : 'text-fg-muted hover:bg-bg-subtle hover:text-fg',
              )}
            >
              <IconUser />
            </Link>
            <button
              onClick={logout}
              disabled={loggingOut}
              aria-label="Log out"
              className="grid size-10 place-items-center rounded-full text-fg-muted transition-colors duration-[var(--duration-fast)] hover:bg-bg-subtle hover:text-fg disabled:opacity-50"
            >
              {loggingOut ? <Spinner /> : <IconLogout />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom tab bar — thumb reach, safe-area aware */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border-base bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {LINKS.map(({ href, short, Icon }) => {
            const active = isActive(href)
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-14 flex-col items-center justify-center gap-0.5 text-[0.65rem] font-medium transition-colors duration-[var(--duration-fast)]',
                    active ? 'text-accent' : 'text-fg-subtle hover:text-fg',
                  )}
                >
                  <Icon className={cn('size-5 transition-transform duration-[var(--duration-fast)]', active && 'scale-110')} />
                  {short}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
