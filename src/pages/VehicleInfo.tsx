import { useState } from 'react'
import { useOBDStore } from '../store/obdStore'
import { useVehicleProfileStore } from '../store/vehicleProfileStore'
import type { VehicleProfile } from '../store/vehicleProfileStore'
import { obd } from '../lib/obd'

const FUEL_OPTIONS: VehicleProfile['fuel'][] = ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico']

function ProfileForm() {
  const { profile, setProfile } = useVehicleProfileStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<VehicleProfile>(profile)

  const hasProfile = profile.make || profile.model

  const startEdit = () => {
    setDraft(profile)
    setEditing(true)
  }

  const save = () => {
    setProfile(draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-100">Datos de tu vehículo</h2>

        {([
          { key: 'make', label: 'Marca', placeholder: 'ej. Renault' },
          { key: 'model', label: 'Modelo', placeholder: 'ej. Clio 4' },
          { key: 'year', label: 'Año', placeholder: 'ej. 2015' },
          { key: 'engine', label: 'Motor', placeholder: 'ej. 1.2 TCe 120cv' },
        ] as { key: keyof VehicleProfile; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-gray-400 block mb-1">{label}</label>
            <input
              type={key === 'year' ? 'number' : 'text'}
              value={draft[key] as string}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              placeholder={placeholder}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
          </div>
        ))}

        <div>
          <label className="text-xs text-gray-400 block mb-1">Combustible</label>
          <div className="grid grid-cols-2 gap-2">
            {FUEL_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setDraft({ ...draft, fuel: f })}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                  draft.fuel === f
                    ? 'bg-green-600/20 border-green-500 text-green-400'
                    : 'bg-gray-800 border-gray-700 text-gray-400'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setEditing(false)}
            className="flex-1 py-2.5 rounded-lg text-sm text-gray-400 bg-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600"
          >
            Guardar
          </button>
        </div>
      </div>
    )
  }

  if (!hasProfile) {
    return (
      <button
        onClick={startEdit}
        className="w-full flex items-center gap-3 p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl text-left"
      >
        <span className="text-2xl">🚗</span>
        <div>
          <p className="text-sm font-medium text-blue-400">Añade los datos de tu coche</p>
          <p className="text-xs text-gray-500 mt-0.5">Marca, modelo, año y motor para diagnósticos más precisos</p>
        </div>
        <span className="ml-auto text-gray-500">›</span>
      </button>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚗</span>
          <div>
            <p className="text-base font-semibold text-gray-100">
              {profile.make} {profile.model}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {[profile.year, profile.engine, profile.fuel].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <button
          onClick={startEdit}
          className="text-xs text-gray-500 underline"
        >
          Editar
        </button>
      </div>
    </div>
  )
}

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
      {/* Vehicle profile (always visible) */}
      <ProfileForm />

      {/* OBD section */}
      <div className="space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Datos OBD en tiempo real</p>

        <button
          onClick={loadInfo}
          disabled={!isConnected || loading}
          className="w-full min-h-[44px] py-3 bg-blue-600/20 text-blue-400 disabled:opacity-50 rounded-lg text-sm font-medium"
        >
          {loading ? 'Leyendo...' : '🔍 Leer VIN y protocolo'}
        </button>

        {!isConnected && (
          <p className="text-center text-gray-600 text-sm py-4">Conecta el ELM327 para leer los datos OBD</p>
        )}

        {vehicleInfo && (
          <div className="space-y-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-3">Identificación OBD</h2>
              <div className="space-y-3 divide-y divide-gray-800">
                <div className="pt-0">
                  <p className="text-xs text-gray-400">VIN</p>
                  <p className="text-sm text-gray-100 font-mono mt-0.5">
                    {vehicleInfo.vin && vehicleInfo.vin !== 'UNKNOWN' ? vehicleInfo.vin : 'No disponible'}
                  </p>
                </div>
                <div className="pt-3">
                  <p className="text-xs text-gray-400">Protocolo</p>
                  <p className="text-sm text-gray-100 mt-0.5">{vehicleInfo.protocolName}</p>
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

            {vehicleInfo.supportedPIDs.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <h2 className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                  PIDs soportados ({vehicleInfo.supportedPIDs.length})
                </h2>
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
