/**
 * src/models/Download.js
 *
 * Queries for the `download_codes` table.
 * Codes are 8-char uppercase alphanumeric strings shown on the Done screen.
 *
 * Upstream : routes/downloads.js
 * Downstream: pool (PostgreSQL)
 */

import { pool } from '../config/db.js'
import { nanoid } from 'nanoid'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // no confusing chars

function generateCode() {
  let code = ''
  const buf = Buffer.allocUnsafe(8)
  for (let i = 0; i < 8; i++) {
    buf[i] = Math.floor(Math.random() * CODE_ALPHABET.length)
  }
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[buf[i]]
  return code
}

export const Download = {
  /**
   * Create a new download code for a completed order.
   * @param {string} orderId
   * @param {string} photoKey  — storage key of the final composited image
   * @param {number} ttlHours  — code validity window
   */
  async create(orderId, photoKey, ttlHours = 24) {
    const code      = generateCode()
    const expiresAt = new Date(Date.now() + ttlHours * 3_600_000)

    const { rows } = await pool.query(
      `INSERT INTO download_codes (code, order_id, photo_key, expires_at)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [code, orderId, photoKey, expiresAt]
    )
    return rows[0]
  },

  async findByCode(code) {
    const { rows } = await pool.query(
      'SELECT * FROM download_codes WHERE code = $1', [code.toUpperCase()]
    )
    return rows[0] ?? null
  },

  async incrementUsed(id) {
    await pool.query(
      'UPDATE download_codes SET used_count = used_count + 1 WHERE id = $1', [id]
    )
  }
}
