import { PrismaClient } from '@prisma/client'

// Reuse one client across hot reloads in development, otherwise every reload
// opens a new connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
