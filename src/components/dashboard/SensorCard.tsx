interface Props {
  pid: string
  name: string
  value: number
  unit: string
  min: number
  max: number
}

export function SensorCard({ name, value, unit, min, max }: Props) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  const barColor =
    pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
      <span className="text-xs text-gray-400 truncate block">{name}</span>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold tabular-nums text-white">
          {value.toFixed(value < 10 ? 1 : 0)}
        </span>
        <span className="text-gray-500 text-xs pb-0.5">{unit}</span>
      </div>
      {/* Mini progress bar */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  )
}
