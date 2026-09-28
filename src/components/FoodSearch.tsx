'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MEAL_SLOTS, type MealSlot } from '@/lib/types'
import {
  Button, Card, CardBody, Field, Input, Select, Skeleton, cn,
} from '@/components/ui'

type FoodHit = {
  id: number
  name: string
  servingLabel: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner',
}

export default function FoodSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<FoodHit[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<FoodHit | null>(null)
  const [servings, setServings] = useState(1)
  const [slot, setSlot] = useState<MealSlot>('breakfast')
  const [busy, setBusy] = useState(false)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    const timer = setTimeout(async () => {
      if (query.trim().length === 0) {
        if (!cancelled) { setHits([]); setSearching(false) }
        return
      }
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (!cancelled) { setHits(data.foods ?? []); setSearching(false) }
    }, 200)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  async function add() {
    if (!picked) return
    setBusy(true)
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodId: picked.id, servings, mealSlot: slot }),
    })
    setBusy(false)
    setJustAdded(`${picked.name} added to ${SLOT_LABEL[slot].toLowerCase()}`)
    setPicked(null)
    setQuery('')
    setServings(1)
    inputRef.current?.focus()
    router.refresh()
    setTimeout(() => setJustAdded(null), 3000)
  }

  const showResults = !picked && query.trim().length > 0

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-fg">Add food</h2>

        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPicked(null)
              // Flagged here rather than in the effect: this is the user action.
              setSearching(e.target.value.trim().length > 0)
            }}
            placeholder="Search — roti, chicken curry, dahi…"
            aria-label="Search foods"
            className="pl-9"
          />
        </div>

        {showResults && (
          <div className="animate-slide-down overflow-hidden rounded-[var(--radius-control)] border border-border-base">
            {searching ? (
              <div className="flex flex-col gap-px">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-11 rounded-none" />
                ))}
              </div>
            ) : hits.length === 0 ? (
              <p className="px-3.5 py-4 text-sm text-fg-muted">
                No match for “{query}”. Try a shorter word, or describe your meal below.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {hits.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => { setPicked(f); setHits([]) }}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm transition-colors duration-[var(--duration-fast)] hover:bg-bg-subtle"
                    >
                      <span className="min-w-0 truncate font-medium text-fg">{f.name}</span>
                      <span className="tabular shrink-0 text-xs text-fg-muted">
                        {f.servingLabel} · {f.kcal} kcal
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {picked && (
          <div className="animate-scale-in rounded-[var(--radius-control)] bg-bg-subtle p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-fg">{picked.name}</p>
                <p className="tabular mt-0.5 text-xs text-fg-muted">
                  {picked.servingLabel} · {Math.round(picked.kcal * servings)} kcal ·{' '}
                  {Math.round(picked.proteinG * servings)} g protein
                </p>
              </div>
              <button
                onClick={() => setPicked(null)}
                aria-label="Cancel"
                className="grid size-9 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-fg"
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Field label="Servings" className="w-24">
                {(p) => (
                  <Input
                    {...p} type="number" inputMode="decimal" step={0.5} min={0.25} max={20}
                    value={servings}
                    onChange={(e) => setServings(Number(e.target.value))}
                  />
                )}
              </Field>
              <Field label="Meal" className="min-w-32 flex-1">
                {(p) => (
                  <Select {...p} value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
                    {MEAL_SLOTS.map((s) => (
                      <option key={s} value={s}>{SLOT_LABEL[s]}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button onClick={add} loading={busy} loadingText="Adding…" className="h-11">
                Add
              </Button>
            </div>
          </div>
        )}

        {/* Success feedback, announced politely and self-dismissing */}
        <p
          role="status"
          aria-live="polite"
          className={cn(
            'text-sm font-medium text-success transition-opacity duration-[var(--duration-base)]',
            justAdded ? 'opacity-100' : 'h-0 opacity-0',
          )}
        >
          {justAdded}
        </p>
      </CardBody>
    </Card>
  )
}
