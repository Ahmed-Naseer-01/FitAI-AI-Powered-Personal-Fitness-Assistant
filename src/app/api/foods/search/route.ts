import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'

const LIMIT = 10

export async function GET(request: Request) {
  await requireUserId()

  const q = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() ?? ''
  if (q.length === 0) return NextResponse.json({ foods: [] })

  // Filtering in JS rather than with `contains` keeps search identical on
  // SQLite and Postgres: SQLite's LIKE is case-insensitive for ASCII while
  // Postgres's is not, and Prisma's `mode: 'insensitive'` is unavailable on
  // SQLite. With ~60 rows the whole table costs nothing to scan, and this is
  // the same approach buildMenu already uses for dietary filtering.
  const rows = await db.food.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, nameUrdu: true, servingLabel: true,
      kcal: true, proteinG: true, carbsG: true, fatG: true,
    },
  })

  const foods = rows
    .filter(
      (f) =>
        f.name.toLowerCase().includes(q) || (f.nameUrdu ?? '').toLowerCase().includes(q),
    )
    .slice(0, LIMIT)
    .map((row) => {
      const { nameUrdu, ...rest } = row
      void nameUrdu // searched on above, not returned to the client
      return rest
    })

  return NextResponse.json({ foods })
}
