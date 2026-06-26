import { useState } from 'react'
import { useOBDStore } from '../store/obdStore'

export function VehicleInfo() {
  const { vehicleInfo, setVehicleInfo, connectionStatus } = useOBDStore()
  const [loading, setLoading] = useState(false)
  const isConnected = connectionStatus === 'connected'

  const loadInfo = async () => {
    setLoading(true)
    const result = await window.obd.getVehicleInfo()
    setLoading(false)
    if (result.ok) setVehicleInfo(result.data)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Información del vehículo</h1>
          <p className="text-gray-500 text-sm mt-1">VIN, protocolo OBD2 y sensores soportados</p>
        </div>
        <button
          onClick={loadInfo}
          disabled={!isConnected || loading}
          className="px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? 'Leyendo...' : '🔍 Leer info'}
        </button>
      </div>

      {vehicleInfo ? (
        <div className="grid gap-4">
          {/* Identification */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-gray-400 text-sm uppercase tracking-wider mb-4">Identificación</h2>
            <div className="space-y-3 divide-y divide-gray-800">
              <div className="flex justify-between items-center py-2 first:pt-0">
                <span className="text-gray-400">VIN</span>
                <span className="font-mono text-white text-sm">{vehicleInfo.vin || 'No disponible'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">Protocolo</span>
                <span className="text-white">{vehicleInfo.protocolName}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">ID protocolo</span>
                <span className="font-mono text-gray-300 text-sm">{vehicleInfo.protocol}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">Estándar OBD</span>
                <span className="text-white">{vehicleInfo.obdStandard}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">ECUs detectadas</span>
                <span className="text-white">{vehicleInfo.ecuCount}</span>
              </div>
            </div>
          </div>

          {/* Supported PIDs */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-gray-400 text-sm uppercase tracking-wider mb-4">
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
          <p className="text-gray-500">
            {isConnected
              ? 'Pulsa "Leer info" para obtener los datos del vehículo'
              : 'Conecta el ELM327 primero'}
          </p>
        </div>
      )}
    </div>
  )
}
