import { describe, it, expect } from 'vitest'
import { normalizePoints, formatGraphValue } from '../../components/dashboard/SensorGraph'

// ─── normalizePoints ──────────────────────────────────────────────────────────

describe('normalizePoints', () => {
  it('returns [] for empty history', () => {
    expect(normalizePoints([], 300, 50)).toEqual([])
  })

  it('maps min value to bottom (y=svgH) and max to top (y=0)', () => {
    const result = normalizePoints(
      [{ time: 0, value: 0 }, { time: 100, value: 100 }],
      300,
      50
    )
    expect(result).toEqual([{ x: 0, y: 50 }, { x: 300, y: 0 }])
  })

  it('places flat line in middle (y = svgH/2) when all values are equal', () => {
    const result = normalizePoints(
      [{ time: 0, value: 50 }, { time: 100, value: 50 }],
      300,
      50
    )
    expect(result).toEqual([{ x: 0, y: 25 }, { x: 300, y: 25 }])
  })

  it('distributes x linearly across time range and inverts y for value range', () => {
    const result = normalizePoints(
      [
        { time: 0, value: 10 },
        { time: 50, value: 20 },
        { time: 100, value: 30 },
      ],
      300,
      50
    )
    // x: 0→0, 50→150, 100→300
    // y: range 10–30 (20 range), 10→50, 20→25, 30→0
    expect(result[0]).toEqual({ x: 0, y: 50 })
    expect(result[1]).toEqual({ x: 150, y: 25 })
    expect(result[2]).toEqual({ x: 300, y: 0 })
  })
})

// ─── formatGraphValue ─────────────────────────────────────────────────────────

describe('formatGraphValue', () => {
  it('formats values below 1000 without trailing .0', () => {
    expect(formatGraphValue(999)).toBe('999')
    expect(formatGraphValue(100.0)).toBe('100')
    expect(formatGraphValue(0)).toBe('0')
  })

  it('keeps one decimal when not .0 for values below 1000', () => {
    expect(formatGraphValue(99.5)).toBe('99.5')
    expect(formatGraphValue(0.5)).toBe('0.5')
  })

  it('formats values >= 1000 with one decimal and k suffix', () => {
    expect(formatGraphValue(1000)).toBe('1.0k')
    expect(formatGraphValue(1500)).toBe('1.5k')
    expect(formatGraphValue(2340)).toBe('2.3k')
  })
})
