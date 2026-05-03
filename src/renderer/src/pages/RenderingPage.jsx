import { useEffect, useRef } from 'react'

const CANVAS_W = 887
const CANVAS_H = 1774

const SLOTS = [
  { x: 40, y: 100,  w: 807, h: 511 },
  { x: 40, y: 631,  w: 807, h: 511 },
  { x: 40, y: 1162, w: 807, h: 511 }
]

function loadImg(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = dataUrl
  })
}

function drawCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height
  const slotRatio = w / h
  let sx, sy, sw, sh
  if (imgRatio > slotRatio) {
    sh = img.height; sw = img.height * slotRatio
    sx = (img.width - sw) / 2; sy = 0
  } else {
    sw = img.width; sh = img.width / slotRatio
    sx = 0; sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

export default function RenderingPage() {
  const canvasRef = useRef(null)

  useEffect(() => {
    async function compose() {
      const { data } = await window.xfoto.getState()
      const { photos = [], framePath } = data
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

      // 1. Draw frame first (frame has no alpha — fully opaque)
      if (framePath) {
        try {
          const dataUrl = await window.xfoto.readAsDataUrl(framePath)
          const frame = await loadImg(dataUrl)
          ctx.drawImage(frame, 0, 0, CANVAS_W, CANVAS_H)
        } catch (e) {
          console.error('Frame failed:', e.message)
        }
      }

      // 2. Draw each photo clipped to its slot — covers the frame placeholder area
      for (let i = 0; i < SLOTS.length && i < photos.length; i++) {
        const { x, y, w, h } = SLOTS[i]
        try {
          const dataUrl = await window.xfoto.readAsDataUrl(photos[i])
          const img = await loadImg(dataUrl)
          ctx.save()
          ctx.beginPath()
          ctx.rect(x, y, w, h)
          ctx.clip()
          drawCover(ctx, img, x, y, w, h)
          ctx.restore()
        } catch (e) {
          console.error(`Slot ${i} failed:`, e.message)
        }
      }

      const base64Data = canvas.toDataURL('image/jpeg', 0.95)
      const finalPath = await window.xfoto?.saveComposed({ base64Data })
      window.xfoto?.transition('PRINTING', { finalPath })
    }

    compose()
  }, [])

  return (
    <div className="page">
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ display: 'none' }} />
      <div style={{
        width: 64, height: 64,
        border: '5px solid #ff3c6e',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <p style={{ fontSize: 28 }}>正在生成照片…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
