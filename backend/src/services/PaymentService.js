/**
 * src/services/PaymentService.js
 *
 * Payment provider abstraction.  Driver is chosen at startup by PAYMENT_DRIVER:
 *   mock    — instant success, no external calls (dev / demo)
 *   xendit  — Xendit QR code payment (Indonesia)
 *   midtrans — Midtrans QRIS (Indonesia)
 *
 * API:
 *   createInvoice(orderId, amount, currency) → { providerRef, qrCodeUrl, checkoutUrl }
 *   getStatus(providerRef)                  → 'pending' | 'success' | 'failed'
 *
 * Upstream : routes/payments.js
 * Downstream: Xendit/Midtrans HTTP APIs (or mock)
 */

import { env } from '../config/env.js'

// ── Mock (dev) ────────────────────────────────────────────────────────────────
const mock = {
  async createInvoice(orderId, amount) {
    return {
      providerRef: `mock_${orderId}`,
      qrCodeUrl:   null,   // No QR in dev — payment auto-succeeds
      checkoutUrl: null
    }
  },
  async getStatus(_ref) {
    return 'success'   // Always succeeds immediately
  }
}

// ── Xendit ────────────────────────────────────────────────────────────────────
const xendit = {
  async createInvoice(orderId, amount, currency = 'IDR') {
    const res = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Basic ' + Buffer.from(env.XENDIT_SECRET_KEY + ':').toString('base64')
      },
      body: JSON.stringify({
        external_id: orderId,
        amount,
        currency,
        payment_methods: ['QR_CODE', 'OVO', 'DANA', 'GOPAY'],
        description: `xfoto session ${orderId}`
      })
    })
    if (!res.ok) throw new Error(`Xendit createInvoice failed: ${res.status}`)
    const data = await res.json()
    return {
      providerRef: data.id,
      qrCodeUrl:   data.qr_code_string ?? null,
      checkoutUrl: data.invoice_url
    }
  },
  async getStatus(ref) {
    const res = await fetch(`https://api.xendit.co/v2/invoices/${ref}`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(env.XENDIT_SECRET_KEY + ':').toString('base64')
      }
    })
    if (!res.ok) return 'pending'
    const data = await res.json()
    if (data.status === 'PAID')    return 'success'
    if (data.status === 'EXPIRED') return 'failed'
    return 'pending'
  }
}

// ── Midtrans ──────────────────────────────────────────────────────────────────
const midtrans = {
  _base() {
    return env.MIDTRANS_IS_PRODUCTION
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com'
  },
  _auth() {
    return 'Basic ' + Buffer.from(env.MIDTRANS_SERVER_KEY + ':').toString('base64')
  },
  async createInvoice(orderId, amount) {
    const res = await fetch(`${this._base()}/v2/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': this._auth() },
      body: JSON.stringify({
        payment_type: 'qris',
        transaction_details: { order_id: orderId, gross_amount: amount },
        qris: { acquirer: 'gopay' }
      })
    })
    if (!res.ok) throw new Error(`Midtrans charge failed: ${res.status}`)
    const data = await res.json()
    const qrAction = data.actions?.find((a) => a.name === 'generate-qr-code')
    return {
      providerRef: data.transaction_id,
      qrCodeUrl:   qrAction?.url ?? null,
      checkoutUrl: null
    }
  },
  async getStatus(ref) {
    const res = await fetch(`${this._base()}/v2/${ref}/status`, {
      headers: { 'Authorization': this._auth() }
    })
    if (!res.ok) return 'pending'
    const data = await res.json()
    if (data.transaction_status === 'settlement') return 'success'
    if (['cancel','deny','expire'].includes(data.transaction_status)) return 'failed'
    return 'pending'
  }
}

const drivers = { mock, xendit, midtrans }

export const PaymentService = drivers[env.PAYMENT_DRIVER] ?? mock
