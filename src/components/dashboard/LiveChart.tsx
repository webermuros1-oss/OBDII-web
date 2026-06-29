import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: Array<{ time: number; value: number }>
  unit: string
  color?: string
  height?: number
}

export function LiveChart({ data, unit, color = '#22c55e', height = 120 }: Props) {
  const formatted = data.map((d, i) => ({ i, value: d.value }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={formatted}>
        <XAxis dataKey="i" hide />
        <YAxis
          width={40}
          tick={{ fill: '#6b7280', fontSize: 11 }}
        />
        <Tooltip
          contentStyle={{
            background: '#111827',
            border: '1px solid #374151',
            borderRadius: 8,
          }}
          labelStyle={{ display: 'none' }}
          formatter={(v: unknown) => typeof v === 'number' ? [`${v.toFixed(1)} ${unit}`, ''] : ['', '']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
