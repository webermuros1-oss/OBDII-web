import type { DTCCodeDTO, DTCCategory } from '../types/obd'

export type AppFuelType = 'Gasolina' | 'Diésel' | 'Híbrido' | 'Eléctrico'

// ─── WMI (World Manufacturer Identifier) lookup ──────────────────────────────

export const WMI_MAP: Record<string, string> = {
  VF1: 'Renault', VF3: 'Peugeot', VF7: 'Citroën', VFA: 'Alpine', VF6: 'Renault',
  WBA: 'BMW', WBS: 'BMW M', WBY: 'BMW', WDD: 'Mercedes-Benz', WDC: 'Mercedes-Benz',
  WVW: 'Volkswagen', WAU: 'Audi', WP0: 'Porsche', W0L: 'Opel', WKK: 'Opel',
  ZFA: 'Fiat', ZFF: 'Ferrari', ZLA: 'Lancia', ZAR: 'Alfa Romeo', ZHW: 'Lamborghini',
  VSS: 'SEAT', VNK: 'Toyota ES', VS6: 'Ford ES',
  SAL: 'Land Rover', SAJ: 'Jaguar', SCB: 'Bentley', SCC: 'Lotus',
  JHM: 'Honda', JTD: 'Toyota', JN1: 'Nissan', JMB: 'Mitsubishi', JS3: 'Suzuki',
  KNA: 'Kia', KMH: 'Hyundai',
  '1FA': 'Ford', '1G1': 'Chevrolet', '1HG': 'Honda', '2T1': 'Toyota',
}

export function decodeWMI(vin: string): string | null {
  if (vin.length < 3) return null
  const w3 = vin.substring(0, 3).toUpperCase()
  const w2 = vin.substring(0, 2).toUpperCase()
  return WMI_MAP[w3] ?? WMI_MAP[w2] ?? null
}

// ─── DTC parsing ─────────────────────────────────────────────────────────────

const DTC_CATEGORY_MAP: DTCCategory[] = ['P', 'C', 'B', 'U']

function dtcDescription(code: string): { en: string; es: string } {
  return { en: `Fault code ${code}`, es: `Código de fallo ${code}` }
}

/**
 * Parse raw hex bytes from OBD mode 03 / 07 (stored / pending DTCs).
 * Each DTC occupies 2 bytes; 0x00 0x00 pairs are empty slots (skipped).
 */
export function parseDTCBytes(hexTokens: string[], isPending: boolean): DTCCodeDTO[] {
  const dtcs: DTCCodeDTO[] = []

  for (let i = 0; i + 1 < hexTokens.length; i += 2) {
    const hi = parseInt(hexTokens[i], 16)
    const lo = parseInt(hexTokens[i + 1], 16)

    if (hi === 0 && lo === 0) continue
    if (isNaN(hi) || isNaN(lo)) continue

    const categoryIdx = (hi >> 6) & 0x03
    const category = DTC_CATEGORY_MAP[categoryIdx]
    const d1 = (hi >> 4) & 0x03
    const d2 = hi & 0x0f
    const d34 = lo.toString(16).padStart(2, '0').toUpperCase()
    const code = `${category}${d1}${d2.toString(16).toUpperCase()}${d34}`

    const { en, es } = dtcDescription(code)
    dtcs.push({ code, category, description: en, descriptionEs: es, isPending, isPermanent: false })
  }

  return dtcs
}

/**
 * Extract hex data bytes from a multi-line ELM327 response.
 * Strips mode byte, PID/frame bytes, and ECU address headers.
 */
export function extractHexBytes(raw: string, responseMode: string): string[] {
  const lines = raw.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean)
  const result: string[] = []

  for (const line of lines) {
    const tokens = line.toUpperCase().split(/\s+/)
    const modeIdx = tokens.indexOf(responseMode.toUpperCase())
    if (modeIdx >= 0) {
      result.push(...tokens.slice(modeIdx + 2))
    }
  }

  return result.filter((t) => t.match(/^[0-9A-F]{2}$/))
}

// ─── VIN parsing ─────────────────────────────────────────────────────────────

/**
 * Parse mode 09 PID 02 (VIN) response.
 * Filters to valid VIN characters only — removes CAN PCI bytes (0x21=!, 0x22=").
 */
export function parseVIN(raw: string): string {
  const cleaned = raw.replace(/>/g, '').replace(/\r/g, '\n').trim()
  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean)
  const hexBytes: string[] = []

  for (const line of lines) {
    const tokens = line.toUpperCase().split(/\s+/)
    for (const t of tokens) {
      if (/^[0-9A-F]{2}$/.test(t)) hexBytes.push(t)
    }
  }

  const idx49 = hexBytes.indexOf('49')
  if (idx49 >= 0 && hexBytes[idx49 + 1] === '02') {
    const vinBytes = hexBytes.slice(idx49 + 3)
    return vinBytes
      .map((b) => String.fromCharCode(parseInt(b, 16)))
      .filter((c) => /[A-HJ-NPR-Z0-9]/i.test(c))
      .join('')
      .trim()
  }

  return 'UNKNOWN'
}

// ─── Protocol parsing ─────────────────────────────────────────────────────────

const PROTOCOL_NAMES: Record<string, string> = {
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

/** Parse "ATDPN" response into numeric protocol id and human-readable name. */
export function parseProtocol(raw: string): { number: string; name: string } {
  const cleaned = raw.replace(/>/g, '').replace(/\r|\n/g, ' ').trim()
  const match = cleaned.match(/([A-Z]?)([0-9A-F])/i)
  if (!match) return { number: '0', name: 'Unknown' }
  const num = match[2].toUpperCase()
  return { number: num, name: PROTOCOL_NAMES[num] ?? `Protocol ${num}` }
}

// ─── Supported PIDs parsing ───────────────────────────────────────────────────

/** Parse mode 01 PID 00 response → list of supported PID hex strings. */
export function parseSupportedPIDs(raw: string): string[] {
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

// ─── PID 51 fuel type ────────────────────────────────────────────────────────

const PID51_FUEL_MAP: Record<number, AppFuelType> = {
  0x01: 'Gasolina', // Gasoline/Petrol
  0x02: 'Gasolina', // Methanol
  0x03: 'Gasolina', // Ethanol
  0x04: 'Diésel',   // Diesel
  0x05: 'Gasolina', // LPG
  0x06: 'Gasolina', // CNG
  0x07: 'Gasolina', // Propane
  0x08: 'Eléctrico',// Electric
  0x09: 'Gasolina', // Bifuel (running gas)
  0x0A: 'Gasolina', // Bifuel (running LPG)
  0x0B: 'Gasolina', // Bifuel (running CNG)
  0x0C: 'Gasolina', // Bifuel (running propane)
  0x0D: 'Híbrido',  // Bifuel (running electricity)
  0x0E: 'Híbrido',  // Bifuel electricity + combustion
  0x0F: 'Híbrido',  // Hybrid gasoline
  0x10: 'Híbrido',  // Hybrid ethanol
  0x11: 'Híbrido',  // Hybrid diesel
  0x12: 'Híbrido',  // Hybrid electric
  0x13: 'Híbrido',  // Hybrid mixed fuel
  0x14: 'Híbrido',  // Hybrid regenerative
}

/**
 * Parse mode 01 PID 51 response → app fuel type string.
 * Returns null if PID 51 is not supported or response is invalid.
 */
export function parseFuelTypePID51(raw: string): AppFuelType | null {
  const tokens = raw
    .toUpperCase()
    .replace(/>/g, '')
    .split(/\s+/)
    .filter((t) => t.match(/^[0-9A-F]{2}$/))

  const idx = tokens.indexOf('41')
  if (idx < 0 || tokens[idx + 1] !== '51' || !tokens[idx + 2]) return null

  const byte = parseInt(tokens[idx + 2], 16)
  return PID51_FUEL_MAP[byte] ?? null
}
