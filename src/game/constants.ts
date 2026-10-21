// Logical canvas resolution — everything is drawn in these units and scaled to fit.
export const W = 960
export const H = 540

// Floor band: z=0 is the far side of the court, z=1 the near side.
export const FLOOR_TOP = 318
export const FLOOR_BOTTOM = 532
/** world units spanned by z 0..1 (used for distances) */
export const DEPTH = 260

export const HOOP_X = 858
export const HOOP_Z = 0.42
/** rim height above the floor, in screen px */
export const RIM_H = 170
export const BASELINE_X = 902
export const THREE_R = 330
export const DUNK_R = 105
export const X_MIN = 40
export const X_MAX = 888

export const GRAVITY = 1150
export const BALL_R = 11
export const SHOT_CLOCK = 14
export const POWER_FILL_SECONDS = 25

export const floorY = (z: number) => FLOOR_TOP + z * (FLOOR_BOTTOM - FLOOR_TOP)
/** sprite scale by depth */
export const persp = (z: number) => 0.9 + 0.3 * z

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
