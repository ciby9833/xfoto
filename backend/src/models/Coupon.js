/**
 * src/models/Coupon.js
 *
 * Queries for the `coupons` table.
 * validate() is the main entry point — it checks all constraints and
 * atomically increments uses_count on success.
 *
 * Upstream : routes/coupons.js
 * Downstream: pool (PostgreSQL)
 */

import { pool } from '../config/db.js'

export const Coupon = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC')
    return rows
  },

  async create({ code, label, discountPercent, maxUses, validFrom, validUntil }) {
    const { rows } = await pool.query(
      `INSERT INTO coupons
         (code, label, discount_percent, max_uses, valid_from, valid_until)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        code.toUpperCase(),
        label,
        discountPercent,
        maxUses ?? null,
        validFrom ?? null,
        validUntil ?? null
      ]
    )
    return rows[0]
  },

  async deactivate(id) {
    const { rows } = await pool.query(
      'UPDATE coupons SET is_active = FALSE WHERE id = $1 RETURNING *', [id]
    )
    return rows[0] ?? null
  },

  /**
   * Validate a coupon code and (on success) atomically increment uses_count.
   * Returns { valid, coupon|null, discountPercent, discountAmount, finalPrice, message }
   */
  async validate(code, basePrice) {
    const now = new Date()
    const { rows } = await pool.query(
      `SELECT * FROM coupons
       WHERE code = $1 AND is_active = TRUE
         AND (valid_from  IS NULL OR valid_from  <= $2)
         AND (valid_until IS NULL OR valid_until >= $2)`,
      [code.toUpperCase(), now]
    )

    const coupon = rows[0] ?? null

    if (!coupon) {
      return { valid: false, discountPercent: 0, discountAmount: 0,
               finalPrice: basePrice, message: '优惠码无效或已过期' }
    }

    if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
      return { valid: false, discountPercent: 0, discountAmount: 0,
               finalPrice: basePrice, message: '优惠码已达使用上限' }
    }

    // Atomically increment uses_count
    await pool.query(
      'UPDATE coupons SET uses_count = uses_count + 1 WHERE id = $1', [coupon.id]
    )

    const discountAmount = Math.round(basePrice * coupon.discount_percent / 100)
    const finalPrice     = basePrice - discountAmount

    return {
      valid: true,
      coupon,
      couponId:        coupon.id,
      code:            coupon.code,
      label:           coupon.label,
      discountPercent: coupon.discount_percent,
      discountAmount,
      finalPrice,
      message: `${coupon.label}：优惠 ${coupon.discount_percent}%`
    }
  }
}
