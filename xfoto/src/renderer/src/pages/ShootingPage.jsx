/**
 * src/renderer/src/pages/ShootingPage.jsx
 *
 * Fullscreen shooting interface — countdown, capture, thumbnail strip.
 *
 * Key design rules:
 *   - pathsRef (useRef) is the single source of truth for captured paths.
 *     React state (paths) is derived from it for UI only.
 *   - The transition to PREVIEW is called DIRECTLY from the async shoot()
 *     function, never inside a setState callback (that is a React anti-pattern
 *     that can fire side-effects multiple times in concurrent mode).
 *   - guardRef prevents the shoot loop from starting twice.
 *
 * Entry modes:
 *   Normal  — enter from PAYMENT_SUCCESS, take config.totalShots photos
 *   Reshoot — enter from PREVIEW with reshoot={slotIndex, replacePhotoIndex},
 *             take 1 photo, replace that slot, return to PREVIEW
 *
 * Upstream : App.jsx (SHOOTING state)
 *            sessionData.config  — totalShots, countdownSeconds
 *            sessionData.photos  — existing paths (reshoot mode)
 *            sessionData.reshoot — { slotIndex, replacePhotoIndex } | null
 * Downstream: → PREVIEW with { photos: string[], reshoot: null }
 */

import { useEffect, useRef, useState } from 'react'
import { DEFAULT_SESSION_CONFIG } from '../../../shared/sessionConfig.js'

export default function ShootingPage() {
  const guardRef   = useRef(false)   // prevents double-start
  const timerRef   = useRef(null)
  // pathsRef is the authoritative store for captured file paths.
  // It is updated synchronously in the shoot loop and read for the transition.
  const pathsRef   = useRef([])

  const [config, setConfig]             = useState(null)
  const [isReshoot, setIsReshoot]       = useState(false)
  const [reshootInfo, setReshootInfo]   = useState(null)
  const [thumbUrls, setThumbUrls]       = useState([])   // base64 for display only
  const [currentShot, setCurrentShot]   = useState(0)
  const [countdown, setCountdown]       = useState(3)
  const [phase, setPhase]               = useState('countdown')
  const [statusText, setStatusText]     = useState('')
  const [showFlash, setShowFlash]       = useState(false)
  const [totalSlots, setTotalSlots]     = useState(3)

  // ── Initialise from main-process session ──────────────────────────────────
  useEffect(() => {
    window.xfoto.getState().then(({ data }) => {
      const cfg           = { ...DEFAULT_SESSION_CONFIG, ...(data.config ?? {}) }
      const reshoot       = data.reshoot ?? null
      const existingPaths = data.photos ?? []

      setConfig(cfg)
      setIsReshoot(!!reshoot)
      setReshootInfo(reshoot)
      setTotalSlots(cfg.totalShots)
      setCountdown(cfg.countdownSeconds)

      // Seed ref + state with existing photos (matters for reshoot mode)
      pathsRef.current = [...existingPaths]

      // Pre-load thumbnails for existing photos
      if (existingPaths.length > 0) {
        Promise.all(existingPaths.map((p) => window.xfoto.readAsDataUrl(p).catch(() => null)))
          .then(setThumbUrls)
      } else {
        setThumbUrls([])
      }
    })
  }, [])

  // ── Start shoot loop once config is ready ─────────────────────────────────
  useEffect(() => {
    if (!config || guardRef.current) return
    guardRef.current = true
    shoot(config)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [config])

  // ─────────────────────────────────────────────────────────────────────────
  async function shoot(cfg) {
    const reshoot = reshootInfo  // captured from state at effect-registration time
    const doReshoot = !!reshoot
    const needed  = doReshoot ? 1 : cfg.totalShots

    let idx = 0
    while (idx < needed) {
      setCurrentShot(idx)
      setStatusText(
        doReshoot
          ? `重拍 位置 ${(reshoot?.slotIndex ?? 0) + 1}`
          : `第 ${idx + 1} / ${needed} 张`
      )

      await runCountdown(cfg.countdownSeconds)

      // Flash
      setPhase('flash')
      setShowFlash(true)
      await sleep(130)
      setShowFlash(false)

      // Capture
      let filePath
      try {
        filePath = await window.xfoto.capture()
      } catch (err) {
        console.error('[Shooting] capture error:', err.message)
        setStatusText('拍照失败，重试中…')
        await sleep(1200)
        setPhase('countdown')
        continue
      }

      // Write to ref (authoritative) and derive display state from it
      const insertIdx = (doReshoot && reshoot) ? reshoot.replacePhotoIndex : idx
      pathsRef.current[insertIdx] = filePath

      // Load thumbnail (fire-and-forget, non-blocking)
      window.xfoto.readAsDataUrl(filePath).then((url) => {
        setThumbUrls((prev) => {
          const next = [...prev]
          next[insertIdx] = url
          return next
        })
      }).catch(() => {})

      idx++
      setPhase('countdown')
      if (idx < needed) await sleep(700)
    }

    // All done
    setPhase('done')
    setStatusText('完成！')
    await sleep(500)

    // Transition directly — pathsRef.current has all captured paths
    // Never call transition() inside a setState callback.
    const finalPhotos = [...pathsRef.current]
    console.log('[Shooting] transitioning to PREVIEW, photos:', finalPhotos.length)
    window.xfoto.transition('PREVIEW', { photos: finalPhotos, reshoot: null })
  }

  function runCountdown(seconds) {
    return new Promise((resolve) => {
      setPhase('countdown')
      setCountdown(seconds)
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timerRef.current); resolve(); return 0 }
          return c - 1
        })
      }, 1000)
    })
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  // ── Render ────────────────────────────────────────────────────────────────
  if (!config) return null

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      overflow: 'hidden', background: '#000'
    }}>
      {/* Viewfinder */}
      <ViewfinderArea />

      {/* Flash overlay */}
      <div style={{
        position: 'absolute', inset: 0, background: '#fff',
        opacity: showFlash ? 0.85 : 0,
        transition: showFlash ? 'none' : 'opacity 0.25s ease',
        pointerEvents: 'none', zIndex: 30
      }} />

      {/* Top status */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '48px 40px 24px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)',
        zIndex: 10
      }}>
        <p style={{ fontSize: 22, color: 'rgba(255,255,255,0.65)', letterSpacing: 2, textAlign: 'center' }}>
          {statusText}
        </p>
      </div>

      {/* Countdown ring */}
      {phase !== 'done' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 20
        }}>
          <OverlayCountdown
            seconds={phase === 'flash' ? 0 : countdown}
            total={config.countdownSeconds}
            flash={phase === 'flash'}
          />
        </div>
      )}

      {/* Done checkmark */}
      {phase === 'done' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 20,
          fontSize: 96, color: '#4caf50'
        }}>
          ✓
        </div>
      )}

      {/* Bottom thumbnail strip */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 24px 48px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {Array.from({ length: totalSlots }).map((_, i) => {
            const url     = thumbUrls[i]
            const isActive = i === currentShot && phase === 'flash'
            return (
              <div key={i} style={{
                width: 70, height: 70, borderRadius: 8, overflow: 'hidden',
                border: isActive
                  ? '2px solid #ff3c6e'
                  : url ? '2px solid rgba(255,255,255,0.4)' : '2px solid rgba(255,255,255,0.15)',
                background: '#111', flexShrink: 0, transition: 'border-color 0.2s'
              }}>
                {url
                  ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'rgba(255,255,255,0.2)', fontSize: 18
                    }}>{i + 1}</div>
                }
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Viewfinder ────────────────────────────────────────────────────────────
function ViewfinderArea() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'radial-gradient(ellipse at center, #1a1a1a 0%, #000 100%)'
    }}>
      <svg width="100%" height="100%"
        style={{ position: 'absolute', inset: 0, opacity: 0.06 }}
        preserveAspectRatio="none">
        <line x1="33.3%" y1="0" x2="33.3%" y2="100%" stroke="#fff" strokeWidth="1"/>
        <line x1="66.6%" y1="0" x2="66.6%" y2="100%" stroke="#fff" strokeWidth="1"/>
        <line x1="0" y1="33.3%" x2="100%" y2="33.3%" stroke="#fff" strokeWidth="1"/>
        <line x1="0" y1="66.6%" x2="100%" y2="66.6%" stroke="#fff" strokeWidth="1"/>
      </svg>
    </div>
  )
}

// ── Countdown overlay ─────────────────────────────────────────────────────
function OverlayCountdown({ seconds, total, flash }) {
  const R = 90, S = 8
  const C = 2 * Math.PI * R
  const dash = C * (flash ? 0 : seconds / total)

  return (
    <div style={{ position: 'relative', width: 220, height: 220 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
      }} />
      <svg width={220} height={220}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={110} cy={110} r={R} fill="none"
          stroke="rgba(255,255,255,0.12)" strokeWidth={S}/>
        <circle cx={110} cy={110} r={R} fill="none"
          stroke="#ff3c6e" strokeWidth={S} strokeLinecap="round"
          strokeDasharray={`${dash} ${C - dash}`}
          style={{ transition: 'stroke-dasharray 0.85s linear' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: flash ? 64 : 80, fontWeight: 'bold', color: '#fff',
        textShadow: '0 2px 12px rgba(0,0,0,0.6)'
      }}>
        {flash ? '📸' : seconds}
      </div>
    </div>
  )
}
