import { describe, it, expect } from 'vitest'
import { colorForPct, valueToAngle } from '../../components/dashboard/DialGauge'

// ─── colorForPct ──────────────────────────────────────────────────────────────

describe('colorForPct', () => {
  it('returns green for 0%', () => {
    expect(colorForPct(0)).toBe('#22c55e')
  })

  it('returns green for 59%', () => {
    expect(colorForPct(59)).toBe('#22c55e')
  })

  it('returns amber for 60%', () => {
    expect(colorForPct(60)).toBe('#f59e0b')
  })

  it('returns amber for 84%', () => {
    expect(colorForPct(84)).toBe('#f59e0b')
  })

  it('returns red for 85% (default redlineAt)', () => {
    expect(colorForPct(85)).toBe('#ef4444')
  })

  it('returns red for 100%', () => {
    expect(colorForPct(100)).toBe('#ef4444')
  })

  it('returns green for 50% with custom redlineAt=70', () => {
    expect(colorForPct(50, 70)).toBe('#22c55e')
  })

  it('returns red for exactly at custom redlineAt=70', () => {
    expect(colorForPct(70, 70)).toBe('#ef4444')
  })
})

// ─── valueToAngle ─────────────────────────────────────────────────────────────

describe('valueToAngle', () => {
  it('returns 135 at min (0% of range)', () => {
    expect(valueToAngle(0, 0, 100)).toBe(135)
  })

  it('returns 405 at max (100% of range)', () => {
    expect(valueToAngle(100, 0, 100)).toBe(405)
  })

  it('returns 270 at midpoint (50% of range)', () => {
    expect(valueToAngle(50, 0, 100)).toBe(270)
  })

  it('returns ~135 at min of negative range', () => {
    expect(valueToAngle(-40, -40, 130)).toBeCloseTo(135, 2)
  })

  it('returns ~405 at max of negative range', () => {
    expect(valueToAngle(130, -40, 130)).toBeCloseTo(405, 2)
  })

  it('clamps to 135 when value is below min', () => {
    expect(valueToAngle(-100, 0, 100)).toBe(135)
  })

  it('clamps to 405 when value is above max', () => {
    expect(valueToAngle(200, 0, 100)).toBe(405)
  })
})
