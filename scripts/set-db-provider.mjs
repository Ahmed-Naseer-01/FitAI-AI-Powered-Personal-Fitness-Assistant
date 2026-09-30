#!/usr/bin/env node
/**
 * Sets the Prisma datasource provider to match DATABASE_URL.
 *
 * SQLite is right for local development — no server to install — but it does
 * not persist on serverless hosts, where a managed Postgres is needed. Rather
 * than keeping two schema files that inevitably drift, the provider is derived
 * from the connection string and rewritten in place before `prisma generate`.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SCHEMA = 'prisma/schema.prisma'
const url = process.env.DATABASE_URL ?? ''

const provider = url.startsWith('postgres')
  ? 'postgresql'
  : url.startsWith('mysql')
    ? 'mysql'
    : 'sqlite'

const schema = readFileSync(SCHEMA, 'utf8')
const current = schema.match(/provider\s*=\s*"(sqlite|postgresql|mysql)"/)?.[1]

if (current === provider) {
  console.log(`Prisma provider already "${provider}".`)
  process.exit(0)
}

writeFileSync(
  SCHEMA,
  schema.replace(
    /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"(?:sqlite|postgresql|mysql)"/,
    `$1"${provider}"`,
  ),
)
console.log(`Prisma provider set to "${provider}" (from DATABASE_URL).`)
