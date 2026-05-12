/**
 * src/routes/payments.js
 *
 * Payment lifecycle:
 *   POST /api/payments/create        — Create order + provider invoice → QR code URL
 *   GET  /api/payments/:orderId/status — Poll payment status
 *   POST /api/payments/webhook        — Receive provider callbacks (Xendit/Midtrans)
 *
 * The kiosk app calls create → shows QR → polls status every 2 s.
 * When status is 'success', the app advances to SHOOTING.
 *
 * Upstream : src/index.js
 * Downstream: Order model, Coupon model, PaymentService
 */

import { Router } from 'express'
import { Order }   from '../models/Order.js'
import { Coupon }  from '../models/Coupon.js'
import { PaymentService } from '../services/PaymentService.js'
import { deviceAuth }     from '../middleware/deviceAuth.js'
import { wrap, HttpError } from '../middleware/errorHandler.js'

const router = Router()

// ── Create order + payment invoice ───────────────────────────────────────────
// Body: { frameId, couponCode?, baseAmount, currency? }
router.post('/create', deviceAuth, wrap(async (req, res) => {
  const { frameId, couponCode, baseAmount, currency } = req.body
  if (!baseAmount) throw new HttpError(400, 'baseAmount is required')

  // Validate coupon (if provided)
  let couponResult = null
  if (couponCode) {
    couponResult = await Coupon.validate(couponCode, baseAmount)
    if (!couponResult.valid) {
      return res.status(400).json({ error: couponResult.message })
    }
  }

  const finalAmount = couponResult ? couponResult.finalPrice : baseAmount

  // Create DB order first so we have an ID for the provider
  const order = await Order.create({
    deviceId:    req.device.id,
    frameId:     frameId ?? null,
    couponId:    couponResult?.couponId ?? null,
    baseAmount,
    finalAmount,
    currency:    currency ?? 'IDR'
  })

  // Create provider invoice (or mock)
  const invoice = await PaymentService.createInvoice(order.id, finalAmount, currency ?? 'IDR')
  await Order.setPaymentRef(order.id, { provider: invoice.providerRef, ref: invoice.providerRef })

  res.status(201).json({
    orderId:     order.id,
    providerRef: invoice.providerRef,
    qrCodeUrl:   invoice.qrCodeUrl,
    checkoutUrl: invoice.checkoutUrl,
    finalAmount,
    coupon: couponResult
      ? { code: couponResult.code, label: couponResult.label,
          discountPercent: couponResult.discountPercent, discountAmount: couponResult.discountAmount }
      : null
  })
}))

// ── Poll status ───────────────────────────────────────────────────────────────
router.get('/:orderId/status', deviceAuth, wrap(async (req, res) => {
  const order = await Order.findById(req.params.orderId)
  if (!order) throw new HttpError(404, 'Order not found')

  // Already in a terminal state — no need to hit provider again
  if (order.status === 'PAID' || order.status === 'DONE') {
    return res.json({ status: 'success', orderStatus: order.status })
  }
  if (order.status === 'FAILED') {
    return res.json({ status: 'failed', orderStatus: order.status })
  }

  const status = await PaymentService.getStatus(order.payment_ref)

  if (status === 'success') {
    await Order.setStatus(order.id, 'PAID')
  } else if (status === 'failed') {
    await Order.setStatus(order.id, 'FAILED')
  }

  res.json({ status, orderStatus: order.status })
}))

// ── Webhook (provider callback) ───────────────────────────────────────────────
// Xendit sends POST with X-CALLBACK-TOKEN header.
// Midtrans sends POST with notification body.
// Both patterns are handled here.
router.post('/webhook', wrap(async (req, res) => {
  const body = req.body

  // Xendit webhook
  if (body.external_id && body.status) {
    const orderId = body.external_id
    const order   = await Order.findById(orderId)
    if (order && body.status === 'PAID') {
      await Order.setStatus(orderId, 'PAID')
      console.log('[payment webhook] Xendit PAID:', orderId)
    }
    return res.json({ ok: true })
  }

  // Midtrans webhook
  if (body.order_id && body.transaction_status) {
    const orderId = body.order_id
    if (body.transaction_status === 'settlement') {
      await Order.setStatus(orderId, 'PAID')
      console.log('[payment webhook] Midtrans settlement:', orderId)
    }
    return res.json({ ok: true })
  }

  res.json({ ok: true })
}))

export default router
