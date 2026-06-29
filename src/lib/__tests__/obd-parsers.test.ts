import { describe, it, expect } from 'vitest'
import {
  parseVIN,
  parseDTCBytes,
  extractHexBytes,
  parseSupportedPIDs,
  parseProtocol,
  decodeWMI,
  parseFuelTypePID51,
} from '../obd-parsers'

// ─── parseVIN ────────────────────────────────────────────────────────────────

describe('parseVIN', () => {
  it('extracts VIN from CAN multi-frame response, filtering out PCI bytes (0x21, 0x22)', () => {
    // Real-world CAN response format with ATH1+ATS1
    // PCI bytes 0x21 ('!') and 0x22 ('"') are continuation frame markers
    const raw = [
      '7E8 10 14 49 02 01 56 46 31',
      '7E8 21 35 52 46 4C 30 48 34',
      '7E8 22 38 39 33 31 37 36 39',
      '>',
    ].join('\r\n')

    // VF1 5RFL0H4 8931769 → VF15RFL0H48931769
    expect(parseVIN(raw)).toBe('VF15RFL0H48931769')
  })

  it('returns UNKNOWN when no 49 02 header is found', () => {
    expect(parseVIN('NO DATA\r\n>')).toBe('UNKNOWN')
    expect(parseVIN('')).toBe('UNKNOWN')
    expect(parseVIN('7E8 03 7F 09 31\r\n>')).toBe('UNKNOWN')
  })

  it('filters all non-VIN characters regardless of PCI byte values', () => {
    // Include 0x23 ('#'), 0x49 is valid VIN char = 'I', but VIN excludes I
    // 0x49='I', 0x4F='O', 0x51='Q' are excluded from valid VIN charset
    const raw = [
      '7E8 10 0E 49 02 01 41 42 43',
      '7E8 21 44 45 46 47 48 4A 4B',
      '>',
    ].join('\r\n')
    // A=41 B=42 C=43 D=44 E=45 F=46 G=47 H=48 J=4A K=4B (I=49 excluded, 21=PCI filtered)
    expect(parseVIN(raw)).toBe('ABCDEFGHJK')
  })
})

// ─── parseDTCBytes ────────────────────────────────────────────────────────────

describe('parseDTCBytes', () => {
  it('parses P0380 (glow plug circuit fault)', () => {
    // 0x03 0x80 → P (cat 0), d1=0, d2=3, d34=80 → P0380
    const result = parseDTCBytes(['03', '80'], false)
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('P0380')
    expect(result[0].category).toBe('P')
    expect(result[0].isPending).toBe(false)
    expect(result[0].isPermanent).toBe(false)
  })

  it('parses P0300 (random/multiple cylinder misfire)', () => {
    const result = parseDTCBytes(['03', '00'], false)
    expect(result).toHaveLength(1)
    expect(result[0].code).toBe('P0300')
  })

  it('parses pending DTC correctly', () => {
    const result = parseDTCBytes(['03', '80'], true)
    expect(result[0].isPending).toBe(true)
  })

  it('skips 00 00 empty slots', () => {
    expect(parseDTCBytes(['00', '00'], false)).toHaveLength(0)
    expect(parseDTCBytes(['00', '00', '03', '80', '00', '00'], false)).toHaveLength(1)
  })

  it('returns empty array for empty input', () => {
    expect(parseDTCBytes([], false)).toHaveLength(0)
  })

  it('parses all four DTC categories', () => {
    // P = category 0 (bits 7-6 = 00), C = 1 (01), B = 2 (10), U = 3 (11)
    // P: hi = 0x0X → bits 7-6 = 00
    // C: hi = 0x4X → bits 7-6 = 01
    // B: hi = 0x8X → bits 7-6 = 10
    // U: hi = 0xCX → bits 7-6 = 11
    const dtcs = parseDTCBytes(
      ['01', '00', '41', '00', '81', '00', 'C1', '00'],
      false
    )
    expect(dtcs.map((d) => d.category)).toEqual(['P', 'C', 'B', 'U'])
  })

  it('parses multiple DTCs in one response', () => {
    const result = parseDTCBytes(['03', '80', '04', '03'], false)
    expect(result).toHaveLength(2)
    expect(result[0].code).toBe('P0380')
    expect(result[1].code).toBe('P0403')
  })

  it('skips invalid (non-hex) tokens', () => {
    expect(parseDTCBytes(['ZZ', '03', '03', '80'], false)).toHaveLength(1)
  })
})

// ─── extractHexBytes ──────────────────────────────────────────────────────────

describe('extractHexBytes', () => {
  it('extracts DTC bytes from mode 03 response', () => {
    const raw = '7E8 06 43 01 03 80 00 00\r\n>'
    const bytes = extractHexBytes(raw, '43')
    // Skips mode byte (43) and count byte (01), returns the DTC pairs
    expect(bytes).toEqual(['03', '80', '00', '00'])
  })

  it('handles multi-line response', () => {
    const raw = '7E8 06 43 02 03 80 04 03\r\n7E8 03 43 01 05 20\r\n>'
    const bytes = extractHexBytes(raw, '43')
    expect(bytes).toEqual(['03', '80', '04', '03', '05', '20'])
  })

  it('returns empty array when mode byte not found', () => {
    expect(extractHexBytes('NO DATA\r\n>', '43')).toEqual([])
  })
})

// ─── parseSupportedPIDs ───────────────────────────────────────────────────────

describe('parseSupportedPIDs', () => {
  it('decodes bitmask 0xFF000000 → PIDs 01-08', () => {
    // 41 00 FF 00 00 00 → all first 8 bits set
    const raw = '7E8 06 41 00 FF 00 00 00\r\n>'
    const pids = parseSupportedPIDs(raw)
    expect(pids).toEqual(['01', '02', '03', '04', '05', '06', '07', '08'])
  })

  it('decodes a real-world bitmask including PID 0C (RPM) and 0D (speed)', () => {
    // 41 00 BE 3F A8 13
    // 0xBE = 1011 1110 → bits 31,29,28,27,26,25 → PIDs 01,03,04,05,06,07
    // 0x3F = 0011 1111 → bits 21-16 → PIDs 0B,0C,0D,0E,0F,10
    // 0xA8 = 1010 1000 → bits 15,13,11 → PIDs 11,13,15
    // 0x13 = 0001 0011 → bits 4,1,0 → PIDs 1C,1F,20
    const raw = '7E8 06 41 00 BE 3F A8 13\r\n>'
    const pids = parseSupportedPIDs(raw)
    expect(pids).toContain('0C') // RPM
    expect(pids).toContain('0D') // Speed
    expect(pids).toContain('05') // Coolant temp
    expect(pids).toContain('04') // Engine load
  })

  it('returns empty array when response has no 41 00 header', () => {
    expect(parseSupportedPIDs('NO DATA')).toEqual([])
  })
})

// ─── parseProtocol ────────────────────────────────────────────────────────────

describe('parseProtocol', () => {
  it('parses auto-detected CAN protocol (A6)', () => {
    const result = parseProtocol('A6\r\n>')
    expect(result.number).toBe('6')
    expect(result.name).toBe('ISO 15765-4 CAN (11-bit, 500 kbaud)')
  })

  it('parses explicit protocol number', () => {
    const result = parseProtocol('6\r\n>')
    expect(result.number).toBe('6')
    expect(result.name).toBe('ISO 15765-4 CAN (11-bit, 500 kbaud)')
  })

  it('handles unknown protocol', () => {
    const result = parseProtocol('F\r\n>')
    expect(result.number).toBe('F')
    expect(result.name).toBe('Protocol F')
  })

  it('returns unknown on empty / garbage response', () => {
    const result = parseProtocol('>\r\n')
    expect(result.number).toBe('0')
    expect(result.name).toBe('Unknown')
  })
})

// ─── decodeWMI ───────────────────────────────────────────────────────────────

describe('decodeWMI', () => {
  it('decodes Renault VIN (VF1)', () => {
    expect(decodeWMI('VF15RFL0H48931769')).toBe('Renault')
  })

  it('decodes BMW VIN (WBA)', () => {
    expect(decodeWMI('WBA12345678901234')).toBe('BMW')
  })

  it('decodes Mercedes-Benz (WDD)', () => {
    expect(decodeWMI('WDD12345678901234')).toBe('Mercedes-Benz')
  })

  it('returns null for unknown WMI', () => {
    expect(decodeWMI('XYZ12345678901234')).toBeNull()
  })

  it('returns null for VIN shorter than 3 characters', () => {
    expect(decodeWMI('VF')).toBeNull()
    expect(decodeWMI('')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(decodeWMI('vf15rfl0h48931769')).toBe('Renault')
  })
})

// ─── parseFuelTypePID51 ───────────────────────────────────────────────────────

describe('parseFuelTypePID51', () => {
  it('identifies Gasolina (0x01)', () => {
    expect(parseFuelTypePID51('7E8 03 41 51 01')).toBe('Gasolina')
  })

  it('identifies Diésel (0x04)', () => {
    expect(parseFuelTypePID51('7E8 03 41 51 04')).toBe('Diésel')
  })

  it('identifies Eléctrico (0x08)', () => {
    expect(parseFuelTypePID51('7E8 03 41 51 08')).toBe('Eléctrico')
  })

  it('identifies Híbrido (0x0F — hybrid gasoline)', () => {
    expect(parseFuelTypePID51('7E8 03 41 51 0F')).toBe('Híbrido')
  })

  it('identifies Híbrido (0x0D — bifuel electric)', () => {
    expect(parseFuelTypePID51('7E8 03 41 51 0D')).toBe('Híbrido')
  })

  it('returns null when PID 51 not in response', () => {
    expect(parseFuelTypePID51('NO DATA')).toBeNull()
    expect(parseFuelTypePID51('7E8 02 7F 51 12')).toBeNull() // negative response
  })

  it('handles response without spaces (sanity check)', () => {
    // ATS1 should always add spaces, but be robust
    expect(parseFuelTypePID51('41 51 04')).toBe('Diésel')
  })
})
