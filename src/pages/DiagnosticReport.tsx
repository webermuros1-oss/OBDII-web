import { useState } from 'react'
import { useOBDStore } from '../store/obdStore'
import { useVehicleProfileStore } from '../store/vehicleProfileStore'
import { useDTCHistoryStore } from '../store/dtcHistoryStore'
import type { LiveDataDTO, DTCCodeDTO } from '../types/obd'

const PID_LABELS: Record<string, string> = {
  '0C': 'RPM',
  '0D': 'Velocidad',
  '05': 'Temp. refrigerante',
  '04': 'Carga motor',
  '0F': 'Temp. admisión',
}

function formatLiveValue(d: LiveDataDTO): string {
  return `${d.value} ${d.unit}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function useReportData() {
  const { vehicleInfo, dtcResult, liveData } = useOBDStore()
  const { getActiveProfile } = useVehicleProfileStore()
  const { history } = useDTCHistoryStore()
  const profile = getActiveProfile() ?? { make: '', model: '', year: '', engine: '', fuel: 'Gasolina' as const }
  return { vehicleInfo, dtcResult, liveData, profile, history }
}

function generateReportText(params: ReturnType<typeof useReportData>): string {
  const { vehicleInfo, dtcResult, liveData, profile, history } = params
  const now = new Date().toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const vehicleLine = [profile.make, profile.model, profile.year].filter(Boolean).join(' ') || 'Vehículo desconocido'
  const engineLine = [profile.engine, profile.fuel].filter(Boolean).join(' | ')

  const lines: string[] = [
    '═══════════════════════════════',
    '  INFORME DE DIAGNÓSTICO OBD-II',
    '═══════════════════════════════',
    `Fecha: ${now}`,
    `Vehículo: ${vehicleLine}`,
  ]

  if (engineLine) lines.push(`Motor: ${engineLine}`)
  if (vehicleInfo?.vin) lines.push(`VIN: ${vehicleInfo.vin}`)
  if (vehicleInfo?.protocolName) lines.push(`Protocolo: ${vehicleInfo.protocolName}`)

  lines.push('')
  lines.push('CÓDIGOS DE AVERÍA')
  lines.push('─────────────────')

  const allDTCs: DTCCodeDTO[] = dtcResult
    ? [...dtcResult.stored, ...dtcResult.pending, ...dtcResult.permanent]
    : []

  const uniqueDTCs = allDTCs.filter(
    (d, i, arr) => arr.findIndex((x) => x.code === d.code) === i
  )

  if (uniqueDTCs.length === 0) {
    lines.push('Sin códigos de fallo activos')
  } else {
    if (dtcResult?.milOn) lines.push('MIL: ENCENDIDA')
    uniqueDTCs.forEach((d) => {
      lines.push(`⚠️  ${d.code} - ${d.descriptionEs || d.description}`)
      const estado = d.isPermanent ? 'PERMANENTE' : 'ACTIVO'
      lines.push(`    Estado: ${estado} | Pendiente: ${d.isPending ? 'Sí' : 'No'}`)
    })
  }

  const pidOrder = ['0C', '0D', '05', '04', '0F']
  const relevantPids = pidOrder.filter((pid) => liveData[pid] !== undefined)

  if (relevantPids.length > 0) {
    lines.push('')
    lines.push('DATOS EN VIVO (último registro)')
    lines.push('────────────────────────────────')
    relevantPids.forEach((pid) => {
      lines.push(`${PID_LABELS[pid]}: ${formatLiveValue(liveData[pid])}`)
    })
  }

  if (history.length > 0) {
    lines.push('')
    lines.push('HISTORIAL DE BORRADOS')
    lines.push('──────────────────────')
    history.forEach((entry) => {
      const date = formatDate(entry.clearedAt)
      const codes = entry.codes.map((c) => c.code).join(', ')
      lines.push(`${date}: ${codes || 'sin códigos'} (borrado manualmente)`)
    })
  }

  lines.push('')
  lines.push('═══════════════════════════════')
  lines.push('Generado con OBD-II Diagnostics')
  lines.push('═══════════════════════════════')

  return lines.join('\n')
}

function DTCBadge({ dtc }: { dtc: DTCCodeDTO }) {
  const isPending = dtc.isPending && !dtc.isPermanent
  const label = dtc.isPermanent ? 'PERMANENTE' : isPending ? 'PENDIENTE' : 'ACTIVO'
  const color = dtc.isPermanent
    ? 'bg-orange-900/60 text-orange-300 border-orange-700'
    : isPending
    ? 'bg-yellow-900/60 text-yellow-300 border-yellow-700'
    : 'bg-red-900/60 text-red-300 border-red-700'

  return (
    <span className={`text-xs border rounded px-1.5 py-0.5 ${color}`}>
      {label}
    </span>
  )
}

export function DiagnosticReport() {
  const reportData = useReportData()
  const { vehicleInfo, dtcResult, liveData, profile, history } = reportData
  const [copied, setCopied] = useState(false)

  const hasData = vehicleInfo !== null || dtcResult !== null

  const share = async () => {
    const text = generateReportText(reportData)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Informe diagnóstico OBD-II', text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {}
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateReportText(reportData))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const vehicleLabel = [profile.make, profile.model, profile.year].filter(Boolean).join(' ')
  const engineLabel = [profile.engine, profile.fuel].filter(Boolean).join(' · ')

  const allDTCs: DTCCodeDTO[] = dtcResult
    ? [...dtcResult.stored, ...dtcResult.pending, ...dtcResult.permanent]
    : []

  const uniqueDTCs = allDTCs.filter(
    (d, i, arr) => arr.findIndex((x) => x.code === d.code) === i
  )

  const pidOrder = ['0C', '0D', '05', '04', '0F']
  const relevantPids = pidOrder.filter((pid) => liveData[pid] !== undefined)

  if (!hasData) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-5xl mb-4">🔌</div>
        <p className="text-gray-400 text-base leading-relaxed max-w-xs">
          Conecta el ELM327 y lee los datos del vehículo para generar un informe
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 pb-8 flex flex-col gap-4">
      <h1 className="text-xl font-bold text-white">Informe de diagnóstico</h1>

      {/* Preview card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-4">

        {/* Vehicle header */}
        <div className="border-b border-gray-800 pb-3">
          <p className="text-white font-semibold text-base">
            {vehicleLabel || 'Vehículo'}
          </p>
          {engineLabel && (
            <p className="text-gray-400 text-sm mt-0.5">{engineLabel}</p>
          )}
          <p className="text-gray-500 text-xs mt-1">
            {new Date().toLocaleString('es-ES', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>

        {/* VIN + Protocol */}
        {(vehicleInfo?.vin || vehicleInfo?.protocolName) && (
          <div className="flex flex-col gap-1 border-b border-gray-800 pb-3">
            {vehicleInfo.vin && (
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-400 text-sm shrink-0">VIN</span>
                <span className="text-gray-200 text-sm font-mono text-right break-all">
                  {vehicleInfo.vin}
                </span>
              </div>
            )}
            {vehicleInfo.protocolName && (
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-400 text-sm shrink-0">Protocolo</span>
                <span className="text-gray-200 text-sm text-right">
                  {vehicleInfo.protocolName}
                </span>
              </div>
            )}
          </div>
        )}

        {/* DTCs */}
        <div className="flex flex-col gap-2 border-b border-gray-800 pb-3">
          <p className="text-gray-300 text-sm font-semibold uppercase tracking-wide">
            Códigos de avería
          </p>
          {dtcResult?.milOn && (
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-sm font-medium">MIL encendida</span>
            </div>
          )}
          {uniqueDTCs.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-base">✅</span>
              <span className="text-green-400 text-sm">Sin códigos de fallo</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {uniqueDTCs.map((d) => (
                <div
                  key={d.code}
                  className="bg-gray-800 rounded-lg p-3 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-red-400 font-mono font-semibold text-sm">
                      {d.code}
                    </span>
                    <DTCBadge dtc={d} />
                  </div>
                  <p className="text-gray-300 text-xs leading-snug">
                    {d.descriptionEs || d.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live data */}
        {relevantPids.length > 0 && (
          <div className="flex flex-col gap-2 border-b border-gray-800 pb-3">
            <p className="text-gray-300 text-sm font-semibold uppercase tracking-wide">
              Datos en vivo (último registro)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {relevantPids.map((pid) => {
                const d = liveData[pid]
                return (
                  <div key={pid} className="bg-gray-800 rounded-lg p-2.5">
                    <p className="text-gray-400 text-xs">{PID_LABELS[pid]}</p>
                    <p className="text-white text-sm font-semibold mt-0.5">
                      {formatLiveValue(d)}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* DTC clear history */}
        {history.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-gray-300 text-sm font-semibold uppercase tracking-wide">
              Historial de borrados
            </p>
            <div className="flex flex-col gap-1.5">
              {history.map((entry, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <span className="text-gray-500 text-xs">{formatDate(entry.clearedAt)}</span>
                  <span className="text-gray-300 text-xs text-right">
                    {entry.codes.length > 0
                      ? entry.codes.map((c) => c.code).join(', ')
                      : 'sin códigos'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 mt-2">
        <button
          onClick={share}
          className="w-full bg-green-600 active:bg-green-700 text-white font-semibold rounded-lg min-h-[44px] px-4 flex items-center justify-center gap-2 transition-colors"
        >
          <span>📤</span>
          <span>Compartir informe</span>
        </button>
        <button
          onClick={copyToClipboard}
          className="w-full bg-gray-800 active:bg-gray-700 text-gray-300 font-semibold rounded-lg min-h-[44px] px-4 flex items-center justify-center gap-2 transition-colors"
        >
          <span>{copied ? '✅' : '📋'}</span>
          <span>{copied ? 'Copiado' : 'Copiar al portapapeles'}</span>
        </button>
      </div>
    </div>
  )
}
