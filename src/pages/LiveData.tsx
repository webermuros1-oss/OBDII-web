import { useOBDStore } from '../store/obdStore'
import { LiveChart } from '../components/dashboard/LiveChart'
import { useLiveData } from '../hooks/useLiveData'

interface PIDConfig {
  pid: string
  name: string
  unit: string
  color: string
  // Rangos: [min_warn, max_warn] — fuera de este rango = amarillo; critical si supera criticalAbove o baja de criticalBelow
  warnAbove?: number
  criticalAbove?: number
  warnBelow?: number
  criticalBelow?: number
}

const CHART_PIDS: PIDConfig[] = [
  { pid: '0C', name: 'RPM',                  unit: 'rpm',  color: '#22c55e', warnAbove: 4500, criticalAbove: 5500 },
  { pid: '0D', name: 'Velocidad',            unit: 'km/h', color: '#3b82f6' },
  { pid: '05', name: 'Temp. refrigerante',   unit: '°C',   color: '#f59e0b', warnAbove: 100, criticalAbove: 110 },
  { pid: '04', name: 'Carga del motor',      unit: '%',    color: '#a855f7', warnAbove: 80, criticalAbove: 95 },
  { pid: '10', name: 'Flujo aire (MAF)',     unit: 'g/s',  color: '#10b981' },
  { pid: '11', name: 'Posición acelerador',  unit: '%',    color: '#8b5cf6' },
  { pid: '0B', name: 'Presión admisión MAP', unit: 'kPa',  color: '#f472b6' },
  { pid: '2F', name: 'Nivel combustible',    unit: '%',    color: '#f97316', warnBelow: 20, criticalBelow: 10 },
  { pid: '42', name: 'Voltaje batería',      unit: 'V',    color: '#06b6d4', warnBelow: 12.5, criticalBelow: 12.0 },
  { pid: '14', name: 'Sonda O₂ (banco 1)',   unit: 'V',    color: '#e879f9', warnAbove: 0.8, criticalAbove: 0.9 },
  { pid: '0A', name: 'Presión combustible',  unit: 'kPa',  color: '#fb923c', warnBelow: 200, criticalBelow: 150 },
  { pid: '0F', name: 'Temp. admisión',       unit: '°C',   color: '#94a3b8', warnAbove: 50, criticalAbove: 65 },
]

function valueColor(value: number, cfg: PIDConfig): string {
  if (cfg.criticalAbove !== undefined && value >= cfg.criticalAbove) return 'text-red-400'
  if (cfg.criticalBelow !== undefined && value <= cfg.criticalBelow) return 'text-red-400'
  if (cfg.warnAbove !== undefined && value >= cfg.warnAbove) return 'text-yellow-400'
  if (cfg.warnBelow !== undefined && value <= cfg.warnBelow) return 'text-yellow-400'
  return 'text-green-400'
}

function formatValue(value: number, pid: string): string {
  if (pid === '0C') return Math.round(value).toString()
  if (pid === '42') return value.toFixed(1)
  if (['04', '11', '2F', '0D'].includes(pid)) return Math.round(value).toString()
  return value.toFixed(1)
}

export function LiveData() {
  const { liveData, liveHistory, connectionStatus, isPolling } = useOBDStore()
  const { startPolling, stopPolling } = useLiveData()
  const isConnected = connectionStatus === 'connected'

  const allPids = CHART_PIDS.map((p) => p.pid)

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Gráficas de sensores en tiempo real</p>

      {isConnected && (
        <button
          onClick={() => isPolling ? stopPolling() : startPolling(allPids)}
          className={`w-full py-3 min-h-[44px] rounded-lg text-sm font-medium ${
            isPolling ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'
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
          {CHART_PIDS.map((cfg) => {
            const current = liveData[cfg.pid]
            const history = liveHistory[cfg.pid] ?? []
            const values = history.map((p) => p.value)
            const minVal = values.length > 0 ? Math.min(...values) : null
            const maxVal = values.length > 0 ? Math.max(...values) : null

            return (
              <div key={cfg.pid} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                {/* Header: nombre + valor actual coloreado */}
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-medium text-gray-300">{cfg.name}</span>
                  {current !== undefined ? (
                    <span className={`text-base font-mono font-semibold ${valueColor(current.value, cfg)}`}>
                      {formatValue(current.value, cfg.pid)}
                      <span className="text-xs text-gray-500 ml-1">{cfg.unit}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-gray-600">— {cfg.unit}</span>
                  )}
                </div>

                {/* Min/max de la sesión actual */}
                {minVal !== null && maxVal !== null && (
                  <div className="flex gap-4 mb-2">
                    <span className="text-[10px] text-gray-600">
                      Mín <span className="text-gray-500 font-mono">{formatValue(minVal, cfg.pid)} {cfg.unit}</span>
                    </span>
                    <span className="text-[10px] text-gray-600">
                      Máx <span className={`font-mono ${valueColor(maxVal, cfg)}`}>{formatValue(maxVal, cfg.pid)} {cfg.unit}</span>
                    </span>
                  </div>
                )}

                <LiveChart data={history} unit={cfg.unit} color={cfg.color} height={140} />

                {/* Indicador de zona de riesgo si el valor es crítico */}
                {current !== undefined &&
                  ((cfg.criticalAbove !== undefined && current.value >= cfg.criticalAbove) ||
                   (cfg.criticalBelow !== undefined && current.value <= cfg.criticalBelow)) && (
                  <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>
                      {cfg.criticalAbove !== undefined && current.value >= cfg.criticalAbove
                        ? `Valor muy alto — límite seguro ${cfg.criticalAbove} ${cfg.unit}`
                        : `Valor muy bajo — mínimo seguro ${cfg.criticalBelow} ${cfg.unit}`}
                    </span>
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
