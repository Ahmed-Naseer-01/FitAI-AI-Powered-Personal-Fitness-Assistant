import { redirect } from 'next/navigation'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import PoseTrainer from '@/components/PoseTrainer'
import type { ExerciseKey } from '@/lib/pose/exercises'
import { Page, PageHeader } from '@/components/ui'

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
    <Page>
      <PageHeader
        title="Form analysis"
        subtitle="Counts your reps and checks your form using your webcam."
      />
      <PoseTrainer initialExercise={initial} />
    </Page>
  )
}
