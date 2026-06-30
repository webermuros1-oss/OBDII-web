import { Capacitor } from '@capacitor/core'
import { OBDNative } from '../capacitor/obd-plugin'
import {
  parseDTCBytes,
  extractHexBytes,
  parseVIN,
  parseProtocol,
  parseSupportedPIDs,
  decodeWMI,
  parseFuelTypePID51,
} from './obd-parsers'
import {
  getSessions as dbGetSessions,
  getSession as dbGetSession,
  deleteSession as dbDeleteSession,
} from '../capacitor/db-bridge'
import type {
  OBDAPI,
  Result,
  OBDError,
  ErrorCode,
  PortInfoDTO,
  ConnectDTO,
  ConnectionStatus,
  LiveDataDTO,
  DTCResultDTO,
  VehicleInfoDTO,
  FreezeFrameDTO,
  FreezeFrameEntryDTO,
  SessionDTO,
  SessionDetailDTO,
} from '../types/obd'

const isNative = Capacitor.isNativePlatform()

// ─── Listener handle map ──────────────────────────────────────────────────────

type ListenerHandle = { remove: () => void }

const handles: {
  connectionStatus: ListenerHandle | null
  liveData: ListenerHandle | null
  obdError: ListenerHandle | null
} = {
  connectionStatus: null,
  liveData: null,
  obdError: null,
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function ok<T>(data: T): Result<T> {
  return { ok: true, data }
}

function fail(code: ErrorCode, message: string, raw?: string): Result<never> {
  return { ok: false, error: { code, message, raw } }
}

function obdError(code: ErrorCode, message: string, raw?: string): OBDError {
  return { code, message, raw }
}

// ─── OBDAPI implementation ────────────────────────────────────────────────────

const obdBridge: OBDAPI = {
  // ── listPorts ─────────────────────────────────────────────────────────────
  async listPorts(): Promise<Result<PortInfoDTO[]>> {
    try {
      const { devices } = await OBDNative.listDevices()
      const ports: PortInfoDTO[] = devices.map((d: { address: string; name: string }) => ({
        path: d.address,
        manufacturer: d.name,
      }))
      return ok(ports)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('SERIAL_ERROR', `Failed to list Bluetooth devices: ${msg}`)
    }
  },

  // ── connect ───────────────────────────────────────────────────────────────
  async connect(dto: ConnectDTO): Promise<Result<void>> {
    try {
      const result = await OBDNative.connect({ address: dto.port })
      if (!result.ok) {
        return fail('SERIAL_ERROR', result.error ?? 'Connection failed')
      }
      return ok(undefined)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('SERIAL_ERROR', `Connect threw: ${msg}`)
    }
  },

  // ── disconnect ────────────────────────────────────────────────────────────
  async disconnect(): Promise<Result<void>> {
    try {
      await OBDNative.disconnect()
      return ok(undefined)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('SERIAL_ERROR', `Disconnect threw: ${msg}`)
    }
  },

  // ── onConnectionStatus ────────────────────────────────────────────────────
  onConnectionStatus(cb: (status: ConnectionStatus) => void): () => void {
    if (!isNative) return () => {}

    handles.connectionStatus?.remove()
    handles.connectionStatus = null

    let removed = false

    OBDNative.addListener('connectionStatus', (data: { status: string }) => {
      if (!removed) cb(data.status as ConnectionStatus)
    }).then((handle: ListenerHandle) => {
      if (removed) handle.remove()
      else handles.connectionStatus = handle
    }).catch(() => {})

    return () => {
      removed = true
      handles.connectionStatus?.remove()
      handles.connectionStatus = null
    }
  },

  // ── startPolling ──────────────────────────────────────────────────────────
  async startPolling(pids: string[]): Promise<Result<void>> {
    try {
      const result = await OBDNative.startPolling({ pids })
      if (!result.ok) {
        return fail('SERIAL_ERROR', 'startPolling returned not-ok')
      }
      return ok(undefined)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('SERIAL_ERROR', `startPolling threw: ${msg}`)
    }
  },

  // ── stopPolling ───────────────────────────────────────────────────────────
  async stopPolling(): Promise<Result<void>> {
    try {
      await OBDNative.stopPolling()
      return ok(undefined)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('SERIAL_ERROR', `stopPolling threw: ${msg}`)
    }
  },

  // ── onLiveData ────────────────────────────────────────────────────────────
  onLiveData(cb: (data: LiveDataDTO) => void): () => void {
    if (!isNative) return () => {}

    handles.liveData?.remove()
    handles.liveData = null

    let removed = false

    OBDNative.addListener('liveData', (data: unknown) => {
      if (!removed) cb(data as LiveDataDTO)
    }).then((handle: ListenerHandle) => {
      if (removed) handle.remove()
      else handles.liveData = handle
    }).catch(() => {})

    return () => {
      removed = true
      handles.liveData?.remove()
      handles.liveData = null
    }
  },

  // ── onOBDError ────────────────────────────────────────────────────────────
  onOBDError(cb: (err: OBDError) => void): () => void {
    if (!isNative) return () => {}

    handles.obdError?.remove()
    handles.obdError = null

    let removed = false

    OBDNative.addListener('obdError', (data: unknown) => {
      if (!removed) {
        const payload = data as { code: string; message: string }
        cb(obdError(payload.code as ErrorCode, payload.message))
      }
    }).then((handle: ListenerHandle) => {
      if (removed) handle.remove()
      else handles.obdError = handle
    }).catch(() => {})

    return () => {
      removed = true
      handles.obdError?.remove()
      handles.obdError = null
    }
  },

  // ── readDTCs ──────────────────────────────────────────────────────────────
  async readDTCs(): Promise<Result<DTCResultDTO>> {
    try {
      // Mode 03 — stored DTCs
      const stored03 = await OBDNative.sendCommand({ command: '03\r' })
      if (!stored03.ok) {
        return fail('SERIAL_ERROR', stored03.error ?? 'mode 03 failed')
      }

      const storedHex = extractHexBytes(stored03.response ?? '', '43')
      const storedDTCs = parseDTCBytes(storedHex, false)

      // Mode 07 — pending DTCs
      const pending07 = await OBDNative.sendCommand({ command: '07\r' })
      const pendingHex = extractHexBytes(pending07.response ?? '', '47')
      const pendingDTCs = parseDTCBytes(pendingHex, true)

      // Mode 01 PID 01 — MIL status
      const milResp = await OBDNative.sendCommand({ command: '01 01\r' })
      let milOn = false
      let readyTests = 0
      let incompleteTests = 0

      if (milResp.ok && milResp.response) {
        const tokens = milResp.response
          .toUpperCase()
          .replace(/>/g, '')
          .split(/\s+/)
          .filter((t: string) => t.match(/^[0-9A-F]{2}$/))
        const idx = tokens.indexOf('41')
        if (idx >= 0 && tokens[idx + 1] === '01' && tokens[idx + 2]) {
          const a = parseInt(tokens[idx + 2], 16)
          milOn = !!(a & 0x80)
          incompleteTests = a & 0x7f
        }
        if (idx >= 0 && tokens[idx + 4]) {
          readyTests = 8 - (parseInt(tokens[idx + 4], 16) & 0x0f)
        }
      }

      return ok({
        stored: storedDTCs,
        pending: pendingDTCs,
        permanent: [],
        milOn,
        readyTests,
        incompleteTests,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('PARSE_ERROR', `readDTCs failed: ${msg}`)
    }
  },

  // ── clearDTCs ─────────────────────────────────────────────────────────────
  async clearDTCs(): Promise<Result<void>> {
    try {
      const result = await OBDNative.sendCommand({ command: '04\r' })
      if (!result.ok) {
        return fail('SERIAL_ERROR', result.error ?? 'mode 04 failed')
      }
      return ok(undefined)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('SERIAL_ERROR', `clearDTCs threw: ${msg}`)
    }
  },

  // ── getVehicleInfo ────────────────────────────────────────────────────────
  async getVehicleInfo(): Promise<Result<VehicleInfoDTO>> {
    try {
      // VIN — mode 09 PID 02
      const vinResp = await OBDNative.sendCommand({ command: '09 02\r' })
      const vin = vinResp.ok && vinResp.response ? parseVIN(vinResp.response) : 'UNKNOWN'

      // Active protocol — ATDPN
      const dpnResp = await OBDNative.sendCommand({ command: 'ATDPN\r' })
      const { number: protocol, name: protocolName } =
        dpnResp.ok && dpnResp.response
          ? parseProtocol(dpnResp.response)
          : { number: '0', name: 'Unknown' }

      // Supported PIDs — mode 01 PID 00
      const pidResp = await OBDNative.sendCommand({ command: '01 00\r' })
      const supportedPIDs =
        pidResp.ok && pidResp.response ? parseSupportedPIDs(pidResp.response) : []

      const ecuCount = 1

      // OBD standard — mode 01 PID 1C
      let obdStandard = 'OBD-II'
      const stdResp = await OBDNative.sendCommand({ command: '01 1C\r' })
      if (stdResp.ok && stdResp.response) {
        const tokens = stdResp.response
          .toUpperCase()
          .replace(/>/g, '')
          .split(/\s+/)
          .filter((t: string) => t.match(/^[0-9A-F]{2}$/))
        const idx = tokens.indexOf('41')
        if (idx >= 0 && tokens[idx + 1] === '1C' && tokens[idx + 2]) {
          const standards: Record<number, string> = {
            1: 'OBD-II (CARB)', 2: 'OBD (EPA)', 3: 'OBD and OBD-II',
            4: 'OBD-I', 5: 'Not OBD compliant', 6: 'EOBD',
            7: 'EOBD and OBD-II', 9: 'EOBD and OBD',
            11: 'EMD', 12: 'EMD+', 13: 'HD OBD-C', 14: 'HD OBD', 15: 'WWH OBD',
          }
          obdStandard = standards[parseInt(tokens[idx + 2], 16)] ?? `Standard ${tokens[idx + 2]}`
        }
      }

      // Fuel type — mode 01 PID 51 (optional; not all vehicles support it)
      let fuelType: VehicleInfoDTO['fuelType']
      const fuelResp = await OBDNative.sendCommand({ command: '01 51\r' })
      if (fuelResp.ok && fuelResp.response) {
        fuelType = parseFuelTypePID51(fuelResp.response) ?? undefined
      }

      const manufacturer = vin !== 'UNKNOWN' ? decodeWMI(vin) ?? undefined : undefined
      return ok({ vin, protocol, protocolName, supportedPIDs, ecuCount, obdStandard, manufacturer, fuelType })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('PARSE_ERROR', `getVehicleInfo failed: ${msg}`)
    }
  },

  // ── readFreezeFrame ───────────────────────────────────────────────────────
  async readFreezeFrame(): Promise<Result<FreezeFrameDTO>> {
    type PIDDef = {
      pid: string
      name: string
      unit: string
      parse: (bytes: string[]) => number
    }
    const PIDS: PIDDef[] = [
      { pid: '04', name: 'Carga del motor',       unit: '%',   parse: (b) => (parseInt(b[0], 16) / 255) * 100 },
      { pid: '05', name: 'Temp. refrigerante',    unit: '°C',  parse: (b) => parseInt(b[0], 16) - 40 },
      { pid: '0B', name: 'Presión admisión',      unit: 'kPa', parse: (b) => parseInt(b[0], 16) },
      { pid: '0C', name: 'RPM',                   unit: 'rpm', parse: (b) => ((parseInt(b[0], 16) << 8) | parseInt(b[1], 16)) / 4 },
      { pid: '0D', name: 'Velocidad',             unit: 'km/h',parse: (b) => parseInt(b[0], 16) },
      { pid: '0F', name: 'Temp. admisión',        unit: '°C',  parse: (b) => parseInt(b[0], 16) - 40 },
      { pid: '10', name: 'Flujo aire (MAF)',      unit: 'g/s', parse: (b) => ((parseInt(b[0], 16) << 8) | parseInt(b[1], 16)) / 100 },
      { pid: '11', name: 'Acelerador',            unit: '%',   parse: (b) => (parseInt(b[0], 16) / 255) * 100 },
      { pid: '06', name: 'Trim combustible corto',unit: '%',   parse: (b) => (parseInt(b[0], 16) / 128 - 1) * 100 },
      { pid: '07', name: 'Trim combustible largo',unit: '%',   parse: (b) => (parseInt(b[0], 16) / 128 - 1) * 100 },
    ]

    try {
      const entries: FreezeFrameEntryDTO[] = []

      for (const { pid, name, unit, parse } of PIDS) {
        try {
          const resp = await OBDNative.sendCommand({ command: `02 ${pid} 00\r` })
          if (!resp.ok || !resp.response) continue

          const tokens = resp.response
            .toUpperCase()
            .replace(/>/g, '')
            .split(/\s+/)
            .filter((t: string) => /^[0-9A-F]{2}$/.test(t))

          // Mode 02 response: 42 [PID] [FRAME] [DATA...]
          const idx = tokens.indexOf('42')
          if (idx < 0 || tokens[idx + 1]?.toUpperCase() !== pid.toUpperCase()) continue

          const dataBytes = tokens.slice(idx + 3) // skip 42, PID, frame number
          if (dataBytes.length === 0 || dataBytes[0] === undefined) continue

          const value = parse(dataBytes)
          if (!isNaN(value)) entries.push({ pid, name, unit, value })
        } catch {
          // PID no soportado por este vehículo
        }
      }

      return ok({ frameNumber: 0, entries })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('PARSE_ERROR', `readFreezeFrame failed: ${msg}`)
    }
  },

  // ── Session methods ───────────────────────────────────────────────────────

  async getSessions(): Promise<Result<SessionDTO[]>> {
    try {
      return ok(await dbGetSessions())
    } catch (e) {
      return fail('DB_ERROR', `getSessions failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  },

  async getSession(id: number): Promise<Result<SessionDetailDTO>> {
    try {
      const session = await dbGetSession(id)
      if (session === null) return fail('DB_ERROR', `Session ${id} not found`)
      return ok(session)
    } catch (e) {
      return fail('DB_ERROR', `getSession failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  },

  async deleteSession(id: number): Promise<Result<void>> {
    try {
      await dbDeleteSession(id)
      return ok(undefined)
    } catch (e) {
      return fail('DB_ERROR', `deleteSession failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  },
}

export const obd: OBDAPI = obdBridge
