import { contextBridge, ipcRenderer } from 'electron'
import type { OBDAPI, ConnectionStatus, LiveDataDTO, OBDError } from '../src/types/obd'

const api: OBDAPI = {
  // ─── Conexión ──────────────────────────────────────────────────────────────
  listPorts: () => ipcRenderer.invoke('obd:listPorts'),

  connect: (dto) => ipcRenderer.invoke('obd:connect', dto),

  disconnect: () => ipcRenderer.invoke('obd:disconnect'),

  onConnectionStatus: (cb: (status: ConnectionStatus) => void) => {
    const handler = (_: unknown, status: ConnectionStatus) => cb(status)
    ipcRenderer.on('obd:connectionStatus', handler)
    return () => ipcRenderer.removeListener('obd:connectionStatus', handler)
  },

  // ─── Datos en vivo ─────────────────────────────────────────────────────────
  startPolling: (pids) => ipcRenderer.invoke('obd:startPolling', pids),

  stopPolling: () => ipcRenderer.invoke('obd:stopPolling'),

  onLiveData: (cb: (data: LiveDataDTO) => void) => {
    const handler = (_: unknown, data: LiveDataDTO) => cb(data)
    ipcRenderer.on('obd:liveData', handler)
    return () => ipcRenderer.removeListener('obd:liveData', handler)
  },

  onOBDError: (cb: (err: OBDError) => void) => {
    const handler = (_: unknown, e: OBDError) => cb(e)
    ipcRenderer.on('obd:error', handler)
    return () => ipcRenderer.removeListener('obd:error', handler)
  },

  // ─── DTCs ──────────────────────────────────────────────────────────────────
  readDTCs: () => ipcRenderer.invoke('obd:readDTCs'),

  clearDTCs: () => ipcRenderer.invoke('obd:clearDTCs'),

  // ─── Vehículo ──────────────────────────────────────────────────────────────
  getVehicleInfo: () => ipcRenderer.invoke('obd:vehicleInfo'),

  // ─── Historial de sesiones ─────────────────────────────────────────────────
  getSessions: () => ipcRenderer.invoke('session:getAll'),

  getSession: (id) => ipcRenderer.invoke('session:getOne', id),

  deleteSession: (id) => ipcRenderer.invoke('session:delete', id),
}

contextBridge.exposeInMainWorld('obd', api)
