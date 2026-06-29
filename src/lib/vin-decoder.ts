import type { AppFuelType } from './obd-parsers'

export type { AppFuelType }

export interface VINDecoded {
  make?: string
  model?: string
  year?: string
  engine?: string
  fuel?: AppFuelType
}

/** Map an NHTSA FuelTypePrimary string to the app's fuel type. */
export function mapNHTSAFuelType(raw: string): AppFuelType | null {
  const s = raw.trim().toLowerCase()
  if (!s) return null
  if (s.includes('diesel')) return 'Diésel'
  // Check hybrid/plug-in before electric — plug-in hybrids contain 'electric' too
  if (s.includes('hybrid') || s.includes('plug-in')) return 'Híbrido'
  if (s.includes('electric')) return 'Eléctrico'
  if (s.includes('gasoline') || s.includes('gas') || s.includes('petrol') || s.includes('flex')) {
    return 'Gasolina'
  }
  return null
}

/** Format engine displacement + cylinder count into a human-readable string. */
export function formatEngineDescription(displacementL: string, cylinders: string): string | null {
  const dispNum = parseFloat(displacementL)
  if (!displacementL || isNaN(dispNum) || dispNum === 0) return null

  const disp = dispNum.toFixed(1)
  const cyl = parseInt(cylinders)
  if (!isNaN(cyl) && cyl > 0) return `${disp} L ${cyl} cil.`
  return `${disp} L`
}

function capitalize(s: string): string {
  if (!s) return s
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Fetch vehicle data from NHTSA free VIN decoder API.
 * Returns null on network error, invalid VIN, or if NHTSA has no data.
 * No API key required.
 */
export async function decodeVINfromNHTSA(vin: string): Promise<VINDecoded | null> {
  try {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(vin)}?format=json`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const json = (await res.json()) as { Results?: Array<Record<string, string>> }
    const result = json.Results?.[0]
    if (!result) return null

    // ErrorCode '0' = clean decode, '1' = partial match, anything else = failed
    const errorCode = (result['ErrorCode'] ?? '').split(',')[0].trim()
    if (errorCode !== '0' && errorCode !== '1') return null

    const decoded: VINDecoded = {}

    if (result['Make']) decoded.make = capitalize(result['Make'])
    if (result['Model']) decoded.model = capitalize(result['Model'])
    if (result['ModelYear'] && /^\d{4}$/.test(result['ModelYear'])) {
      decoded.year = result['ModelYear']
    }

    const engine = formatEngineDescription(
      result['DisplacementL'] ?? '',
      result['EngineCylinders'] ?? ''
    )
    if (engine) decoded.engine = engine

    const fuel = mapNHTSAFuelType(result['FuelTypePrimary'] ?? '')
    if (fuel) decoded.fuel = fuel

    return decoded
  } catch {
    return null
  }
}
