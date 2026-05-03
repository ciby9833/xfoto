import { useEffect, useState } from 'react'

const TOTAL_SHOTS = 3
const COUNTDOWN = 3

export default function ShootingPage() {
  const [shotsTaken, setShotsTaken] = useState([])
  const [countdown, setCountdown] = useState(COUNTDOWN)
  const [shooting, setShooting] = useState(false)

  useEffect(() => {
    if (shotsTaken.length >= TOTAL_SHOTS) {
      window.xfoto?.transition('PREVIEW', { photos: shotsTaken })
      return
    }
    setCountdown(COUNTDOWN)
    setShooting(false)
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(tick)
          takeShot()
          return COUNTDOWN
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [shotsTaken.length])

  async function takeShot() {
    setShooting(true)
    const path = await window.xfoto?.capture()
    setShotsTaken((prev) => [...prev, path])
  }

  return (
    <div className="page">
      <p style={{ opacity: 0.5, fontSize: 22 }}>第 {shotsTaken.length + 1} / {TOTAL_SHOTS} 张</p>
      <div style={{ fontSize: 140, fontWeight: 'bold', color: shooting ? '#ff3c6e' : '#fff' }}>
        {shooting ? '📸' : countdown}
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {Array.from({ length: TOTAL_SHOTS }).map((_, i) => (
          <div key={i} style={{
            width: 60, height: 60, borderRadius: 8,
            background: i < shotsTaken.length ? '#ff3c6e' : '#1e1e1e'
          }} />
        ))}
      </div>
    </div>
  )
}
