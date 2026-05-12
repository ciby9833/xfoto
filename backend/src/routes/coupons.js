/**
 * src/routes/coupons.js
 *
 * POST /api/coupons/validate    — Validate a coupon code (kiosk calls this)
 * GET  /api/coupons             — (Admin) List all coupons
 * POST /api/coupons             — (Admin) Create a coupon
 * DELETE /api/coupons/:id       — (Admin) Deactivate a coupon
 *
 * Note: validate does NOT commit the use — that happens in payments/create
 * once the user confirms payment.  This route is purely for showing the
 * discount preview on the payment screen.
 *
 * Upstream : src/index.js
 * Downstream: Coupon model
 */

import { Router } from 'express'
import { Coupon } from '../models/Coupon.js'
import { deviceAuth } from '../middleware/deviceAuth.js'
import { wrap, HttpError } from '../middleware/errorHandler.js'

const router = Router()

// ── Validate (kiosk) — read-only, no side effects ────────────────────────────
router.post('/validate', deviceAuth, wrap(async (req, res) => {
  const { code, basePrice } = req.body
  if (!code || !basePrice) throw new HttpError(400, 'code and basePrice required')

  // Preview-only: use a read query, don't increment uses_count
  const { rows } = await import('../config/db.js').then(m =>
    m.pool.query(
      `SELECT * FROM coupons
       WHERE code = $1 AND is_active = TRUE
         AND (valid_from  IS NULL OR valid_from  <= NOW())
         AND (valid_until IS NULL OR valid_until >= NOW())`,
      [code.toUpperCase()]
    )
  )
  const coupon = rows[0] ?? null

  if (!coupon) {
    return res.json({ valid: false, message: '优惠码无效或已过期',
                      discountPercent: 0, discountAmount: 0, finalPrice: basePrice })
  }
  if (coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses) {
    return res.json({ valid: false, message: '优惠码已达使用上限',
                      discountPercent: 0, discountAmount: 0, finalPrice: basePrice })
  }

  const discountAmount = Math.round(basePrice * coupon.discount_percent / 100)
  res.json({
    valid:           true,
    code:            coupon.code,
    label:           coupon.label,
    discountPercent: coupon.discount_percent,
    discountAmount,
    finalPrice:      basePrice - discountAmount,
    message:         `${coupon.label}：优惠 ${coupon.discount_percent}%`
  })
}))

// ── Admin: list ───────────────────────────────────────────────────────────────
router.get('/', wrap(async (_req, res) => {
  res.json(await Coupon.findAll())
}))

// ── Admin: create ─────────────────────────────────────────────────────────────
router.post('/', wrap(async (req, res) => {
  const { code, label, discountPercent, maxUses, validFrom, validUntil } = req.body
  if (!code || !label || !discountPercent) {
    throw new HttpError(400, 'code, label and discountPercent are required')
  }
  const coupon = await Coupon.create({ code, label, discountPercent, maxUses, validFrom, validUntil })
  res.status(201).json(coupon)
}))

// ── Admin: deactivate ─────────────────────────────────────────────────────────
router.delete('/:id', wrap(async (req, res) => {
  const coupon = await Coupon.deactivate(req.params.id)
  if (!coupon) throw new HttpError(404, 'Coupon not found')
  res.json({ ok: true })
}))

export default router
