import { useState, useEffect } from 'react'
import { useOBDStore } from '../../store/obdStore'
import { useOBDConnection } from '../../hooks/useOBDConnection'
import type { PortInfoDTO } from '../../types/obd'

const OBD_KEYWORDS = ['obd', 'elm', 'elm327', 'obdii', 'obd2', 'vlink', 'konnwei', 'veepeak']

function isOBDDevice(d: PortInfoDTO) {
  const text = ((d.path ?? '') + ' ' + (d.manufacturer ?? '')).toLowerCase()
  return OBD_KEYWORDS.some((k) => text.includes(k))
}

export function ConnectionPanel() {
  const [showPicker, setShowPicker] = useState(false)
  const [devices, setDevices] = useState<PortInfoDTO[]>([])
  const [connecting, setConnecting] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const { connectionStatus } = useOBDStore()
  const { listDevices, autoConnect, disconnect } = useOBDConnection()

  const isConnected = connectionStatus === 'connected'

  useEffect(() => {
    if (connectionStatus === 'connected') {
      setShowPicker(false)
      setConnecting(null)
    }
  }, [connectionStatus])

  const openPicker = async () => {
    setShowPicker(true)
    setScanning(true)
    setDevices([])
    const result = await listDevices()
    setScanning(false)
    if (result.ok) setDevices(result.data)
  }

  const handleSelect = async (device: PortInfoDTO) => {
    setConnecting(device.path)
    const ok = await autoConnect(device.path)
    if (!ok) setConnecting(null)
  }

  if (isConnected) {
    return (
      <button
        onClick={() => disconnect()}
        className="flex items-center gap-2 px-3 py-1.5 min-h-[36px] rounded-lg bg-green-600/20"
      >
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
        <span className="text-green-400 text-sm font-medium">Conectado</span>
      </button>
    )
  }

  return (
    <>
      <button
        onClick={openPicker}
        className="px-3 py-1.5 min-h-[36px] bg-green-600 text-white text-sm font-medium rounded-lg"
      >
        Conectar
      </button>

      {/* Device picker bottom sheet */}
      {showPicker && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !connecting && setShowPicker(false)}
          />

          {/* Sheet */}
          <div className="relative bg-gray-900 rounded-t-2xl border-t border-gray-800 max-h-[70vh] flex flex-col">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-700" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div>
                <h2 className="text-base font-semibold text-gray-100">Selecciona tu adaptador OBD</h2>
                <p className="text-xs text-gray-500 mt-0.5">Dispositivos Bluetooth emparejados</p>
              </div>
              {!connecting && (
                <button
                  onClick={() => setShowPicker(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-800 text-gray-400"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Device list */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {scanning && (
                <div className="flex items-center justify-center py-8 text-gray-500 text-sm gap-2">
                  <span className="animate-spin">⟳</span>
                  Buscando dispositivos emparejados...
                </div>
              )}

              {!scanning && devices.length === 0 && (
                <div className="py-8 text-center space-y-3">
                  <p className="text-2xl">📡</p>
                  <p className="text-gray-400 text-sm font-medium">No hay dispositivos emparejados</p>
                  <p className="text-gray-600 text-xs">
                    Ve a Ajustes → Bluetooth → empareja tu ELM327{'\n'}
                    (PIN habitual: 1234 o 0000)
                  </p>
                </div>
              )}

              {!scanning && devices.map((device) => {
                const isOBD = isOBDDevice(device)
                const isThisConnecting = connecting === device.path
                const name = device.manufacturer || 'Dispositivo desconocido'
                const address = device.path

                return (
                  <button
                    key={address}
                    onClick={() => !connecting && handleSelect(device)}
                    disabled={!!connecting}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                      isOBD
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-gray-800 border-gray-700'
                    } ${connecting && !isThisConnecting ? 'opacity-40' : ''}`}
                  >
                    <span className="text-2xl shrink-0">{isOBD ? '🔌' : '📱'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-100 truncate">{name}</p>
                        {isOBD && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                            OBD
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{address}</p>
                    </div>
                    {isThisConnecting ? (
                      <span className="text-gray-400 text-xs shrink-0">Conectando...</span>
                    ) : (
                      <span className="text-gray-600 shrink-0">›</span>
                    )}
                  </button>
                )
              })}

              {/* Tip for Renault / generic cars */}
              {!scanning && devices.length > 0 && (
                <p className="text-xs text-gray-600 text-center pt-2 pb-1">
                  Selecciona el dispositivo ELM327. Si no lo ves, emparéjalo primero en Ajustes → Bluetooth.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
