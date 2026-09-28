'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MEAL_SLOTS, type MealSlot } from '@/lib/types'

type DraftRow = {
  foodId: number
  servings: number
  mealSlot: MealSlot
  food: { id: number; name: string; servingLabel: string; kcal: number }
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
      return setNote('Could not match anything. Try the search box above.')
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
          foodId: d.foodId,
          servings: d.servings,
          mealSlot: d.mealSlot,
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

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h2 className="font-semibold">Or describe what you ate</h2>
      <p className="mt-1 text-xs text-gray-500">
        Quantities read from text are approximate — check the draft before saving.
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="two rotis, chicken curry and a glass of lassi"
          className="min-w-52 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={interpret}
          disabled={busy || text.trim().length === 0}
          className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          {busy ? 'Reading…' : 'Interpret'}
        </button>
      </div>

      {note && <p className="mt-2 text-sm text-amber-700">{note}</p>}

      {draft && (
        <div className="mt-3 rounded bg-gray-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Draft — nothing is saved yet
          </p>

          <ul className="mt-2 flex flex-col gap-2">
            {draft.map((row, i) => (
              <li key={`${row.foodId}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                <input
                  type="number"
                  step={0.5}
                  min={0.25}
                  max={20}
                  value={row.servings}
                  onChange={(e) => update(i, { servings: Number(e.target.value) })}
                  className="w-20 rounded border border-gray-300 px-2 py-1"
                />
                <span className="flex-1">
                  {row.food.name}
                  <span className="ml-2 text-gray-500">
                    {Math.round(row.food.kcal * row.servings)} kcal
                  </span>
                </span>
                <select
                  value={row.mealSlot}
                  onChange={(e) => update(i, { mealSlot: e.target.value as MealSlot })}
                  className="rounded border border-gray-300 px-2 py-1"
                >
                  {MEAL_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setDraft((p) => p?.filter((_, j) => j !== i) ?? null)}
                  className="text-gray-400 hover:text-red-600"
                  aria-label={`Remove ${row.food.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2">
            <button
              onClick={confirm}
              disabled={busy || draft.length === 0}
              className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Save {draft.length} {draft.length === 1 ? 'item' : 'items'}
            </button>
            <button
              onClick={() => setDraft(null)}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
