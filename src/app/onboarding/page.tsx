'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardBody, Field, Input, Notice, Select, cn } from '@/components/ui'

const ALLERGIES = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'egg', label: 'Egg' },
  { value: 'nuts', label: 'Nuts' },
  { value: 'gluten', label: 'Gluten' },
]

const GOALS = [
  { value: 'weight_loss', label: 'Weight loss', hint: '500 kcal below maintenance' },
  { value: 'maintenance', label: 'Maintain weight', hint: 'Stay at maintenance' },
  { value: 'muscle_gain', label: 'Build muscle', hint: '300 kcal above maintenance' },
  { value: 'general_fitness', label: 'General fitness', hint: 'Stay at maintenance' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showOptional, setShowOptional] = useState(false)
  const [allergies, setAllergies] = useState<string[]>([])
  const [goal, setGoal] = useState('general_fitness')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    const payload = Object.fromEntries(new FormData(e.currentTarget).entries())
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, goal, allergies }),
    })

    if (!res.ok) {
      setBusy(false)
      const data = await res.json()
      return setError(data.error ?? 'Could not save your profile')
    }
    router.push('/dashboard')
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 pb-16 sm:px-6">
      <div className="animate-rise-in">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Step 1 of 1</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          Set up your profile
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          Six quick questions. We use these to calculate your calorie and protein targets.
        </p>
      </div>

      <form onSubmit={submit} className="mt-7 flex flex-col gap-5">
        <Card className="animate-rise-in [animation-delay:60ms]">
          <CardBody className="flex flex-col gap-4">
            <Field label="Name">
              {(p) => <Input {...p} name="name" required autoComplete="name" placeholder="Ali" />}
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Age">
                {(p) => <Input {...p} name="age" type="number" inputMode="numeric" required min={10} max={120} placeholder="24" />}
              </Field>
              <Field label="Gender">
                {(p) => (
                  <Select {...p} name="gender" required defaultValue="male">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </Select>
                )}
              </Field>
              <Field label="Height" hint="centimetres">
                {(p) => <Input {...p} name="heightCm" type="number" inputMode="decimal" step="0.5" required min={80} max={250} placeholder="175" />}
              </Field>
              <Field label="Weight" hint="kilograms">
                {(p) => <Input {...p} name="weightKg" type="number" inputMode="decimal" step="0.1" required min={25} max={300} placeholder="72" />}
              </Field>
            </div>

            <Field label="Activity level">
              {(p) => (
                <Select {...p} name="activityLevel" required defaultValue="moderate">
                  <option value="sedentary">Sedentary — desk job, little exercise</option>
                  <option value="light">Light — exercise 1–3 days a week</option>
                  <option value="moderate">Moderate — exercise 3–5 days a week</option>
                  <option value="active">Active — exercise 6–7 days a week</option>
                  <option value="very_active">Very active — physical job or twice daily</option>
                </Select>
              )}
            </Field>
          </CardBody>
        </Card>

        {/* Goal as cards rather than a dropdown: it drives every target, so it
            deserves to be the most visible choice on the page. */}
        <fieldset className="animate-rise-in [animation-delay:100ms]">
          <legend className="mb-2 text-sm font-medium text-fg">What is your goal?</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {GOALS.map((g) => {
              const selected = goal === g.value
              return (
                <label
                  key={g.value}
                  className={cn(
                    'cursor-pointer rounded-[var(--radius-card)] border p-3.5 transition-all duration-[var(--duration-fast)]',
                    'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]',
                    selected
                      ? 'border-accent bg-accent-soft shadow-[var(--shadow-sm)]'
                      : 'border-border-base bg-surface hover:border-border-strong',
                  )}
                >
                  <input
                    type="radio"
                    name="goalRadio"
                    value={g.value}
                    checked={selected}
                    onChange={() => setGoal(g.value)}
                    aria-label={`${g.label} — ${g.hint}`}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      selected ? 'text-accent-soft-fg' : 'text-fg',
                    )}
                  >
                    {g.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-fg-muted">{g.hint}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="animate-rise-in [animation-delay:140ms]">
          <button
            type="button"
            onClick={() => setShowOptional((v) => !v)}
            aria-expanded={showOptional}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <svg
              className={cn(
                'size-4 transition-transform duration-[var(--duration-base)]',
                showOptional && 'rotate-90',
              )}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
            {showOptional ? 'Hide' : 'Show'} optional preferences
          </button>

          {showOptional && (
            <Card className="animate-slide-down mt-3">
              <CardBody className="flex flex-col gap-4">
                <Field label="Experience">
                  {(p) => (
                    <Select {...p} name="experience" defaultValue="beginner">
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </Select>
                  )}
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Workout days" hint="per week">
                    {(p) => <Input {...p} name="workoutDays" type="number" inputMode="numeric" min={1} max={7} defaultValue={3} />}
                  </Field>
                  <Field label="Session length" hint="minutes">
                    {(p) => <Input {...p} name="sessionMinutes" type="number" inputMode="numeric" min={15} max={120} defaultValue={45} />}
                  </Field>
                </div>

                <Field label="Diet">
                  {(p) => (
                    <Select {...p} name="dietaryPreference" defaultValue="non_veg">
                      <option value="non_veg">No restriction</option>
                      <option value="vegetarian">Vegetarian</option>
                    </Select>
                  )}
                </Field>

                <Field label="Budget">
                  {(p) => (
                    <Select {...p} name="budget" defaultValue="any">
                      <option value="any">No preference</option>
                      <option value="low">Budget-friendly foods only</option>
                    </Select>
                  )}
                </Field>

                <fieldset>
                  <legend className="text-sm font-medium text-fg">Avoid these</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ALLERGIES.map((a) => {
                      const on = allergies.includes(a.value)
                      return (
                        <label
                          key={a.value}
                          className={cn(
                            'cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-all duration-[var(--duration-fast)]',
                            'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]',
                            on
                              ? 'border-accent bg-accent-soft font-medium text-accent-soft-fg'
                              : 'border-border-base text-fg-muted hover:border-border-strong hover:text-fg',
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) =>
                              setAllergies((prev) =>
                                e.target.checked
                                  ? [...prev, a.value]
                                  : prev.filter((x) => x !== a.value),
                              )
                            }
                            aria-label={`Avoid ${a.label}`}
                            className="sr-only"
                          />
                          {a.label}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              </CardBody>
            </Card>
          )}
        </div>

        {error && <Notice tone="danger">{error}</Notice>}

        <Button
          type="submit"
          size="lg"
          loading={busy}
          loadingText="Saving…"
          className="animate-rise-in w-full [animation-delay:180ms] sm:w-auto sm:self-start"
        >
          Save and continue
        </Button>
      </form>
    </main>
  )
}
