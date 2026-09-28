import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics } from '@/lib/profile'
import MetricsPanel from '@/components/MetricsPanel'
import WeightUpdateForm from '@/components/WeightUpdateForm'
import { Badge, Card, CardBody, Page, PageHeader, cn } from '@/components/ui'

export default async function ProfilePage() {
  const userId = await requireUserId()
  const result = await getProfileWithMetrics(userId)
  if (!result) redirect('/onboarding')

  const { profile, metrics, allergies } = result
  const entries = await db.weightEntry.findMany({
    where: { userId },
    orderBy: { recordedAt: 'desc' },
    take: 10,
  })

  const first = entries.at(-1)

  return (
    <Page>
      <PageHeader
        title={profile.name}
        subtitle={
          <>
            <span className="tabular">{profile.age}</span> years ·{' '}
            <span className="tabular">{profile.heightCm}</span> cm ·{' '}
            <span className="tabular">{profile.weightKg}</span> kg
          </>
        }
      />

      <div className="stagger flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{profile.goal.replace('_', ' ')}</Badge>
          <Badge tone="neutral">{profile.activityLevel.replace('_', ' ')}</Badge>
          <Badge tone="neutral">{profile.experience}</Badge>
          <Badge tone="neutral">
            {profile.dietaryPreference === 'vegetarian' ? 'vegetarian' : 'no diet restriction'}
          </Badge>
          {profile.budget === 'low' && <Badge tone="neutral">budget foods</Badge>}
          {allergies.map((a) => (
            <Badge key={a} tone="warning">avoids {a}</Badge>
          ))}
        </div>

        <MetricsPanel metrics={metrics} />

        <Card>
          <CardBody className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Update weight</h2>
            <WeightUpdateForm currentWeight={profile.weightKg} />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold tracking-tight text-fg">Weight history</h2>

            {entries.length === 0 ? (
              <p className="text-sm text-fg-subtle">No entries yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {entries.map((e) => {
                  const delta = first ? Math.round((e.weightKg - first.weightKg) * 10) / 10 : 0
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="text-sm text-fg-muted">
                        {new Date(e.recordedAt).toLocaleDateString(undefined, {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                      <span className="flex items-baseline gap-3">
                        {delta !== 0 && (
                          <span
                            className={cn(
                              'tabular text-xs font-medium',
                              delta < 0 ? 'text-success' : 'text-fg-subtle',
                            )}
                          >
                            {delta > 0 ? '+' : ''}{delta} kg
                          </span>
                        )}
                        <span className="tabular text-sm font-semibold text-fg">
                          {e.weightKg} kg
                        </span>
                        <span className="tabular w-16 text-right text-xs text-fg-subtle">
                          BMI {e.bmi}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </Page>
  )
}
