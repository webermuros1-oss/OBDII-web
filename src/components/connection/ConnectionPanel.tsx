import { useState, useEffect } from 'react'
import { useOBDStore } from '../../store/obdStore'
import { useOBDConnection } from '../../hooks/useOBDConnection'
import type { PortInfoDTO } from '../../types/obd'

export function ConnectionPanel() {
  const [ports, setPorts] = useState<PortInfoDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [autoTrying, setAutoTrying] = useState(false)
  const { connectionStatus, selectedPort, setSelectedPort } = useOBDStore()
  const { listPorts, autoConnect, disconnect } = useOBDConnection()

  const refreshPorts = async () => {
    const result = await listPorts()
    if (result.ok) setPorts(result.data)
  }

  useEffect(() => {
    refreshPorts()
  }, [])

  const isObdPort = (p: PortInfoDTO) => {
    const name = (p.path + (p.manufacturer ?? '')).toLowerCase()
    return name.includes('obd') || name.includes('elm') || name.includes('bluetooth') || name.includes('bt') || p.path.includes('cu.')
  }

  const sortedPorts = [...ports].sort((a, b) => (isObdPort(b) ? 1 : 0) - (isObdPort(a) ? 1 : 0))
  const recommendedPort = sortedPorts.find(isObdPort)

  useEffect(() => {
    if (recommendedPort && !selectedPort) {
      setSelectedPort(recommendedPort.path)
    }
  }, [ports])

  const handleConnect = async () => {
    const port = selectedPort
    if (!port) return
    setLoading(true)
    setAutoTrying(true)
    await autoConnect(port)
    setAutoTrying(false)
    setLoading(false)
  }

  const isConnected = connectionStatus === 'connected'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Conexión</span>
        <button
          onClick={refreshPorts}
          className="text-gray-500 hover:text-gray-300 text-xs"
          title="Actualizar puertos"
        >
          &#8635;
        </button>
      </div>

      {ports.length === 0 ? (
        <p className="text-xs text-yellow-500">
          No se detecta ningún adaptador. Empareja el dispositivo OBD-II por Bluetooth primero.
        </p>
      ) : (
        <>
          <select
            value={selectedPort ?? ''}
            onChange={(e) => setSelectedPort(e.target.value || null)}
            disabled={isConnected}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">Seleccionar dispositivo</option>
            {sortedPorts.map((p) => (
              <option key={p.path} value={p.path}>
                {isObdPort(p) ? '★ ' : ''}
                {p.manufacturer ?? p.path}
                {isObdPort(p) ? ' (OBD-II)' : ''}
              </option>
            ))}
          </select>

          {recommendedPort && !isConnected && (
            <p className="text-xs text-green-500">✓ Adaptador OBD-II detectado</p>
          )}
        </>
      )}

      {isConnected ? (
        <button
          onClick={disconnect}
          className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors"
        >
          Desconectar
        </button>
      ) : (
        <button
          onClick={handleConnect}
          disabled={!selectedPort || loading}
          className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {autoTrying ? 'Detectando velocidad...' : 'Conectar'}
        </button>
      )}
    </div>
  )
}
