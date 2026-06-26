export interface PIDDefinition {
  pid: string
  name: string
  unit: string
  min: number
  max: number
  parse(bytes: number[]): number
}

export const PIDS: Record<string, PIDDefinition> = {
  '04': {
    pid: '04',
    name: 'Carga del motor',
    unit: '%',
    min: 0,
    max: 100,
    parse: (b) => Math.round(b[0] * 100 / 255),
  },
  '05': {
    pid: '05',
    name: 'Temp. refrigerante',
    unit: '°C',
    min: -40,
    max: 215,
    parse: (b) => b[0] - 40,
  },
  '0A': {
    pid: '0A',
    name: 'Presión combustible',
    unit: 'kPa',
    min: 0,
    max: 765,
    parse: (b) => b[0] * 3,
  },
  '0B': {
    pid: '0B',
    name: 'Presión colector',
    unit: 'kPa',
    min: 0,
    max: 255,
    parse: (b) => b[0],
  },
  '0C': {
    pid: '0C',
    name: 'RPM',
    unit: 'rpm',
    min: 0,
    max: 16383,
    parse: (b) => Math.round(((b[0] * 256) + b[1]) / 4),
  },
  '0D': {
    pid: '0D',
    name: 'Velocidad',
    unit: 'km/h',
    min: 0,
    max: 255,
    parse: (b) => b[0],
  },
  '0E': {
    pid: '0E',
    name: 'Avance encendido',
    unit: '°',
    min: -64,
    max: 63.5,
    parse: (b) => b[0] / 2 - 64,
  },
  '0F': {
    pid: '0F',
    name: 'Temp. aire admisión',
    unit: '°C',
    min: -40,
    max: 215,
    parse: (b) => b[0] - 40,
  },
  '10': {
    pid: '10',
    name: 'Flujo de masa MAF',
    unit: 'g/s',
    min: 0,
    max: 655.35,
    parse: (b) => Math.round(((b[0] * 256) + b[1]) / 100 * 100) / 100,
  },
  '11': {
    pid: '11',
    name: 'Posición mariposa',
    unit: '%',
    min: 0,
    max: 100,
    parse: (b) => Math.round(b[0] * 100 / 255),
  },
  '1F': {
    pid: '1F',
    name: 'Tiempo en marcha',
    unit: 's',
    min: 0,
    max: 65535,
    parse: (b) => (b[0] * 256) + b[1],
  },
  '2F': {
    pid: '2F',
    name: 'Nivel combustible',
    unit: '%',
    min: 0,
    max: 100,
    parse: (b) => Math.round(b[0] * 100 / 255),
  },
  '33': {
    pid: '33',
    name: 'Presión barométrica',
    unit: 'kPa',
    min: 0,
    max: 255,
    parse: (b) => b[0],
  },
  '46': {
    pid: '46',
    name: 'Temp. ambiente',
    unit: '°C',
    min: -40,
    max: 215,
    parse: (b) => b[0] - 40,
  },
  '5C': {
    pid: '5C',
    name: 'Temp. aceite motor',
    unit: '°C',
    min: -40,
    max: 215,
    parse: (b) => b[0] - 40,
  },
}

/**
 * Parses a raw ELM327 response for a Mode 01 PID query into data bytes.
 *
 * ELM327 response format (with ATH1 headers on, ATS0 spaces off):
 *   [HEADER]41XX<data bytes>
 * With ATS0 (spaces off) and ATH1 the response looks like:
 *   7E8064104BB0F>
 * But many adapters still include spaces even with ATS0. We handle both.
 *
 * Returns null on NO DATA, ERROR, or any parse failure.
 */
export function parseRawResponse(raw: string, pid: string): number[] | null {
  if (!raw) return null

  // Normalize: remove echo (lines containing the sent command), prompt, CR/LF
  const pidUpper = pid.toUpperCase()

  // Error patterns
  const errorPatterns = ['NO DATA', 'ERROR', 'UNABLE TO CONNECT', 'BUS INIT', 'STOPPED', 'CAN ERROR']
  const rawUpper = raw.toUpperCase()
  for (const pattern of errorPatterns) {
    if (rawUpper.includes(pattern)) return null
  }

  // Split into lines, filter out the echo and prompt
  const lines = raw
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== '>')

  // Remove echo lines (lines that match the sent command pattern)
  const dataLines = lines.filter((l) => {
    const upper = l.toUpperCase().replace(/\s/g, '')
    // Filter out the echo: "0104", "01 04", etc.
    if (upper === `01${pidUpper}`) return false
    if (upper.startsWith('>')) return false
    return true
  })

  // Look for the Mode 01 response line: starts with "41 XX" or "41XX"
  // With headers on there may be a CAN header prefix (e.g. "7E8 06 41 04 BB 0F")
  const expectedResponse = `41${pidUpper}`

  for (const line of dataLines) {
    const cleaned = line.replace(/\s/g, '').toUpperCase()

    // Find the "41XX" pattern in the cleaned string
    const idx = cleaned.indexOf(expectedResponse)
    if (idx === -1) continue

    // Extract bytes after "41XX"
    const dataHex = cleaned.slice(idx + expectedResponse.length)

    // Parse hex pairs into byte values
    if (dataHex.length === 0) continue

    const bytes: number[] = []
    for (let i = 0; i < dataHex.length - 1; i += 2) {
      const hexByte = dataHex.slice(i, i + 2)
      const byteVal = parseInt(hexByte, 16)
      if (isNaN(byteVal)) break
      bytes.push(byteVal)
    }

    if (bytes.length > 0) return bytes
  }

  return null
}
