import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import MetricsPanel from '@/components/MetricsPanel'
import WeightUpdateForm from '@/components/WeightUpdateForm'

export default async function ProfilePage() {
  const userId = await requireUserId()
  const result = await getProfileWithMetrics(userId)
  if (!result) redirect('/onboarding')

  const { profile, metrics } = result
  const entries = await db.weightEntry.findMany({
    where: { userId },
    orderBy: { recordedAt: 'desc' },
    take: 10,
  })

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">{profile.name}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {profile.age} years · {profile.heightCm} cm · {profile.weightKg} kg ·{' '}
        {profile.goal.replace('_', ' ')}
      </p>

      <div className="mt-6">
        <MetricsPanel metrics={metrics} />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Update weight</h2>
        <WeightUpdateForm currentWeight={profile.weightKg} />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Weight history</h2>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No entries yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
            {entries.map((e) => (
              <li key={e.id} className="flex justify-between px-4 py-2 text-sm">
                <span>{new Date(e.recordedAt).toLocaleDateString()}</span>
                <span>
                  {e.weightKg} kg · BMI {e.bmi}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
