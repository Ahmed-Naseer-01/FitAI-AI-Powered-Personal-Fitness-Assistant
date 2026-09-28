import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, zCredentials } from '@/lib/auth'
import { createSession } from '@/lib/session'

export async function POST(request: Request) {
  const parsed = zCredentials.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 })
  }

  const { email, password } = parsed.data
  const user = await db.user.findUnique({ where: { email }, include: { profile: true } })

  // Identical message for an unknown email and a wrong password, so the
  // response cannot be used to discover which addresses are registered.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  await createSession(user.id)
  return NextResponse.json({ ok: true, next: user.profile ? '/dashboard' : '/onboarding' })
}
