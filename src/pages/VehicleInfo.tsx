import { useState } from 'react'
import { useOBDStore } from '../store/obdStore'
import { obd } from '../lib/obd'

export function VehicleInfo() {
  const { vehicleInfo, setVehicleInfo, connectionStatus } = useOBDStore()
  const [loading, setLoading] = useState(false)
  const isConnected = connectionStatus === 'connected'

  const loadInfo = async () => {
    setLoading(true)
    const result = await obd.getVehicleInfo()
    setLoading(false)
    if (result.ok) setVehicleInfo(result.data)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">VIN, protocolo OBD2 y sensores soportados</p>

      <button
        onClick={loadInfo}
        disabled={!isConnected || loading}
        className="w-full min-h-[44px] py-3 bg-blue-600/20 text-blue-400 disabled:opacity-50 rounded-lg text-sm font-medium"
      >
        {loading ? 'Leyendo...' : '🔍 Obtener info'}
      </button>

      {vehicleInfo ? (
        <div className="space-y-3">
          {/* Identification */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Identificación</h2>
            <div className="space-y-3 divide-y divide-gray-800">
              <div className="pt-0">
                <p className="text-xs text-gray-400">VIN</p>
                <p className="text-sm text-gray-100 font-mono mt-0.5">{vehicleInfo.vin || 'No disponible'}</p>
              </div>
              <div className="pt-3">
                <p className="text-xs text-gray-400">Protocolo</p>
                <p className="text-sm text-gray-100 mt-0.5">{vehicleInfo.protocolName}</p>
              </div>
              <div className="pt-3">
                <p className="text-xs text-gray-400">ID protocolo</p>
                <p className="text-sm text-gray-100 font-mono mt-0.5">{vehicleInfo.protocol}</p>
              </div>
              <div className="pt-3">
                <p className="text-xs text-gray-400">Estándar OBD</p>
                <p className="text-sm text-gray-100 mt-0.5">{vehicleInfo.obdStandard}</p>
              </div>
              <div className="pt-3">
                <p className="text-xs text-gray-400">ECUs detectadas</p>
                <p className="text-sm text-gray-100 mt-0.5">{vehicleInfo.ecuCount}</p>
              </div>
            </div>
          </div>

          {/* Supported PIDs */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
            <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-3">
              PIDs soportados ({vehicleInfo.supportedPIDs.length})
            </h2>
            {vehicleInfo.supportedPIDs.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {vehicleInfo.supportedPIDs.map((pid) => (
                  <span
                    key={pid}
                    className="font-mono text-xs bg-gray-800 text-green-400 px-2 py-1 rounded border border-gray-700"
                  >
                    0x{pid}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm">No se han detectado PIDs soportados</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-5xl mb-4">🚗</div>
          <p className="text-gray-500 text-sm">
            {isConnected
              ? 'Pulsa "Obtener info" para leer los datos del vehículo'
              : 'Conecta el ELM327 primero'}
          </p>
        </div>
      )}
    </div>
  )
}
