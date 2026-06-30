import { useEffect, useState } from 'react'
import { useOBDStore } from '../store/obdStore'
import { useLiveData } from '../hooks/useLiveData'
import { useIsLandscape } from '../hooks/useOrientation'
import { DialGauge } from '../components/dashboard/DialGauge'
import { WarningLights } from '../components/dashboard/WarningLights'
import { SensorGraph } from '../components/dashboard/SensorGraph'

const PIDS = ['0C', '0D', '05', '04', '2F', '0F', '11', '0E', '42', '1F', '10', '0B', '33', '0A', '14']

function formatRuntime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function voltageColor(v: number): string {
  if (v >= 13.5) return 'text-green-400'
  if (v >= 12.0) return 'text-yellow-400'
  return 'text-red-400'
}

export function Dashboard() {
  const { liveData, connectionStatus, isPolling, dtcResult } = useOBDStore()
  const { startPolling, stopPolling } = useLiveData()
  const isLandscape = useIsLandscape()
  const [drivingMode, setDrivingMode] = useState(false)

  const isConnected = connectionStatus === 'connected'
  const d0C = liveData['0C']  // RPM
  const d0D = liveData['0D']  // Velocidad km/h
  const d05 = liveData['05']  // Temp. refrigerante °C
  const d04 = liveData['04']  // Carga motor %
  const d2F = liveData['2F']  // Nivel combustible %
  const d0F = liveData['0F']  // Temp. admisión °C
  const d42 = liveData['42']  // Voltaje batería V
  const d1F = liveData['1F']  // Tiempo de marcha s
  const anyData = Object.keys(liveData).length > 0

  useEffect(() => {
    if (isConnected && !isPolling) startPolling(PIDS)
    if (!isConnected && isPolling) stopPolling()
  }, [isConnected])

  // Salir del modo conducción al desconectar
  useEffect(() => {
    if (!isConnected) setDrivingMode(false)
  }, [isConnected])

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="text-6xl mb-4">🔌</div>
        <p className="text-gray-400 text-lg">Conecta tu ELM327 para comenzar</p>
        <p className="text-gray-600 text-sm mt-2">Usa el botón Conectar en la cabecera</p>
      </div>
    )
  }

  // ── MODO CONDUCCIÓN ────────────────────────────────────────────────────────
  if (drivingMode) {
    return (
      <div className="space-y-3 pb-2">
        <div className="flex items-center justify-between">
          <WarningLights
            coolantTemp={d05?.value}
            fuelLevel={d2F?.value}
            milOn={dtcResult?.milOn ?? false}
            hasData={anyData}
          />
          <button
            onClick={() => setDrivingMode(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400"
          >
            ✕ Salir
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DialGauge
            pid="0C" name="RPM" unit="rpm"
            value={d0C?.value ?? 0} min={0} max={6000}
            hasData={d0C !== undefined} size="lg" redlineAt={85}
          />
          <DialGauge
            pid="0D" name="Velocidad" unit="km/h"
            value={d0D?.value ?? 0} min={0} max={220}
            hasData={d0D !== undefined} size="lg"
          />
        </div>
      </div>
    )
  }

  if (isLandscape) {
    // ── LANDSCAPE: barra compacta + diales grandes izquierda + pequeños derecha ──
    return (
      <div className="space-y-2 pb-2">
        <div className="flex items-center gap-3 flex-wrap justify-between">
          <p className="text-xs text-gray-500">
            {isPolling ? 'Recibiendo datos...' : 'En pausa'}
          </p>
          <WarningLights
            coolantTemp={d05?.value}
            fuelLevel={d2F?.value}
            milOn={dtcResult?.milOn ?? false}
            hasData={anyData}
          />
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setDrivingMode(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-gray-400"
            >
              🚗 Conducción
            </button>
            <button
              onClick={() => isPolling ? stopPolling() : startPolling(PIDS)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                isPolling ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'
              }`}
            >
              {isPolling ? '⏸ Pausar' : '▶ Iniciar'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 items-start">
          <div className="grid grid-cols-2 gap-2" style={{ flex: '58' }}>
            <div className="max-w-[190px] mx-auto w-full">
              <DialGauge pid="0C" name="RPM" unit="rpm"
                value={d0C?.value ?? 0} min={0} max={6000}
                hasData={d0C !== undefined} size="lg" redlineAt={85} />
            </div>
            <div className="max-w-[190px] mx-auto w-full">
              <DialGauge pid="0D" name="Velocidad" unit="km/h"
                value={d0D?.value ?? 0} min={0} max={220}
                hasData={d0D !== undefined} size="lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2" style={{ flex: '42' }}>
            <div className="max-w-[120px] mx-auto w-full">
              <DialGauge pid="05" name="Refrig." unit="°C"
                value={d05?.value ?? 0} min={-40} max={130}
                hasData={d05 !== undefined} size="sm" redlineAt={88} />
            </div>
            <div className="max-w-[120px] mx-auto w-full">
              <DialGauge pid="04" name="Carga" unit="%"
                value={d04?.value ?? 0} min={0} max={100}
                hasData={d04 !== undefined} size="sm" />
            </div>
            <div className="max-w-[120px] mx-auto w-full">
              <DialGauge pid="2F" name="Comb." unit="%"
                value={d2F?.value ?? 0} min={0} max={100}
                hasData={d2F !== undefined} size="sm" />
            </div>
            <div className="max-w-[120px] mx-auto w-full">
              <DialGauge pid="0F" name="Admis." unit="°C"
                value={d0F?.value ?? 0} min={-40} max={80}
                hasData={d0F !== undefined} size="sm" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── PORTRAIT: layout vertical completo ──────────────────────────────────────
  return (
    <div className="space-y-3 pb-2">

      {/* Controles */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-500">
          {isPolling ? 'Recibiendo datos...' : 'En pausa'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setDrivingMode(true)}
            className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium bg-gray-800 text-gray-400"
          >
            🚗
          </button>
          <button
            onClick={() => isPolling ? stopPolling() : startPolling(PIDS)}
            className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium ${
              isPolling ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'
            }`}
          >
            {isPolling ? '⏸ Pausar' : '▶ Iniciar'}
          </button>
        </div>
      </div>

      {/* Indicadores de alerta */}
      <WarningLights
        coolantTemp={d05?.value}
        fuelLevel={d2F?.value}
        milOn={dtcResult?.milOn ?? false}
        hasData={anyData}
      />

      {/* Chips de estado: batería + tiempo de marcha */}
      {(d42 !== undefined || d1F !== undefined) && (
        <div className="flex gap-2">
          {d42 !== undefined && (
            <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">🔋 Batería</span>
              <span className={`text-sm font-mono font-semibold ${voltageColor(d42.value)}`}>
                {d42.value.toFixed(1)}V
              </span>
            </div>
          )}
          {d1F !== undefined && (
            <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">⏱ Marcha</span>
              <span className="text-sm font-mono text-gray-300">
                {formatRuntime(d1F.value)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Diales grandes: RPM + Velocidad */}
      <div className="grid grid-cols-2 gap-3">
        <DialGauge
          pid="0C" name="RPM" unit="rpm"
          value={d0C?.value ?? 0} min={0} max={6000}
          hasData={d0C !== undefined} size="lg" redlineAt={85}
        />
        <DialGauge
          pid="0D" name="Velocidad" unit="km/h"
          value={d0D?.value ?? 0} min={0} max={220}
          hasData={d0D !== undefined} size="lg"
        />
      </div>

      {/* Diales secundarios */}
      <div className="grid grid-cols-4 gap-2">
        <DialGauge
          pid="05" name="Refrig." unit="°C"
          value={d05?.value ?? 0} min={-40} max={130}
          hasData={d05 !== undefined} size="sm" redlineAt={88}
        />
        <DialGauge
          pid="04" name="Carga" unit="%"
          value={d04?.value ?? 0} min={0} max={100}
          hasData={d04 !== undefined} size="sm"
        />
        <DialGauge
          pid="2F" name="Comb." unit="%"
          value={d2F?.value ?? 0} min={0} max={100}
          hasData={d2F !== undefined} size="sm"
        />
        <DialGauge
          pid="0F" name="Admis." unit="°C"
          value={d0F?.value ?? 0} min={-40} max={80}
          hasData={d0F !== undefined} size="sm"
        />
      </div>

      {/* Gráficas históricas */}
      <SensorGraph pid="0C" name="Historial RPM" unit="rpm" color="#22c55e" />
      <SensorGraph pid="0D" name="Historial Velocidad" unit="km/h" color="#60a5fa" />

    </div>
  )
}
