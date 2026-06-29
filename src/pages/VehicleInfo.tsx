import { useState } from 'react'
import { useOBDStore } from '../store/obdStore'
import { useVehicleProfileStore } from '../store/vehicleProfileStore'
import type { VehicleProfile } from '../store/vehicleProfileStore'
import { obd } from '../lib/obd'

const FUEL_OPTIONS: VehicleProfile['fuel'][] = ['Gasolina', 'Diésel', 'Híbrido', 'Eléctrico']

const PID_NAMES: Record<string, string> = {
  '01': 'Estado del motor y MIL',
  '03': 'Estado del combustible',
  '04': 'Carga del motor',
  '05': 'Temp. refrigerante',
  '06': 'Trim combustible (corto)',
  '07': 'Trim combustible (largo)',
  '0B': 'Presión de admisión',
  '0C': 'Régimen del motor (RPM)',
  '0D': 'Velocidad',
  '0E': 'Avance de encendido',
  '0F': 'Temp. aire admisión',
  '10': 'Flujo de aire (MAF)',
  '11': 'Posición del acelerador',
  '13': 'Sensores de oxígeno',
  '1C': 'Norma OBD del vehículo',
  '1F': 'Tiempo desde arranque',
  '20': 'Sensores PIDs 21-40',
  '21': 'Dist. con MIL encendido',
  '2F': 'Nivel de combustible',
  '31': 'Dist. desde borrado DTCs',
  '33': 'Presión barométrica',
  '42': 'Voltaje batería',
  '46': 'Temp. ambiente',
}

function pidName(pid: string): string {
  return PID_NAMES[pid.toUpperCase()] ?? `Sensor 0x${pid.toUpperCase()}`
}

type FormMode = 'view' | 'edit' | 'add'

function ProfileForm() {
  const { profiles, activeId, getActiveProfile, addProfile, updateProfile, deleteProfile, setActive } =
    useVehicleProfileStore()
  const [mode, setMode] = useState<FormMode>('view')
  const [draft, setDraft] = useState<Omit<VehicleProfile, 'id'>>({
    make: '',
    model: '',
    year: '',
    engine: '',
    fuel: 'Gasolina',
  })

  const activeProfile = getActiveProfile()

  const handleDelete = (id: string) => {
    const p = profiles.find((pr) => pr.id === id)
    const label = p?.make || p?.model ? `${p?.make} ${p?.model}`.trim() : 'este vehículo'
    if (window.confirm(`¿Eliminar ${label}?`)) {
      deleteProfile(id)
      if (id === activeId) {
        setMode('view')
      }
    }
  }

  const handleAddNew = () => {
    setDraft({ make: '', model: '', year: '', engine: '', fuel: 'Gasolina' })
    setMode('add')
  }

  const handleEdit = () => {
    if (activeProfile) {
      const { id: _id, ...rest } = activeProfile
      setDraft(rest)
    }
    setMode('edit')
  }

  const handleSave = () => {
    if (mode === 'add') {
      addProfile(draft)
    } else if (mode === 'edit' && activeId) {
      updateProfile(activeId, draft)
    }
    setMode('view')
  }

  const handleCancel = () => {
    setMode('view')
  }

  const isFormMode = mode === 'edit' || mode === 'add'

  return (
    <div className="space-y-3">
      {/* Section A: Profile Switcher */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setActive(p.id)
              setMode('view')
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border whitespace-nowrap ${
              p.id === activeId
                ? 'bg-green-600/20 border-green-500 text-green-400'
                : 'bg-gray-800 border-gray-700 text-gray-400'
            }`}
          >
            {p.make || p.model ? `${p.make} ${p.model}`.trim() : 'Sin nombre'}
            <span
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(p.id)
              }}
              className="text-gray-500 hover:text-red-400 ml-1"
            >
              ×
            </span>
          </button>
        ))}
        <button
          onClick={handleAddNew}
          className="px-3 py-1.5 rounded-full text-sm border border-dashed border-gray-700 text-gray-500 whitespace-nowrap"
        >
          + Añadir
        </button>
      </div>

      {/* Section B: Profile Form */}
      {isFormMode ? (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-100">
            {mode === 'add' ? 'Nuevo vehículo' : 'Editar vehículo'}
          </h2>

          {([
            { key: 'make', label: 'Marca', placeholder: 'ej. Renault' },
            { key: 'model', label: 'Modelo', placeholder: 'ej. Clio IV' },
            { key: 'year', label: 'Año', placeholder: 'ej. 2013' },
            { key: 'engine', label: 'Motor', placeholder: 'ej. 1.5 dCi 90cv' },
          ] as { key: keyof Omit<VehicleProfile, 'id' | 'fuel'>; label: string; placeholder: string }[]).map(
            ({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-gray-400 block mb-1">{label}</label>
                <input
                  type={key === 'year' ? 'number' : 'text'}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-500"
                />
              </div>
            )
          )}

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
              onClick={handleCancel}
              className="flex-1 py-2.5 rounded-lg text-sm text-gray-400 bg-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600"
            >
              Guardar
            </button>
          </div>
        </div>
      ) : activeProfile ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚗</span>
              <div>
                <p className="text-base font-semibold text-gray-100">
                  {activeProfile.make} {activeProfile.model}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[activeProfile.year, activeProfile.engine, activeProfile.fuel]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <button onClick={handleEdit} className="text-xs text-gray-500 underline">
              Editar
            </button>
          </div>
        </div>
      ) : profiles.length === 0 ? (
        <button
          onClick={handleAddNew}
          className="w-full flex items-center gap-3 p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl text-left"
        >
          <span className="text-2xl">🚗</span>
          <div>
            <p className="text-sm font-medium text-blue-400">Añade los datos de tu coche</p>
            <p className="text-xs text-gray-500 mt-0.5">Marca, modelo, año y motor</p>
          </div>
          <span className="ml-auto text-gray-500">›</span>
        </button>
      ) : null}
    </div>
  )
}

export function VehicleInfo() {
  const { vehicleInfo, setVehicleInfo, connectionStatus } = useOBDStore()
  const { getActiveProfile, setProfile } = useVehicleProfileStore()
  const [loading, setLoading] = useState(false)
  const isConnected = connectionStatus === 'connected'

  const loadInfo = async () => {
    setLoading(true)
    const result = await obd.getVehicleInfo()
    setLoading(false)
    if (result.ok) {
      setVehicleInfo(result.data)
      const activeProfile = getActiveProfile()
      if (result.data.manufacturer && (!activeProfile || !activeProfile.make)) {
        setProfile({ make: result.data.manufacturer })
      }
    }
  }

  const vinClean = vehicleInfo?.vin && vehicleInfo.vin !== 'UNKNOWN' ? vehicleInfo.vin : null

  return (
    <div className="space-y-4">
      {/* Vehicle profiles */}
      <ProfileForm />

      {/* OBD read button */}
      <button
        onClick={loadInfo}
        disabled={!isConnected || loading}
        className="w-full min-h-[44px] py-3 bg-blue-600/20 text-blue-400 disabled:opacity-50 rounded-lg text-sm font-medium"
      >
        {loading ? 'Leyendo datos del coche...' : '🔍 Leer datos OBD del vehículo'}
      </button>

      {!isConnected && (
        <p className="text-center text-gray-600 text-sm py-2">
          Conecta el ELM327 para leer los datos OBD
        </p>
      )}

      {/* OBD results */}
      {vehicleInfo && (
        <div className="space-y-3">
          {/* Identification */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <h2 className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Identificación del vehículo
            </h2>

            {vehicleInfo.manufacturer && (
              <Row label="Fabricante" value={vehicleInfo.manufacturer} highlight />
            )}

            {vinClean ? (
              <Row label="Número de bastidor (VIN)" value={vinClean} mono />
            ) : (
              <Row label="Número de bastidor (VIN)" value="No disponible en este vehículo" dim />
            )}

            <Row
              label="Protocolo de comunicación"
              value={vehicleInfo.protocolName.replace('ISO 15765-4 CAN', 'CAN Bus')}
            />

            <Row
              label="Norma de diagnóstico"
              value={
                vehicleInfo.obdStandard === 'EOBD'
                  ? 'EOBD (normativa europea)'
                  : vehicleInfo.obdStandard === 'OBD-II (CARB)'
                  ? 'OBD-II (normativa americana)'
                  : vehicleInfo.obdStandard
              }
            />
          </div>

          {/* Supported sensors */}
          {vehicleInfo.supportedPIDs.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-3">
                Sensores disponibles ({vehicleInfo.supportedPIDs.length})
              </h2>
              <div className="space-y-1.5">
                {vehicleInfo.supportedPIDs.map((pid) => (
                  <div key={pid} className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-gray-600 w-8 shrink-0">{pid}</span>
                    <span className="text-sm text-gray-300">{pidName(pid)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  mono,
  highlight,
  dim,
}: {
  label: string
  value: string
  mono?: boolean
  highlight?: boolean
  dim?: boolean
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`text-sm mt-0.5 ${
          highlight
            ? 'text-green-400 font-semibold'
            : dim
            ? 'text-gray-600'
            : mono
            ? 'text-gray-100 font-mono'
            : 'text-gray-200'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
