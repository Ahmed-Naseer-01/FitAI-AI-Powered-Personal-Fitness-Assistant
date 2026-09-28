'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Item = {
  id: number
  sets: number
  reps: number
  restSec: number
  reason: string
  focus: string
  exercise: {
    id: number
    name: string
    repUnit: string
    muscleGroup: string
    hasFormTracking: boolean
    formKey: string | null
  }
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function WorkoutDayCard({
  dayOfWeek,
  items,
  completedItemIds,
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

  return (
    <section className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{DAY_NAMES[dayOfWeek]}</h2>
        <span className="text-sm text-gray-500">
          {items[0]?.focus} · {completedCount}/{items.length} done
        </span>
      </div>

      <ul className="mt-2 divide-y divide-gray-100">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <input
              type="checkbox"
              checked={done.has(item.id)}
              disabled={done.has(item.id) || busy === item.id}
              onChange={() => complete(item.id)}
              className="size-4"
              aria-label={`Mark ${item.exercise.name} complete`}
            />
            <span className={`flex-1 ${done.has(item.id) ? 'text-gray-400 line-through' : ''}`}>
              {item.exercise.name}
              <span className="ml-2 text-gray-500">
                {item.sets} × {item.reps}
                {item.exercise.repUnit === 'seconds' ? 's' : ''}
              </span>
            </span>

            {/* The entire coupling between the planner and the camera module. */}
            {item.exercise.hasFormTracking && item.exercise.formKey && (
              <Link
                href={`/train?exercise=${item.exercise.formKey}`}
                className="rounded bg-black px-2.5 py-1 text-xs text-white hover:bg-gray-800"
              >
                Train with camera
              </Link>
            )}
          </li>
        ))}
      </ul>

      {items[0]?.reason && <p className="mt-2 text-sm italic text-gray-600">{items[0].reason}</p>}
    </section>
  )
}
