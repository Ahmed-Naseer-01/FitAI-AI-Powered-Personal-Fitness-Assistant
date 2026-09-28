'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GenerateWorkoutButton({ hasPlan }: { hasPlan: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function generate() {
    setBusy(true)
    await fetch('/api/workout', { method: 'POST' })
    setBusy(false)
    router.refresh()
  }

  return (
    <button
      onClick={generate}
      disabled={busy}
      className="shrink-0 rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {busy ? 'Generating…' : hasPlan ? 'Regenerate week' : 'Generate workout'}
    </button>
  )
}
