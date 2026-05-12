/**
 * src/renderer/src/pages/PreviewPage.jsx
 *
 * After shooting, photos are automatically placed into the selected frame.
 * The user sees a live Canvas composite and can:
 *   - Switch frames (if multiple exist in assets/frames/)
 *   - Pick a quick filter
 *   - Expand a reshoot panel for any individual slot
 *   - Confirm → FILTER_SELECT
 *
 * Rendering design:
 *   - drawComposite() is called inline inside useEffect (no useCallback stale-
 *     closure risk, no dependency on 'rendering' state in the guard).
 *   - A cancelRef guards against running two composites concurrently.
 *   - 'rendering' state is only used for the spinner — it is never read as a
 *     condition inside the draw function itself.
 *
 * Upstream : App.jsx (PREVIEW state)
 *            sessionData.photos       — captured file paths in order
 *            sessionData.config       — slotsCount, availableFilters, …
 *            sessionData.framePath    — currently selected frame path
 * Downstream: → FILTER_SELECT with { framePath, slotAssignments, selectedFilter }
 *             → SHOOTING with { reshoot: {…} } for per-slot retake
 */

import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SESSION_CONFIG, FILTER_PRESETS } from '../../../shared/sessionConfig.js'
import { drawComposite } from '../utils/canvasComposite.js'

// ── Full-resolution frame geometry (must match your frame PNG) ─────────────
const FULL_W = 887
const FULL_H = 1774
const FULL_SLOTS = [
  { x: 40,  y: 100,  w: 807, h: 511 },
  { x: 40,  y: 631,  w: 807, h: 511 },
  { x: 40,  y: 1162, w: 807, h: 511 }
]

// ── Preview display height (CSS pixels) ───────────────────────────────────
const DISPLAY_H = 560
const DISPLAY_W = Math.round(FULL_W * (DISPLAY_H / FULL_H))   // ~280

export default function PreviewPage() {
  const canvasRef   = useRef(null)
  // cancelRef: when we start a new render we set it so any in-flight render
  // can detect it was superseded and stop early.
  const cancelRef   = useRef(false)
  // renderCount: increment to trigger the render useEffect
  const renderCount = useRef(0)

  const [config, setConfig]               = useState(null)
  const [photos, setPhotos]               = useState([])      // file paths
  const [photoUrls, setPhotoUrls]         = useState([])      // data URLs
  const [frames, setFrames]               = useState([])      // available frames
  const [activeFrameIdx, setActiveFrameIdx] = useState(0)
  const [selectedFilter, setSelectedFilter] = useState('none')
  const [rendering, setRendering]         = useState(false)
  const [showReshoot, setShowReshoot]     = useState(false)
  const [dataReady, setDataReady]         = useState(false)   // true once init done

  // ── Load everything once ────────────────────────────────────────────────────
  // Design rules:
  //   • Every readAsDataUrl call has .catch(() => null) — a single bad file
  //     must never block the whole preview page.
  //   • setDataReady(true) is called inside a finally block so it ALWAYS runs
  //     even if something throws unexpectedly.
  //   • 'alive' guards against stale async results after unmount.
  useEffect(() => {
    let alive = true
    async function init() {
      // 1. Get session data
      const { data } = await window.xfoto.getState()
      if (!alive) return

      const cfg   = { ...DEFAULT_SESSION_CONFIG, ...(data.config ?? {}) }
      const paths = data.photos ?? []
      console.log('[PreviewPage] init — photos:', paths.length, 'framePath:', data.framePath ?? 'none')

      // Set config + paths immediately so the page can start rendering
      setConfig(cfg)
      setPhotos(paths)

      // 2. Load photo thumbnails — failures return null (photo slot stays empty)
      const urls = await Promise.all(
        paths.map((p) => window.xfoto.readAsDataUrl(p).catch((e) => {
          console.warn('[PreviewPage] photo load failed:', p, e.message)
          return null
        }))
      )
      if (!alive) return
      setPhotoUrls(urls)

      // 3. Load frame list + their previews — fully resilient
      const frameList      = await window.xfoto.listFrames().catch(() => [])
      const framesWithUrls = await Promise.all(
        frameList.map(async (f) => ({
          ...f,
          dataUrl: await window.xfoto.readAsDataUrl(f.path).catch((e) => {
            console.warn('[PreviewPage] frame load failed:', f.path, e.message)
            return null
          })
        }))
      )
      if (!alive) return

      const currentFramePath = data.framePath ?? null
      const startIdx = framesWithUrls.findIndex((f) => f.path === currentFramePath)

      setFrames(framesWithUrls)
      setActiveFrameIdx(startIdx >= 0 ? startIdx : 0)
      setSelectedFilter(data.selectedFilter ?? 'none')
    }

    // Always call setDataReady(true) — the page must never stay stuck
    init()
      .catch((err) => console.error('[PreviewPage] init error:', err.message))
      .finally(() => { if (alive) setDataReady(true) })

    return () => { alive = false }
  }, [])

  // ── Re-render canvas whenever data or user choice changes ──────────────────
  useEffect(() => {
    if (!dataReady || !canvasRef.current) return

    // Cancel any in-flight render
    cancelRef.current = true
    const myToken = {}      // unique object reference for this render
    cancelRef.current = myToken

    setRendering(true)

    const frame       = frames[activeFrameIdx] ?? null
    const slotPhotos  = FULL_SLOTS.map((_, i) => photoUrls[i] ?? null)

    drawComposite(canvasRef.current, {
      slots:        FULL_SLOTS,
      slotPhotos,
      frameDataUrl: frame?.dataUrl ?? null,
      filterKey:    selectedFilter
    })
      .then(() => {
        if (cancelRef.current !== myToken) return   // superseded — don't update spinner
        setRendering(false)
      })
      .catch((err) => {
        console.error('[PreviewPage] composite error:', err.message)
        if (cancelRef.current === myToken) setRendering(false)
      })
  }, [dataReady, activeFrameIdx, selectedFilter, photoUrls, frames])

  // ── Confirm ────────────────────────────────────────────────────────────────
  function handleConfirm() {
    const frame          = frames[activeFrameIdx] ?? null
    const slotAssignments = FULL_SLOTS.map((_, i) => photos[i] ?? null)
    window.xfoto.transition('FILTER_SELECT', {
      framePath:       frame?.path ?? null,
      slotAssignments,
      selectedFilter
    })
  }

  // ── Per-slot reshoot ───────────────────────────────────────────────────────
  function handleReshoot(slotIdx) {
    const frame          = frames[activeFrameIdx] ?? null
    const slotAssignments = FULL_SLOTS.map((_, i) => photos[i] ?? null)
    window.xfoto.transition('SHOOTING', {
      framePath:        frame?.path ?? null,
      slotAssignments,
      reshoot: { slotIndex: slotIdx, replacePhotoIndex: slotIdx }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!dataReady || !config) {
    return (
      <div className="page">
        <div style={spinnerStyle} />
        <p style={{ fontSize: 20, color: '#555' }}>加载中…</p>
        <style>{spinKeyframes}</style>
      </div>
    )
  }

  const filterKeys = (config.availableFilters ?? []).filter((k) => k in FILTER_PRESETS)

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      background: '#0a0a0a',
      overflowY: 'auto',
      padding: '24px 0 48px'
    }}>
      <h2 style={{ fontSize: 28, marginBottom: 4 }}>预览效果</h2>
      <p style={{ fontSize: 15, color: '#555', marginBottom: 20 }}>
        可切换相框 / 滤镜，满意后确认
      </p>

      {/* ── Canvas preview ── */}
      <div style={{
        width:         DISPLAY_W,
        height:        DISPLAY_H,
        borderRadius:  12,
        overflow:      'hidden',
        boxShadow:     '0 8px 40px rgba(0,0,0,0.7)',
        position:      'relative',
        flexShrink:    0,
        marginBottom:  24,
        background:    '#111'
      }}>
        <canvas
          ref={canvasRef}
          width={FULL_W}
          height={FULL_H}
          style={{ width: DISPLAY_W, height: DISPLAY_H, display: 'block' }}
        />
        {rendering && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)'
          }}>
            <div style={spinnerStyle} />
          </div>
        )}
      </div>

      {/* ── Frame switcher (only when >1 frame) ── */}
      {frames.length > 1 && (
        <section style={sectionStyle}>
          <p style={labelStyle}>选择相框</p>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {frames.map((f, i) => (
              <button key={f.id} onClick={() => setActiveFrameIdx(i)} style={{
                width: 64, height: 100, padding: 0, flexShrink: 0,
                borderRadius: 8, overflow: 'hidden',
                border: i === activeFrameIdx ? '3px solid #ff3c6e' : '3px solid #222',
                background: '#111', cursor: 'pointer', transition: 'border-color 0.15s'
              }}>
                <img src={f.dataUrl} alt={f.name}
                  style={{ width: '100%', height: '80%', objectFit: 'cover' }} />
                <p style={{
                  fontSize: 10, color: i === activeFrameIdx ? '#ff3c6e' : '#555',
                  margin: '3px 0', overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', padding: '0 2px'
                }}>
                  {f.name}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Quick filter strip ── */}
      {filterKeys.length > 0 && (
        <section style={sectionStyle}>
          <p style={labelStyle}>快速滤镜</p>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 4 }}>
            {filterKeys.map((key) => {
              const preset = FILTER_PRESETS[key]
              const active = key === selectedFilter
              return (
                <div key={key} onClick={() => setSelectedFilter(key)}
                  style={{ flexShrink: 0, textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{
                    width: 58, height: 58, borderRadius: 8, overflow: 'hidden',
                    border: active ? '2px solid #ff3c6e' : '2px solid #222',
                    background: '#111', transition: 'border-color 0.15s'
                  }}>
                    {photoUrls[0]
                      ? <img src={photoUrls[0]} alt={preset.label}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: preset.css }} />
                      : <div style={{ width: '100%', height: '100%', background: '#1a1a1a' }} />
                    }
                  </div>
                  <p style={{ fontSize: 11, color: active ? '#ff3c6e' : '#555', marginTop: 4 }}>
                    {preset.label}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Reshoot panel ── */}
      <section style={sectionStyle}>
        <button onClick={() => setShowReshoot((v) => !v)} style={{
          fontSize: 14, color: '#555',
          background: 'none', border: '1px solid #222',
          borderRadius: 20, padding: '7px 18px', cursor: 'pointer'
        }}>
          {showReshoot ? '▲ 收起' : '▼ 重拍某张？'}
        </button>
        {showReshoot && (
          <div style={{ display: 'flex', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
            {FULL_SLOTS.map((_, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 70, height: 70, borderRadius: 8, overflow: 'hidden',
                  border: '2px solid #222', background: '#111', marginBottom: 6
                }}>
                  {photoUrls[i] && (
                    <img src={photoUrls[i]} alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <button onClick={() => handleReshoot(i)} style={{
                  fontSize: 12, padding: '5px 10px',
                  background: 'none', border: '1px solid #333',
                  color: '#777', borderRadius: 14, cursor: 'pointer'
                }}>
                  重拍 #{i + 1}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Confirm ── */}
      <button className="btn-primary" onClick={handleConfirm} style={{ minWidth: 260, marginTop: 8 }}>
        确认，选择滤镜 →
      </button>

      <style>{spinKeyframes}</style>
    </div>
  )
}

// ── Shared micro-styles ────────────────────────────────────────────────────
const sectionStyle = {
  width: '100%', maxWidth: 560,
  padding: '0 20px', marginBottom: 22
}
const labelStyle = {
  fontSize: 14, color: '#555', marginBottom: 10
}
const spinnerStyle = {
  width: 36, height: 36,
  border: '4px solid #ff3c6e',
  borderTopColor: 'transparent',
  borderRadius: '50%',
  animation: 'spin 0.7s linear infinite'
}
const spinKeyframes = `@keyframes spin { to { transform: rotate(360deg); } }`
