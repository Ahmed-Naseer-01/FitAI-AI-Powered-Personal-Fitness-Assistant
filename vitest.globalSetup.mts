import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'

/**
 * Integration tests run against a throwaway SQLite file, never dev.db, so a
 * test run can never damage the data you are demoing with.
 */
export default function setup() {
  const url = 'file:./test.db'
  rmSync('prisma/test.db', { force: true })

  execSync('npx prisma db push --skip-generate', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: url },
  })
  execSync('npx tsx prisma/seed.ts', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: url },
  })

  return () => {
    rmSync('prisma/test.db', { force: true })
    rmSync('prisma/test.db-journal', { force: true })
  }
}
