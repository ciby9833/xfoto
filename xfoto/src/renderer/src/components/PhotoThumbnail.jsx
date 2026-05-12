/**
 * src/renderer/src/components/PhotoThumbnail.jsx
 *
 * Reusable photo thumbnail used in ShootingPage (progress strip) and
 * PreviewPage (photo picker + slot grid).
 *
 * Props:
 *   dataUrl     {string|null} - base64 data URL; null → shows placeholder
 *   size        {number}      - Width & height in px (default 120)
 *   label       {string}      - Optional label text below the image
 *   selected    {boolean}     - Highlight border (used in PreviewPage slot picker)
 *   onClick     {function}    - Tap handler
 *   badge       {string|null} - Small badge text in top-right corner (e.g. slot index)
 *   dim         {boolean}     - Slightly dim the photo (unselected states)
 *   filterCss   {string}      - CSS filter string to apply to the <img>
 *
 * Upstream : ShootingPage, PreviewPage, FilterPage
 * Downstream: Pure display component — no IPC calls.
 */

export default function PhotoThumbnail({
  dataUrl = null,
  size = 120,
  label = null,
  selected = false,
  onClick = null,
  badge = null,
  dim = false,
  filterCss = 'none'
}) {
  const isEmpty = !dataUrl

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: 12,
        overflow: 'visible',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0
      }}
    >
      {/* Photo or placeholder box */}
      <div style={{
        width: size,
        height: size,
        borderRadius: 12,
        overflow: 'hidden',
        border: selected
          ? '3px solid #ff3c6e'
          : '3px solid #333',
        background: '#1a1a1a',
        opacity: dim ? 0.45 : 1,
        transition: 'border-color 0.15s, opacity 0.15s'
      }}>
        {!isEmpty ? (
          <img
            src={dataUrl}
            alt={label ?? 'photo'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: filterCss
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#444', fontSize: 28
          }}>
            {/* Empty slot indicator */}
            <svg width={36} height={36} viewBox="0 0 36 36" fill="none">
              <rect x={2} y={2} width={32} height={32} rx={6}
                stroke="#444" strokeWidth={2} strokeDasharray="4 3" />
              <line x1={10} y1={18} x2={26} y2={18} stroke="#444" strokeWidth={2} />
              <line x1={18} y1={10} x2={18} y2={26} stroke="#444" strokeWidth={2} />
            </svg>
          </div>
        )}
      </div>

      {/* Number badge (top-right) */}
      {badge !== null && (
        <div style={{
          position: 'absolute',
          top: -8, right: -8,
          width: 24, height: 24,
          borderRadius: '50%',
          background: selected ? '#ff3c6e' : '#444',
          color: '#fff',
          fontSize: 12,
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s'
        }}>
          {badge}
        </div>
      )}

      {/* Label */}
      {label && (
        <div style={{
          textAlign: 'center',
          fontSize: 13,
          color: selected ? '#ff3c6e' : '#888',
          marginTop: 6,
          transition: 'color 0.15s'
        }}>
          {label}
        </div>
      )}
    </div>
  )
}
