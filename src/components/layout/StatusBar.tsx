import { useOBDStore } from '../../store/obdStore'

const STATUS_COLORS: Record<string, string> = {
  disconnected: 'bg-gray-500',
  connecting: 'bg-yellow-500 animate-pulse',
  connected: 'bg-green-500',
  error: 'bg-red-500',
}

const STATUS_LABELS: Record<string, string> = {
  disconnected: 'Desconectado',
  connecting: 'Conectando...',
  connected: 'Conectado',
  error: 'Error de conexión',
}

export function StatusBar() {
  const { connectionStatus, lastError, selectedPort } = useOBDStore()

  return (
    <footer className="h-8 bg-gray-900 border-t border-gray-800 flex items-center px-4 gap-4 text-xs text-gray-500">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[connectionStatus]}`} />
        <span>{STATUS_LABELS[connectionStatus]}</span>
        {selectedPort && connectionStatus === 'connected' && (
          <span className="text-gray-600">({selectedPort})</span>
        )}
      </div>
      {lastError && (
        <span className="text-red-400 truncate">&#9888; {lastError.message}</span>
      )}
      <span className="ml-auto">OBDII Diagnostics v1.0</span>
    </footer>
  )
}
