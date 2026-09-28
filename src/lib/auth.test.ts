import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, zCredentials } from './auth'

describe('password hashing', () => {
  it('produces a hash that differs from the plaintext', async () => {
    const hash = await hashPassword('correct-horse')
    expect(hash).not.toBe('correct-horse')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('verifies a correct password', async () => {
    const hash = await hashPassword('correct-horse')
    expect(await verifyPassword('correct-horse', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse')
    expect(await verifyPassword('wrong-horse', hash)).toBe(false)
  })

  it('produces different hashes for the same password, so it is salted', async () => {
    const a = await hashPassword('same')
    const b = await hashPassword('same')
    expect(a).not.toBe(b)
    // ...but both still verify
    expect(await verifyPassword('same', a)).toBe(true)
    expect(await verifyPassword('same', b)).toBe(true)
  })

  it('never stores the password in the hash', async () => {
    const hash = await hashPassword('mySecret123')
    expect(hash).not.toContain('mySecret123')
  })
})

describe('zCredentials', () => {
  it('accepts a valid email and an 8+ character password', () => {
    expect(zCredentials.safeParse({ email: 'a@b.com', password: 'longenough' }).success).toBe(true)
  })

  it('rejects a malformed email', () => {
    expect(zCredentials.safeParse({ email: 'nope', password: 'longenough' }).success).toBe(false)
    expect(zCredentials.safeParse({ email: 'a@', password: 'longenough' }).success).toBe(false)
  })

  it('rejects a password under 8 characters', () => {
    expect(zCredentials.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(false)
  })

  it('lowercases and trims the email, so signup and login always agree', () => {
    expect(zCredentials.parse({ email: '  A@B.COM ', password: 'longenough' }).email).toBe('a@b.com')
  })

  it('rejects missing fields', () => {
    expect(zCredentials.safeParse({ email: 'a@b.com' }).success).toBe(false)
    expect(zCredentials.safeParse({}).success).toBe(false)
  })
})
