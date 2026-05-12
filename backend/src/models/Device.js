/**
 * src/models/Device.js
 *
 * Queries for the `devices` table.
 * Returns plain objects — no ORM classes.
 *
 * Upstream : routes/devices.js
 * Downstream: pool (PostgreSQL)
 */

import { pool } from '../config/db.js'

export const Device = {
  async findById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM devices WHERE id = $1', [id]
    )
    return rows[0] ?? null
  },

  async findAll() {
    const { rows } = await pool.query(
      'SELECT id, name, location, is_active, last_seen_at, created_at FROM devices ORDER BY created_at DESC'
    )
    return rows
  },

  async create({ name, location, secretHash }) {
    const { rows } = await pool.query(
      `INSERT INTO devices (name, location, secret_hash)
       VALUES ($1, $2, $3) RETURNING *`,
      [name, location ?? null, secretHash]
    )
    return rows[0]
  },

  async updateLastSeen(id) {
    await pool.query(
      'UPDATE devices SET last_seen_at = NOW() WHERE id = $1', [id]
    )
  },

  async updateConfig(id, configOverride) {
    const { rows } = await pool.query(
      `UPDATE devices SET config_override = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, configOverride]
    )
    return rows[0] ?? null
  },

  /** Returns the merged config: global defaults + device override. */
  async getEffectiveConfig(id) {
    const { rows } = await pool.query(
      'SELECT config_override FROM devices WHERE id = $1', [id]
    )
    if (!rows[0]) return null
    return rows[0].config_override ?? {}
  },

  /** Returns frames assigned to this device (or all active frames if none assigned). */
  async getFrames(id) {
    const { rows } = await pool.query(
      `SELECT f.* FROM frames f
       WHERE f.is_active = TRUE
         AND (
           EXISTS (SELECT 1 FROM device_frames df WHERE df.device_id = $1 AND df.frame_id = f.id)
           OR NOT EXISTS (SELECT 1 FROM device_frames WHERE device_id = $1)
         )
       ORDER BY f.sort_order, f.created_at`,
      [id]
    )
    return rows
  }
}
