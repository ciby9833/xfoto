/**
 * src/renderer/src/pages/CouponPage.jsx
 *
 * Optional coupon code entry screen shown between template selection and payment.
 *
 * The user can:
 *   - Enter a coupon code and tap "验证" to validate it (shows discount info)
 *   - Tap "使用优惠码继续" to proceed to payment with the discount applied
 *   - Tap "跳过" to go to payment at full price
 *   - Tap "返回" to go back to SELECT_TEMPLATE
 *
 * Validated coupon info is stored in sessionData.coupon and the final price
 * is passed to payment:create in PaymentPage.
 *
 * Upstream : App.jsx renders this for COUPON_INPUT state.
 *            sessionData.config.price — full session price
 * Downstream: transitions to PAYMENT_PENDING via createPayment IPC
 *             (PaymentPage handles PAYMENT_PENDING rendering)
 *             OR transitions back to SELECT_TEMPLATE on "返回"
 */

import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SESSION_CONFIG } from '../../../shared/sessionConfig.js'

export default function CouponPage() {
  const [config, setConfig]               = useState(null)
  const [code, setCode]                   = useState('')
  const [validating, setValidating]       = useState(false)
  const [couponResult, setCouponResult]   = useState(null)  // result from validateCoupon
  const [errorMsg, setErrorMsg]           = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    window.xfoto.getState().then(({ data }) => {
      const cfg = { ...DEFAULT_SESSION_CONFIG, ...(data.config ?? {}) }
      setConfig(cfg)
      // Restore previously entered coupon if user navigated back
      if (data.coupon?.code) {
        setCode(data.coupon.code)
        setCouponResult(data.coupon)
      }
    })
    // Auto-focus the input on mount
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  async function handleValidate() {
    if (!code.trim()) {
      setErrorMsg('请输入优惠码')
      return
    }
    setValidating(true)
    setErrorMsg('')
    setCouponResult(null)
    try {
      const result = await window.xfoto.validateCoupon({
        code: code.trim(),
        basePrice: config.price
      })
      if (result.valid) {
        setCouponResult(result)
      } else {
        setErrorMsg(result.message)
      }
    } catch (err) {
      setErrorMsg('验证失败，请重试')
    } finally {
      setValidating(false)
    }
  }

  async function handleContinue(withCoupon) {
    const finalPrice = withCoupon && couponResult ? couponResult.finalPrice : config.price
    const couponData = withCoupon && couponResult ? couponResult : null

    // createPayment transitions to PAYMENT_PENDING internally and stores the
    // full coupon object in sessionData so PaymentPage can display the discount.
    await window.xfoto.createPayment({
      amount: finalPrice,
      couponCode: couponData?.code ?? null,
      coupon: couponData
    })
  }

  function handleSkip() {
    handleContinue(false)
  }

  function handleBack() {
    window.xfoto.transition('SELECT_TEMPLATE')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleValidate()
  }

  if (!config) {
    return <div className="page"><p style={{ color: '#555' }}>加载中…</p></div>
  }

  return (
    <div className="page" style={{ gap: 28 }}>
      <h2 style={{ fontSize: 36 }}>输入优惠码</h2>

      <p style={{ fontSize: 18, color: '#888' }}>
        原价：<span style={{ color: '#fff' }}>Rp {config.price.toLocaleString()}</span>
      </p>

      {/* Code input */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setCouponResult(null)
            setErrorMsg('')
          }}
          onKeyDown={handleKeyDown}
          placeholder="输入优惠码"
          maxLength={20}
          style={{
            width: 260, height: 60,
            fontSize: 26, fontWeight: 'bold',
            letterSpacing: 4,
            textAlign: 'center',
            background: '#1a1a1a',
            border: couponResult ? '2px solid #4caf50'
                   : errorMsg    ? '2px solid #e53935'
                   :               '2px solid #444',
            borderRadius: 12,
            color: '#fff',
            outline: 'none',
            transition: 'border-color 0.15s'
          }}
        />
        <button
          onClick={handleValidate}
          disabled={validating}
          style={{
            height: 60, padding: '0 24px',
            fontSize: 20, fontWeight: 'bold',
            background: '#333', color: '#fff',
            border: 'none', borderRadius: 12,
            cursor: validating ? 'wait' : 'pointer'
          }}
        >
          {validating ? '验证中…' : '验证'}
        </button>
      </div>

      {/* Error message */}
      {errorMsg && (
        <p style={{ fontSize: 18, color: '#e53935' }}>{errorMsg}</p>
      )}

      {/* Success info */}
      {couponResult && (
        <div style={{
          background: '#1b2e1b',
          border: '1px solid #4caf50',
          borderRadius: 12,
          padding: '16px 32px',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: 20, color: '#4caf50', marginBottom: 8 }}>
            ✓ {couponResult.message}
          </p>
          <p style={{ fontSize: 26, fontWeight: 'bold' }}>
            优惠后：Rp <span style={{ color: '#ff3c6e' }}>
              {couponResult.finalPrice.toLocaleString()}
            </span>
          </p>
          {couponResult.finalPrice === 0 && (
            <p style={{ fontSize: 16, color: '#4caf50', marginTop: 4 }}>🎉 本次免费！</p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {couponResult && (
          <button
            className="btn-primary"
            onClick={() => handleContinue(true)}
          >
            使用优惠码继续
          </button>
        )}
        <button
          className="btn-primary"
          onClick={handleSkip}
          style={{ background: '#333', fontSize: 22, padding: '16px 36px' }}
        >
          跳过
        </button>
        <button
          onClick={handleBack}
          style={{
            fontSize: 20, background: 'none',
            color: '#666', border: 'none', cursor: 'pointer'
          }}
        >
          返回
        </button>
      </div>

      {/* Demo hint — remove in production */}
      <p style={{ fontSize: 13, color: '#3a3a3a', marginTop: 8 }}>
        Demo 码：FREE100 / HALF50 / XFOTO20
      </p>
    </div>
  )
}
