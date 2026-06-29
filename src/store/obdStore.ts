import { create } from 'zustand'
import type { ConnectionStatus, LiveDataDTO, DTCResultDTO, SessionDTO, VehicleInfoDTO, OBDError } from '../types/obd'

interface OBDState {
  // Conexión
  connectionStatus: ConnectionStatus
  selectedPort: string | null
  baudRate: 9600 | 38400 | 115200
  setConnectionStatus: (s: ConnectionStatus) => void
  setSelectedPort: (p: string | null) => void
  setBaudRate: (b: 9600 | 38400 | 115200) => void

  // Live data — mapa pid → último valor
  liveData: Record<string, LiveDataDTO>
  liveHistory: Record<string, Array<{ time: number; value: number }>>  // últimos 60 puntos
  updateLiveData: (data: LiveDataDTO) => void
  clearLiveData: () => void

  // DTCs
  dtcResult: DTCResultDTO | null
  dtcLoading: boolean
  setDTCResult: (r: DTCResultDTO | null) => void
  setDTCLoading: (v: boolean) => void

  // Vehículo
  vehicleInfo: VehicleInfoDTO | null
  setVehicleInfo: (v: VehicleInfoDTO | null) => void

  // Sesiones
  sessions: SessionDTO[]
  setSessions: (s: SessionDTO[]) => void

  // Errores OBD
  lastError: OBDError | null
  setLastError: (e: OBDError | null) => void

  // Polling activo
  isPolling: boolean
  setIsPolling: (v: boolean) => void
}

export const useOBDStore = create<OBDState>((set) => ({
  connectionStatus: 'disconnected',
  selectedPort: null,
  baudRate: 38400,
  setConnectionStatus: (s) => set({ connectionStatus: s }),
  setSelectedPort: (p) => set({ selectedPort: p }),
  setBaudRate: (b) => set({ baudRate: b }),

  liveData: {},
  liveHistory: {},
  updateLiveData: (data) => set((state) => {
    const history = state.liveHistory[data.pid] ?? []
    const newHistory = [...history, { time: data.timestamp, value: data.value }].slice(-60)
    return {
      liveData: { ...state.liveData, [data.pid]: data },
      liveHistory: { ...state.liveHistory, [data.pid]: newHistory },
    }
  }),
  clearLiveData: () => set({ liveData: {}, liveHistory: {} }),

  dtcResult: null,
  dtcLoading: false,
  setDTCResult: (r) => set({ dtcResult: r }),
  setDTCLoading: (v) => set({ dtcLoading: v }),

  vehicleInfo: null,
  setVehicleInfo: (v) => set({ vehicleInfo: v }),

  sessions: [],
  setSessions: (s) => set({ sessions: s }),

  lastError: null,
  setLastError: (e) => set({ lastError: e }),

  isPolling: false,
  setIsPolling: (v) => set({ isPolling: v }),
}))
