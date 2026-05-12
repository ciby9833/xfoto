/**
 * src/config/migrate.js
 *
 * Run the SQL migration files against the database.
 * Usage:  npm run migrate
 *
 * Reads every .sql file from migrations/ in alphabetical order and executes
 * each one.  Safe to re-run — all statements use IF NOT EXISTS.
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import 'dotenv/config'

const __dir = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dir, '../../migrations')

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function run() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    console.log('[migrate] running', file, '…')
    await pool.query(sql)
    console.log('[migrate] ✓', file)
  }
  await pool.end()
  console.log('[migrate] all done')
}

run().catch((err) => { console.error('[migrate] FAILED:', err.message); process.exit(1) })
