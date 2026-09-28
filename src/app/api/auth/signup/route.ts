import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, zCredentials } from '@/lib/auth'
import { createSession } from '@/lib/session'

export async function POST(request: Request) {
  const parsed = zCredentials.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { email, password } = parsed.data

  if (await db.user.findUnique({ where: { email } })) {
    return NextResponse.json(
      { error: 'An account with that email already exists' },
      { status: 409 },
    )
  }

  const user = await db.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  })

  await createSession(user.id)
  return NextResponse.json({ ok: true, next: '/onboarding' })
}
