import { useEffect, useState } from 'react'

export default function SelectTemplatePage() {
  const [frames, setFrames] = useState([])

  useEffect(() => {
    async function load() {
      const list = await window.xfoto?.listFrames() ?? []
      // Load each frame as base64 so <img> works without file:// restrictions
      const withData = await Promise.all(
        list.map(async (f) => ({
          ...f,
          dataUrl: await window.xfoto.readAsDataUrl(f.path)
        }))
      )
      setFrames(withData)
    }
    load()
  }, [])

  const select = (frame) =>
    window.xfoto?.createPayment({
      amount: 15000,
      templateId: 'strip_2x6',
      framePath: frame.path   // raw path, not file:// URL
    })

  return (
    <div className="page">
      <h2 style={{ fontSize: 40 }}>选择相框</h2>

      {frames.length === 0 && (
        <p style={{ opacity: 0.4, fontSize: 20 }}>加载中…</p>
      )}

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
        {frames.map((frame) => (
          <button
            key={frame.id}
            onClick={() => select(frame)}
            style={{
              width: 160, height: 280, borderRadius: 12,
              background: '#1e1e1e', border: '2px solid #333',
              color: '#fff', cursor: 'pointer', padding: 0,
              overflow: 'hidden', display: 'flex',
              flexDirection: 'column', alignItems: 'center'
            }}
          >
            <img
              src={frame.dataUrl}
              alt={frame.name}
              style={{ width: '100%', height: 220, objectFit: 'cover' }}
            />
            <span style={{ fontSize: 16, padding: '10px 0' }}>{frame.name}</span>
          </button>
        ))}
      </div>

      <button
        style={{ fontSize: 20, background: 'none', color: '#888', border: 'none', cursor: 'pointer' }}
        onClick={() => window.xfoto?.transition('IDLE')}
      >
        返回
      </button>
    </div>
  )
}
