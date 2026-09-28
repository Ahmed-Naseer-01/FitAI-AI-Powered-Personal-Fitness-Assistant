'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { scaleMacros, sumMacros } from '@/lib/nutrition'
import type { MealSlot } from '@/lib/types'
import { Button, Card, CardBody, Skeleton, cn } from '@/components/ui'

type Item = {
  id: number
  servings: number
  reason: string
  food: {
    id: number; name: string; servingLabel: string
    kcal: number; proteinG: number; carbsG: number; fatG: number
  }
}

type SimilarFood = { id: number; name: string; servingLabel: string; kcal: number }

export default function MealCard({
  slot, label, items,
}: {
  slot: MealSlot
  label: string
  items: Item[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [swapFor, setSwapFor] = useState<number | null>(null)
  const [options, setOptions] = useState<SimilarFood[] | null>(null)
  const [logged, setLogged] = useState(false)

  const totals = sumMacros(items.map((i) => scaleMacros(i.food, i.servings)))
  const reason = items.find((i) => i.reason)?.reason ?? ''

  async function regenerate() {
    setRegenerating(true)
    await fetch('/api/diet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot }),
    })
    setRegenerating(false)
    setLogged(false)
    router.refresh()
  }

  async function openSwap(item: Item) {
    setSwapFor(item.id)
    setOptions(null)
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

  async function logMeal() {
    setBusy(true)
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: items.map((i) => ({ foodId: i.food.id, servings: i.servings, mealSlot: slot })),
      }),
    })
    setBusy(false)
    setLogged(true)
    router.refresh()
  }

  return (
    <Card className={cn('transition-opacity duration-[var(--duration-base)]', regenerating && 'opacity-60')}>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-fg">{label}</h2>
          <span className="tabular shrink-0 text-xs font-medium text-fg-muted">
            {Math.round(totals.kcal)} kcal · {Math.round(totals.proteinG)} g protein
          </span>
        </div>

        {items.length === 0 ? (
          <p className="py-2 text-sm text-fg-subtle">No items for this meal.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {items.map((item) => (
              <li key={item.id} className="py-2.5 first:pt-0">
                <div className="flex items-center gap-3">
                  <span className="tabular shrink-0 rounded-md bg-bg-subtle px-1.5 py-0.5 text-xs font-semibold text-fg-muted">
                    {item.servings}×
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">{item.food.name}</span>
                  <span className="tabular shrink-0 text-xs text-fg-muted">
                    {Math.round(item.food.kcal * item.servings)} kcal
                  </span>
                  <button
                    onClick={() => (swapFor === item.id ? setSwapFor(null) : openSwap(item))}
                    aria-expanded={swapFor === item.id}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-fg-muted transition-colors duration-[var(--duration-fast)] hover:bg-bg-subtle hover:text-fg"
                  >
                    Swap
                  </button>
                </div>

                {swapFor === item.id && (
                  <div className="animate-slide-down mt-2 rounded-[var(--radius-control)] bg-bg-subtle p-2">
                    {options === null ? (
                      <div className="flex flex-col gap-1.5">
                        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-7" />)}
                      </div>
                    ) : options.length === 0 ? (
                      <p className="px-1 py-1.5 text-xs text-fg-muted">
                        No similar foods available.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {options.map((o) => (
                          <li key={o.id}>
                            <button
                              onClick={() => doSwap(item.id, o.id)}
                              disabled={busy}
                              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface disabled:opacity-50"
                            >
                              <span className="min-w-0 truncate text-fg">{o.name}</span>
                              <span className="tabular shrink-0 text-fg-muted">
                                {o.servingLabel} · {o.kcal} kcal
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {reason && (
          <p className="border-l-2 border-accent/40 pl-3 text-sm italic leading-relaxed text-fg-muted">
            {reason}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={regenerate} loading={regenerating} loadingText="Working…">
            Regenerate
          </Button>
          <Button size="sm" onClick={logMeal} loading={busy && !regenerating} disabled={items.length === 0}>
            Log this meal
          </Button>
          {logged && (
            <span role="status" className="animate-fade-in text-sm font-medium text-success">
              Added to today&apos;s log
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
