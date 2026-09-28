'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { scaleMacros, sumMacros } from '@/lib/nutrition'
import type { MealSlot } from '@/lib/types'

type Item = {
  id: number
  servings: number
  reason: string
  food: {
    id: number
    name: string
    servingLabel: string
    kcal: number
    proteinG: number
    carbsG: number
    fatG: number
  }
}

type SimilarFood = { id: number; name: string; servingLabel: string; kcal: number }

export default function MealCard({
  slot,
  label,
  items,
}: {
  slot: MealSlot
  label: string
  items: Item[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [swapFor, setSwapFor] = useState<number | null>(null)
  const [options, setOptions] = useState<SimilarFood[]>([])
  const [logged, setLogged] = useState(false)

  const totals = sumMacros(items.map((i) => scaleMacros(i.food, i.servings)))
  const reason = items.find((i) => i.reason)?.reason ?? ''

  async function regenerate() {
    setBusy(true)
    await fetch('/api/diet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot }),
    })
    setBusy(false)
    setLogged(false)
    router.refresh()
  }

  async function openSwap(item: Item) {
    setSwapFor(item.id)
    setOptions([])
    const res = await fetch(`/api/foods/similar?foodId=${item.food.id}`)
    setOptions((await res.json()).foods ?? [])
  }

  async function doSwap(itemId: number, foodId: number) {
    setBusy(true)
    await fetch('/api/diet', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, foodId }),
    })
    setBusy(false)
    setSwapFor(null)
    router.refresh()
  }

  // The plan is what you should eat; the log is what you did. Copying across
  // is always explicit.
  async function logMeal() {
    setBusy(true)
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: items.map((i) => ({
          foodId: i.food.id,
          servings: i.servings,
          mealSlot: slot,
        })),
      }),
    })
    setBusy(false)
    setLogged(true)
    router.refresh()
  }

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">{label}</h2>
        <span className="text-sm text-gray-500">
          {Math.round(totals.kcal)} kcal · {Math.round(totals.proteinG)} g protein
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">No items for this meal.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.id} className="py-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {item.servings} × {item.food.name}
                  <span className="ml-2 text-gray-500">
                    {Math.round(item.food.kcal * item.servings)} kcal
                  </span>
                </span>
                <button
                  onClick={() => openSwap(item)}
                  className="text-xs text-gray-500 underline hover:text-black"
                >
                  Swap
                </button>
              </div>

              {swapFor === item.id && (
                <div className="mt-2 rounded bg-gray-50 p-2">
                  {options.length === 0 ? (
                    <p className="text-xs text-gray-500">No similar foods available.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {options.map((o) => (
                        <li key={o.id}>
                          <button
                            onClick={() => doSwap(item.id, o.id)}
                            disabled={busy}
                            className="w-full text-left text-xs hover:underline disabled:opacity-50"
                          >
                            {o.name} — {o.servingLabel} · {o.kcal} kcal
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={() => setSwapFor(null)}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {reason && <p className="mt-2 text-sm italic text-gray-600">{reason}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={regenerate}
          disabled={busy}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Regenerate'}
        </button>
        <button
          onClick={logMeal}
          disabled={busy || items.length === 0}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Log this meal
        </button>
        {logged && <span className="text-sm text-green-700">Added to today&apos;s log</span>}
      </div>
    </section>
  )
}
