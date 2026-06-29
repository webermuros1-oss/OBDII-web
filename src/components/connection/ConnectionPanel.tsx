import { useState, useEffect } from 'react'
import { useOBDStore } from '../../store/obdStore'
import { useOBDConnection } from '../../hooks/useOBDConnection'

const OBD_KEYWORDS = ['obd', 'elm', 'obdii', 'elm327']

export function ConnectionPanel() {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'trying' | 'failed'>('idle')
  const { connectionStatus } = useOBDStore()
  const { listDevices, autoConnect, disconnect } = useOBDConnection()

  const isConnected = connectionStatus === 'connected'
  const isBusy = status === 'scanning' || status === 'trying'

  useEffect(() => {
    if (connectionStatus === 'error') setStatus('failed')
    if (connectionStatus === 'connected') setStatus('idle')
    if (connectionStatus === 'disconnected') setStatus('idle')
  }, [connectionStatus])

  const handleConnect = async () => {
    setStatus('scanning')
    const result = await listDevices()
    if (!result.ok || result.data.length === 0) {
      setStatus('failed')
      return
    }

    // Find first device whose name/path contains an OBD keyword
    const candidate = result.data.find((d) => {
      const haystack = ((d.path ?? '') + ' ' + (d.manufacturer ?? '')).toLowerCase()
      return OBD_KEYWORDS.some((k) => haystack.includes(k))
    })

    const toTry = candidate ? [candidate] : result.data

    setStatus('trying')
    for (const device of toTry) {
      const ok = await autoConnect(device.path)
      if (ok) return
    }
    setStatus('failed')
  }

  // Connected: show green dot + label
  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        <span className="text-green-400 text-sm font-medium">Conectado</span>
      </div>
    )
  }

  // Busy: disabled button
  if (isBusy) {
    return (
      <button
        disabled
        className="px-3 py-1.5 min-h-[36px] bg-gray-700 text-gray-400 text-sm font-medium rounded-lg opacity-60 cursor-not-allowed"
      >
        {status === 'scanning' ? 'Buscando...' : 'Conectando...'}
      </button>
    )
  }

  // Failed: red retry button
  if (status === 'failed') {
    return (
      <button
        onClick={handleConnect}
        className="px-3 py-1.5 min-h-[36px] bg-red-600 text-white text-sm font-medium rounded-lg"
      >
        Reintentar
      </button>
    )
  }

  // Idle / disconnected: green connect button
  return (
    <button
      onClick={handleConnect}
      className="px-3 py-1.5 min-h-[36px] bg-green-600 text-white text-sm font-medium rounded-lg"
    >
      Conectar
    </button>
  )
}
