import { useEffect } from 'react'
import { useOBDStore } from '../store/obdStore'
import { SensorCard } from '../components/dashboard/SensorCard'
import { useLiveData } from '../hooks/useLiveData'

const DASHBOARD_PIDS = [
  { pid: '0C', name: 'RPM', unit: 'rpm', min: 0, max: 8000 },
  { pid: '0D', name: 'Velocidad', unit: 'km/h', min: 0, max: 260 },
  { pid: '05', name: 'Temp. refrigerante', unit: '°C', min: -40, max: 130 },
  { pid: '11', name: 'Posición mariposa', unit: '%', min: 0, max: 100 },
  { pid: '04', name: 'Carga motor', unit: '%', min: 0, max: 100 },
  { pid: '0F', name: 'Temp. admisión', unit: '°C', min: -40, max: 80 },
  { pid: '2F', name: 'Nivel combustible', unit: '%', min: 0, max: 100 },
  { pid: '0E', name: 'Avance encendido', unit: '°', min: -64, max: 64 },
]

export function Dashboard() {
  const { liveData, connectionStatus, isPolling } = useOBDStore()
  const { startPolling, stopPolling } = useLiveData()

  const isConnected = connectionStatus === 'connected'

  // Auto-start polling when we connect
  useEffect(() => {
    if (isConnected && !isPolling) {
      startPolling(DASHBOARD_PIDS.map((p) => p.pid))
    }
    if (!isConnected && isPolling) {
      stopPolling()
    }
  }, [isConnected])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Datos en tiempo real del vehículo</p>
        {isConnected && (
          <button
            onClick={() =>
              isPolling
                ? stopPolling()
                : startPolling(DASHBOARD_PIDS.map((p) => p.pid))
            }
            className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium ${
              isPolling
                ? 'bg-red-600/20 text-red-400'
                : 'bg-green-600/20 text-green-400'
            }`}
          >
            {isPolling ? '⏸ Pausar' : '▶ Iniciar'}
          </button>
        )}
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-6xl mb-4">🔌</div>
          <p className="text-gray-400 text-lg">Conecta tu ELM327 para comenzar</p>
          <p className="text-gray-600 text-sm mt-2">Usa el botón Conectar en la cabecera</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {DASHBOARD_PIDS.map(({ pid, name, unit, min, max }) => {
            const data = liveData[pid]
            return (
              <SensorCard
                key={pid}
                pid={pid}
                name={name}
                value={data?.value ?? 0}
                unit={unit}
                min={min}
                max={max}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
