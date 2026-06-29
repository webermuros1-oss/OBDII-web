import { useState } from 'react'
import { useOBDStore } from '../store/obdStore'
import { readMonitors } from '../lib/obd-monitors'
import type { MonitorsResult } from '../lib/obd-monitors'

function MonitorRow({ nameEs, supported, ready }: { nameEs: string; supported: boolean; ready: boolean }) {
  if (!supported) {
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0">
        <div className="w-3 h-3 rounded-full bg-gray-700 shrink-0" />
        <span className="flex-1 text-gray-500 text-sm">{nameEs}</span>
        <span className="text-xs text-gray-600">No soportado</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0">
      <div
        className={`w-3 h-3 rounded-full shrink-0 ${
          ready ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className={`flex-1 text-sm ${ready ? 'text-gray-200' : 'text-gray-300'}`}>
        {nameEs}
      </span>
      {ready ? (
        <span className="text-xs font-medium text-green-400">Listo ✓</span>
      ) : (
        <span className="text-xs font-medium text-red-400">Incompleto</span>
      )}
    </div>
  )
}

export function ITVReadiness() {
  const { connectionStatus } = useOBDStore()
  const isConnected = connectionStatus === 'connected'

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<MonitorsResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleRead = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await readMonitors()
      if (data.monitors.length === 0) {
        setError('No se pudo leer la respuesta del vehículo. Comprueba la conexión e inténtalo de nuevo.')
        setResult(null)
      } else {
        setResult(data)
      }
    } catch {
      setError('Error al comunicarse con el vehículo.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const allReady =
    result !== null &&
    result.monitors.filter((m) => m.supported).every((m) => m.ready)

  const supportedCount = result ? result.monitors.filter((m) => m.supported).length : 0
  const readyCount = result ? result.monitors.filter((m) => m.supported && m.ready).length : 0

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Monitores de diagnóstico del vehículo</p>

      <button
        onClick={handleRead}
        disabled={!isConnected || loading}
        className="w-full min-h-[44px] py-3 bg-blue-600/20 text-blue-400 disabled:opacity-50 rounded-lg text-sm font-medium"
      >
        {loading ? 'Leyendo monitores...' : '🔍 Leer monitores'}
      </button>

      {!isConnected && (
        <p className="text-center text-gray-600 text-sm py-2">
          Conecta el ELM327 para leer los monitores
        </p>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* MIL indicator */}
          <div
            className={`flex items-center gap-3 p-3 rounded-xl ${
              result.milOn
                ? 'bg-red-500/10 border border-red-500/30'
                : 'bg-green-500/10 border border-green-500/30'
            }`}
          >
            <span className="text-2xl">{result.milOn ? '⚠️' : '✅'}</span>
            <div>
              <p
                className={`font-medium text-sm ${
                  result.milOn ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {result.milOn ? 'Luz de avería ENCENDIDA' : 'Sin averías activas'}
              </p>
              {result.dtcCount > 0 && (
                <p className="text-gray-500 text-xs">
                  {result.dtcCount} código(s) DTC almacenado(s)
                </p>
              )}
            </div>
          </div>

          {/* Overall readiness summary */}
          <div
            className={`flex items-center gap-3 p-3 rounded-xl ${
              allReady
                ? 'bg-green-500/10 border border-green-500/30'
                : 'bg-yellow-500/10 border border-yellow-500/30'
            }`}
          >
            <span className="text-2xl">{allReady ? '🟢' : '🟡'}</span>
            <div>
              <p
                className={`font-medium text-sm ${
                  allReady ? 'text-green-400' : 'text-yellow-400'
                }`}
              >
                {allReady
                  ? 'Vehículo preparado para la ITV'
                  : 'Monitores pendientes de completar'}
              </p>
              <p className="text-gray-500 text-xs">
                {readyCount} de {supportedCount} monitores listos
              </p>
            </div>
          </div>

          {/* Monitor list */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4">
            {result.monitors.map((m) => (
              <MonitorRow
                key={m.name}
                nameEs={m.nameEs}
                supported={m.supported}
                ready={m.ready}
              />
            ))}
          </div>

          {/* Info footer */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 space-y-1.5">
            <p className="text-xs text-gray-400">
              Todos los monitores deben estar en verde para pasar la ITV.
            </p>
            <p className="text-xs text-gray-600">
              En motores diésel es normal que los monitores de catalizador y sonda lambda aparezcan como «No soportado».
            </p>
          </div>
        </div>
      )}

      {!result && !error && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">
            {isConnected
              ? 'Pulsa «Leer monitores» para comprobar el estado de los sistemas'
              : 'Conecta el ELM327 para comprobar la preparación para la ITV'}
          </p>
        </div>
      )}
    </div>
  )
}
