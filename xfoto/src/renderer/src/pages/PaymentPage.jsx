/**
 * src/renderer/src/pages/PaymentPage.jsx
 *
 * Handles PAYMENT_PENDING and PAYMENT_SUCCESS states in one component.
 *
 * PAYMENT_PENDING layout:
 *   ┌─────────────────────────────┐
 *   │  扫码支付  Rp 15,000        │
 *   │  ┌───────────────────┐      │
 *   │  │    QR CODE        │      │
 *   │  └───────────────────┘      │
 *   │  等待支付确认中…             │
 *   │                             │
 *   │  [有优惠码？点此输入]   ←  toggle button
 *   │  ┌────────────┐  [验证]     │  ← expands inline
 *   │  │ CODE INPUT │             │
 *   │  └────────────┘             │
 *   │  ✓ 已优惠 20%  Rp 12,000   │
 *   └─────────────────────────────┘
 *
 * On first render, if no orderId exists yet, createPayment is called to obtain
 * the QR code.  The coupon discount (if applied) is passed to createPayment as
 * the final amount.  If the user changes the coupon after an order is created,
 * a new order is created.
 *
 * Upstream : App.jsx renders this for PAYMENT_PENDING + PAYMENT_SUCCESS.
 *            sessionData.config.price  — base price
 *            sessionData.framePath / templateId — passed through from SelectTemplate
 * Downstream: payment:poll success → main transitions to PAYMENT_SUCCESS
 *             PAYMENT_SUCCESS auto-advances to SHOOTING after 1.5 s
 */

import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SESSION_CONFIG } from '../../../shared/sessionConfig.js'

export default function PaymentPage({ state, data }) {
  const pollRef     = useRef(null)
  const timerRef    = useRef(null)
  const orderRef    = useRef(null)   // tracks the current orderId to avoid double-creation

  const [qrUrl, setQrUrl]             = useState(data.qrCodeUrl ?? null)
  const [currentPrice, setCurrentPrice] = useState(null)

  // Coupon inline state
  const [couponOpen, setCouponOpen]   = useState(false)
  const [couponCode, setCouponCode]   = useState('')
  const [couponResult, setCouponResult] = useState(null)
  const [couponError, setCouponError] = useState('')
  const [validating, setValidating]   = useState(false)

  const config = { ...DEFAULT_SESSION_CONFIG, ...(data.config ?? {}) }

  // ── Create payment order ──────────────────────────────────────────────────
  // Called once on mount (or when coupon changes and user re-confirms).
  async function createOrder(discountedPrice, couponObj) {
    const amount = discountedPrice ?? config.price
    const order = await window.xfoto.createPayment({
      amount,
      couponCode: couponObj?.code ?? null,
      coupon:     couponObj ?? null
    })
    orderRef.current = order.orderId
    setQrUrl(order.qrCodeUrl)
    setCurrentPrice(amount)
    return order
  }

  useEffect(() => {
    if (state !== 'PAYMENT_PENDING') return
    if (data.orderId) {
      // Already created by a previous render cycle
      orderRef.current = data.orderId
      setQrUrl(data.qrCodeUrl ?? null)
      setCurrentPrice(data.finalAmount ?? config.price)
      return
    }
    // First time on this screen — create default order (no coupon yet)
    createOrder(config.price, null)
  }, [state])

  // ── Poll ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'PAYMENT_PENDING') return
    const orderId = orderRef.current ?? data.orderId
    if (!orderId) return

    pollRef.current = setInterval(async () => {
      const status = await window.xfoto.pollPayment(orderId).catch(() => 'pending')
      if (status === 'success') clearInterval(pollRef.current)
    }, 2000)

    return () => clearInterval(pollRef.current)
  }, [state, data.orderId, qrUrl])  // re-subscribe when orderId arrives

  // ── Auto-advance after success ────────────────────────────────────────────
  useEffect(() => {
    if (state !== 'PAYMENT_SUCCESS') return
    timerRef.current = setTimeout(() => window.xfoto.transition('SHOOTING'), 1500)
    return () => clearTimeout(timerRef.current)
  }, [state])

  // ── Coupon validation ─────────────────────────────────────────────────────
  async function handleValidateCoupon() {
    if (!couponCode.trim()) { setCouponError('请输入优惠码'); return }
    setValidating(true)
    setCouponError('')
    setCouponResult(null)
    try {
      const result = await window.xfoto.validateCoupon({
        code: couponCode.trim(),
        basePrice: config.price
      })
      if (result.valid) {
        setCouponResult(result)
        // Re-create order with discounted price so QR reflects final amount
        clearInterval(pollRef.current)
        await createOrder(result.finalPrice, result)
      } else {
        setCouponError(result.message)
      }
    } catch {
      setCouponError('验证失败，请重试')
    } finally {
      setValidating(false)
    }
  }

  function handleClearCoupon() {
    setCouponResult(null)
    setCouponCode('')
    setCouponError('')
    // Recreate order at full price
    clearInterval(pollRef.current)
    createOrder(config.price, null)
  }

  // ── SUCCESS view ──────────────────────────────────────────────────────────
  if (state === 'PAYMENT_SUCCESS') {
    return (
      <div className="page">
        <div style={{ fontSize: 96, color: '#4caf50', lineHeight: 1 }}>✓</div>
        <p style={{ fontSize: 32, marginTop: 8 }}>支付成功！准备拍照…</p>
      </div>
    )
  }

  // ── PENDING view ─────────────────────────────────────────────────────────
  const displayPrice = couponResult ? couponResult.finalPrice : (currentPrice ?? config.price)
  const hasDiscount  = couponResult?.discountAmount > 0

  return (
    <div className="page" style={{ gap: 20, padding: '28px 32px' }}>

      {/* Title + price */}
      <h2 style={{ fontSize: 34 }}>扫码支付</h2>
      <div style={{ textAlign: 'center' }}>
        {hasDiscount && (
          <p style={{ fontSize: 16, color: '#666', textDecoration: 'line-through', marginBottom: 2 }}>
            Rp {config.price.toLocaleString()}
          </p>
        )}
        <p style={{ fontSize: 30, fontWeight: 'bold' }}>
          Rp <span style={{ color: '#ff3c6e' }}>{displayPrice.toLocaleString()}</span>
        </p>
        {hasDiscount && (
          <p style={{ fontSize: 15, color: '#4caf50', marginTop: 2 }}>
            {couponResult.label} — 已优惠 {couponResult.discountPercent}%
          </p>
        )}
      </div>

      {/* QR Code */}
      <div style={{
        width: 240, height: 240,
        background: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 0 4px #222'
      }}>
        {qrUrl
          ? <img src={qrUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="QR" />
          : <p style={{ fontSize: 14, color: '#bbb', textAlign: 'center', padding: 12 }}>
              二维码生成中…
            </p>
        }
      </div>

      <p style={{ fontSize: 17, color: '#555' }}>等待支付确认中…</p>

      {/* ── Coupon toggle ── */}
      {!couponOpen && !couponResult && (
        <button
          onClick={() => setCouponOpen(true)}
          style={{
            fontSize: 16, color: '#666',
            background: 'none', border: '1px solid #333',
            borderRadius: 20, padding: '8px 20px',
            cursor: 'pointer', marginTop: 4
          }}
        >
          有优惠码？点此输入
        </button>
      )}

      {/* ── Inline coupon form ── */}
      {couponOpen && !couponResult && (
        <div style={{
          background: '#111', border: '1px solid #2a2a2a',
          borderRadius: 14, padding: '18px 20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 12, width: '100%', maxWidth: 360
        }}>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <input
              autoFocus
              type="text"
              value={couponCode}
              onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleValidateCoupon()}
              placeholder="输入优惠码"
              maxLength={20}
              style={{
                flex: 1, height: 52, fontSize: 22,
                fontWeight: 'bold', letterSpacing: 3,
                textAlign: 'center', background: '#1a1a1a',
                border: couponError ? '2px solid #e53935' : '2px solid #333',
                borderRadius: 10, color: '#fff', outline: 'none'
              }}
            />
            <button
              onClick={handleValidateCoupon}
              disabled={validating}
              style={{
                width: 64, height: 52, fontSize: 15,
                background: '#ff3c6e', color: '#fff',
                border: 'none', borderRadius: 10,
                cursor: validating ? 'wait' : 'pointer', fontWeight: 'bold'
              }}
            >
              {validating ? '…' : '验证'}
            </button>
          </div>
          {couponError && <p style={{ fontSize: 15, color: '#e53935' }}>{couponError}</p>}
          <button
            onClick={() => { setCouponOpen(false); setCouponCode(''); setCouponError('') }}
            style={{ fontSize: 14, color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            取消
          </button>
          <p style={{ fontSize: 12, color: '#2a2a2a' }}>Demo: FREE100 / HALF50 / XFOTO20</p>
        </div>
      )}

      {/* ── Applied coupon badge ── */}
      {couponResult && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#1b2e1b', border: '1px solid #4caf50',
          borderRadius: 10, padding: '10px 16px'
        }}>
          <span style={{ fontSize: 18, color: '#4caf50' }}>✓ {couponResult.label}</span>
          <button
            onClick={handleClearCoupon}
            style={{ fontSize: 13, color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕ 取消
          </button>
        </div>
      )}
    </div>
  )
}
