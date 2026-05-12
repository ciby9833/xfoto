/**
 * src/renderer/src/components/CountdownRing.jsx
 *
 * A large animated countdown display for the shooting page.
 * Shows a circular SVG progress ring that shrinks as time counts down,
 * plus the numeric value in the centre.
 *
 * Props:
 *   seconds      {number}  - Current seconds remaining (0 triggers flash)
 *   totalSeconds {number}  - Total duration of one countdown (for ring fill)
 *   shooting     {boolean} - When true, shows camera flash emoji instead of count
 *
 * Upstream : ShootingPage owns the countdown state and passes it here.
 * Downstream: Pure display — no side-effects.
 */

const RADIUS = 110
const STROKE = 10
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function CountdownRing({ seconds, totalSeconds, shooting }) {
  const progress = shooting ? 0 : seconds / totalSeconds
  const dash = CIRCUMFERENCE * progress
  const gap  = CIRCUMFERENCE - dash

  return (
    <div style={{ position: 'relative', width: 260, height: 260 }}>
      {/* SVG ring */}
      <svg width={260} height={260} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={130} cy={130} r={RADIUS}
          fill="none" stroke="#2a2a2a" strokeWidth={STROKE} />
        {/* Progress */}
        <circle cx={130} cy={130} r={RADIUS}
          fill="none"
          stroke={shooting ? '#ff3c6e' : '#ff3c6e'}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          style={{ transition: 'stroke-dasharray 0.9s linear' }}
        />
      </svg>

      {/* Centre content */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: shooting ? 72 : 96,
        fontWeight: 'bold',
        color: shooting ? '#ff3c6e' : '#ffffff',
        animation: shooting ? 'flash 0.3s ease' : 'none'
      }}>
        {shooting ? '📸' : seconds}
      </div>

      <style>{`
        @keyframes flash {
          0%   { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
