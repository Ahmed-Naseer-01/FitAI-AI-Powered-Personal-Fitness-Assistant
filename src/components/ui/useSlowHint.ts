'use client'

import { useEffect, useState } from 'react'

/**
 * True once an operation has been running longer than `afterMs`.
 * Used to explain a slow AI provider instead of leaving a spinner unexplained.
 */
export function useSlowHint(active: boolean, afterMs = 4000): boolean {
  const [elapsed, setElapsed] = useState(false)

  useEffect(() => {
    if (!active) return

    const timer = setTimeout(() => setElapsed(true), afterMs)
    // Reset on teardown rather than in the effect body, so the hook never
    // triggers a cascading render.
    return () => {
      clearTimeout(timer)
      setElapsed(false)
    }
  }, [active, afterMs])

  return active && elapsed
}
