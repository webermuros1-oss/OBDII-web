import { useState, useEffect } from 'react'
import { useOBDStore } from '../../store/obdStore'
import { useOBDConnection } from '../../hooks/useOBDConnection'
import type { PortInfoDTO } from '../../types/obd'

export function ConnectionPanel() {
  const [ports, setPorts] = useState<PortInfoDTO[]>([])
  const [loading, setLoading] = useState(false)
  const { connectionStatus, selectedPort, baudRate, setSelectedPort, setBaudRate } = useOBDStore()
  const { listPorts, connect, disconnect } = useOBDConnection()

  const refreshPorts = async () => {
    const result = await listPorts()
    if (result.ok) setPorts(result.data)
  }

  useEffect(() => {
    refreshPorts()
  }, [])

  const handleConnect = async () => {
    if (!selectedPort) return
    setLoading(true)
    await connect(selectedPort, baudRate)
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

      {/* Puerto */}
      <select
        value={selectedPort ?? ''}
        onChange={(e) => setSelectedPort(e.target.value || null)}
        disabled={isConnected}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-green-500"
      >
        <option value="">Seleccionar puerto</option>
        {ports.map((p) => (
          <option key={p.path} value={p.path}>
            {p.path}
            {p.manufacturer ? ` (${p.manufacturer})` : ''}
          </option>
        ))}
      </select>

      {/* Baudrate */}
      <select
        value={baudRate}
        onChange={(e) => setBaudRate(Number(e.target.value) as typeof baudRate)}
        disabled={isConnected}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-green-500"
      >
        <option value={9600}>9600 baud</option>
        <option value={38400}>38400 baud</option>
        <option value={115200}>115200 baud</option>
      </select>

      {/* Botón conectar / desconectar */}
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
          disabled={!selectedPort || loading || connectionStatus === 'connecting'}
          className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {loading || connectionStatus === 'connecting' ? 'Conectando...' : 'Conectar'}
        </button>
      )}
    </div>
  )
}
