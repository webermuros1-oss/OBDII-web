import { useOBDStore } from '../store/obdStore'
import { LiveChart } from '../components/dashboard/LiveChart'
import { useLiveData } from '../hooks/useLiveData'

const CHART_PIDS = [
  { pid: '0C', name: 'RPM', unit: 'rpm', color: '#22c55e' },
  { pid: '0D', name: 'Velocidad', unit: 'km/h', color: '#3b82f6' },
  { pid: '05', name: 'Temp. refrigerante', unit: '°C', color: '#f59e0b' },
  { pid: '11', name: 'Posición mariposa', unit: '%', color: '#8b5cf6' },
]

export function LiveData() {
  const { liveHistory, connectionStatus, isPolling } = useOBDStore()
  const { startPolling, stopPolling } = useLiveData()
  const isConnected = connectionStatus === 'connected'

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Gráficas de sensores en tiempo real</p>

      {isConnected && (
        <button
          onClick={() =>
            isPolling
              ? stopPolling()
              : startPolling(CHART_PIDS.map((p) => p.pid))
          }
          className={`w-full py-3 min-h-[44px] rounded-lg text-sm font-medium ${
            isPolling
              ? 'bg-red-600/20 text-red-400'
              : 'bg-green-600/20 text-green-400'
          }`}
        >
          {isPolling ? '⏸ Detener' : '▶ Iniciar lectura'}
        </button>
      )}

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-5xl mb-4">📈</div>
          <p className="text-gray-400">Conecta tu ELM327 para ver las gráficas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {CHART_PIDS.map(({ pid, name, unit, color }) => (
            <div key={pid} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-300">{name}</span>
                <span className="text-xs text-gray-500">{unit}</span>
              </div>
              <LiveChart data={liveHistory[pid] ?? []} unit={unit} color={color} height={200} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
