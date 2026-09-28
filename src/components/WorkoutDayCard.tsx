'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardBody, cn } from '@/components/ui'
import { IconCamera, IconCheck } from '@/components/ui/icons'

type Item = {
  id: number
  sets: number
  reps: number
  restSec: number
  reason: string
  focus: string
  exercise: {
    id: number; name: string; repUnit: string; muscleGroup: string
    hasFormTracking: boolean; formKey: string | null
  }
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function WorkoutDayCard({
  dayOfWeek, items, completedItemIds,
}: {
  dayOfWeek: number
  items: Item[]
  completedItemIds: number[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<number | null>(null)
  const done = new Set(completedItemIds)

  async function complete(itemId: number) {
    setBusy(itemId)
    await fetch('/api/workout/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workoutPlanItemId: itemId }),
    })
    setBusy(null)
    router.refresh()
  }

  const completedCount = items.filter((i) => done.has(i.id)).length
  const allDone = completedCount === items.length && items.length > 0
  const pct = items.length > 0 ? (completedCount / items.length) * 100 : 0

  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-fg">
              {DAY_NAMES[dayOfWeek]}
            </h2>
            {allDone && <IconCheck className="size-4 text-success" />}
          </div>
          <span className="text-xs font-medium text-fg-muted">
            {items[0]?.focus} · <span className="tabular">{completedCount}/{items.length}</span> done
          </span>
        </div>

        {/* Progress through the day, so completion feels like progress */}
        <div
          role="progressbar"
          aria-label={`${DAY_NAMES[dayOfWeek]} completion`}
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={items.length}
          className="h-1 w-full overflow-hidden rounded-full bg-bg-subtle"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-[var(--duration-slow)] ease-[var(--ease-out-soft)]"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {items.map((item) => {
            const isDone = done.has(item.id)
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-2.5 py-2.5 first:pt-1">
                <label
                  className={cn(
                    'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-all duration-[var(--duration-fast)]',
                    'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--accent)]',
                    isDone
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-border-strong hover:border-accent',
                    busy === item.id && 'opacity-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isDone}
                    disabled={isDone || busy === item.id}
                    onChange={() => complete(item.id)}
                    className="sr-only"
                    aria-label={`Mark ${item.exercise.name} complete`}
                  />
                  {isDone && <IconCheck className="size-3.5" />}
                </label>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm font-medium transition-colors',
                      isDone ? 'text-fg-subtle line-through' : 'text-fg',
                    )}
                  >
                    {item.exercise.name}
                  </p>
                  <p className="tabular text-xs text-fg-subtle">
                    {item.sets} × {item.reps}
                    {item.exercise.repUnit === 'seconds' ? 's' : ' reps'} ·{' '}
                    {item.exercise.muscleGroup}
                  </p>
                </div>

                {/* The single flag that couples the planner to the camera */}
                {item.exercise.hasFormTracking && item.exercise.formKey && (
                  <Link
                    href={`/train?exercise=${item.exercise.formKey}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent-soft-fg transition-all duration-[var(--duration-fast)] hover:bg-accent hover:text-accent-fg"
                  >
                    <IconCamera className="size-3.5" />
                    <span className="hidden xs:inline sm:inline">Train</span>
                  </Link>
                )}
              </li>
            )
          })}
        </ul>

        {items[0]?.reason && (
          <p className="border-l-2 border-accent/40 pl-3 text-sm italic leading-relaxed text-fg-muted">
            {items[0].reason}
          </p>
        )}
      </CardBody>
    </Card>
  )
}
