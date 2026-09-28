import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'

export async function GET(request: Request) {
  await requireUserId()

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length === 0) return NextResponse.json({ foods: [] })

  // With ~60 rows, a LIKE scan is instant; no index or fuzzy matching needed.
  const foods = await db.food.findMany({
    where: { OR: [{ name: { contains: q } }, { nameUrdu: { contains: q } }] },
    take: 10,
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, servingLabel: true,
      kcal: true, proteinG: true, carbsG: true, fatG: true,
    },
  })

  return NextResponse.json({ foods })
}
