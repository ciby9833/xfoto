/**
 * src/models/Order.js
 *
 * Queries for the `orders` table.
 *
 * Upstream : routes/orders.js, routes/payments.js
 * Downstream: pool (PostgreSQL)
 */

import { pool } from '../config/db.js'

export const Order = {
  async findById(id) {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [id])
    return rows[0] ?? null
  },

  async create({ deviceId, frameId, couponId, baseAmount, finalAmount, currency }) {
    const { rows } = await pool.query(
      `INSERT INTO orders
         (device_id, frame_id, coupon_id, base_amount, final_amount, currency)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [deviceId ?? null, frameId ?? null, couponId ?? null,
       baseAmount, finalAmount, currency ?? 'IDR']
    )
    return rows[0]
  },

  async setPaymentRef(id, { provider, ref }) {
    const { rows } = await pool.query(
      `UPDATE orders
       SET payment_provider = $2, payment_ref = $3, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, provider, ref]
    )
    return rows[0] ?? null
  },

  async setStatus(id, status) {
    const { rows } = await pool.query(
      `UPDATE orders SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, status]
    )
    return rows[0] ?? null
  },

  async setFinalPhoto(id, { photoPaths, finalPhotoKey }) {
    const { rows } = await pool.query(
      `UPDATE orders
       SET photo_paths = $2, final_photo_key = $3, status = 'DONE', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(photoPaths), finalPhotoKey]
    )
    return rows[0] ?? null
  },

  async listByDevice(deviceId, limit = 50) {
    const { rows } = await pool.query(
      `SELECT * FROM orders WHERE device_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [deviceId, limit]
    )
    return rows
  }
}
