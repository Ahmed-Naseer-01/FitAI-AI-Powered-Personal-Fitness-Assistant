'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MEAL_SLOTS, type MealSlot } from '@/lib/types'

type FoodHit = {
  id: number
  name: string
  servingLabel: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
}

export default function FoodSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<FoodHit[]>([])
  const [picked, setPicked] = useState<FoodHit | null>(null)
  const [servings, setServings] = useState(1)
  const [slot, setSlot] = useState<MealSlot>('breakfast')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (query.trim().length === 0) {
      setHits([])
      return
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      setHits(data.foods ?? [])
    }, 200)
    return () => clearTimeout(timer)
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
    setPicked(null)
    setQuery('')
    setServings(1)
    router.refresh()
  }

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <h2 className="font-semibold">Add food</h2>

      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setPicked(null)
        }}
        placeholder="Search — roti, chicken curry, dahi…"
        className="mt-2 w-full rounded border border-gray-300 px-3 py-2"
      />

      {!picked && hits.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 rounded border border-gray-200">
          {hits.map((f) => (
            <li key={f.id}>
              <button
                onClick={() => {
                  setPicked(f)
                  setHits([])
                }}
                className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span>{f.name}</span>
                <span className="text-gray-500">
                  {f.servingLabel} · {f.kcal} kcal
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded bg-gray-50 p-3">
          <div className="text-sm">
            <div className="font-medium">{picked.name}</div>
            <div className="text-gray-500">
              {picked.servingLabel} · {Math.round(picked.kcal * servings)} kcal
            </div>
          </div>

          <label className="text-sm font-medium">
            Servings
            <input
              type="number"
              step={0.5}
              min={0.25}
              max={20}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="mt-1 block w-24 rounded border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="text-sm font-medium">
            Meal
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value as MealSlot)}
              className="mt-1 block rounded border border-gray-300 px-2 py-1.5"
            >
              {MEAL_SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={add}
            disabled={busy}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
    </section>
  )
}
