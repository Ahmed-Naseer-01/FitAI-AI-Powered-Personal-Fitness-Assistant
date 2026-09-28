'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/log', label: 'Log food' },
  { href: '/diet', label: 'Diet plan' },
  { href: '/workout', label: 'Workout' },
  { href: '/train', label: 'Train' },
  { href: '/profile', label: 'Profile' },
]

const HIDDEN_ON = ['/login', '/signup', '/onboarding']

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  if (HIDDEN_ON.includes(pathname)) return null

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-1 p-3">
        <span className="mr-3 font-semibold">FitAI</span>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded px-3 py-1.5 text-sm ${
              pathname === l.href ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {l.label}
          </Link>
        ))}
        <button onClick={logout} className="ml-auto text-sm text-gray-500 hover:underline">
          Log out
        </button>
      </div>
    </nav>
  )
}
