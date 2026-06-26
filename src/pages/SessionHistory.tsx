import { useEffect } from 'react'
import { useOBDStore } from '../store/obdStore'

export function SessionHistory() {
  const { sessions, setSessions } = useOBDStore()

  useEffect(() => {
    window.obd.getSessions().then((r) => {
      if (r.ok) setSessions(r.data)
    })
  }, [])

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Eliminar esta sesión?')) return
    const result = await window.obd.deleteSession(id)
    if (result.ok) setSessions(sessions.filter((s) => s.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Historial de sesiones</h1>
        <p className="text-gray-500 text-sm mt-1">{sessions.length} sesión(es) guardada(s)</p>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-500">No hay sesiones guardadas todavía</p>
          <p className="text-gray-600 text-sm mt-2">Las sesiones se guardan automáticamente al conectar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Sesión #{session.id}</p>
                  <p className="text-gray-500 text-sm">
                    {new Date(session.startedAt).toLocaleString('es-ES')}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                    <span>Puerto: {session.port}</span>
                    <span>DTCs: {session.dtcCount}</span>
                    <span>Capturas: {session.snapshotCount}</span>
                    {session.durationSeconds > 0 && (
                      <span>
                        Duración:{' '}
                        {Math.floor(session.durationSeconds / 60)}m{' '}
                        {session.durationSeconds % 60}s
                      </span>
                    )}
                    {session.endedAt && (
                      <span className="text-gray-600">
                        Fin: {new Date(session.endedAt).toLocaleTimeString('es-ES')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(session.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-sm px-3 py-1.5 rounded hover:bg-red-500/10"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
