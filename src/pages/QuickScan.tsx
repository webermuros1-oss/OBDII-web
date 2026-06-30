import { useState } from 'react'
import { useOBDStore } from '../store/obdStore'
import { obd } from '../lib/obd'
import { readMonitors } from '../lib/obd-monitors'

type ScanStep = 'dtcs' | 'vehicle' | 'monitors' | 'freezeframe' | 'sensors' | 'done'

interface ScanResult {
  dtcCount: number
  milOn: boolean
  storedDTCs: string[]
  protocol: string
  readyCount: number
  totalMonitors: number
  hasFreezeFrame: boolean
  batteryVoltage: number | null
  fuelLevel: number | null
  coolantTemp: number | null
}

type HealthStatus = 'green' | 'yellow' | 'red'

function overallHealth(result: ScanResult): HealthStatus {
  if (result.milOn || result.dtcCount > 0) return 'red'
  if (result.readyCount < result.totalMonitors) return 'yellow'
  return 'green'
}

const STEP_LABELS: Record<ScanStep, string> = {
  dtcs: 'Leyendo códigos de fallo...',
  vehicle: 'Leyendo datos del vehículo...',
  monitors: 'Comprobando monitores ITV...',
  freezeframe: 'Buscando instantánea de fallo...',
  sensors: 'Leyendo sensores...',
  done: 'Análisis completo',
}

function ResultRow({ icon, label, detail, status }: {
  icon: string; label: string; detail: string; status: HealthStatus
}) {
  const dot = { green: 'bg-green-500', yellow: 'bg-yellow-400', red: 'bg-red-500' }[status]
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-0">
      <span className="text-base">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 truncate">{detail}</p>
      </div>
      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
    </div>
  )
}

export function QuickScan() {
  const { liveData, connectionStatus } = useOBDStore()
  const isConnected = connectionStatus === 'connected'
  const [scanning, setScanning] = useState(false)
  const [step, setStep] = useState<ScanStep>('done')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)

  const batteryVoltage = liveData['42']?.value ?? null
  const fuelLevel = liveData['2F']?.value ?? null
  const coolantTemp = liveData['05']?.value ?? null

  const runScan = async () => {
    setScanning(true)
    setStep('dtcs')

    const dtcRes = await obd.readDTCs()
    const dtcs = dtcRes.ok ? dtcRes.data : null

    setStep('vehicle')
    const vehicleRes = await obd.getVehicleInfo()
    const vehicleData = vehicleRes.ok ? vehicleRes.data : null

    setStep('monitors')
    const monitorsData = await readMonitors()

    setStep('freezeframe')
    let hasFreezeFrame = false
    if (dtcs && dtcs.stored.length > 0) {
      const ffRes = await obd.readFreezeFrame()
      hasFreezeFrame = ffRes.ok && ffRes.data.entries.length > 0
    }

    setStep('sensors')

    setStep('done')

    const result: ScanResult = {
      dtcCount: dtcs ? (dtcs.stored.length + dtcs.pending.length) : 0,
      milOn: dtcs?.milOn ?? false,
      storedDTCs: dtcs ? dtcs.stored.map(d => d.code) : [],
      protocol: vehicleData?.protocolName ?? 'Desconocido',
      readyCount: monitorsData.monitors.filter(m => m.supported && m.ready).length,
      totalMonitors: monitorsData.monitors.filter(m => m.supported).length,
      hasFreezeFrame,
      batteryVoltage: null,
      fuelLevel: null,
      coolantTemp: null,
    }

    setScanResult(result)
    setScanning(false)
  }

  const shareReport = async () => {
    if (!scanResult) return
    const health = overallHealth(scanResult)
    const healthLabel = { green: '✅ BIEN', yellow: '⚠️ ATENCIÓN', red: '🔴 FALLOS' }[health]
    const lines = [
      '═══════════════════════',
      '  ESCANEO OBD-II COMPLETO',
      '═══════════════════════',
      `Estado: ${healthLabel}`,
      `Fecha: ${new Date().toLocaleString('es-ES')}`,
      '',
      `DTCs: ${scanResult.dtcCount === 0 ? 'Sin fallos' : scanResult.storedDTCs.join(', ')}`,
      `MIL: ${scanResult.milOn ? 'ENCENDIDA' : 'Apagada'}`,
      `Protocolo: ${scanResult.protocol}`,
      `Monitores ITV: ${scanResult.readyCount}/${scanResult.totalMonitors} listos`,
      batteryVoltage !== null ? `Batería: ${batteryVoltage.toFixed(1)}V` : '',
      fuelLevel !== null ? `Combustible: ${Math.round(fuelLevel)}%` : '',
      coolantTemp !== null ? `Temperatura: ${Math.round(coolantTemp)}°C` : '',
      '',
      'Generado con OBD-II Diagnostics',
    ].filter((l) => l !== '')

    const text = lines.join('\n')
    try {
      if (navigator.share) await navigator.share({ title: 'Escaneo OBD-II', text })
      else await navigator.clipboard.writeText(text)
    } catch {
      try { await navigator.clipboard.writeText(text) } catch {}
    }
  }

  const stepOrder: ScanStep[] = ['dtcs', 'vehicle', 'monitors', 'freezeframe', 'sensors']

  return (
    <div className="space-y-4 pb-2">
      <p className="text-sm text-gray-500">Diagnóstico completo del sistema</p>

      {scanning ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-blue-400">{STEP_LABELS[step]}</p>
          </div>
          <div className="flex gap-1">
            {stepOrder.map((s, i) => {
              const currentIdx = stepOrder.indexOf(step)
              const done = i < currentIdx || step === 'done'
              const active = i === currentIdx
              return (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full ${done ? 'bg-blue-500' : active ? 'bg-blue-500/60' : 'bg-gray-800'}`}
                />
              )
            })}
          </div>
        </div>
      ) : (
        <button
          onClick={runScan}
          disabled={!isConnected}
          className="w-full min-h-[52px] bg-blue-600/20 text-blue-400 disabled:opacity-40 rounded-xl text-base font-semibold border border-blue-500/30"
        >
          🔍 Escaneo completo
        </button>
      )}

      {!isConnected && (
        <p className="text-center text-gray-600 text-sm">
          Conecta el ELM327 para realizar el escaneo
        </p>
      )}

      {scanResult !== null && !scanning && (
        <>
          {(() => {
            const health = overallHealth(scanResult)
            const banners = {
              green:  { bg: 'bg-green-500/10 border-green-500/30', icon: '✅', text: 'text-green-400', label: 'Vehículo en buen estado' },
              yellow: { bg: 'bg-yellow-500/10 border-yellow-500/30', icon: '⚠️', text: 'text-yellow-400', label: 'Atención requerida' },
              red:    { bg: 'bg-red-500/10 border-red-500/30', icon: '🔴', text: 'text-red-400', label: 'Fallos detectados' },
            }[health]
            return (
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${banners.bg}`}>
                <span className="text-2xl">{banners.icon}</span>
                <div>
                  <p className={`font-semibold text-sm ${banners.text}`}>{banners.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Escaneo completado · Toca en cada sección para más detalles</p>
                </div>
              </div>
            )
          })()}

          <div className="bg-gray-900 border border-gray-800 rounded-xl px-4">
            <ResultRow
              icon="🔧"
              label="Códigos de avería (DTC)"
              detail={scanResult.dtcCount === 0 ? 'Sin fallos activos' : `${scanResult.dtcCount} código(s): ${scanResult.storedDTCs.join(', ')}`}
              status={scanResult.milOn ? 'red' : scanResult.dtcCount > 0 ? 'yellow' : 'green'}
            />
            <ResultRow
              icon="🔌"
              label="Comunicación OBD"
              detail={scanResult.protocol || 'Sin datos'}
              status={scanResult.protocol ? 'green' : 'yellow'}
            />
            <ResultRow
              icon="🟢"
              label="Monitores ITV"
              detail={`${scanResult.readyCount} de ${scanResult.totalMonitors} monitores listos`}
              status={scanResult.readyCount === scanResult.totalMonitors ? 'green' : scanResult.readyCount >= scanResult.totalMonitors * 0.6 ? 'yellow' : 'red'}
            />
            <ResultRow
              icon="📸"
              label="Instantánea de fallo"
              detail={scanResult.hasFreezeFrame ? 'Hay datos de fallo guardados en la ECU' : 'Sin datos de freeze frame'}
              status={scanResult.hasFreezeFrame ? 'yellow' : 'green'}
            />
            {batteryVoltage !== null && (
              <ResultRow
                icon="🔋"
                label="Batería / Alternador"
                detail={`${batteryVoltage.toFixed(1)}V · ${batteryVoltage >= 13.5 ? 'Cargando correctamente' : batteryVoltage >= 12.0 ? 'Tensión baja' : 'Batería descargada'}`}
                status={batteryVoltage >= 13.5 ? 'green' : batteryVoltage >= 12.0 ? 'yellow' : 'red'}
              />
            )}
            {fuelLevel !== null && (
              <ResultRow
                icon="⛽"
                label="Nivel de combustible"
                detail={`${Math.round(fuelLevel)}%`}
                status={fuelLevel >= 20 ? 'green' : fuelLevel >= 10 ? 'yellow' : 'red'}
              />
            )}
            {coolantTemp !== null && (
              <ResultRow
                icon="🌡️"
                label="Temperatura motor"
                detail={`${Math.round(coolantTemp)}°C`}
                status={coolantTemp <= 100 ? 'green' : coolantTemp <= 110 ? 'yellow' : 'red'}
              />
            )}
          </div>

          <button
            onClick={shareReport}
            className="w-full min-h-[44px] bg-gray-800 text-gray-300 rounded-xl text-sm font-medium"
          >
            📤 Compartir informe
          </button>
        </>
      )}
    </div>
  )
}
