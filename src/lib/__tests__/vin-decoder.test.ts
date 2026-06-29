import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mapNHTSAFuelType, formatEngineDescription, decodeVINfromNHTSA } from '../vin-decoder'

// ─── mapNHTSAFuelType ────────────────────────────────────────────────────────

describe('mapNHTSAFuelType', () => {
  it('maps gasoline variants to Gasolina', () => {
    expect(mapNHTSAFuelType('Gasoline')).toBe('Gasolina')
    expect(mapNHTSAFuelType('GASOLINE')).toBe('Gasolina')
    expect(mapNHTSAFuelType('Flex Fuel (Gasoline/E85)')).toBe('Gasolina')
    expect(mapNHTSAFuelType('Natural Gas')).toBe('Gasolina')
  })

  it('maps diesel to Diésel', () => {
    expect(mapNHTSAFuelType('Diesel')).toBe('Diésel')
    expect(mapNHTSAFuelType('DIESEL')).toBe('Diésel')
  })

  it('maps electric to Eléctrico', () => {
    expect(mapNHTSAFuelType('Electric')).toBe('Eléctrico')
    expect(mapNHTSAFuelType('ELECTRIC')).toBe('Eléctrico')
    expect(mapNHTSAFuelType('Battery Electric')).toBe('Eléctrico')
  })

  it('maps hybrid variants to Híbrido', () => {
    expect(mapNHTSAFuelType('Hybrid')).toBe('Híbrido')
    expect(mapNHTSAFuelType('Plug-In Hybrid')).toBe('Híbrido')
    expect(mapNHTSAFuelType('plug-in electric')).toBe('Híbrido')
  })

  it('returns null for unknown or empty fuel strings', () => {
    expect(mapNHTSAFuelType('')).toBeNull()
    expect(mapNHTSAFuelType('Unknown')).toBeNull()
    expect(mapNHTSAFuelType('N/A')).toBeNull()
  })
})

// ─── formatEngineDescription ─────────────────────────────────────────────────

describe('formatEngineDescription', () => {
  it('formats displacement + cylinders', () => {
    expect(formatEngineDescription('1.4609', '4')).toBe('1.5 L 4 cil.')
    expect(formatEngineDescription('2.0', '6')).toBe('2.0 L 6 cil.')
    expect(formatEngineDescription('1.6', '4')).toBe('1.6 L 4 cil.')
  })

  it('formats displacement alone when cylinders is missing', () => {
    expect(formatEngineDescription('1.6', '')).toBe('1.6 L')
    expect(formatEngineDescription('2.5', '0')).toBe('2.5 L')
  })

  it('returns null for missing or zero displacement', () => {
    expect(formatEngineDescription('', '4')).toBeNull()
    expect(formatEngineDescription('0', '4')).toBeNull()
    expect(formatEngineDescription('invalid', '4')).toBeNull()
  })

  it('rounds displacement to one decimal', () => {
    expect(formatEngineDescription('1.9990', '4')).toBe('2.0 L 4 cil.')
    expect(formatEngineDescription('2.9500', '6')).toBe('3.0 L 6 cil.')
  })
})

// ─── decodeVINfromNHTSA ───────────────────────────────────────────────────────

const NHTSA_RENAULT_RESPONSE = {
  Count: 136,
  Message: 'Results returned successfully',
  Results: [
    {
      Make: 'RENAULT',
      Model: 'CLIO',
      ModelYear: '2013',
      FuelTypePrimary: 'Diesel',
      DisplacementL: '1.4609',
      EngineCylinders: '4',
      ErrorCode: '0',
      ErrorText: '0 - VIN decoded clean.',
    },
  ],
}

describe('decodeVINfromNHTSA', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('decodes a Renault Clio VIN', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => NHTSA_RENAULT_RESPONSE,
    } as Response)

    const result = await decodeVINfromNHTSA('VF15RFL0H48931769')

    expect(result).not.toBeNull()
    expect(result?.make).toBe('Renault')
    expect(result?.model).toBe('Clio')
    expect(result?.year).toBe('2013')
    expect(result?.engine).toBe('1.5 L 4 cil.')
    expect(result?.fuel).toBe('Diésel')
  })

  it('capitalizes make and model correctly, including multi-word models', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        Results: [{ Make: 'VOLKSWAGEN', Model: 'GOLF GTI', ModelYear: '2020', ErrorCode: '0',
          FuelTypePrimary: 'Gasoline', DisplacementL: '1.4', EngineCylinders: '4' }],
      }),
    } as Response)

    const result = await decodeVINfromNHTSA('WVWZZZ1JZYW123456')
    expect(result?.make).toBe('Volkswagen')
    expect(result?.model).toBe('Golf Gti') // each word capitalized
  })

  it('returns null on HTTP error', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)
    expect(await decodeVINfromNHTSA('VF15RFL0H48931769')).toBeNull()
  })

  it('returns null on network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))
    expect(await decodeVINfromNHTSA('VF15RFL0H48931769')).toBeNull()
  })

  it('returns null when NHTSA has no data (error code ≠ 0/1)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        Results: [{ Make: '', Model: '', ModelYear: '', ErrorCode: '8',
          FuelTypePrimary: '', DisplacementL: '', EngineCylinders: '' }],
      }),
    } as Response)

    expect(await decodeVINfromNHTSA('ZZZZZZZZZZZZZZZZZ')).toBeNull()
  })

  it('accepts partial match (error code 1)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        Results: [{ Make: 'BMW', Model: '3 SERIES', ModelYear: '2019', ErrorCode: '1',
          FuelTypePrimary: 'Gasoline', DisplacementL: '2.0', EngineCylinders: '4' }],
      }),
    } as Response)

    const result = await decodeVINfromNHTSA('WBA8E9G56JNU94390')
    expect(result?.make).toBe('Bmw')
    expect(result?.fuel).toBe('Gasolina')
  })

  it('handles missing optional fields gracefully', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        Results: [{ Make: 'SEAT', Model: '', ModelYear: '', ErrorCode: '0',
          FuelTypePrimary: '', DisplacementL: '', EngineCylinders: '' }],
      }),
    } as Response)

    const result = await decodeVINfromNHTSA('VSSZZZ6JZHR123456')
    expect(result?.make).toBe('Seat')
    expect(result?.model).toBeUndefined()
    expect(result?.year).toBeUndefined()
    expect(result?.engine).toBeUndefined()
    expect(result?.fuel).toBeUndefined()
  })
})
