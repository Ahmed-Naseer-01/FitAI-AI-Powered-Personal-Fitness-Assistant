import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireUserId } from '@/lib/session'

const zPatch = z.object({ servings: z.number().min(0.25).max(20) })

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Ctx) {
  const userId = await requireUserId()
  const id = Number((await params).id)
  const parsed = zPatch.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid servings' }, { status: 400 })

  // Scoping by userId means another user's row reads as not-found rather than
  // being editable.
  const result = await db.foodLog.updateMany({
    where: { id, userId },
    data: { servings: parsed.data.servings },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const userId = await requireUserId()
  const id = Number((await params).id)

  const result = await db.foodLog.deleteMany({ where: { id, userId } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
