'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Field, Input } from '@/components/ui'

/**
 * Updating your weight IS logging it — the profile POST appends a
 * WeightEntry whenever the value actually changed.
 */
export default function WeightUpdateForm({ currentWeight }: { currentWeight: number }) {
  const router = useRouter()
  const [weight, setWeight] = useState(String(currentWeight))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setSaved(false)

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
    setSaved(true)
    router.refresh()
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <Field label="Weight" hint="kilograms" className="w-32">
        {(p) => (
          <Input
            {...p}
            type="number"
            inputMode="decimal"
            step="0.1"
            min={25}
            max={300}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        )}
      </Field>

      <Button type="submit" loading={busy} loadingText="Saving…" className="mb-[1.375rem]">
        Save
      </Button>

      {saved && (
        <p role="status" className="animate-fade-in mb-[1.625rem] text-sm font-medium text-success">
          Weight updated
        </p>
      )}
    </form>
  )
}
