import { useState } from 'react'
import { useOBDStore } from '../store/obdStore'
import { useDTCHistoryStore } from '../store/dtcHistoryStore'
import { useDTC } from '../hooks/useDTC'
import { obd } from '../lib/obd'
import type { DTCCodeDTO, FreezeFrameEntryDTO } from '../types/obd'

function openDTCInfo(code: string) {
  // Opens the system browser with DTC info; _system forces external browser in Capacitor
  window.open(`https://www.obd-codes.com/${code.toLowerCase()}`, '_system')
}

function DTCCard({ dtc }: { dtc: DTCCodeDTO }) {
  const badge = dtc.isPermanent ? 'PERMANENTE' : dtc.isPending ? 'PENDIENTE' : 'ACTIVO'
  const badgeColor = dtc.isPermanent
    ? 'bg-red-500/20 text-red-400'
    : dtc.isPending
    ? 'bg-yellow-500/20 text-yellow-400'
    : 'bg-orange-500/20 text-orange-400'

  const categoryLabel: Record<string, string> = {
    P: 'Motor/transmisión',
    C: 'Chasis',
    B: 'Carrocería',
    U: 'Red CAN',
  }

  return (
    <button
      onClick={() => openDTCInfo(dtc.code)}
      className="w-full bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2 text-left active:bg-gray-800 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-white text-base">{dtc.code}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
          <span className="text-gray-600 text-xs">🔗 Info</span>
        </div>
      </div>
      <p className="text-gray-300 text-sm">{dtc.descriptionEs || dtc.description}</p>
      <p className="text-gray-600 text-xs">{categoryLabel[dtc.category] ?? dtc.category} · Toca para más información</p>
    </button>
  )
}

function formatFreezeValue(entry: FreezeFrameEntryDTO): string {
  const v = entry.value
  if (entry.pid === '0C') return Math.round(v).toString()
  if (['04', '11'].includes(entry.pid)) return Math.round(v) + '%'
  if (['06', '07'].includes(entry.pid)) return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
  if (entry.pid === '10') return v.toFixed(2)
  return Number.isInteger(v) ? v.toString() : v.toFixed(1)
}

function FreezeFrameSection({ isConnected }: { isConnected: boolean }) {
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<FreezeFrameEntryDTO[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const handleRead = async () => {
    setLoading(true)
    setError(null)
    const result = await obd.readFreezeFrame()
    setLoading(false)
    if (!result.ok) {
      setError('No se pudo leer la instantánea')
      return
    }
    if (result.data.entries.length === 0) {
      setError('El vehículo no tiene datos de instantánea disponibles')
      return
    }
    setEntries(result.data.entries)
    setExpanded(true)
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"
        >
          {expanded ? '▾' : '▸'} Instantánea del fallo (Freeze Frame)
        </button>
        <button
          onClick={handleRead}
          disabled={!isConnected || loading}
          className="text-xs px-2.5 py-1 rounded-lg bg-purple-600/20 text-purple-400 disabled:opacity-40"
        >
          {loading ? 'Leyendo...' : '📸 Leer'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-gray-600 pl-3">{error}</p>
      )}

      {expanded && entries && entries.length > 0 && (
        <div className="bg-gray-900 border border-purple-500/20 rounded-xl p-3 space-y-2">
          <p className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold">
            Valores registrados en el momento del fallo
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {entries.map((e) => (
              <div key={e.pid} className="flex items-center justify-between">
                <span className="text-xs text-gray-400 truncate">{e.name}</span>
                <span className="text-xs font-mono text-gray-100 ml-1 shrink-0">
                  {formatFreezeValue(e)} <span className="text-gray-600">{e.unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function ClearedHistorySection() {
  const { history, clearHistory } = useDTCHistoryStore()
  const [expanded, setExpanded] = useState(false)

  if (history.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1"
        >
          {expanded ? '▾' : '▸'} Historial de borrados ({history.length})
        </button>
        <button
          onClick={clearHistory}
          className="text-xs text-gray-600 underline"
        >
          Limpiar
        </button>
      </div>

      {expanded && (
        <div className="space-y-3">
          {history.map((entry, i) => (
            <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-3 space-y-2">
              <p className="text-xs text-gray-500">
                Borrados el {new Date(entry.clearedAt).toLocaleString('es-ES')}
              </p>
              <div className="flex flex-wrap gap-2">
                {entry.codes.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => openDTCInfo(c.code)}
                    className="font-mono text-xs px-2 py-1 bg-gray-800 text-yellow-400 rounded border border-gray-700"
                  >
                    {c.code}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function DtcManager() {
  const { dtcResult, dtcLoading, connectionStatus } = useOBDStore()
  const { readDTCs, clearDTCs } = useDTC()
  const { addEntry } = useDTCHistoryStore()
  const isConnected = connectionStatus === 'connected'

  const allDTCs: DTCCodeDTO[] = dtcResult
    ? [...dtcResult.stored, ...dtcResult.pending, ...dtcResult.permanent]
    : []

  const handleClear = async () => {
    if (!window.confirm('¿Borrar todos los códigos DTC del vehículo?\n\nSe guardarán en el historial antes de borrarlos.')) return
    // Save current codes to history before clearing
    if (allDTCs.length > 0) addEntry(allDTCs)
    await clearDTCs()
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
        {dtcResult && allDTCs.length > 0 && (
          <button
            onClick={handleClear}
            disabled={!isConnected}
            className="w-full min-h-[44px] py-3 bg-red-600 text-white disabled:opacity-50 rounded-lg text-sm font-medium"
          >
            🗑 Borrar DTCs del vehículo
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
              {allDTCs.length} código(s) encontrado(s)
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
                  <DTCCard key={d.code + d.isPending} dtc={d} />
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
                  <DTCCard key={d.code + d.isPending} dtc={d} />
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
                  <DTCCard key={d.code + d.isPending} dtc={d} />
                ))}
              </div>
            </section>
          )}
          {allDTCs.length === 0 && (
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

      {/* Freeze Frame — solo visible cuando hay DTCs almacenados */}
      {dtcResult && dtcResult.stored.length > 0 && (
        <FreezeFrameSection isConnected={isConnected} />
      )}

      {/* Cleared DTCs history */}
      <ClearedHistorySection />
    </div>
  )
}
