// ─── Patrón Result<T> ───────────────────────────────────────────────────────
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: OBDError }

export type ErrorCode =
  | 'NO_RESPONSE'
  | 'BUS_INIT_ERROR'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'SERIAL_ERROR'
  | 'NOT_CONNECTED'
  | 'UNSUPPORTED_PID'
  | 'DB_ERROR'
  | 'UNKNOWN'

export interface OBDError {
  code: ErrorCode
  message: string
  raw?: string
}

// ─── DTOs de Conexión ────────────────────────────────────────────────────────
export interface PortInfoDTO {
  path: string
  manufacturer?: string
  pnpId?: string
  serialNumber?: string
}

export interface ConnectDTO {
  port: string
  baudRate: 9600 | 38400 | 115200
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// ─── DTOs de Datos en Vivo ──────────────────────────────────────────────────
export interface LiveDataDTO {
  pid: string
  name: string
  value: number
  unit: string
  min: number
  max: number
  timestamp: number
}

// ─── DTOs de DTC ─────────────────────────────────────────────────────────────
export type DTCCategory = 'P' | 'C' | 'B' | 'U'

export interface DTCCodeDTO {
  code: string
  category: DTCCategory
  description: string
  descriptionEs: string
  isPending: boolean
  isPermanent: boolean
}

export interface DTCResultDTO {
  stored: DTCCodeDTO[]
  pending: DTCCodeDTO[]
  permanent: DTCCodeDTO[]
  milOn: boolean
  readyTests: number
  incompleteTests: number
}

// ─── DTOs de Vehículo ────────────────────────────────────────────────────────
export interface VehicleInfoDTO {
  vin: string
  protocol: string
  protocolName: string
  supportedPIDs: string[]
  ecuCount: number
  obdStandard: string
}

// ─── DTOs de Sesión ──────────────────────────────────────────────────────────
export interface SessionDTO {
  id: number
  startedAt: string
  endedAt: string | null
  port: string
  dtcCount: number
  snapshotCount: number
  durationSeconds: number
}

export interface SnapshotDTO {
  id: number
  sessionId: number
  timestamp: string
  data: LiveDataDTO[]
}

export interface SessionDetailDTO extends SessionDTO {
  dtcs: DTCCodeDTO[]
  snapshots: SnapshotDTO[]
}

// ─── API IPC expuesta en window.obd ─────────────────────────────────────────
export interface OBDAPI {
  // Conexión
  listPorts(): Promise<Result<PortInfoDTO[]>>
  connect(dto: ConnectDTO): Promise<Result<void>>
  disconnect(): Promise<Result<void>>
  onConnectionStatus(cb: (status: ConnectionStatus) => void): () => void

  // Datos en vivo
  startPolling(pids: string[]): Promise<Result<void>>
  stopPolling(): Promise<Result<void>>
  onLiveData(cb: (data: LiveDataDTO) => void): () => void
  onOBDError(cb: (err: OBDError) => void): () => void

  // DTCs
  readDTCs(): Promise<Result<DTCResultDTO>>
  clearDTCs(): Promise<Result<void>>

  // Vehículo
  getVehicleInfo(): Promise<Result<VehicleInfoDTO>>

  // Historial
  getSessions(): Promise<Result<SessionDTO[]>>
  getSession(id: number): Promise<Result<SessionDetailDTO>>
  deleteSession(id: number): Promise<Result<void>>
}

declare global {
  interface Window {
    obd: OBDAPI
  }
}
