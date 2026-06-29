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
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{sessions.length} sesión(es) guardada(s)</p>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-500 text-sm">No hay sesiones guardadas todavía</p>
          <p className="text-gray-600 text-xs mt-2">Las sesiones se guardan automáticamente al conectar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-100 font-medium text-sm">Sesión #{session.id}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(session.startedAt).toLocaleString('es-ES')}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                    <span className="text-xs text-gray-400">Puerto: {session.port}</span>
                    <span className="text-xs text-gray-400">DTCs: {session.dtcCount}</span>
                    <span className="text-xs text-gray-400">Capturas: {session.snapshotCount}</span>
                    {session.durationSeconds > 0 && (
                      <span className="text-xs text-gray-400">
                        Duración: {Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s
                      </span>
                    )}
                    {session.endedAt && (
                      <span className="text-xs text-gray-500">
                        Fin: {new Date(session.endedAt).toLocaleTimeString('es-ES')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(session.id)}
                  className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-600 text-sm px-3 rounded-lg"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
