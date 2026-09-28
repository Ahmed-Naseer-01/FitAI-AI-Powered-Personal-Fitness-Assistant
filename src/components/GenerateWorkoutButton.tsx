'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'
import { IconSpark } from '@/components/ui/icons'

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
    <Button onClick={generate} loading={busy} loadingText="Generating…">
      {!busy && <IconSpark className="size-4" />}
      {hasPlan ? 'Regenerate week' : 'Generate workout'}
    </Button>
  )
}
