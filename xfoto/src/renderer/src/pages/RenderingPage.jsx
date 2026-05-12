/**
 * src/renderer/src/pages/RenderingPage.jsx
 *
 * Composites the final full-resolution photo strip and saves it to disk.
 *
 * Uses the shared drawComposite() utility (same logic as PreviewPage) so the
 * final output is pixel-identical to what the user approved in preview.
 *
 * Pipeline:
 *   1. Read sessionData (slotAssignments, framePath, selectedFilter)
 *   2. Load each photo as a data URL via IPC
 *   3. drawComposite() onto a hidden 887×1774 canvas
 *   4. canvas.toDataURL → base64 JPEG → layout:save IPC → file on disk
 *   5. Transition to PRINTING with the saved path
 *
 * Upstream : App.jsx (RENDERING state)
 *            sessionData.slotAssignments — file path per slot
 *            sessionData.framePath       — absolute path to chosen frame PNG
 *            sessionData.selectedFilter  — filter key (default 'none')
 * Downstream: → PRINTING with { finalPath }
 */

import { useEffect, useRef } from 'react'
import { drawComposite } from '../utils/canvasComposite.js'

const CANVAS_W = 887
const CANVAS_H = 1774
const SLOTS = [
  { x: 40, y: 100,  w: 807, h: 511 },
  { x: 40, y: 631,  w: 807, h: 511 },
  { x: 40, y: 1162, w: 807, h: 511 }
]

export default function RenderingPage() {
  const canvasRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function compose() {
      const { data } = await window.xfoto.getState()
      const { slotAssignments = [], framePath, selectedFilter = 'none' } = data

      const canvas = canvasRef.current
      if (!canvas || cancelled) return

      // Load each slot's photo as a data URL
      const slotPhotos = await Promise.all(
        SLOTS.map((_, i) => {
          const p = slotAssignments[i]
          return p ? window.xfoto.readAsDataUrl(p) : Promise.resolve(null)
        })
      )

      // Load frame
      const frameDataUrl = framePath
        ? await window.xfoto.readAsDataUrl(framePath).catch(() => null)
        : null

      if (cancelled) return

      await drawComposite(canvas, { slots: SLOTS, slotPhotos, frameDataUrl, filterKey: selectedFilter })

      if (cancelled) return

      const base64Data = canvas.toDataURL('image/jpeg', 0.95)
      const finalPath  = await window.xfoto.saveComposed({ base64Data })
      console.log('[Rendering] saved:', finalPath)

      if (!cancelled) {
        window.xfoto.transition('PRINTING', { finalPath })
      }
    }

    compose().catch((err) => console.error('[Rendering] fatal:', err.message))
    return () => { cancelled = true }
  }, [])

  return (
    <div className="page">
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} style={{ display: 'none' }}/>
      <div style={{
        width: 64, height: 64,
        border: '5px solid #ff3c6e', borderTopColor: 'transparent',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite'
      }}/>
      <p style={{ fontSize: 28 }}>正在生成照片…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
