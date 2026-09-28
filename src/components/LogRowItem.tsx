'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LogRow } from '@/lib/foodLog'
import { scaleMacros } from '@/lib/nutrition'
import { cn } from '@/components/ui'

export default function LogRowItem({ row }: { row: LogRow }) {
  const router = useRouter()
  const [servings, setServings] = useState(row.servings)
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)
  const macros = scaleMacros(row.food, servings)

  async function save(next: number) {
    setServings(next)
    setBusy(true)
    await fetch(`/api/log/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servings: next }),
    })
    setBusy(false)
    router.refresh()
  }

  async function remove() {
    setRemoving(true) // fade out before the row disappears
    await fetch(`/api/log/${row.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <li
      className={cn(
        'flex items-center gap-3 px-3.5 py-2.5 transition-all duration-[var(--duration-base)]',
        removing ? 'scale-[0.98] opacity-0' : 'opacity-100',
        busy && 'opacity-70',
      )}
    >
      <input
        type="number"
        inputMode="decimal"
        step={0.5}
        min={0.25}
        max={20}
        value={servings}
        onChange={(e) => save(Number(e.target.value))}
        disabled={busy || removing}
        aria-label={`Servings of ${row.food.name}`}
        className="tabular h-9 w-16 shrink-0 rounded-[var(--radius-control)] border border-border-base bg-surface px-2 text-sm text-fg transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/25"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{row.food.name}</p>
        <p className="tabular text-xs text-fg-subtle">{row.food.servingLabel}</p>
      </div>

      <span className="tabular shrink-0 text-sm text-fg-muted">
        {Math.round(macros.kcal)} kcal
      </span>

      <button
        onClick={remove}
        disabled={busy || removing}
        aria-label={`Remove ${row.food.name}`}
        className="grid size-9 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors duration-[var(--duration-fast)] hover:bg-danger-soft hover:text-danger disabled:opacity-40"
      >
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </li>
  )
}
