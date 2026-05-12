/**
 * src/config/db.js
 *
 * PostgreSQL connection pool (singleton).
 * All models import { pool } from here and call pool.query() directly —
 * no ORM, keeping queries explicit and auditable.
 *
 * Upstream : process.env.DATABASE_URL (set in .env)
 * Downstream: every model file (Device, Frame, Order, Coupon, Download)
 */

import pg from 'pg'
import { env } from './env.js'

const { Pool } = pg

export const pool = new Pool({ connectionString: env.DATABASE_URL })

// Log connection errors so they surface immediately on startup
pool.on('error', (err) => {
  console.error('[DB] unexpected pool error:', err.message)
})

/** Verify the DB is reachable at startup. */
export async function testConnection() {
  const client = await pool.connect()
  await client.query('SELECT 1')
  client.release()
  console.log('[DB] connected to PostgreSQL')
}
