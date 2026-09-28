export type Pt = { x: number; y: number; visibility?: number }

/** MediaPipe Pose landmark indices used by FitAI. */
export const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const

/**
 * Interior angle at point b, in degrees, 0-180.
 * Every rep count and form check in FitAI derives from this function.
 */
export function angle(a: Pt, b: Pt, c: Pt): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  const degrees = Math.abs((radians * 180) / Math.PI)
  return degrees > 180 ? 360 - degrees : degrees
}

export function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * Degrees between the from→to vector and straight down (the image y axis).
 * 0 = perfectly vertical, 90 = horizontal.
 */
export function verticalAngle(from: Pt, to: Pt): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI)
}
