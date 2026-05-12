/**
 * src/renderer/src/pages/SelectTemplatePage.jsx
 *
 * Template (frame) selection screen — the first interactive step after IDLE.
 *
 * Loads all frame images from assets/frames/ via the listFrames IPC, displays
 * them as selectable cards, and calls selectTemplate when the user picks one.
 *
 * selectTemplate (main/ipc/index.js) stores the choice in sessionData and
 * transitions to COUPON_INPUT (if config.showCouponInput is true) or directly
 * to PAYMENT_PENDING.
 *
 * Upstream : App.jsx renders this for SELECT_TEMPLATE state.
 * Downstream: window.xfoto.selectTemplate() → COUPON_INPUT or PAYMENT_PENDING
 *             "返回" → IDLE
 */

import { useEffect, useState } from 'react'

// V1: hardcoded frame metadata. V2: will come from cloud API frame library.
const FRAME_META = {
  // Map filename → extra metadata
  // e.g. 'frame_strip.png': { slotsCount: 3, aspectLabel: '2×6 竖' }
}

export default function SelectTemplatePage() {
  const [frames, setFrames] = useState([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)

  useEffect(() => {
    async function loadFrames() {
      const list = await window.xfoto.listFrames().catch(() => [])
      const withData = await Promise.all(
        list.map(async (f) => ({
          ...f,
          dataUrl: await window.xfoto.readAsDataUrl(f.path),
          meta: FRAME_META[f.id] ?? {}
        }))
      )
      setFrames(withData)
      setLoading(false)
    }
    loadFrames()
  }, [])

  async function select(frame) {
    if (selecting) return
    setSelecting(true)
    try {
      await window.xfoto.selectTemplate({
        templateId: frame.id,
        framePath: frame.path,
        // config overrides can be frame-specific in V2
        config: {
          slotsCount: frame.meta.slotsCount ?? 3
        }
      })
    } finally {
      setSelecting(false)
    }
  }

  return (
    <div className="page" style={{ gap: 32, padding: '32px 24px' }}>
      <h2 style={{ fontSize: 40 }}>选择相框</h2>

      {loading && (
        <p style={{ opacity: 0.4, fontSize: 20 }}>加载相框中…</p>
      )}

      {!loading && frames.length === 0 && (
        <p style={{ opacity: 0.4, fontSize: 18, textAlign: 'center' }}>
          未找到相框文件<br />
          <span style={{ fontSize: 14 }}>请将 PNG 文件放入 assets/frames/</span>
        </p>
      )}

      <div style={{
        display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center'
      }}>
        {frames.map((frame) => (
          <button
            key={frame.id}
            onClick={() => select(frame)}
            disabled={selecting}
            style={{
              width: 160, height: 280,
              borderRadius: 12,
              background: '#1e1e1e',
              border: '2px solid #333',
              color: '#fff',
              cursor: selecting ? 'wait' : 'pointer',
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transition: 'border-color 0.15s, transform 0.1s'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <img
              src={frame.dataUrl}
              alt={frame.name}
              style={{ width: '100%', height: 220, objectFit: 'cover' }}
            />
            <span style={{ fontSize: 16, padding: '10px 8px', textAlign: 'center' }}>
              {frame.name}
            </span>
          </button>
        ))}
      </div>

      <button
        style={{
          fontSize: 20, background: 'none',
          color: '#666', border: 'none', cursor: 'pointer'
        }}
        onClick={() => window.xfoto.transition('IDLE')}
      >
        返回
      </button>
    </div>
  )
}
