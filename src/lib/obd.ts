/**
 * Bridge between the OBDAPI interface and the native Capacitor OBDPlugin.
 *
 * Responsibilities:
 *  - Adapts the Bluetooth MAC-address-based native API to the port-string
 *    convention used by the rest of the app (port = MAC address on Android).
 *  - Manages native event listener lifecycles.
 *  - Parses raw ELM327 hex responses into typed DTOs.
 *  - Delegates session persistence to db-bridge (created by another agent).
 */

import { Capacitor } from '@capacitor/core'
import { OBDNative } from '../capacitor/obd-plugin'

const isNative = Capacitor.isNativePlatform()
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
  DTCCodeDTO,
  DTCCategory,
  VehicleInfoDTO,
  SessionDTO,
  SessionDetailDTO,
} from '../types/obd'

// db-bridge returns raw values (not Result<T>); the session methods below wrap them.

// ─── Listener handle map ──────────────────────────────────────────────────────
// We store one native listener handle per logical event type so we can remove
// it when the JS caller un-subscribes.

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

// ─── DTC parsing ─────────────────────────────────────────────────────────────

const DTC_CATEGORY_MAP: DTCCategory[] = ['P', 'C', 'B', 'U']

/**
 * Minimal DTC description lookup (English + Spanish).
 * A full database lives in a separate asset; here we return a sensible default.
 */
function dtcDescription(code: string): { en: string; es: string } {
  return {
    en: `Fault code ${code}`,
    es: `Código de fallo ${code}`,
  }
}

/**
 * Parse the raw hex bytes from OBD mode 03 (stored DTCs) or mode 07 (pending).
 *
 * Protocol: each DTC occupies 2 bytes.
 *   Byte 1: bits 7-6 → category (0=P,1=C,2=B,3=U)
 *           bits 5-4 → first digit (0-3)
 *           bits 3-0 → second digit (0-F)
 *   Byte 2: third + fourth digits (0-FF)
 *
 * A pair of 0x00 0x00 means "no DTC" and is skipped.
 */
function parseDTCBytes(hexTokens: string[], isPending: boolean): DTCCodeDTO[] {
  const dtcs: DTCCodeDTO[] = []

  for (let i = 0; i + 1 < hexTokens.length; i += 2) {
    const hi = parseInt(hexTokens[i], 16)
    const lo = parseInt(hexTokens[i + 1], 16)

    if (hi === 0 && lo === 0) continue // empty slot
    if (isNaN(hi) || isNaN(lo)) continue

    const categoryIdx = (hi >> 6) & 0x03
    const category = DTC_CATEGORY_MAP[categoryIdx]

    const d1 = (hi >> 4) & 0x03  // first digit after category letter (0-3)
    const d2 = hi & 0x0f          // second digit
    const d34 = lo.toString(16).padStart(2, '0').toUpperCase()

    const numericPart = `${d1}${d2.toString(16).toUpperCase()}${d34}`
    const code = `${category}${numericPart}`

    const { en, es } = dtcDescription(code)
    dtcs.push({
      code,
      category,
      description: en,
      descriptionEs: es,
      isPending,
      isPermanent: false,
    })
  }

  return dtcs
}

/**
 * Extract hex data bytes from a multi-line ELM327 response.
 * Strips mode byte, PID/frame bytes, and ECU address headers.
 * Returns a flat array of two-character hex strings.
 */
function extractHexBytes(raw: string, responseMode: string): string[] {
  const lines = raw.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean)
  const result: string[] = []

  for (const line of lines) {
    const tokens = line.toUpperCase().split(/\s+/)
    // Find the mode response byte (e.g. "43" for mode 03 response)
    const modeIdx = tokens.indexOf(responseMode.toUpperCase())
    if (modeIdx >= 0) {
      // Skip the mode byte; the next byte is the DTC count, then pairs follow
      result.push(...tokens.slice(modeIdx + 2)) // +2 to also skip count byte
    }
  }

  return result.filter((t) => t.match(/^[0-9A-F]{2}$/))
}

// ─── VIN / vehicle info parsing ───────────────────────────────────────────────

/**
 * Parse mode 09 PID 02 (VIN) response.
 * ELM327 returns multiple frames; each frame starts with a sequence number.
 * ASCII bytes follow after the header.
 */
function parseVIN(raw: string): string {
  // Remove all non-printable except hex and spaces
  const cleaned = raw
    .replace(/>/g, '')
    .replace(/\r/g, '\n')
    .trim()

  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean)
  const hexBytes: string[] = []

  for (const line of lines) {
    const tokens = line.toUpperCase().split(/\s+/)
    // Skip frame counter tokens (single hex digit like "0:", "1:", etc.)
    for (const t of tokens) {
      if (/^[0-9A-F]{2}$/.test(t)) hexBytes.push(t)
    }
  }

  // Mode 09 response: 49 02 <count> <vin bytes...>
  const idx49 = hexBytes.indexOf('49')
  if (idx49 >= 0 && hexBytes[idx49 + 1] === '02') {
    // Skip 49 02 <count>
    const vinBytes = hexBytes.slice(idx49 + 3)
    return vinBytes
      .map((b) => String.fromCharCode(parseInt(b, 16)))
      .filter((c) => c >= ' ' && c <= '~')
      .join('')
      .trim()
  }

  return 'UNKNOWN'
}

/**
 * Parse "ATDPN" response to get numeric protocol and its name.
 */
function parseProtocol(raw: string): { number: string; name: string } {
  const cleaned = raw.replace(/>/g, '').replace(/\r|\n/g, ' ').trim()
  // ATDPN returns e.g. "A6" (auto-detected, protocol 6) or just "6"
  const match = cleaned.match(/([A-Z]?)([0-9A-F])/i)
  if (!match) return { number: '0', name: 'Unknown' }

  const num = match[2].toUpperCase()
  const names: Record<string, string> = {
    '1': 'SAE J1850 PWM',
    '2': 'SAE J1850 VPW',
    '3': 'ISO 9141-2',
    '4': 'ISO 14230-4 KWP (5 baud init)',
    '5': 'ISO 14230-4 KWP (fast init)',
    '6': 'ISO 15765-4 CAN (11-bit, 500 kbaud)',
    '7': 'ISO 15765-4 CAN (29-bit, 500 kbaud)',
    '8': 'ISO 15765-4 CAN (11-bit, 250 kbaud)',
    '9': 'ISO 15765-4 CAN (29-bit, 250 kbaud)',
    A: 'SAE J1939 CAN',
    B: 'USER1 CAN',
    C: 'USER2 CAN',
  }

  return { number: num, name: names[num] ?? `Protocol ${num}` }
}

/**
 * Parse mode 01 PID 00 response to extract supported PIDs bitmask.
 * Returns a list of supported PID strings (e.g. ["01","03","04",...]).
 */
function parseSupportedPIDs(raw: string): string[] {
  const lines = raw.replace(/>/g, '').split(/[\r\n]+/).map((l) => l.trim())
  const supported: string[] = []

  for (const line of lines) {
    const tokens = line.toUpperCase().split(/\s+/)
    const idx = tokens.indexOf('41')
    if (idx >= 0 && tokens[idx + 1] === '00') {
      const dataBytes = tokens.slice(idx + 2, idx + 6)
      if (dataBytes.length < 4) continue

      let bitmask = 0
      for (const b of dataBytes) {
        bitmask = (bitmask << 8) | parseInt(b, 16)
      }

      for (let bit = 31; bit >= 0; bit--) {
        if (bitmask & (1 << bit)) {
          const pid = (32 - bit).toString(16).padStart(2, '0').toUpperCase()
          supported.push(pid)
        }
      }
      break
    }
  }

  return supported
}

// ─── OBDAPI implementation ────────────────────────────────────────────────────

const obdBridge: OBDAPI = {
  // ── listPorts ─────────────────────────────────────────────────────────────
  async listPorts(): Promise<Result<PortInfoDTO[]>> {
    try {
      const { devices } = await OBDNative.listDevices()
      const ports: PortInfoDTO[] = devices.map((d: { address: string; name: string }) => ({
        // On Android the "path" is the Bluetooth MAC address
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

      const storedRaw = stored03.response ?? ''
      const storedHex = extractHexBytes(storedRaw, '43')
      const storedDTCs = parseDTCBytes(storedHex, false)

      // Mode 07 — pending DTCs
      const pending07 = await OBDNative.sendCommand({ command: '07\r' })
      const pendingRaw = pending07.response ?? ''
      const pendingHex = extractHexBytes(pendingRaw, '47')
      const pendingDTCs = parseDTCBytes(pendingHex, true)

      // Mode 01 PID 01 — MIL status + ready/incomplete test counts
      const milResp = await OBDNative.sendCommand({ command: '01 01\r' })
      let milOn = false
      let readyTests = 0
      let incompleteTests = 0

      if (milResp.ok && milResp.response) {
        const milRaw = milResp.response.toUpperCase()
        const tokens = milRaw.replace(/>/g, '').split(/\s+/).filter((t: string) => t.match(/^[0-9A-F]{2}$/))
        const idx = tokens.indexOf('41')
        if (idx >= 0 && tokens[idx + 1] === '01' && tokens[idx + 2]) {
          const a = parseInt(tokens[idx + 2], 16)
          milOn = !!(a & 0x80)
          // Bits 0-6 of byte A are incomplete tests; byte C is ready
          incompleteTests = a & 0x7f
        }
        if (idx >= 0 && tokens[idx + 4]) {
          const c = parseInt(tokens[idx + 4], 16)
          readyTests = 8 - (c & 0x0f)
        }
      }

      return ok({
        stored: storedDTCs,
        pending: pendingDTCs,
        permanent: [], // Mode 0A (permanent DTCs) requires CAN; skip for now
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
      // ELM327 responds with "44" on success
      if (result.response && !result.response.toUpperCase().includes('44')) {
        return fail('PARSE_ERROR', `Unexpected clear-DTC response: ${result.response}`)
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

      // ECU count — mode 09 PID 04 (ECU name gives count indirectly; use header count)
      // Simple heuristic: count distinct ECU addresses in the 01 00 response
      const ecuCount = 1 // Default; advanced multi-ECU detection is out of scope here

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
          const val = parseInt(tokens[idx + 2], 16)
          const standards: Record<number, string> = {
            1: 'OBD-II (CARB)',
            2: 'OBD (EPA)',
            3: 'OBD and OBD-II',
            4: 'OBD-I',
            5: 'Not OBD compliant',
            6: 'EOBD',
            7: 'EOBD and OBD-II',
            9: 'EOBD and OBD',
            11: 'EMD',
            12: 'EMD+',
            13: 'HD OBD-C',
            14: 'HD OBD',
            15: 'WWH OBD',
          }
          obdStandard = standards[val] ?? `Standard ${val}`
        }
      }

      return ok({ vin, protocol, protocolName, supportedPIDs, ecuCount, obdStandard })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('PARSE_ERROR', `getVehicleInfo failed: ${msg}`)
    }
  },

  // ── Session methods (delegated to db-bridge) ──────────────────────────────
  // db-bridge returns raw values; we wrap them in Result<T> here.

  async getSessions(): Promise<Result<SessionDTO[]>> {
    try {
      const sessions = await dbGetSessions()
      return ok(sessions)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('DB_ERROR', `getSessions failed: ${msg}`)
    }
  },

  async getSession(id: number): Promise<Result<SessionDetailDTO>> {
    try {
      const session = await dbGetSession(id)
      if (session === null) {
        return fail('DB_ERROR', `Session ${id} not found`)
      }
      return ok(session)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('DB_ERROR', `getSession failed: ${msg}`)
    }
  },

  async deleteSession(id: number): Promise<Result<void>> {
    try {
      await dbDeleteSession(id)
      return ok(undefined)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail('DB_ERROR', `deleteSession failed: ${msg}`)
    }
  },
}

export const obd: OBDAPI = obdBridge
