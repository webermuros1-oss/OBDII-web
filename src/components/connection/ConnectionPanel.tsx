import { useState, useEffect } from 'react'
import { useOBDStore } from '../../store/obdStore'
import { useOBDConnection } from '../../hooks/useOBDConnection'
import type { PortInfoDTO } from '../../types/obd'

const OBD_KEYWORDS = ['obd', 'elm', 'obdii', 'elm327']

function rankPort(p: PortInfoDTO): number {
  const name = (p.path + (p.manufacturer ?? '')).toLowerCase()
  if (OBD_KEYWORDS.some((k) => name.includes(k))) return 2
  if (p.path.includes('cu.')) return 1
  return 0
}

export function ConnectionPanel() {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'trying' | 'failed'>('idle')
  const { connectionStatus } = useOBDStore()
  const { listPorts, autoConnect, disconnect } = useOBDConnection()

  const isConnected = connectionStatus === 'connected'

  useEffect(() => {
    if (connectionStatus === 'error') setStatus('failed')
    if (connectionStatus === 'connected') setStatus('idle')
    if (connectionStatus === 'disconnected') setStatus('idle')
  }, [connectionStatus])

  const handleConnect = async () => {
    setStatus('scanning')
    const result = await listPorts()
    if (!result.ok || result.data.length === 0) {
      setStatus('failed')
      return
    }

    const sorted = [...result.data].sort((a, b) => rankPort(b) - rankPort(a))
    const candidates = sorted.filter((p) => rankPort(p) > 0)
    const toTry = candidates.length > 0 ? candidates : sorted

    setStatus('trying')
    for (const port of toTry) {
      const ok = await autoConnect(port.path)
      if (ok) return
    }
    setStatus('failed')
  }

  const statusMessage = () => {
    if (status === 'scanning') return 'Buscando adaptador...'
    if (status === 'trying') return 'Conectando...'
    if (status === 'failed') return 'No se encontró el adaptador. Asegúrate de que el dispositivo OBD-II está encendido y emparejado por Bluetooth.'
    return null
  }

  return (
    <div className="space-y-3">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Conexión</span>

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
          disabled={status === 'scanning' || status === 'trying'}
          className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
        >
          {status === 'scanning' || status === 'trying' ? statusMessage() : 'Conectar'}
        </button>
      )}

      {status === 'failed' && (
        <p className="text-xs text-red-400">{statusMessage()}</p>
      )}
    </div>
  )
}
