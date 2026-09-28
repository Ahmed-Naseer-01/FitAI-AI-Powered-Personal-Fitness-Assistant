import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignJWT, jwtVerify } from 'jose'

// A signed JWT in an httpOnly cookie. Stateless, so there is no session table
// to keep in sync, and the cookie is unreadable and untamperable from JS.

const COOKIE_NAME = 'fitai_session'
const MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 days

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET
  if (!value || value.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short — set it in .env')
  }
  return new TextEncoder().encode(value)
}

export async function createSession(userId: number): Promise<void> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret())

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SEC,
  })
}

/** The signed-in user's id, or null. Never throws on a bad or expired token. */
export async function getUserId(): Promise<number | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret())
    return typeof payload.userId === 'number' ? payload.userId : null
  } catch {
    return null // expired, tampered with, or signed by a different secret
  }
}

/** Same, but redirects to /login instead of returning null. */
export async function requireUserId(): Promise<number> {
  const id = await getUserId()
  if (id === null) redirect('/login')
  return id
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
