import { NextResponse } from 'next/server'
import { requireUserId } from '@/lib/session'
import { getProfileWithMetrics, saveProfile, zProfileInput } from '@/lib/profile'

export async function GET() {
  const userId = await requireUserId()
  const result = await getProfileWithMetrics(userId)
  if (!result) return NextResponse.json({ error: 'No profile yet' }, { status: 404 })
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const userId = await requireUserId()
  const parsed = zProfileInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  await saveProfile(userId, parsed.data)
  return NextResponse.json(await getProfileWithMetrics(userId))
}
