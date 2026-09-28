import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getUserId } from '@/lib/session'

export default async function Home() {
  const userId = await getUserId()
  if (userId === null) redirect('/login')

  const profile = await db.profile.findUnique({ where: { userId } })
  redirect(profile ? '/dashboard' : '/onboarding')
}
