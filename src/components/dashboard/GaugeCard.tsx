interface GaugeCardProps {
  pid: string
  name: string
  value: number
  unit: string
  min: number
  max: number
  hasData: boolean
}

const CIRCUMFERENCE = Math.PI * 65

function arcColor(pct: number): string {
  if (pct >= 80) return '#ef4444'
  if (pct >= 50) return '#f59e0b'
  return '#22c55e'
}

function formatValue(pid: string, value: number, hasData: boolean): string {
  if (!hasData) return '—'
  if (pid === '0C' || pid === '0D') return Math.round(value).toString()
  if (pid === '11' || pid === '04' || pid === '2F') return Math.round(value).toString()
  return value.toFixed(1)
}

export function GaugeCard({ pid, name, value, unit, min, max, hasData }: GaugeCardProps) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const offset = CIRCUMFERENCE * (1 - pct / 100)
  const color = arcColor(pct)
  const displayValue = formatValue(pid, value, hasData)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 flex flex-col items-center">
      <svg viewBox="0 0 160 100" className="w-full">
        <path
          d="M 15 85 A 65 65 0 0 1 145 85"
          fill="none"
          stroke="#374151"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 15 85 A 65 65 0 0 1 145 85"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
        />
        <text
          x="80"
          y="76"
          textAnchor="middle"
          dominantBaseline="auto"
          fill={hasData ? '#ffffff' : '#6b7280'}
          fontSize="22"
          fontWeight="700"
          fontFamily="ui-monospace, monospace"
        >
          {displayValue}
        </text>
        <text
          x="80"
          y="92"
          textAnchor="middle"
          dominantBaseline="auto"
          fill="#6b7280"
          fontSize="10"
        >
          {unit}
        </text>
      </svg>
      <span className="text-xs text-gray-500 text-center leading-tight pb-1 truncate w-full">
        {name}
      </span>
    </div>
  )
}
