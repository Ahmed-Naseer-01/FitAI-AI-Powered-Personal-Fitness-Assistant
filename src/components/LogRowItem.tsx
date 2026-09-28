'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LogRow } from '@/lib/foodLog'
import { scaleMacros } from '@/lib/nutrition'

export default function LogRowItem({ row }: { row: LogRow }) {
  const router = useRouter()
  const [servings, setServings] = useState(row.servings)
  const [busy, setBusy] = useState(false)
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
    setBusy(true)
    await fetch(`/api/log/${row.id}`, { method: 'DELETE' })
    setBusy(false)
    router.refresh()
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <input
        type="number"
        step={0.5}
        min={0.25}
        max={20}
        value={servings}
        onChange={(e) => save(Number(e.target.value))}
        disabled={busy}
        className="w-16 rounded border border-gray-300 px-2 py-1"
      />
      <span className="flex-1">{row.food.name}</span>
      <span className="text-gray-500">{Math.round(macros.kcal)} kcal</span>
      <button
        onClick={remove}
        disabled={busy}
        className="text-gray-400 hover:text-red-600"
        aria-label={`Remove ${row.food.name}`}
      >
        ✕
      </button>
    </li>
  )
}
