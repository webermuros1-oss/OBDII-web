import { OBDNative } from '../capacitor/obd-plugin'

export interface MonitorStatus {
  name: string
  nameEs: string
  supported: boolean
  ready: boolean
}

export interface MonitorsResult {
  milOn: boolean
  dtcCount: number
  monitors: MonitorStatus[]
}

const CONTINUOUS_MONITORS = [
  { nameEs: 'Encendido/Chispa', name: 'Misfire', bit: 0 },
  { nameEs: 'Sistema combustible', name: 'Fuel System', bit: 1 },
  { nameEs: 'Componentes motor', name: 'Components', bit: 2 },
]

const NON_CONTINUOUS_MONITORS = [
  { nameEs: 'Catalizador', name: 'Catalyst', bit: 0 },
  { nameEs: 'Catalizador calefactado', name: 'Heated Catalyst', bit: 1 },
  { nameEs: 'Sistema evaporativo', name: 'Evaporative System', bit: 2 },
  { nameEs: 'Aire secundario', name: 'Secondary Air', bit: 3 },
  { nameEs: 'Sensores de oxígeno', name: 'O2 Sensors', bit: 5 },
  { nameEs: 'Calentador sonda lambda', name: 'O2 Heater', bit: 6 },
  { nameEs: 'EGR / VVT', name: 'EGR/VVT', bit: 7 },
]

function parseTokens(raw: string): string[] {
  return raw
    .toUpperCase()
    .replace(/>/g, '')
    .split(/\s+/)
    .filter((t) => /^[0-9A-F]{2}$/.test(t))
}

export async function readMonitors(): Promise<MonitorsResult> {
  try {
    const resp = await OBDNative.sendCommand({ command: '01 01\r' })

    if (!resp.ok || !resp.response) {
      return { milOn: false, dtcCount: 0, monitors: [] }
    }

    const tokens = parseTokens(resp.response)
    const idx = tokens.indexOf('41')

    if (idx < 0 || tokens[idx + 1] !== '01') {
      return { milOn: false, dtcCount: 0, monitors: [] }
    }

    const A = parseInt(tokens[idx + 2] ?? '00', 16)
    const B = parseInt(tokens[idx + 3] ?? '00', 16)
    const C = parseInt(tokens[idx + 4] ?? '00', 16)
    const D = parseInt(tokens[idx + 5] ?? '00', 16)

    const milOn = !!(A & 0x80)
    const dtcCount = A & 0x7f

    const monitors: MonitorStatus[] = []

    for (const m of CONTINUOUS_MONITORS) {
      monitors.push({
        name: m.name,
        nameEs: m.nameEs,
        supported: true,
        ready: !(C & (1 << m.bit)),
      })
    }

    for (const m of NON_CONTINUOUS_MONITORS) {
      const supported = !!(B & (1 << m.bit))
      monitors.push({
        name: m.name,
        nameEs: m.nameEs,
        supported,
        ready: supported ? !(D & (1 << m.bit)) : false,
      })
    }

    return { milOn, dtcCount, monitors }
  } catch {
    return { milOn: false, dtcCount: 0, monitors: [] }
  }
}
