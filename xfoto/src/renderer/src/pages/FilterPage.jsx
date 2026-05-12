/**
 * src/renderer/src/pages/FilterPage.jsx
 *
 * Lets the user pick a photo filter before the final composite is rendered.
 *
 * Displays a preview using the FIRST slot's assigned photo with each filter
 * applied via CSS (fast, no re-render of full Canvas).  The selected filter
 * key is stored in sessionData.selectedFilter and consumed by RenderingPage
 * which applies it via ctx.filter on the Canvas before drawing.
 *
 * Upstream : App.jsx renders this for FILTER_SELECT state.
 *            sessionData.config.availableFilters  — which filters to show
 *            sessionData.slotAssignments[0]        — file path used for preview
 * Downstream: transitions to RENDERING with { selectedFilter: string }
 *             Can go back to PREVIEW.
 *
 * Components used: PhotoThumbnail
 */

import { useEffect, useState } from 'react'
import { DEFAULT_SESSION_CONFIG, FILTER_PRESETS } from '../../../shared/sessionConfig.js'
import PhotoThumbnail from '../components/PhotoThumbnail.jsx'

export default function FilterPage() {
  const [availableFilters, setAvailableFilters] = useState([])
  const [previewDataUrl, setPreviewDataUrl]     = useState(null)   // first slot's photo
  const [selectedFilter, setSelectedFilter]     = useState('none')
  const [loading, setLoading]                   = useState(true)

  // ── Load config + preview photo ────────────────────────────────────────────
  useEffect(() => {
    window.xfoto.getState().then(async ({ data }) => {
      const cfg = { ...DEFAULT_SESSION_CONFIG, ...(data.config ?? {}) }
      const keys = cfg.availableFilters.filter((k) => k in FILTER_PRESETS)
      setAvailableFilters(keys)
      setSelectedFilter(data.selectedFilter ?? cfg.defaultFilter ?? 'none')

      // Load first assigned photo for the live preview
      const firstPhoto = data.slotAssignments?.[0] ?? data.photos?.[0] ?? null
      if (firstPhoto) {
        const url = await window.xfoto.readAsDataUrl(firstPhoto)
        setPreviewDataUrl(url)
      }
      setLoading(false)
    })
  }, [])

  function confirm() {
    window.xfoto.transition('RENDERING', { selectedFilter })
  }

  function goBack() {
    window.xfoto.transition('PREVIEW')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page">
        <p style={{ color: '#555', fontSize: 20 }}>加载中…</p>
      </div>
    )
  }

  const currentPreset = FILTER_PRESETS[selectedFilter] ?? FILTER_PRESETS.none

  return (
    <div className="page" style={{ gap: 28, padding: '32px 24px' }}>
      <h2 style={{ fontSize: 36 }}>选择滤镜</h2>

      {/* Large preview of first photo with selected filter */}
      <div style={{
        width: 280, height: 280,
        borderRadius: 16,
        overflow: 'hidden',
        border: '3px solid #333',
        flexShrink: 0
      }}>
        {previewDataUrl ? (
          <img
            src={previewDataUrl}
            alt="preview"
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
              filter: currentPreset.css,
              transition: 'filter 0.2s ease'
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: '#1a1a1a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#555'
          }}>
            无预览图
          </div>
        )}
      </div>

      <p style={{ fontSize: 22, color: '#ff3c6e', fontWeight: 'bold' }}>
        {currentPreset.label}
      </p>

      {/* Filter selector strip */}
      <div style={{
        display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center',
        maxWidth: 680
      }}>
        {availableFilters.map((key) => {
          const preset = FILTER_PRESETS[key]
          const isActive = key === selectedFilter
          return (
            <div
              key={key}
              onClick={() => setSelectedFilter(key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 8, cursor: 'pointer'
              }}
            >
              {/* Mini thumbnail with filter applied */}
              <div style={{
                width: 80, height: 80,
                borderRadius: 10,
                overflow: 'hidden',
                border: isActive ? '3px solid #ff3c6e' : '3px solid #333',
                transition: 'border-color 0.15s',
                flexShrink: 0
              }}>
                {previewDataUrl ? (
                  <img
                    src={previewDataUrl}
                    alt={preset.label}
                    style={{
                      width: '100%', height: '100%',
                      objectFit: 'cover',
                      filter: preset.css
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#1a1a1a' }} />
                )}
              </div>
              <span style={{
                fontSize: 14,
                color: isActive ? '#ff3c6e' : '#888',
                transition: 'color 0.15s'
              }}>
                {preset.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 24 }}>
        <button
          className="btn-primary"
          style={{ background: '#333', fontSize: 22, padding: '16px 40px' }}
          onClick={goBack}
        >
          返回
        </button>
        <button
          className="btn-primary"
          onClick={confirm}
        >
          确认，生成照片
        </button>
      </div>
    </div>
  )
}
