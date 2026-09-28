import { describe, it, expect } from 'vitest'
import { angle, midpoint, verticalAngle } from './angles'

describe('angle', () => {
  it('measures a right angle at the middle point', () => {
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeCloseTo(90, 5)
  })

  it('measures a straight line as 180 degrees', () => {
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })).toBeCloseTo(180, 5)
  })

  it('measures a fully folded joint as 0 degrees', () => {
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0 })).toBeCloseTo(0, 5)
  })

  it('measures 135 degrees for an even diagonal', () => {
    expect(angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 2 })).toBeCloseTo(135, 5)
  })

  it('always returns a value between 0 and 180', () => {
    for (const cx of [-2, -1, 0, 1, 2]) {
      const a = angle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: cx, y: 1 })
      expect(a).toBeLessThanOrEqual(180)
      expect(a).toBeGreaterThanOrEqual(0)
    }
  })

  it('is mirror-symmetric', () => {
    const right = angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })
    const left = angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 1 })
    expect(right).toBeCloseTo(left, 5)
  })

  it('is scale-invariant, so it does not depend on camera distance', () => {
    const near = angle({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 2 })
    const far = angle({ x: 0, y: 0 }, { x: 0, y: 0.1 }, { x: 0.1, y: 0.2 })
    expect(near).toBeCloseTo(far, 5)
  })
})

describe('midpoint', () => {
  it('averages both coordinates', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 2, y: 4 })).toEqual({ x: 1, y: 2 })
  })
})

describe('verticalAngle', () => {
  it('is 0 for a perfectly vertical downward vector', () => {
    expect(verticalAngle({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.6 })).toBeCloseTo(0, 5)
  })

  it('is 90 for a horizontal vector', () => {
    expect(verticalAngle({ x: 0.2, y: 0.5 }, { x: 0.6, y: 0.5 })).toBeCloseTo(90, 5)
  })

  it('is 45 for an even diagonal', () => {
    expect(verticalAngle({ x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(45, 5)
  })

  it('is symmetric — leaning left or right gives the same magnitude', () => {
    expect(verticalAngle({ x: 0, y: 0 }, { x: 0.5, y: 1 })).toBeCloseTo(
      verticalAngle({ x: 0, y: 0 }, { x: -0.5, y: 1 }),
      5,
    )
  })
})
