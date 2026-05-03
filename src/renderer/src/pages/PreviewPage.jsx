import { useEffect, useState } from 'react'

export default function PreviewPage({ data }) {
  const { photos = [] } = data
  const [dataUrls, setDataUrls] = useState([])

  useEffect(() => {
    async function load() {
      const urls = await Promise.all(
        photos.map((p) => window.xfoto.readAsDataUrl(p))
      )
      setDataUrls(urls)
    }
    if (photos.length > 0) load()
  }, [photos])

  const confirm = () => window.xfoto?.transition('RENDERING')

  return (
    <div className="page">
      <h2 style={{ fontSize: 36 }}>选择照片</h2>
      <div style={{ display: 'flex', gap: 20 }}>
        {photos.map((_, i) => (
          <div key={i} style={{
            width: 200, height: 200, borderRadius: 12,
            background: '#1e1e1e', overflow: 'hidden',
            border: '3px solid #333'
          }}>
            {dataUrls[i]
              ? <img src={dataUrls[i]} alt={`photo-${i}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#555', fontSize: 14 }}>加载中…</div>
            }
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={confirm}>确认，开始拼图</button>
    </div>
  )
}
