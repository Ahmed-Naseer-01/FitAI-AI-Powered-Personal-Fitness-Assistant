import { redirect } from 'next/navigation'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import PoseTrainer from '@/components/PoseTrainer'
import type { ExerciseKey } from '@/lib/pose/exercises'

export default async function TrainPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>
}) {
  const userId = await requireUserId()
  if (!(await getProfileWithMetrics(userId))) redirect('/onboarding')

  const requested = (await searchParams).exercise
  const initial: ExerciseKey = requested === 'bicep_curl' ? 'bicep_curl' : 'squat'

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Form analysis</h1>
        <p className="mt-1 text-sm text-gray-600">
          Counts your reps and checks your form using your webcam.
        </p>
      </div>
      <PoseTrainer initialExercise={initial} />
    </main>
  )
}
