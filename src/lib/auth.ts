import bcrypt from 'bcryptjs'
import { z } from 'zod'

const ROUNDS = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// Email is trimmed and lowercased before validation so that signup and login
// always agree on the same stored value.
export const zCredentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type Credentials = z.infer<typeof zCredentials>
