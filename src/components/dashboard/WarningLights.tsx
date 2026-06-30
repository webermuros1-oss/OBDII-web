export interface WarningLightsProps {
  coolantTemp: number | undefined   // from PID 05 (°C)
  fuelLevel: number | undefined     // from PID 2F (%)
  milOn: boolean                    // MIL / Check Engine lamp
  hasData: boolean                  // true when OBD is connected and returning live data
}

export function isCoolantHot(temp: number | undefined): boolean {
  return temp !== undefined && temp > 105
}

export function isFuelLow(level: number | undefined): boolean {
  return level !== undefined && level < 15
}

export function WarningLights(props: WarningLightsProps): JSX.Element | null {
  const { coolantTemp, fuelLevel, milOn, hasData } = props

  if (!hasData) {
    return null
  }

  const coolantHot = isCoolantHot(coolantTemp)
  const fuelLow = isFuelLow(fuelLevel)
  const anyWarning = milOn || coolantHot || fuelLow

  return (
    <div className="flex flex-wrap gap-2 min-h-[32px]">
      {milOn && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
          <span>⚠️</span><span>Motor</span>
        </div>
      )}
      {coolantHot && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
          <span>🌡️</span><span>Temp. alta</span>
        </div>
      )}
      {fuelLow && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          <span>⛽</span><span>Combustible bajo</span>
        </div>
      )}
      {!anyWarning && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
          <span>✓</span><span>Sin alertas</span>
        </div>
      )}
    </div>
  )
}
