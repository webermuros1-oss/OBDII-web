import { useOBDStore } from '../store/obdStore'
import { useDTC } from '../hooks/useDTC'
import type { DTCCodeDTO } from '../types/obd'

function DTCCard({ dtc }: { dtc: DTCCodeDTO }) {
  const badge = dtc.isPermanent ? 'PERMANENTE' : dtc.isPending ? 'PENDIENTE' : 'ACTIVO'
  const badgeColor = dtc.isPermanent
    ? 'bg-red-500/20 text-red-400'
    : dtc.isPending
    ? 'bg-yellow-500/20 text-yellow-400'
    : 'bg-orange-500/20 text-orange-400'

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-white text-base">{dtc.code}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
      </div>
      <p className="text-gray-300 text-sm">{dtc.descriptionEs || dtc.description}</p>
      {dtc.descriptionEs && dtc.description !== dtc.descriptionEs && (
        <p className="text-gray-600 text-xs italic">{dtc.description}</p>
      )}
    </div>
  )
}

export function DtcManager() {
  const { dtcResult, dtcLoading, connectionStatus } = useOBDStore()
  const { readDTCs, clearDTCs } = useDTC()
  const isConnected = connectionStatus === 'connected'

  const totalDTCs = dtcResult
    ? dtcResult.stored.length + dtcResult.pending.length + dtcResult.permanent.length
    : 0

  const handleClear = async () => {
    if (window.confirm('¿Borrar todos los códigos DTC?')) {
      await clearDTCs()
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Diagnóstico de averías del vehículo</p>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => readDTCs()}
          disabled={!isConnected || dtcLoading}
          className="flex-1 min-h-[44px] py-2 bg-blue-600/20 text-blue-400 disabled:opacity-50 rounded-lg text-sm font-medium"
        >
          {dtcLoading ? 'Leyendo...' : '🔍 Leer DTCs'}
        </button>
        {dtcResult && totalDTCs > 0 && (
          <button
            onClick={handleClear}
            disabled={!isConnected}
            className="w-full min-h-[44px] py-3 bg-red-600 text-white disabled:opacity-50 rounded-lg text-sm font-medium"
          >
            🗑 Borrar DTCs
          </button>
        )}
      </div>

      {/* MIL indicator */}
      {dtcResult && (
        <div
          className={`flex items-center gap-3 p-3 rounded-xl ${
            dtcResult.milOn
              ? 'bg-red-500/10 border border-red-500/30'
              : 'bg-green-500/10 border border-green-500/30'
          }`}
        >
          <span className="text-2xl">{dtcResult.milOn ? '⚠️' : '✅'}</span>
          <div>
            <p className={`font-medium text-sm ${dtcResult.milOn ? 'text-red-400' : 'text-green-400'}`}>
              {dtcResult.milOn ? 'Luz de avería ENCENDIDA' : 'Sin averías activas'}
            </p>
            <p className="text-gray-500 text-xs">
              {totalDTCs} código(s) encontrado(s)
              {dtcResult.incompleteTests > 0 && (
                <span className="ml-2 text-yellow-500">
                  · {dtcResult.incompleteTests} test(s) incompleto(s)
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* DTC lists */}
      {dtcResult ? (
        <div className="space-y-5">
          {dtcResult.stored.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Almacenados ({dtcResult.stored.length})
              </h2>
              <div className="space-y-2">
                {dtcResult.stored.map((d) => (
                  <DTCCard key={d.code} dtc={d} />
                ))}
              </div>
            </section>
          )}
          {dtcResult.pending.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Pendientes ({dtcResult.pending.length})
              </h2>
              <div className="space-y-2">
                {dtcResult.pending.map((d) => (
                  <DTCCard key={d.code} dtc={d} />
                ))}
              </div>
            </section>
          )}
          {dtcResult.permanent.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Permanentes ({dtcResult.permanent.length})
              </h2>
              <div className="space-y-2">
                {dtcResult.permanent.map((d) => (
                  <DTCCard key={d.code} dtc={d} />
                ))}
              </div>
            </section>
          )}
          {totalDTCs === 0 && (
            <div className="text-center py-10 text-gray-500 text-sm">
              No se encontraron códigos DTC
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm">
            {isConnected
              ? 'Pulsa "Leer DTCs" para escanear el vehículo'
              : 'Conecta el ELM327 para leer los DTCs'}
          </p>
        </div>
      )}
    </div>
  )
}
