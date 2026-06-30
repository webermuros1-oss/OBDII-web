import { describe, it, expect } from 'vitest'
import { isCoolantHot, isFuelLow } from '../../components/dashboard/WarningLights'

describe('isCoolantHot', () => {
  it('returns false for undefined', () => {
    expect(isCoolantHot(undefined)).toBe(false)
  })

  it('returns false for 90°C', () => {
    expect(isCoolantHot(90)).toBe(false)
  })

  it('returns false at boundary 105°C (not hot at exactly 105)', () => {
    expect(isCoolantHot(105)).toBe(false)
  })

  it('returns true for 106°C', () => {
    expect(isCoolantHot(106)).toBe(true)
  })

  it('returns true for 130°C', () => {
    expect(isCoolantHot(130)).toBe(true)
  })
})

describe('isFuelLow', () => {
  it('returns false for undefined', () => {
    expect(isFuelLow(undefined)).toBe(false)
  })

  it('returns false for 20%', () => {
    expect(isFuelLow(20)).toBe(false)
  })

  it('returns false at boundary 15% (not low at exactly 15)', () => {
    expect(isFuelLow(15)).toBe(false)
  })

  it('returns true for 14%', () => {
    expect(isFuelLow(14)).toBe(true)
  })

  it('returns true for 0%', () => {
    expect(isFuelLow(0)).toBe(true)
  })
})
