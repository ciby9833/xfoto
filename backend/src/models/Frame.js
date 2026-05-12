/**
 * src/models/Frame.js
 *
 * Queries for the `frames` table.
 * slot_definitions is stored as JSONB, returned as a JS array.
 *
 * Upstream : routes/frames.js
 * Downstream: pool (PostgreSQL), storage (for file keys)
 */

import { pool } from '../config/db.js'

export const Frame = {
  async findAll(activeOnly = true) {
    const { rows } = await pool.query(
      `SELECT * FROM frames ${activeOnly ? 'WHERE is_active = TRUE' : ''}
       ORDER BY sort_order, created_at`
    )
    return rows
  },

  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM frames WHERE id = $1', [id])
    return rows[0] ?? null
  },

  async create({ name, fileKey, thumbnailKey, canvasWidth, canvasHeight, slotDefinitions, priceOverride }) {
    const { rows } = await pool.query(
      `INSERT INTO frames
         (name, file_key, thumbnail_key, canvas_width, canvas_height,
          slot_definitions, price_override)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        name,
        fileKey,
        thumbnailKey ?? null,
        canvasWidth  ?? 887,
        canvasHeight ?? 1774,
        JSON.stringify(slotDefinitions ?? []),
        priceOverride ?? null
      ]
    )
    return rows[0]
  },

  async update(id, fields) {
    // Build SET clause dynamically from supplied fields
    const allowed = ['name', 'slot_definitions', 'price_override', 'is_active', 'sort_order']
    const pairs   = []
    const values  = []
    let   n       = 1
    for (const [k, v] of Object.entries(fields)) {
      if (!allowed.includes(k)) continue
      pairs.push(`${k} = $${n++}`)
      values.push(typeof v === 'object' ? JSON.stringify(v) : v)
    }
    if (!pairs.length) return null
    values.push(id)
    const { rows } = await pool.query(
      `UPDATE frames SET ${pairs.join(', ')}, updated_at = NOW()
       WHERE id = $${n} RETURNING *`,
      values
    )
    return rows[0] ?? null
  },

  async delete(id) {
    const { rows } = await pool.query(
      'DELETE FROM frames WHERE id = $1 RETURNING file_key, thumbnail_key', [id]
    )
    return rows[0] ?? null
  }
}
