import { create } from 'zustand'
import type { ConnectionStatus, LiveDataDTO, DTCResultDTO, SessionDTO, VehicleInfoDTO, OBDError } from '../types/obd'

export interface SessionStats {
  maxRPM: number
  maxSpeed: number
  maxCoolantTemp: number
  timer0to100: number | null   // segundos, null = sin resultado aún
  timerActive: boolean         // midiendo actualmente
  timerStartTime: number | null
}

const INITIAL_STATS: SessionStats = {
  maxRPM: 0,
  maxSpeed: 0,
  maxCoolantTemp: -999,
  timer0to100: null,
  timerActive: false,
  timerStartTime: null,
}

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
  liveHistory: Record<string, Array<{ time: number; value: number }>>
  updateLiveData: (data: LiveDataDTO) => void
  clearLiveData: () => void

  // Estadísticas de sesión
  sessionStats: SessionStats
  resetSessionStats: () => void

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
    // Actualizar historial (últimos 60 puntos)
    const history = state.liveHistory[data.pid] ?? []
    const newHistory = [...history, { time: data.timestamp, value: data.value }].slice(-60)

    // Actualizar estadísticas de sesión
    const stats = state.sessionStats
    let newStats = stats

    if (data.pid === '0C') {
      // Max RPM
      if (data.value > stats.maxRPM) newStats = { ...newStats, maxRPM: data.value }
    }

    if (data.pid === '05') {
      // Max temperatura refrigerante
      if (data.value > stats.maxCoolantTemp) newStats = { ...newStats, maxCoolantTemp: data.value }
    }

    if (data.pid === '0D') {
      const curSpeed = data.value
      // Max velocidad
      if (curSpeed > stats.maxSpeed) newStats = { ...newStats, maxSpeed: curSpeed }

      // Timer 0-100 km/h
      const prevSpeed = history.length > 0 ? history[history.length - 1].value : 0

      // Inicio: velocidad cruza de ≤3 a >3 km/h (arrancada)
      if (!stats.timerActive && stats.timer0to100 === null && prevSpeed <= 3 && curSpeed > 3) {
        newStats = { ...newStats, timerActive: true, timerStartTime: data.timestamp }
      }
      // Fin: alcanzó 100 km/h
      if (stats.timerActive && curSpeed >= 100 && stats.timerStartTime !== null) {
        newStats = {
          ...newStats,
          timerActive: false,
          timer0to100: (data.timestamp - stats.timerStartTime) / 1000,
          timerStartTime: null,
        }
      }
      // Cancelar: frenó antes de llegar a 100 (velocidad < 1 km/h)
      if (stats.timerActive && curSpeed < 1) {
        newStats = { ...newStats, timerActive: false, timerStartTime: null }
      }
    }

    return {
      liveData: { ...state.liveData, [data.pid]: data },
      liveHistory: { ...state.liveHistory, [data.pid]: newHistory },
      sessionStats: newStats,
    }
  }),
  clearLiveData: () => set({ liveData: {}, liveHistory: {} }),

  sessionStats: { ...INITIAL_STATS },
  resetSessionStats: () => set({ sessionStats: { ...INITIAL_STATS } }),

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
