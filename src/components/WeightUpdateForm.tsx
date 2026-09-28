'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Updating your weight IS logging it — the profile POST appends a
 * WeightEntry whenever the value actually changed.
 */
export default function WeightUpdateForm({ currentWeight }: { currentWeight: number }) {
  const router = useRouter()
  const [weight, setWeight] = useState(String(currentWeight))
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)

    // Re-send the whole profile with only the weight changed, so the single
    // profile endpoint stays the only write path.
    const current = await fetch('/api/profile').then((r) => r.json())
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...current.profile,
        allergies: current.allergies,
        weightKg: Number(weight),
      }),
    })

    setBusy(false)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="mt-2 flex items-end gap-2">
      <label className="text-sm font-medium">
        Weight (kg)
        <input
          type="number"
          step="0.1"
          min={25}
          max={300}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="mt-1 block w-32 rounded border border-gray-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
