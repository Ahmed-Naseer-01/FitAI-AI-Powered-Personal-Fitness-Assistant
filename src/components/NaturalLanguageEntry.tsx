'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MEAL_SLOTS, type MealSlot } from '@/lib/types'
import { Badge, Button, Card, CardBody, Input, Notice, Spinner } from '@/components/ui'
import { IconSpark } from '@/components/ui/icons'

type DraftRow = {
  foodId: number
  servings: number
  mealSlot: MealSlot
  food: { id: number; name: string; servingLabel: string; kcal: number }
}

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner',
}

export default function NaturalLanguageEntry({ aiEnabled }: { aiEnabled: boolean }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<DraftRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  if (!aiEnabled) return null

  async function interpret() {
    setBusy(true)
    setNote(null)

    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, defaultSlot: 'lunch' }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) return setNote(data.error ?? 'Could not read that')
    if (!data.draft || data.draft.length === 0) {
      return setNote('Could not match anything to the food database. Try the search box above.')
    }
    setDraft(data.draft)
  }

  async function confirm() {
    if (!draft) return
    setBusy(true)
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: draft.map((d) => ({
          foodId: d.foodId, servings: d.servings, mealSlot: d.mealSlot,
        })),
      }),
    })
    setBusy(false)
    setDraft(null)
    setText('')
    router.refresh()
  }

  function update(index: number, patch: Partial<DraftRow>) {
    setDraft((prev) => prev?.map((row, i) => (i === index ? { ...row, ...patch } : row)) ?? null)
  }

  const draftKcal = draft?.reduce((n, d) => n + d.food.kcal * d.servings, 0) ?? 0

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconSpark className="size-4 text-accent" />
          <h2 className="text-sm font-semibold tracking-tight text-fg">
            Or describe what you ate
          </h2>
        </div>
        <p className="-mt-1 text-xs text-fg-muted">
          Quantities read from text are approximate — you review the draft before anything saves.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); interpret() }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="two rotis, chicken curry and a glass of lassi"
            aria-label="Describe what you ate"
            className="flex-1"
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={busy || text.trim().length === 0}
            className="shrink-0"
          >
            {busy && !draft ? <><Spinner /> Reading…</> : 'Interpret'}
          </Button>
        </form>

        {note && <Notice tone="warning">{note}</Notice>}

        {draft && (
          <div className="animate-scale-in rounded-[var(--radius-control)] border border-accent/30 bg-accent-soft/40 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Badge tone="info">Draft — nothing saved yet</Badge>
              <span className="tabular text-xs font-medium text-fg-muted">
                {Math.round(draftKcal)} kcal total
              </span>
            </div>

            <ul className="mt-3 flex flex-col gap-2">
              {draft.map((row, i) => (
                <li key={`${row.foodId}-${i}`} className="flex flex-wrap items-center gap-2">
                  <input
                    type="number" inputMode="decimal" step={0.5} min={0.25} max={20}
                    value={row.servings}
                    onChange={(e) => update(i, { servings: Number(e.target.value) })}
                    aria-label={`Servings of ${row.food.name}`}
                    className="tabular h-9 w-16 rounded-[var(--radius-control)] border border-border-base bg-surface px-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                    {row.food.name}
                  </span>
                  <select
                    value={row.mealSlot}
                    onChange={(e) => update(i, { mealSlot: e.target.value as MealSlot })}
                    aria-label={`Meal for ${row.food.name}`}
                    className="h-9 rounded-[var(--radius-control)] border border-border-base bg-surface px-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25"
                  >
                    {MEAL_SLOTS.map((s) => (
                      <option key={s} value={s}>{SLOT_LABEL[s]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setDraft((p) => p?.filter((_, j) => j !== i) ?? null)}
                    aria-label={`Remove ${row.food.name} from draft`}
                    className="grid size-9 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface hover:text-danger"
                  >
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-3.5 flex flex-wrap gap-2">
              <Button size="sm" onClick={confirm} loading={busy} loadingText="Saving…" disabled={draft.length === 0}>
                Save {draft.length} {draft.length === 1 ? 'item' : 'items'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
