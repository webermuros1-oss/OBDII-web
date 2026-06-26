import { useOBDStore } from '../store/obdStore'
import { LiveChart } from '../components/dashboard/LiveChart'

const CHART_PIDS = [
  { pid: '0C', name: 'RPM', unit: 'rpm', color: '#22c55e' },
  { pid: '0D', name: 'Velocidad', unit: 'km/h', color: '#3b82f6' },
  { pid: '05', name: 'Temp. refrigerante', unit: '°C', color: '#f59e0b' },
  { pid: '11', name: 'Posición mariposa', unit: '%', color: '#8b5cf6' },
]

export function LiveData() {
  const { liveHistory, connectionStatus } = useOBDStore()
  const isConnected = connectionStatus === 'connected'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Datos en vivo</h1>
        <p className="text-gray-500 text-sm mt-1">Gráficas de sensores en tiempo real</p>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-5xl mb-4">📈</div>
          <p className="text-gray-400">Conecta tu ELM327 para ver las gráficas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {CHART_PIDS.map(({ pid, name, unit, color }) => (
            <div key={pid} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-300">{name}</span>
                <span className="text-xs text-gray-500">{unit}</span>
              </div>
              <LiveChart data={liveHistory[pid] ?? []} unit={unit} color={color} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
