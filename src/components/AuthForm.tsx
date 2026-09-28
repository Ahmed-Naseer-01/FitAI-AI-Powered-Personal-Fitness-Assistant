'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, Field, Input, Notice } from '@/components/ui'

/**
 * Shared by login and signup — the two differ only in copy and endpoint,
 * so the validation, error handling and busy states stay identical.
 */
export default function AuthForm({
  mode,
}: {
  mode: 'login' | 'signup'
}) {
  const router = useRouter()
  const isSignup = mode === 'signup'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setBusy(false)
      return setError(data.error ?? 'Something went wrong')
    }
    // Keep the button busy through navigation — the page is about to change.
    router.push(data.next)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-7 px-5 py-10">
      <div className="animate-rise-in">
        <div className="mb-5 grid size-11 place-items-center rounded-xl bg-accent text-sm font-bold text-accent-fg shadow-[var(--shadow-md)]">
          Fi
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">
          {isSignup ? 'Create your FitAI account' : 'Welcome back'}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          {isSignup
            ? 'Six quick questions and your plan is ready.'
            : 'Log in to pick up where you left off.'}
        </p>
      </div>

      <form onSubmit={submit} className="animate-rise-in flex flex-col gap-4 [animation-delay:60ms]">
        <Field label="Email">
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          )}
        </Field>

        <Field label="Password" hint={isSignup ? 'At least 8 characters.' : undefined}>
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              required
              minLength={isSignup ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>

        {error && <Notice tone="danger">{error}</Notice>}

        <Button
          type="submit"
          size="lg"
          loading={busy}
          loadingText={isSignup ? 'Creating account…' : 'Logging in…'}
          className="mt-1 w-full"
        >
          {isSignup ? 'Create account' : 'Log in'}
        </Button>
      </form>

      <p className="animate-fade-in text-center text-sm text-fg-muted [animation-delay:120ms]">
        {isSignup ? 'Already have an account? ' : 'Need an account? '}
        <Link
          href={isSignup ? '/login' : '/signup'}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          {isSignup ? 'Log in' : 'Sign up'}
        </Link>
      </p>
    </main>
  )
}
