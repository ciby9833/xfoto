import { useEffect, useRef } from 'react'

export default function PaymentPage({ state, data }) {
  const timerRef = useRef(null)

  useEffect(() => {
    if (state !== 'PAYMENT_PENDING') return
    const { orderId } = data
    timerRef.current = setInterval(async () => {
      const status = await window.xfoto?.pollPayment(orderId)
      if (status === 'success') clearInterval(timerRef.current)
    }, 2000)
    return () => clearInterval(timerRef.current)
  }, [state, data])

  useEffect(() => {
    if (state !== 'PAYMENT_SUCCESS') return
    const t = setTimeout(() => window.xfoto?.transition('SHOOTING'), 1500)
    return () => clearTimeout(t)
  }, [state])

  if (state === 'PAYMENT_SUCCESS') {
    return (
      <div className="page">
        <div style={{ fontSize: 80 }}>✓</div>
        <p style={{ fontSize: 32 }}>支付成功！准备拍照…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h2 style={{ fontSize: 36 }}>扫码支付</h2>
      {data.qrCodeUrl
        ? <img src={data.qrCodeUrl} style={{ width: 260, height: 260 }} alt="QR" />
        : <div style={{ width: 260, height: 260, background: '#1e1e1e', borderRadius: 8,
            display:'flex', alignItems:'center', justifyContent:'center', fontSize: 18, color: '#555' }}>
            二维码加载中…
          </div>
      }
      <p style={{ opacity: 0.5, fontSize: 20 }}>等待支付确认中…</p>
    </div>
  )
}
