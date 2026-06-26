import dtcDatabase from '../data/dtc-codes.json'

export interface ParsedDTC {
  code: string
  category: 'P' | 'C' | 'B' | 'U'
  description: string
  descriptionEs: string
  isPending: boolean
  isPermanent: boolean
}

/**
 * Category map: first 2 bits of first byte
 * 00 = P (Powertrain)
 * 01 = C (Chassis)
 * 10 = B (Body)
 * 11 = U (Network)
 */
const CATEGORY_MAP: Record<number, 'P' | 'C' | 'B' | 'U'> = {
  0: 'P',
  1: 'C',
  2: 'B',
  3: 'U',
}

/**
 * Converts two OBD-II DTC bytes into a DTC code string.
 *
 * Byte 1 format: CC DD XXXX
 *   CC = category (2 bits): 00=P, 01=C, 10=B, 11=U
 *   DD = first digit (2 bits): 0–3
 *   XXXX = second digit (4 bits): 0–F
 * Byte 2: third and fourth digits (two hex nibbles)
 */
export function bytesToDTCCode(byte1: number, byte2: number): string {
  const categoryBits = (byte1 >> 6) & 0x03
  const category = CATEGORY_MAP[categoryBits]

  const firstDigit = (byte1 >> 4) & 0x03
  const secondDigit = byte1 & 0x0F

  const thirdDigit = (byte2 >> 4) & 0x0F
  const fourthDigit = byte2 & 0x0F

  return `${category}${firstDigit}${secondDigit.toString(16).toUpperCase()}${thirdDigit.toString(16).toUpperCase()}${fourthDigit.toString(16).toUpperCase()}`
}

/**
 * Looks up a DTC code in the database.
 * Returns English and Spanish descriptions, or generic unknown messages.
 */
export function lookupDTC(code: string): { en: string; es: string } {
  const db = dtcDatabase as Record<string, { en: string; es: string }>
  const entry = db[code.toUpperCase()]
  if (entry) {
    return { en: entry.en, es: entry.es }
  }
  return {
    en: `Unknown fault code ${code}`,
    es: `Código de fallo desconocido ${code}`,
  }
}

/**
 * Parses the raw ELM327 response from Mode 03, 07, or 0A into an array of ParsedDTC.
 *
 * OBD-II Mode 03 response format:
 *   43 XX YY XX YY ... (mode 43 = response to 03)
 *   Each pair of bytes (XX YY) is one DTC
 *   00 00 means no DTC
 *
 * With headers on (ATH1), lines may have CAN headers prepended.
 */
export function parseDTCResponse(raw: string, isPending = false, isPermanent = false): ParsedDTC[] {
  if (!raw) return []

  const rawUpper = raw.toUpperCase()

  // Check for error/no data conditions
  const errorPatterns = ['NO DATA', 'ERROR', 'UNABLE TO CONNECT', 'BUS INIT', 'STOPPED', 'CAN ERROR']
  for (const pattern of errorPatterns) {
    if (rawUpper.includes(pattern)) return []
  }

  // Determine the expected response mode byte
  // Mode 03 → 43, Mode 07 → 47, Mode 0A → 4A
  let responseByte: string
  if (isPending) {
    responseByte = '47'
  } else if (isPermanent) {
    responseByte = '4A'
  } else {
    responseByte = '43'
  }

  // Split into lines, clean up
  const lines = raw
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== '>' && !l.includes(':'))

  // Collect all hex bytes from lines containing the response mode byte
  const allBytes: number[] = []

  for (const line of lines) {
    const cleaned = line.replace(/\s/g, '').toUpperCase()

    // Find the response mode byte in this line
    const idx = cleaned.indexOf(responseByte)
    if (idx === -1) continue

    // Extract hex after the response byte
    const dataHex = cleaned.slice(idx + 2) // skip the response byte (2 chars)

    // Parse hex pairs
    for (let i = 0; i < dataHex.length - 1; i += 2) {
      const hexByte = dataHex.slice(i, i + 2)
      const byteVal = parseInt(hexByte, 16)
      if (!isNaN(byteVal)) {
        allBytes.push(byteVal)
      }
    }
  }

  // Parse DTC pairs (2 bytes per DTC)
  const dtcs: ParsedDTC[] = []

  for (let i = 0; i < allBytes.length - 1; i += 2) {
    const byte1 = allBytes[i]
    const byte2 = allBytes[i + 1]

    // 00 00 means no DTC
    if (byte1 === 0x00 && byte2 === 0x00) continue

    const code = bytesToDTCCode(byte1, byte2)
    const { en, es } = lookupDTC(code)

    const categoryBits = (byte1 >> 6) & 0x03
    const category = CATEGORY_MAP[categoryBits]

    dtcs.push({
      code,
      category,
      description: en,
      descriptionEs: es,
      isPending,
      isPermanent,
    })
  }

  return dtcs
}
