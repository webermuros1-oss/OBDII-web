import type { JSX } from 'react'

export interface DialGaugeProps {
  pid: string
  name: string
  value: number
  unit: string
  min: number
  max: number
  hasData: boolean
  size?: 'sm' | 'lg'
  redlineAt?: number
}

// ─── Pure exported functions ──────────────────────────────────────────────────

export function valueToAngle(value: number, min: number, max: number): number {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return 135 + pct * 270
}

export function colorForPct(pct: number, redlineAt?: number): string {
  const threshold = redlineAt ?? 85
  if (pct >= threshold) return '#ef4444'
  if (pct >= 60) return '#f59e0b'
  return '#22c55e'
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  sweepDeg: number
): string {
  const endDeg = startDeg + sweepDeg
  const s = polarToCartesian(cx, cy, r, startDeg)
  const e = polarToCartesian(cx, cy, r, endDeg)
  const large = sweepDeg > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

function formatValue(pid: string, value: number, hasData: boolean): string {
  if (!hasData) return '—'
  if (pid === '0C' || pid === '0D') return Math.round(value).toString()
  if (['11', '04', '2F'].includes(pid)) return Math.round(value).toString()
  return value.toFixed(1)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DialGauge(props: DialGaugeProps): JSX.Element {
  const { pid, name, value, unit, min, max, hasData, size = 'lg', redlineAt } = props

  const clampedPct =
    max !== min
      ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
      : 0

  const color = colorForPct(clampedPct, redlineAt)
  const displayValue = formatValue(pid, value, hasData)

  // Arc length for the full 270° sweep on r=82
  const FULL_ARC = Math.PI * 82 * (270 / 180)
  const dashOffset = FULL_ARC * (1 - clampedPct / 100)

  // Needle
  const needleAngle = valueToAngle(hasData ? value : min, min, max)
  const needleRad = (needleAngle * Math.PI) / 180
  const tipX = 100 + 68 * Math.cos(needleRad)
  const tipY = 100 + 68 * Math.sin(needleRad)
  const tailX = 100 - 10 * Math.cos(needleRad)
  const tailY = 100 - 10 * Math.sin(needleRad)

  // Tick marks: 18 ticks at every 15° across the 270° sweep, i = 0..18
  const ticks: JSX.Element[] = []
  for (let i = 0; i <= 18; i++) {
    const angleDeg = 135 + i * 15
    const isMajor = i % 3 === 0
    const innerR = isMajor ? 85 : 87
    const outerR = isMajor ? 95 : 93
    const inner = polarToCartesian(100, 100, innerR, angleDeg)
    const outer = polarToCartesian(100, 100, outerR, angleDeg)
    ticks.push(
      <line
        key={i}
        x1={inner.x.toFixed(2)}
        y1={inner.y.toFixed(2)}
        x2={outer.x.toFixed(2)}
        y2={outer.y.toFixed(2)}
        stroke="#6b7280"
        strokeWidth={isMajor ? 1.5 : 1}
      />
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-full">
        {/* 1. Outer decorative ring */}
        <circle
          cx="100"
          cy="100"
          r="95"
          fill="none"
          stroke="#1f2937"
          strokeWidth="2"
        />

        {/* 2. Background track arc (full 270°) */}
        <path
          d={arcPath(100, 100, 82, 135, 270)}
          fill="none"
          stroke="#374151"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* 3. Tick marks */}
        {ticks}

        {/* 4. Value arc with strokeDasharray animation */}
        {clampedPct > 0 && (
          <path
            d={arcPath(100, 100, 82, 135, 270)}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={FULL_ARC}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
          />
        )}

        {/* 5. Needle */}
        <line
          x1={tailX.toFixed(2)}
          y1={tailY.toFixed(2)}
          x2={tipX.toFixed(2)}
          y2={tipY.toFixed(2)}
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ transition: 'all 0.4s ease' }}
        />

        {/* 6. Center cap */}
        <circle
          cx="100"
          cy="100"
          r="6"
          fill="#111827"
          stroke="#6b7280"
          strokeWidth="1.5"
        />

        {/* 7. Value text */}
        <text
          x="100"
          y="108"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={hasData ? '#ffffff' : '#4b5563'}
          fontSize={size === 'sm' ? 20 : 26}
          fontWeight="700"
          fontFamily="ui-monospace, monospace"
        >
          {displayValue}
        </text>

        {/* 8. Unit text */}
        <text
          x="100"
          y="125"
          textAnchor="middle"
          fill="#6b7280"
          fontSize="9"
        >
          {unit}
        </text>

        {/* 9. Name text */}
        <text
          x="100"
          y="170"
          textAnchor="middle"
          fill="#6b7280"
          fontSize={size === 'sm' ? 8 : 9}
        >
          {name}
        </text>
      </svg>
    </div>
  )
}
