import { useOBDStore } from '../../store/obdStore'

export interface SensorGraphProps {
  pid: string
  name: string
  unit: string
  color?: string
}

export function normalizePoints(
  history: Array<{ time: number; value: number }>,
  svgW: number,
  svgH: number
): Array<{ x: number; y: number }> {
  if (history.length === 0) return []

  const times = history.map((p) => p.time)
  const values = history.map((p) => p.value)

  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)

  const rangeT = maxT - minT
  const rangeV = maxV - minV

  return history.map((p) => {
    const x = rangeT === 0 ? 0 : ((p.time - minT) / rangeT) * svgW
    const y = rangeV === 0 ? svgH / 2 : svgH - ((p.value - minV) / rangeV) * svgH
    return { x, y }
  })
}

export function formatGraphValue(value: number): string {
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + 'k'
  }
  const s = value.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export function SensorGraph(props: SensorGraphProps): JSX.Element {
  const { pid, name, unit, color } = props
  const resolvedColor = color ?? '#22c55e'

  const { liveHistory } = useOBDStore()
  const history = liveHistory[pid] ?? []

  if (history.length < 2) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">{name}</span>
          <span className="text-xs text-gray-600">— {unit}</span>
        </div>
        <div className="h-10 flex items-center justify-center">
          <span className="text-xs text-gray-700">Sin datos suficientes</span>
        </div>
      </div>
    )
  }

  const lastValue = history[history.length - 1].value
  const pts = normalizePoints(history, 300, 50)
  const linePoints = pts.map((p) => `${p.x},${p.y}`).join(' ')
  const fillPoints = [
    ...pts.map((p) => `${p.x},${p.y}`),
    `${pts[pts.length - 1].x},50`,
    `0,50`,
  ].join(' ')

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{name}</span>
        <span className="text-xs font-mono text-gray-300">
          {formatGraphValue(lastValue)} {unit}
        </span>
      </div>
      <svg viewBox="0 0 300 50" className="w-full h-10" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${pid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity="0.35" />
            <stop offset="100%" stopColor={resolvedColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={fillPoints}
          fill={`url(#grad-${pid})`}
        />
        <polyline
          points={linePoints}
          fill="none"
          stroke={resolvedColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
