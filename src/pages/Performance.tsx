import { useOBDStore } from '../store/obdStore'
import { useVehicleProfileStore } from '../store/vehicleProfileStore'
import type { SessionStats } from '../store/obdStore'

function calcFuelConsumption(mafGs: number, fuelType: string | undefined): {
  lPerHour: number
  co2Factor: number
} {
  const isDiesel = fuelType === 'Diésel'
  const factor = isDiesel ? 0.2956 : 0.3312
  const co2Factor = isDiesel ? 2.64 : 2.31
  return { lPerHour: mafGs * factor, co2Factor }
}

function StatBox({ label, value, unit, color = 'text-gray-100' }: {
  label: string
  value: string
  unit: string
  color?: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-2.5 text-center">
      <p className="text-[10px] text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-600">{unit}</p>
    </div>
  )
}

export function Performance() {
  const { liveData, sessionStats, resetSessionStats, connectionStatus, isPolling } = useOBDStore()
  const { getActiveProfile } = useVehicleProfileStore()
  const profile = getActiveProfile()

  const isConnected = connectionStatus === 'connected'
  const { maxRPM, maxSpeed, maxCoolantTemp, timer0to100, timerActive }: SessionStats = sessionStats
  const currentSpeed = liveData['0D']?.value ?? 0

  const maf = liveData['10']
  let lPerHour = 0
  let l100km: number | null = null
  let co2: number | null = null
  let co2Factor = 2.31
  if (maf !== undefined) {
    const { lPerHour: lph, co2Factor: cf } = calcFuelConsumption(maf.value, profile?.fuel)
    co2Factor = cf
    lPerHour = lph
    if (currentSpeed > 10) {
      l100km = (lph / currentSpeed) * 100
      co2 = l100km * co2Factor * 10
    }
  }

  const mapKpa = liveData['0B']?.value ?? 0
  const baroKpa = liveData['33']?.value ?? 100
  const boostBar = (mapKpa - baroKpa) / 100
  const boostPsi = boostBar * 14.504
  const hasBoost = liveData['0B'] !== undefined && liveData['33'] !== undefined

  const fuelTypeLabel = profile?.fuel ?? 'Gasolina'

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-5xl mb-4">🏎️</div>
        <p className="text-gray-400">Conecta el ELM327 para ver el rendimiento</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-2">
      <p className="text-sm text-gray-500">Rendimiento y consumo en tiempo real</p>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Timer 0-100 km/h</h2>
          <button onClick={resetSessionStats} className="text-xs text-gray-600 underline">Reiniciar</button>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-bold font-mono text-white">
            {timer0to100 !== null ? timer0to100.toFixed(2) : '—'}
          </span>
          {timer0to100 !== null && <span className="text-xl text-gray-400">s</span>}
        </div>

        <p className="text-sm text-gray-500">
          {timer0to100 !== null
            ? `Mejor tiempo • Velocidad actual: ${Math.round(currentSpeed)} km/h`
            : timerActive
            ? `Midiendo... ${Math.round(currentSpeed)} km/h`
            : isPolling
            ? 'Acelera desde parado para iniciar la medición'
            : 'Inicia la lectura de datos para usar el timer'}
        </p>

        {timerActive && (
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-200"
              style={{ width: `${Math.min(100, (currentSpeed / 100) * 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">Máximos de sesión</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="RPM máx" value={maxRPM > 0 ? Math.round(maxRPM).toString() : '—'} unit="rpm" />
          <StatBox label="V. máxima" value={maxSpeed > 0 ? Math.round(maxSpeed).toString() : '—'} unit="km/h" />
          <StatBox
            label="Temp. máx"
            value={maxCoolantTemp > -999 ? Math.round(maxCoolantTemp).toString() : '—'}
            unit="°C"
            color={maxCoolantTemp > 105 ? 'text-red-400' : maxCoolantTemp > 95 ? 'text-yellow-400' : 'text-gray-100'}
          />
        </div>
      </div>

      {maf !== undefined && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h2 className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Consumo en tiempo real</h2>

          <div className="grid grid-cols-3 gap-3">
            <StatBox label="L/h" value={lPerHour.toFixed(1)} unit="litros/hora" />
            <StatBox
              label="L/100km"
              value={l100km !== null ? l100km.toFixed(1) : '—'}
              unit="litros/100km"
              color={l100km !== null ? (l100km > 12 ? 'text-red-400' : l100km > 8 ? 'text-yellow-400' : 'text-green-400') : 'text-gray-100'}
            />
            <StatBox label="CO₂" value={co2 !== null ? Math.round(co2).toString() : '—'} unit="g/km" />
          </div>

          <p className="text-[10px] text-gray-600">
            Cálculo basado en sensor MAF (flujo de aire) · Combustible: {fuelTypeLabel}
          </p>
        </div>
      )}

      {hasBoost && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
          <h2 className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Presión de sobrealimentación</h2>

          <div className="flex items-baseline gap-3">
            <span className={`text-3xl font-bold font-mono ${boostBar > 0.1 ? 'text-green-400' : 'text-gray-400'}`}>
              {boostBar >= 0 ? '+' : ''}{boostBar.toFixed(2)}
            </span>
            <span className="text-gray-400">bar</span>
            <span className="text-gray-600 text-sm">({boostPsi >= 0 ? '+' : ''}{boostPsi.toFixed(1)} psi)</span>
          </div>

          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${boostBar > 0.5 ? 'bg-red-500' : boostBar > 0.1 ? 'bg-green-500' : 'bg-gray-600'}`}
              style={{ width: `${Math.min(100, Math.max(0, (boostBar / 2.0) * 100))}%` }}
            />
          </div>

          <p className="text-[10px] text-gray-600">MAP: {mapKpa} kPa · Baro: {baroKpa} kPa</p>
        </div>
      )}
    </div>
  )
}
