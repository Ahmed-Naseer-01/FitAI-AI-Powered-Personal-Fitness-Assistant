import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/session'

/**
 * /logout is a guessable URL, so make it work rather than 404. The app's own
 * log-out button still POSTs to /api/auth/logout.
 */
export async function GET(request: Request) {
  await destroySession()
  return NextResponse.redirect(new URL('/login', request.url))
}
