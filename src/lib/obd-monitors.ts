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
  kmWithMIL: number      // PID 21 — km recorridos con la luz de avería encendida
  kmSinceClear: number   // PID 31 — km recorridos desde el último borrado de DTCs
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
      return { milOn: false, dtcCount: 0, monitors: [], kmWithMIL: 0, kmSinceClear: 0 }
    }

    const tokens = parseTokens(resp.response)
    const idx = tokens.indexOf('41')

    if (idx < 0 || tokens[idx + 1] !== '01') {
      return { milOn: false, dtcCount: 0, monitors: [], kmWithMIL: 0, kmSinceClear: 0 }
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

    // PID 21 — Distancia recorrida con MIL encendido
    let kmWithMIL = 0
    try {
      const r21 = await OBDNative.sendCommand({ command: '01 21\r' })
      if (r21.ok && r21.response) {
        const t21 = parseTokens(r21.response)
        const i21 = t21.indexOf('41')
        if (i21 >= 0 && t21[i21 + 1] === '21' && t21[i21 + 2] && t21[i21 + 3]) {
          kmWithMIL = (parseInt(t21[i21 + 2], 16) << 8) | parseInt(t21[i21 + 3], 16)
        }
      }
    } catch {}

    // PID 31 — Distancia recorrida desde el borrado de DTCs
    let kmSinceClear = 0
    try {
      const r31 = await OBDNative.sendCommand({ command: '01 31\r' })
      if (r31.ok && r31.response) {
        const t31 = parseTokens(r31.response)
        const i31 = t31.indexOf('41')
        if (i31 >= 0 && t31[i31 + 1] === '31' && t31[i31 + 2] && t31[i31 + 3]) {
          kmSinceClear = (parseInt(t31[i31 + 2], 16) << 8) | parseInt(t31[i31 + 3], 16)
        }
      }
    } catch {}

    return { milOn, dtcCount, monitors, kmWithMIL, kmSinceClear }
  } catch {
    return { milOn: false, dtcCount: 0, monitors: [], kmWithMIL: 0, kmSinceClear: 0 }
  }
}
