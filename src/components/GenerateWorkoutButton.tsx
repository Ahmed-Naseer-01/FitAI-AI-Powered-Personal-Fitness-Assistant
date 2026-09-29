'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, useSlowHint } from '@/components/ui'
import { IconSpark } from '@/components/ui/icons'

export default function GenerateWorkoutButton({ hasPlan }: { hasPlan: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const slow = useSlowHint(busy)

  async function generate() {
    setBusy(true)
    await fetch('/api/workout', { method: 'POST' })
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button onClick={generate} loading={busy} loadingText="Generating…">
        {!busy && <IconSpark className="size-4" />}
      {hasPlan ? 'Regenerate week' : 'Generate workout'}
      </Button>
      {slow && (
        <p role="status" className="animate-fade-in max-w-[14rem] text-right text-xs text-fg-muted">
          The AI service is slow right now. We&apos;ll fall back to the built-in planner shortly.
        </p>
      )}
    </div>
  )
}
