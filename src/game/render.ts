import type { TKey } from '../lib/i18n'
import type { Look } from '../lib/outfits'
import {
  BALL_R, BASELINE_X, DEPTH, DUNK_R, FLOOR_BOTTOM, FLOOR_TOP, H, HOOP_X, HOOP_Z, RIM_H, THREE_R, W,
  clamp, floorY, lerp, persp,
} from './constants'
import { MASCOT_TIME, MAX_HOLD, PERFECT_T, RELEASE_T, type Athlete, type Fx, type MascotKind, type Match, type ShotQuality } from './engine'

const OUTLINE = '#2b2320'
export const RIM_Y = floorY(HOOP_Z) - RIM_H
const DISPLAY = '"Barlow Condensed", "Arial Narrow", sans-serif'

/* ------------------------------------------------------------------ */
/* utils                                                              */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))))
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

const easeOutBack = (k: number) => {
  const c = 1.70158
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2)
}

/* ------------------------------------------------------------------ */
/* static backdrop (cached)                                           */
/* ------------------------------------------------------------------ */

const STANDS: [number, number][] = [
  [0, 372],
  [588, W],
]
/** seat level of each row, back → front */
const ROW_Y = [150, 186, 222, 258]
const ROW_S = [0.8, 0.86, 0.93, 1]
const STANDS_TOP = 112
const BOARD_TOP = FLOOR_TOP - 26

interface Seat {
  x: number
  y: number
  s: number
  row: number
}

let seatCache: Seat[] | null = null
function getSeats(): Seat[] {
  if (seatCache) return seatCache
  const seats: Seat[] = []
  for (let r = 0; r < ROW_Y.length; r++) {
    const s = ROW_S[r]
    const gap = 31 * s
    for (const [x0, x1] of STANDS) {
      const off = r % 2 ? gap / 2 : 0
      for (let x = x0 + 14 + off; x < x1 - 12; x += gap) seats.push({ x, y: ROW_Y[r], s, row: r })
    }
  }
  seatCache = seats
  return seats
}

const rgb = (c: number[]) => `rgb(${c.map((v) => Math.max(0, Math.min(255, Math.round(v)))).join(',')})`

/** Polished maple hardwood: individual planks, grain, glossy window reflections. */
function paintFloor(ctx: CanvasRenderingContext2D) {
  const rnd = mulberry32(99)
  const n = 26
  // strips get wider towards the viewer (fake perspective)
  const yAt = (i: number) => FLOOR_TOP + (H - FLOOR_TOP) * Math.pow(i / n, 1.25)
  const far = [236, 186, 128]
  const near = [214, 150, 88]
  for (let i = 0; i < n; i++) {
    const y0 = yAt(i)
    const y1 = yAt(i + 1)
    const hgt = y1 - y0
    const k = i / n
    const base = far.map((v, j) => v + (near[j] - v) * k)
    let x = -rnd() * 160
    while (x < W) {
      const len = 110 + rnd() * 230
      const tone = 1 + (rnd() - 0.5) * 0.13
      const warm = (rnd() - 0.5) * 10
      ctx.fillStyle = rgb([base[0] * tone + warm, base[1] * tone, base[2] * tone - warm])
      ctx.fillRect(x, y0, len, hgt + 0.6)
      // grain
      ctx.lineWidth = 0.7
      for (let g = 0; g < 3; g++) {
        const gy = y0 + hgt * (0.2 + rnd() * 0.6)
        ctx.strokeStyle = rnd() < 0.5 ? `rgba(140,80,30,${0.07 + rnd() * 0.07})` : `rgba(255,235,200,${0.06 + rnd() * 0.05})`
        ctx.beginPath()
        ctx.moveTo(x + 3, gy)
        ctx.bezierCurveTo(x + len * 0.3, gy + (rnd() - 0.5) * hgt * 0.5, x + len * 0.7, gy + (rnd() - 0.5) * hgt * 0.5, x + len - 3, gy + (rnd() - 0.5) * hgt * 0.3)
        ctx.stroke()
      }
      if (rnd() < 0.05) {
        ctx.fillStyle = 'rgba(120,65,25,0.25)'
        ctx.beginPath()
        ctx.ellipse(x + len * rnd(), y0 + hgt / 2, 3 + rnd() * 3, hgt * 0.2, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = 'rgba(105,58,22,0.35)'
      ctx.fillRect(x + len - 1, y0, 1, hgt)
      x += len
    }
    ctx.fillStyle = 'rgba(105,58,22,0.3)'
    ctx.fillRect(0, y0, W, 0.9)
    ctx.fillStyle = 'rgba(255,238,205,0.2)'
    ctx.fillRect(0, y0 + 0.9, W, 0.7)
  }
  // varnish: soft reflections of the windows + overall sheen
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let x = 62; x < W; x += 122) {
    const rx = x + (x - W / 2) * 0.12
    ctx.save()
    ctx.translate(rx, FLOOR_TOP + 70)
    ctx.scale(0.5, 1.6)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 60)
    g.addColorStop(0, 'rgba(255,248,230,0.16)')
    g.addColorStop(1, 'rgba(255,248,230,0)')
    ctx.fillStyle = g
    ctx.fillRect(-60, -60, 120, 120)
    ctx.restore()
  }
  const sheen = ctx.createLinearGradient(0, FLOOR_TOP, 0, H)
  sheen.addColorStop(0, 'rgba(255,240,215,0.12)')
  sheen.addColorStop(0.4, 'rgba(255,240,215,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, FLOOR_TOP, W, H - FLOOR_TOP)
  ctx.restore()
  // ambient occlusion under the boards
  const ao = ctx.createLinearGradient(0, FLOOR_TOP, 0, FLOOR_TOP + 26)
  ao.addColorStop(0, 'rgba(50,25,8,0.35)')
  ao.addColorStop(1, 'rgba(50,25,8,0)')
  ctx.fillStyle = ao
  ctx.fillRect(0, FLOOR_TOP, W, 26)
}

function paintCourt(ctx: CanvasRenderingContext2D) {
  const fy = (z: number) => floorY(z)
  const zr = (r: number) => (r / DEPTH) * (FLOOR_BOTTOM - FLOOR_TOP)
  const kz0 = HOOP_Z - 0.22
  const kz1 = HOOP_Z + 0.22
  const ARC = (c: CanvasRenderingContext2D) => c.ellipse(HOOP_X, fy(HOOP_Z), THREE_R, zr(THREE_R), 0, Math.PI / 2, (3 * Math.PI) / 2)

  // out-of-bounds apron in TEB blue
  ctx.fillStyle = 'rgba(36,88,168,0.78)'
  ctx.fillRect(BASELINE_X, FLOOR_TOP, W - BASELINE_X, H - FLOOR_TOP)
  ctx.fillRect(0, FLOOR_TOP, BASELINE_X, fy(0.02) - FLOOR_TOP)
  ctx.fillRect(0, fy(0.98), BASELINE_X, H - fy(0.98))

  // lighter stain inside the arc, blue paint, orange center circle
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, fy(0.02), BASELINE_X, fy(0.98) - fy(0.02))
  ctx.clip()
  ctx.beginPath()
  ARC(ctx)
  ctx.lineTo(BASELINE_X, fy(HOOP_Z) + zr(THREE_R))
  ctx.lineTo(BASELINE_X, fy(HOOP_Z) - zr(THREE_R))
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,236,200,0.09)'
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = 'rgba(36,88,168,0.62)'
  ctx.fillRect(690, fy(kz0), BASELINE_X - 690, fy(kz1) - fy(kz0))
  ctx.beginPath()
  ctx.ellipse(72, fy(0.5), 88, zr(88), 0, -Math.PI / 2, Math.PI / 2)
  ctx.fillStyle = 'rgba(242,140,40,0.5)'
  ctx.fill()

  const lines = (offset: number, color: string) => {
    ctx.save()
    ctx.translate(0, offset)
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, fy(0.02), BASELINE_X, fy(0.98) - fy(0.02))
    ctx.clip()
    ctx.beginPath()
    ARC(ctx)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(72, fy(0.5), 88, zr(88), 0, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    ctx.restore()
    ctx.strokeRect(690, fy(kz0), BASELINE_X - 690, fy(kz1) - fy(kz0))
    ctx.beginPath()
    ctx.ellipse(690, fy(HOOP_Z), 62, zr(62), 0, Math.PI / 2, (3 * Math.PI) / 2)
    ctx.stroke()
    ctx.setLineDash([10, 9])
    ctx.beginPath()
    ctx.ellipse(690, fy(HOOP_Z), 62, zr(62), 0, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(HOOP_X, fy(HOOP_Z), DUNK_R, zr(DUNK_R), 0, Math.PI / 2, (3 * Math.PI) / 2)
    ctx.stroke()
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(0, fy(0.02))
    ctx.lineTo(BASELINE_X, fy(0.02))
    ctx.lineTo(BASELINE_X, fy(0.98))
    ctx.lineTo(0, fy(0.98))
    ctx.moveTo(72, fy(0.02))
    ctx.lineTo(72, fy(0.98))
    // hash marks on the lane
    for (const hx of [740, 790, 840]) {
      ctx.moveTo(hx, fy(kz0))
      ctx.lineTo(hx, fy(kz0) - 5)
      ctx.moveTo(hx, fy(kz1))
      ctx.lineTo(hx, fy(kz1) + 6)
    }
    ctx.stroke()
    ctx.restore()
  }
  lines(1.5, 'rgba(60,30,10,0.18)')
  lines(0, 'rgba(255,255,255,0.96)')

  // painted mid-court logo
  ctx.save()
  ctx.setTransform(1, 0, -0.35, 0.45, 0, 0)
  const ly = fy(0.62) / 0.45
  const lx = 470 + 0.35 * ly
  ctx.font = `800 58px ${DISPLAY}`
  ctx.textAlign = 'center'
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.strokeText('tebBasket', lx, ly)
  ctx.fillStyle = 'rgba(36,88,168,0.14)'
  ctx.fillText('tebBasket', lx, ly)
  ctx.restore()
}

function paintBackdrop(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!

  // wall
  const wall = ctx.createLinearGradient(0, 0, 0, FLOOR_TOP)
  wall.addColorStop(0, '#cfd4d9')
  wall.addColorStop(1, '#e9ebed')
  ctx.fillStyle = wall
  ctx.fillRect(0, 0, W, FLOOR_TOP)
  ctx.strokeStyle = 'rgba(120,130,140,0.12)'
  ctx.lineWidth = 2
  for (let x = 0; x < W; x += 80) {
    ctx.beginPath()
    ctx.moveTo(x, 68)
    ctx.lineTo(x, FLOOR_TOP)
    ctx.stroke()
  }
  ctx.fillStyle = '#2f6fd0'
  ctx.fillRect(0, 96, W, 7)
  ctx.fillStyle = '#f28c28'
  ctx.fillRect(0, 103, W, 3)

  // windows strip
  ctx.fillStyle = '#717a84'
  ctx.fillRect(0, 0, W, 62)
  for (let x = 6; x < W; x += 122) {
    const g = ctx.createLinearGradient(0, 6, 0, 54)
    g.addColorStop(0, '#e2f3fd')
    g.addColorStop(1, '#93c8ea')
    ctx.fillStyle = g
    ctx.fillRect(x, 6, 112, 48)
    ctx.strokeStyle = '#f4f6f8'
    ctx.lineWidth = 3
    ctx.strokeRect(x, 6, 112, 48)
    ctx.beginPath()
    ctx.moveTo(x + 56, 6)
    ctx.lineTo(x + 56, 54)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.beginPath()
    ctx.moveTo(x + 10, 54)
    ctx.lineTo(x + 30, 6)
    ctx.lineTo(x + 44, 6)
    ctx.lineTo(x + 24, 54)
    ctx.fill()
  }
  ctx.fillStyle = '#596169'
  ctx.fillRect(0, 60, W, 8)

  // pennants between the stands
  const flags: [number, string, string][] = [
    [404, '#2f6fd0', 'TEB'],
    [446, '#f28c28', '2026'],
    [488, '#2f6fd0', 'MVP'],
    [530, '#d93a3a', '★'],
  ]
  for (const [x, col, txt] of flags) {
    ctx.fillStyle = col
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x, 114)
    ctx.lineTo(x + 34, 114)
    ctx.lineTo(x + 34, 168)
    ctx.lineTo(x + 17, 180)
    ctx.lineTo(x, 168)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 13px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.fillText(txt, x + 17, 146)
  }
  // trophy case / doors under the pennants
  ctx.fillStyle = '#b9c0c8'
  ctx.fillRect(392, 200, 176, BOARD_TOP - 200)
  ctx.fillStyle = '#8d959e'
  for (const dx of [404, 488]) ctx.fillRect(dx, 214, 68, BOARD_TOP - 214)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  for (const dx of [404, 488]) ctx.fillRect(dx + 6, 220, 4, BOARD_TOP - 226)

  // stands: concrete tiers + plastic seats (fans are drawn live)
  for (const [x0, x1] of STANDS) {
    const g = ctx.createLinearGradient(0, STANDS_TOP, 0, BOARD_TOP)
    g.addColorStop(0, '#4c525a')
    g.addColorStop(1, '#6a717a')
    ctx.fillStyle = g
    ctx.fillRect(x0, STANDS_TOP, x1 - x0, BOARD_TOP - STANDS_TOP)
    for (let r = 0; r < ROW_Y.length; r++) {
      const s = ROW_S[r]
      const y = ROW_Y[r]
      ctx.fillStyle = '#a3a9b1'
      ctx.fillRect(x0, y + 1, x1 - x0, 7 * s)
      ctx.fillStyle = '#c3c8ce'
      ctx.fillRect(x0, y + 1, x1 - x0, 1.5)
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.fillRect(x0, y + 1 + 7 * s, x1 - x0, 4)
    }
    // end wall + handrail
    const ex = x0 === 0 ? x1 - 8 : x0
    ctx.fillStyle = '#8a9199'
    ctx.fillRect(ex, STANDS_TOP, 8, BOARD_TOP - STANDS_TOP)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.fillRect(ex + 1, STANDS_TOP, 2, BOARD_TOP - STANDS_TOP)
  }
  getSeats().forEach((seat, i) => {
    const { x, y, s } = seat
    const col = seat.row === ROW_Y.length - 1 ? '#e07a1e' : i % 13 === 5 ? '#e07a1e' : '#2f6fd0'
    ctx.fillStyle = shade(col, -0.25)
    rr(ctx, x - 9.5 * s, y - 3 * s, 19 * s, 5 * s, 2)
    ctx.fill()
    ctx.fillStyle = col
    rr(ctx, x - 9 * s, y - 21 * s, 18 * s, 18 * s, 4 * s)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.fillRect(x - 7 * s, y - 19 * s, 14 * s, 2.5 * s)
  })

  paintFloor(ctx)
  paintCourt(ctx)

  // light shafts from the windows
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let x = 6; x < W; x += 244) {
    const g = ctx.createLinearGradient(0, 60, 0, H)
    g.addColorStop(0, 'rgba(255,250,235,0.09)')
    g.addColorStop(1, 'rgba(255,250,235,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x + 10, 60)
    ctx.lineTo(x + 102, 60)
    ctx.lineTo(x + 260, H)
    ctx.lineTo(x + 90, H)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()


  return c
}

/** Glass backboard in 3/4 view: (u, v) ∈ [0,1]² → board surface. */
const BB = { l: 884, r: 913, topL: RIM_Y - 96, topR: RIM_Y - 110, botL: RIM_Y + 24, botR: RIM_Y + 12 }
const bbAt = (u: number, v: number): V => [BB.l + (BB.r - BB.l) * u, lerp(BB.topL, BB.botL, v) + (lerp(BB.topR, BB.botR, v) - lerp(BB.topL, BB.botL, v)) * u]

function drawBackboard(ctx: CanvasRenderingContext2D, shake: number) {
  const dy = Math.sin(shake * 25) * shake * 1.5
  ctx.save()
  ctx.translate(0, dy)
  const quad = (u0: number, v0: number, u1: number, v1: number) => {
    const a = bbAt(u0, v0)
    const b = bbAt(u1, v0)
    const c = bbAt(u1, v1)
    const d = bbAt(u0, v1)
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.lineTo(c[0], c[1])
    ctx.lineTo(d[0], d[1])
    ctx.closePath()
  }
  // board thickness (edge facing the court)
  ctx.fillStyle = '#4a5058'
  ctx.beginPath()
  ctx.moveTo(BB.l, BB.topL)
  ctx.lineTo(BB.l - 4, BB.topL + 2)
  ctx.lineTo(BB.l - 4, BB.botL + 2)
  ctx.lineTo(BB.l, BB.botL)
  ctx.closePath()
  ctx.fill()
  // glass
  quad(0, 0, 1, 1)
  const g = ctx.createLinearGradient(BB.l, 0, BB.r, 0)
  g.addColorStop(0, 'rgba(225,240,255,0.86)')
  g.addColorStop(1, 'rgba(200,225,245,0.74)')
  ctx.fillStyle = g
  ctx.fill()
  // reflections
  ctx.save()
  quad(0, 0, 1, 1)
  ctx.clip()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.moveTo(BB.l, BB.topL + 20)
  ctx.lineTo(BB.l + 8, BB.topL + 6)
  ctx.lineTo(BB.l + 8, BB.topL + 40)
  ctx.lineTo(BB.l, BB.topL + 56)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillRect(BB.l + 12, BB.topR, 3, BB.botL - BB.topR)
  ctx.restore()
  // target square + bottom padding
  quad(0.18, 0.5, 0.82, 0.82)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3.5
  ctx.stroke()
  ctx.strokeStyle = '#e8501f'
  ctx.lineWidth = 1.8
  ctx.stroke()
  quad(0, 0.92, 1, 1)
  ctx.fillStyle = '#2f6fd0'
  ctx.fill()
  // frame
  quad(0, 0, 1, 1)
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 4.5
  ctx.stroke()
  ctx.strokeStyle = '#c9ced4'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}


/** Hoop stand, cached in its own sprite so it can be drawn in front of the crowd. */
const STAND_X = 895
let standCache: HTMLCanvasElement | null = null
function getStanchion() {
  if (standCache) return standCache
  const c = document.createElement('canvas')
  c.width = (W - STAND_X) * SPRITE_SCALE
  c.height = H * SPRITE_SCALE
  const ctx = c.getContext('2d')!
  ctx.scale(SPRITE_SCALE, SPRITE_SCALE)
  ctx.translate(-STAND_X, 0)
  // stanchion: padded base on the floor, thick pole with padding, arm to the backboard
  const baseY = floorY(0.25)
  ctx.fillStyle = 'rgba(40,20,5,0.3)'
  ctx.beginPath()
  ctx.ellipse(940, baseY + 2, 34, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  const pole = ctx.createLinearGradient(933, 0, 947, 0)
  pole.addColorStop(0, '#5b636c')
  pole.addColorStop(0.35, '#9aa3ad')
  pole.addColorStop(1, '#3e454d')
  ctx.fillStyle = pole
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2
  rr(ctx, 933, RIM_Y - 84, 14, baseY - 30 - (RIM_Y - 84), 3)
  ctx.fill()
  ctx.stroke()
  // arm + strut to the back of the backboard
  ctx.lineCap = 'round'
  for (const [x0, y0, x1, y1, w] of [
    [940, RIM_Y - 78, 908, RIM_Y - 52, 9],
    [940, RIM_Y - 30, 908, RIM_Y - 10, 6],
  ]) {
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = w + 3
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    ctx.strokeStyle = '#7d858e'
    ctx.lineWidth = w
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  // padding around the lower pole
  const pad = ctx.createLinearGradient(929, 0, 951, 0)
  pad.addColorStop(0, '#2458a8')
  pad.addColorStop(0.4, '#3f86e6')
  pad.addColorStop(1, '#1d4686')
  ctx.fillStyle = pad
  ctx.strokeStyle = OUTLINE
  rr(ctx, 929, baseY - 98, 22, 72, 5)
  ctx.fill()
  ctx.stroke()
  // padded base
  const bg = ctx.createLinearGradient(0, baseY - 34, 0, baseY)
  bg.addColorStop(0, '#3f86e6')
  bg.addColorStop(1, '#2458a8')
  ctx.fillStyle = bg
  rr(ctx, 912, baseY - 34, 56, 34, 6)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.fillRect(915, baseY - 31, 50, 4)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 13px ${DISPLAY}`
  ctx.textAlign = 'center'
  ctx.fillText('TEB', 940, baseY - 12)
  standCache = c
  return c
}
let backdropCache: HTMLCanvasElement | null = null
function getBackdrop() {
  if (!backdropCache) backdropCache = paintBackdrop()
  return backdropCache
}

/* ------------------------------------------------------------------ */
/* live crowd                                                         */
/* ------------------------------------------------------------------ */

const SKINS = ['#f6d3b3', '#efc29c', '#e8b48f', '#c68a5e', '#a86e45', '#8d5a3b', '#5e3a26']
const HAIRS = ['#2a1d14', '#3b2a1f', '#5a3b22', '#6b4423', '#1c1c1c', '#c9a15b', '#e3c27a', '#a0522d', '#b5532c']
const TOPS = ['#2f6fd0', '#2f6fd0', '#f28c28', '#ffffff', '#1f2933', '#9aa3ad', '#d93a3a', '#3fa66b', '#7b5cc4', '#f4c542', '#e889b5', '#5b7083']
const PANTS = ['#3b5b8a', '#2a3a55', '#1f1f24', '#6b7280', '#c9b79c']
const SIGNS = ['TEB!', 'GO TEB', 'DEFENSE', '3PT!', 'MVP', '♥ TEB']
type FemaleHair = 'long' | 'ponytail' | 'bun' | 'bob' | 'curly'
type MaleHair = 'short' | 'buzz' | 'cap' | 'beanie' | 'curly'

interface Fan {
  x: number
  y: number
  s: number
  front: boolean
  female: boolean
  kid: boolean
  skin: string
  hair: string
  hairStyle: FemaleHair | MaleHair
  top: 'tee' | 'hoodie' | 'jersey'
  topColor: string
  pants: string
  num: number
  cheerer: boolean
  phase: number
  prop: null | 'sign' | 'phone' | 'finger' | 'scarf'
  sign: string
  glasses: boolean
  capColor: string
  earrings: boolean
  bow: string | null
}

let fanCache: Fan[] | null = null
function getFans(): Fan[] {
  if (fanCache) return fanCache
  const rnd = mulberry32(1234)
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
  const fans: Fan[] = []
  let signs = 0
  for (const seat of getSeats()) {
    if (rnd() < 0.08) continue
    const female = rnd() < 0.5
    const kid = rnd() < 0.1
    const propRoll = rnd()
    let prop: Fan['prop'] = null
    if (seat.row < 3 && propRoll < 0.06 && signs < SIGNS.length) prop = 'sign'
    else if (propRoll < 0.12) prop = 'phone'
    else if (propRoll < 0.16) prop = 'finger'
    else if (propRoll < 0.24) prop = 'scarf'
    fans.push({
      x: seat.x + (rnd() - 0.5) * 2,
      y: seat.y,
      s: seat.s * (kid ? 0.8 : 0.96 + rnd() * 0.08),
      front: seat.row === ROW_Y.length - 1,
      female,
      kid,
      skin: pick(SKINS),
      hair: rnd() < 0.06 ? pick(['#e889b5', '#7b5cc4', '#3fa6c4']) : pick(HAIRS),
      hairStyle: female ? pick<FemaleHair>(['long', 'long', 'ponytail', 'bun', 'bob', 'curly']) : pick<MaleHair>(['short', 'short', 'buzz', 'cap', 'beanie', 'curly']),
      top: pick<Fan['top']>(['tee', 'tee', 'hoodie', 'jersey']),
      topColor: pick(TOPS),
      pants: pick(PANTS),
      num: 1 + Math.floor(rnd() * 30),
      cheerer: rnd() < 0.6,
      phase: rnd() * Math.PI * 2,
      prop,
      sign: prop === 'sign' ? SIGNS[signs++] : '',
      glasses: rnd() < 0.14,
      capColor: pick(['#2f6fd0', '#f28c28', '#1f2933', '#d93a3a']),
      earrings: female && rnd() < 0.45,
      bow: female && rnd() < 0.3 ? pick(['#ff6b9a', '#ffffff', '#2f6fd0', '#f28c28', '#b46bff']) : null,
    })
  }
  fanCache = fans
  return fans
}

const FAN_LINE = 'rgba(35,28,24,0.75)'

function fanArm(ctx: CanvasRenderingContext2D, f: Fan, pts: V[], sleeve: 'short' | 'long' | 'none') {
  const sleeveCol = f.topColor
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = FAN_LINE
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  ctx.lineTo(pts[1][0], pts[1][1])
  ctx.lineTo(pts[2][0], pts[2][1])
  ctx.stroke()
  ctx.lineWidth = 4.2
  ctx.strokeStyle = f.skin
  ctx.stroke()
  if (sleeve !== 'none') {
    ctx.strokeStyle = sleeveCol
    ctx.lineWidth = 4.8
    ctx.beginPath()
    ctx.moveTo(pts[0][0], pts[0][1])
    if (sleeve === 'long') {
      ctx.lineTo(pts[1][0], pts[1][1])
      ctx.lineTo(pts[0][0] + (pts[2][0] - pts[0][0]) * 0.9, pts[0][1] + (pts[2][1] - pts[0][1]) * 0.9)
      ctx.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * 0.75, pts[1][1] + (pts[2][1] - pts[1][1]) * 0.75)
    } else ctx.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * 0.5, pts[0][1] + (pts[1][1] - pts[0][1]) * 0.5)
    ctx.stroke()
  }
  ctx.fillStyle = f.skin
  ctx.beginPath()
  ctx.arc(pts[2][0], pts[2][1], 2.4, 0, Math.PI * 2)
  ctx.fill()
}

function fanHairBack(ctx: CanvasRenderingContext2D, f: Fan, t: number) {
  ctx.fillStyle = f.hair
  ctx.strokeStyle = FAN_LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  switch (f.hairStyle) {
    case 'long':
      ctx.moveTo(-11, -44)
      ctx.quadraticCurveTo(-13, -26, -12, -18)
      ctx.lineTo(12, -18)
      ctx.quadraticCurveTo(13, -26, 11, -44)
      break
    case 'curly':
      for (const [cx, cy, r] of [[-9, -36, 6], [9, -36, 6], [-8, -27, 5], [8, -27, 5], [0, -46, 8]] as const) {
        ctx.moveTo(cx + r, cy)
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
      }
      break
    case 'bob':
      ctx.moveTo(-11, -44)
      ctx.quadraticCurveTo(-13, -33, -11, -30)
      ctx.lineTo(11, -30)
      ctx.quadraticCurveTo(13, -33, 11, -44)
      break
    case 'ponytail': {
      const sw = Math.sin(t * 3 + f.phase) * 1.5
      ctx.ellipse(10 + sw, -38, 3.6, 8, 0.35, 0, Math.PI * 2)
      break
    }
    default:
      return
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function fanHairFront(ctx: CanvasRenderingContext2D, f: Fan) {
  ctx.fillStyle = f.hair
  ctx.strokeStyle = FAN_LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  switch (f.hairStyle) {
    case 'long':
    case 'bob':
      ctx.moveTo(-10, f.hairStyle === 'bob' ? -32 : -30)
      ctx.quadraticCurveTo(-12, -51, 0, -51)
      ctx.quadraticCurveTo(12, -51, 10, f.hairStyle === 'bob' ? -32 : -30)
      ctx.lineTo(8, -36)
      ctx.quadraticCurveTo(7, -46, 1, -46)
      ctx.quadraticCurveTo(-6, -45, -7.5, -37)
      break
    case 'ponytail':
    case 'bun':
      ctx.moveTo(-9.8, -38)
      ctx.quadraticCurveTo(-11, -51, 0, -51)
      ctx.quadraticCurveTo(11, -51, 9.8, -38)
      ctx.quadraticCurveTo(6, -46, 0, -45.5)
      ctx.quadraticCurveTo(-6, -46, -9.8, -38)
      if (f.hairStyle === 'bun') {
        ctx.moveTo(4.5, -52)
        ctx.arc(0, -52, 4.5, 0, Math.PI * 2)
      }
      break
    case 'curly':
      for (const [cx, cy] of [[-6, -47], [0, -50], [6, -47], [-9, -42], [9, -42]] as const) {
        ctx.moveTo(cx + 4, cy)
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      }
      break
    case 'short':
      ctx.moveTo(-9.6, -40)
      ctx.quadraticCurveTo(-11, -52, 0, -51.5)
      ctx.quadraticCurveTo(10, -52, 9.8, -41)
      ctx.lineTo(7, -45)
      ctx.lineTo(3, -44)
      ctx.lineTo(-1, -46)
      ctx.lineTo(-5, -44)
      ctx.closePath()
      break
    case 'buzz':
      ctx.globalAlpha = 0.75
      ctx.arc(0, -40, 9.8, Math.PI * 1.08, Math.PI * 1.92)
      ctx.quadraticCurveTo(0, -46, -9.4, -42.5)
      break
    case 'cap':
      ctx.fillStyle = f.capColor
      ctx.arc(0, -42, 10, Math.PI, 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = shade(f.capColor, -0.25)
      ctx.beginPath()
      ctx.ellipse(0, -42, 12, 2.6, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(0, -47, 1.8, 0, Math.PI * 2)
      ctx.fill()
      return
    case 'beanie':
      ctx.fillStyle = f.capColor
      ctx.arc(0, -42, 10.2, Math.PI, 0)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = shade(f.capColor, 0.25)
      ctx.fillRect(-10.5, -44, 21, 4)
      ctx.beginPath()
      ctx.arc(0, -53, 3, 0, Math.PI * 2)
      ctx.fill()
      return
  }
  ctx.fill()
  ctx.stroke()
  ctx.globalAlpha = 1
}

/** sprite bounds around the seat point, in fan units */
const FAN_BOX = { x: -30, y: -80, w: 60, h: 114 }
const fanSprites = new Map<Fan, HTMLCanvasElement>()

/** Static part of a fan (body, face, hair, outfit) rendered once into a sprite. */
function fanSprite(f: Fan) {
  let c = fanSprites.get(f)
  if (c) return c
  const k = SPRITE_SCALE * f.s
  c = document.createElement('canvas')
  c.width = Math.ceil(FAN_BOX.w * k)
  c.height = Math.ceil(FAN_BOX.h * k)
  const ctx = c.getContext('2d')!
  ctx.scale(k, k)
  ctx.translate(-FAN_BOX.x, -FAN_BOX.y)
  drawFanBody(ctx, f)
  fanSprites.set(f, c)
  return c
}

function drawFanBody(ctx: CanvasRenderingContext2D, f: Fan) {
  const sw = f.female ? 10.5 : 12.5
  const ww = f.female ? 8.2 : 11
  const hip = f.female ? 10.5 : 11

  // legs (only the front row shows them)
  if (f.front) {
    ctx.fillStyle = f.pants
    ctx.strokeStyle = FAN_LINE
    ctx.lineWidth = 1
    for (const lx of [-5.5, 5.5]) {
      rr(ctx, lx - 4.5, -2, 9, 12, 3)
      ctx.fill()
      ctx.stroke()
      rr(ctx, lx - 3.5, 8, 7, 20, 3)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#f4f4f4'
      rr(ctx, lx - 5, 26, 10, 5, 2.5)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = f.pants
    }
  }

  fanHairBack(ctx, f, 0)

  // hood behind the neck
  if (f.top === 'hoodie') {
    ctx.fillStyle = shade(f.topColor, -0.2)
    ctx.beginPath()
    ctx.ellipse(0, -27, 10, 4.5, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // torso
  const torso = () => {
    ctx.beginPath()
    if (f.female) {
      ctx.moveTo(-sw, -27)
      ctx.quadraticCurveTo(-sw - 1.8, -20, -ww - 1.2, -13)
      ctx.quadraticCurveTo(-ww - 0.6, -6, -hip, 0)
      ctx.lineTo(hip, 0)
      ctx.quadraticCurveTo(ww + 0.6, -6, ww + 1.2, -13)
      ctx.quadraticCurveTo(sw + 1.8, -20, sw, -27)
    } else {
      ctx.moveTo(-sw, -27)
      ctx.lineTo(-ww - 1, -8)
      ctx.lineTo(-hip, 0)
      ctx.lineTo(hip, 0)
      ctx.lineTo(ww + 1, -8)
      ctx.lineTo(sw, -27)
    }
    ctx.quadraticCurveTo(0, -24.5, -sw, -27)
    ctx.closePath()
  }
  torso()
  ctx.fillStyle = f.topColor
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.fillRect(-16, -30, 7, 32)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(6, -30, 3, 32)
  if (f.female) {
    // bust shading
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(-4.4, -18.5, 4.4, 0.1 * Math.PI, 0.9 * Math.PI)
    ctx.moveTo(8.8, -18.5)
    ctx.arc(4.4, -18.5, 4.4, 0.1 * Math.PI, 0.9 * Math.PI)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    ctx.beginPath()
    ctx.ellipse(-4.5, -20.5, 2.6, 1.6, -0.3, 0, Math.PI * 2)
    ctx.ellipse(4.5, -20.5, 2.6, 1.6, 0.3, 0, Math.PI * 2)
    ctx.fill()
  }
  if (f.top === 'jersey') {
    ctx.fillStyle = f.topColor === '#ffffff' ? '#2f6fd0' : '#ffffff'
    ctx.font = `800 ${f.female ? 7 : 9}px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.fillText(String(f.num), 0, f.female ? -7 : -10)
  }
  if (f.top === 'hoodie') {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(-2, -25)
    ctx.lineTo(-2.4, -17)
    ctx.moveTo(2, -25)
    ctx.lineTo(2.4, -17)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'
    ctx.beginPath()
    ctx.moveTo(-6, -2)
    ctx.quadraticCurveTo(0, -8, 6, -2)
    ctx.stroke()
  }
  ctx.restore()
  torso()
  ctx.strokeStyle = FAN_LINE
  ctx.lineWidth = 1
  ctx.stroke()
  // neckline
  if (f.top !== 'hoodie') {
    ctx.fillStyle = f.skin
    ctx.beginPath()
    ctx.moveTo(-4.5, -26.6)
    ctx.quadraticCurveTo(0, f.top === 'jersey' ? -19 : -22, 4.5, -26.6)
    ctx.closePath()
    ctx.fill()
  }

  // scarf
  if (f.prop === 'scarf') {
    ctx.fillStyle = '#2f6fd0'
    rr(ctx, -8, -30, 16, 5, 2)
    ctx.fill()
    ctx.fillStyle = '#f28c28'
    ctx.fillRect(-4, -30, 2.5, 5)
    ctx.fillRect(2, -30, 2.5, 5)
    ctx.fillStyle = '#2f6fd0'
    ctx.fillRect(3, -26, 4, 12)
    ctx.fillStyle = '#f28c28'
    ctx.fillRect(3, -19, 4, 2)
  }

  // neck + head
  ctx.fillStyle = shade(f.skin, -0.08)
  ctx.fillRect(-3.2, -32, 6.4, 6)
  ctx.fillStyle = f.skin
  ctx.strokeStyle = FAN_LINE
  ctx.lineWidth = 1
  for (const ex of [-9.6, 9.6]) {
    ctx.beginPath()
    ctx.ellipse(ex, -39, 1.8, 2.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.ellipse(0, -40, 9.6, 10.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // face
  const eyeW = f.female ? 1.35 : 1.05
  const eyeH = f.female ? 1.8 : 1.45
  for (const ex of [-3.4, 3.4]) {
    ctx.fillStyle = '#231a15'
    ctx.beginPath()
    ctx.ellipse(ex, -40, eyeW, eyeH, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(ex + 0.45, -40.6, 0.45, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(35,26,21,0.55)'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.moveTo(0, -39)
  ctx.quadraticCurveTo(1, -37.5, 0, -37)
  ctx.stroke()
  ctx.strokeStyle = '#231a15'
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.moveTo(-5, -43.5)
  ctx.lineTo(-2, -44)
  ctx.moveTo(2, -44)
  ctx.lineTo(5, -43.5)
  if (f.female) {
    ctx.moveTo(-4.5, -41)
    ctx.lineTo(-5.6, -42)
    ctx.moveTo(4.5, -41)
    ctx.lineTo(5.6, -42)
  }
  ctx.stroke()
  if (f.female || f.kid) {
    ctx.fillStyle = 'rgba(255,110,120,0.3)'
    ctx.beginPath()
    ctx.ellipse(-5.6, -36.5, 2, 1.3, 0, 0, Math.PI * 2)
    ctx.ellipse(5.6, -36.5, 2, 1.3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = f.female ? '#c2455a' : '#231a15'
  ctx.lineWidth = f.female ? 1.3 : 0.9
  ctx.beginPath()
  ctx.arc(0, -36.5, 2.6, 0.2 * Math.PI, 0.8 * Math.PI)
  ctx.stroke()
  if (f.glasses) {
    ctx.strokeStyle = '#231a15'
    ctx.lineWidth = 0.9
    ctx.beginPath()
    ctx.arc(-3.5, -40, 2.6, 0, Math.PI * 2)
    ctx.moveTo(6.1, -40)
    ctx.arc(3.5, -40, 2.6, 0, Math.PI * 2)
    ctx.moveTo(-0.9, -40.5)
    ctx.lineTo(0.9, -40.5)
    ctx.stroke()
  }
  fanHairFront(ctx, f)
  // hair shine
  if (f.hairStyle !== 'cap' && f.hairStyle !== 'beanie' && f.hairStyle !== 'buzz') {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.arc(-1, -42, 7.5, Math.PI * 1.2, Math.PI * 1.45)
    ctx.stroke()
  }
  if (f.earrings) {
    ctx.fillStyle = '#ffd86b'
    for (const ex of [-9.6, 9.6]) {
      ctx.beginPath()
      ctx.arc(ex, -35.8, 1.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (f.bow) {
    ctx.fillStyle = f.bow
    ctx.strokeStyle = FAN_LINE
    ctx.lineWidth = 0.8
    const bx = f.hairStyle === 'bun' ? 0 : 6
    const by = f.hairStyle === 'bun' ? -56.5 : -49
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx - 4, by - 2.5)
    ctx.lineTo(bx - 4, by + 2.5)
    ctx.closePath()
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + 4, by - 2.5)
    ctx.lineTo(bx + 4, by + 2.5)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

}

/** Animated part of a fan, drawn every crowd refresh: arms, cheering mouth, props. */
function drawFanAnimated(ctx: CanvasRenderingContext2D, f: Fan, t: number, excite: number) {
  const hyped = excite > 0.2
  const up = f.cheerer && f.prop !== 'phone' && (hyped ? Math.sin(t * 6 + f.phase) > -0.5 : Math.sin(t * 0.5 + f.phase) > 0.94)
  const clap = !up && hyped && f.prop !== 'phone'
  const sw = f.female ? 10.5 : 12.5

  // arms
  const sleeve = f.top === 'hoodie' ? 'long' : f.top === 'jersey' ? 'none' : 'short'
  const ls: V = [-sw + 1.5, -25]
  const rs: V = [sw - 1.5, -25]
  let left: V[]
  let right: V[]
  if (f.prop === 'sign') {
    left = [ls, [-sw - 2, -38], [-10, -50]]
    right = [rs, [sw + 2, -38], [10, -50]]
  } else if (up) {
    const w = Math.sin(t * 12 + f.phase) * 3 * excite
    left = [ls, [-sw - 4, -38], [-sw - 3 + w, -51]]
    right = [rs, [sw + 4, -38], [sw + 3 + w, -51]]
  } else if (clap) {
    const c = Math.abs(Math.sin(t * 14 + f.phase)) * 3.5
    left = [ls, [-sw - 1.5, -12], [-1.5 - c, -21]]
    right = [rs, [sw + 1.5, -12], [1.5 + c, -21]]
  } else {
    left = [ls, [-sw - 2, -12], [-6, -3]]
    right = [rs, [sw + 2, -12], [6, -3]]
  }
  if (f.prop === 'phone') right = [rs, [sw + 2.5, -16], [5, -33]]
  fanArm(ctx, f, left, sleeve)
  fanArm(ctx, f, right, sleeve)


  if (hyped) {
    // cover the calm smile baked into the sprite, then open the mouth
    ctx.fillStyle = f.skin
    ctx.beginPath()
    ctx.ellipse(0, -35.6, 3.6, 2.2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#7a2a1f'
    ctx.beginPath()
    ctx.ellipse(0, -34.5, 2.6, 2.1, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // props
  if (f.prop === 'phone') {
    ctx.fillStyle = '#1b1b1f'
    rr(ctx, 2, -42, 6, 10, 1.2)
    ctx.fill()
    ctx.fillStyle = hyped ? 'rgba(170,215,255,0.95)' : 'rgba(120,170,230,0.8)'
    ctx.fillRect(2.8, -41, 4.4, 8)
  } else if (f.prop === 'finger' && up) {
    const [hx, hy] = right[2]
    ctx.fillStyle = '#f28c28'
    ctx.strokeStyle = FAN_LINE
    ctx.lineWidth = 1
    rr(ctx, hx - 5, hy - 7, 10, 10, 3)
    ctx.fill()
    ctx.stroke()
    rr(ctx, hx - 1.8, hy - 20, 4, 14, 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.font = `800 5px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.fillText('#1', hx, hy)
  } else if (f.prop === 'sign') {
    const sy = -70 + (hyped ? Math.sin(t * 8 + f.phase) * 3 : 0)
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = 'rgba(40,30,25,0.6)'
    ctx.lineWidth = 1.5
    rr(ctx, -24, sy, 48, 22, 3)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = f.sign === 'DEFENSE' ? '#d93a3a' : '#2f6fd0'
    ctx.font = `800 ${f.sign.length > 5 ? 11 : 14}px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.fillText(f.sign, 0, sy + 16)
  }
}

function drawFan(ctx: CanvasRenderingContext2D, f: Fan, t: number, excite: number) {
  const hyped = excite > 0.2
  const bob = hyped ? -Math.abs(Math.sin(t * 9 + f.phase)) * 5 * excite : Math.sin(t * 1.3 + f.phase) * 0.6
  ctx.save()
  ctx.translate(f.x, f.y + bob * f.s)
  ctx.drawImage(fanSprite(f), FAN_BOX.x * f.s, FAN_BOX.y * f.s, FAN_BOX.w * f.s, FAN_BOX.h * f.s)
  ctx.scale(f.s, f.s)
  drawFanAnimated(ctx, f, t, excite)
  ctx.restore()
}

const BOARD_TEXT = '  tebBasket   ★   TEB   ★   GO TEB!   ★   1v1 ARENA   ★'
/** sprites are rendered at this multiple of the logical resolution so they stay sharp on hi-dpi */
const SPRITE_SCALE = 2
const boardSprites: Record<string, HTMLCanvasElement> = {}

/** Pre-rendered glowing text strip — shadowBlur once instead of every frame. */
function boardSprite(color: string) {
  if (boardSprites[color]) return boardSprites[color]
  const font = `800 17px ${DISPLAY}`
  const m = document.createElement('canvas').getContext('2d')!
  m.font = font
  const w = Math.ceil(m.measureText(BOARD_TEXT).width)
  const c = document.createElement('canvas')
  c.width = w * SPRITE_SCALE
  c.height = 26 * SPRITE_SCALE
  const ctx = c.getContext('2d')!
  ctx.scale(SPRITE_SCALE, SPRITE_SCALE)
  ctx.font = font
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  ctx.shadowColor = '#ff8a1f'
  ctx.shadowBlur = 8
  ctx.fillText(BOARD_TEXT, 0, 13)
  boardSprites[color] = c
  return c
}

/** Courtside LED boards with scrolling text. */
function drawBoards(ctx: CanvasRenderingContext2D, t: number, excite: number) {
  const y = BOARD_TOP
  const h = FLOOR_TOP - BOARD_TOP
  ctx.fillStyle = '#101c38'
  ctx.fillRect(0, y, W, h)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(0, y, W, 1.5)
  const flash = excite > 0.5 && Math.floor(t * 6) % 2 === 0
  const sprite = boardSprite(flash ? '#ffffff' : '#ffb054')
  const sw = sprite.width / SPRITE_SCALE
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, y + 3, W, h - 6)
  ctx.clip()
  const off = -((t * 45) % sw)
  for (let x = off; x < W; x += sw) ctx.drawImage(sprite, x, y + h / 2 - 12, sw, 26)
  ctx.restore()
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  for (let gy = y + 3; gy < y + h; gy += 3) ctx.fillRect(0, gy, W, 1)
}

// The crowd (~100 hand-drawn fans) is cached in its own layer and only
// repainted at 15–30 fps instead of every frame.
let crowdLayer: HTMLCanvasElement | null = null
let crowdT = -1
let crowdExcite = -1

function drawCrowd(ctx: CanvasRenderingContext2D, t: number, excite: number) {
  if (!crowdLayer) {
    crowdLayer = document.createElement('canvas')
    crowdLayer.width = W * SPRITE_SCALE
    crowdLayer.height = BOARD_TOP * SPRITE_SCALE
  }
  const fps = excite > 0.2 ? 30 : 15
  if (t < crowdT || t - crowdT >= 1 / fps || Math.abs(excite - crowdExcite) > 0.2) {
    const c = crowdLayer.getContext('2d')!
    c.setTransform(SPRITE_SCALE, 0, 0, SPRITE_SCALE, 0, 0)
    c.clearRect(0, 0, W, BOARD_TOP)
    for (const f of getFans()) drawFan(c, f, t, excite)
    crowdT = t
    crowdExcite = excite
  }
  ctx.drawImage(crowdLayer, 0, 0, W, BOARD_TOP)
}

/** Gym backdrop + animated crowd + LED boards (lobby and match). */
export function drawGym(ctx: CanvasRenderingContext2D, t: number, excite: number) {
  ctx.drawImage(getBackdrop(), 0, 0)
  drawCrowd(ctx, t, excite)
  drawBoards(ctx, t, excite)
  // the hoop stand is in front of the stands and the LED boards
  ctx.drawImage(getStanchion(), STAND_X, 0, W - STAND_X, H)
}

/* ------------------------------------------------------------------ */
/* ball                                                               */
/* ------------------------------------------------------------------ */

export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, glow = false, squash = 0) {
  ctx.save()
  if (glow) {
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3)
    g.addColorStop(0, 'rgba(255,200,60,0.85)')
    g.addColorStop(1, 'rgba(255,120,20,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r * 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.translate(x, y + r * squash * 0.25)
  ctx.scale(1 + squash * 0.25, 1 - squash * 0.25)
  ctx.save()
  ctx.rotate(spin)
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.2, 0, 0, r)
  g.addColorStop(0, '#ffb466')
  g.addColorStop(1, '#d9640f')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#3a2412'
  ctx.lineWidth = Math.max(1, r * 0.13)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-r, 0)
  ctx.lineTo(r, 0)
  ctx.moveTo(0, -r)
  ctx.lineTo(0, r)
  ctx.moveTo(-r * 0.6, -r * 0.8)
  ctx.quadraticCurveTo(-r * 0.15, 0, -r * 0.6, r * 0.8)
  ctx.moveTo(r * 0.6, -r * 0.8)
  ctx.quadraticCurveTo(r * 0.15, 0, r * 0.6, r * 0.8)
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.ellipse(-r * 0.38, -r * 0.42, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha = 0.25) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, `rgba(70,35,10,${alpha * 1.4})`)
  g.addColorStop(0.6, `rgba(70,35,10,${alpha})`)
  g.addColorStop(1, 'rgba(70,35,10,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* person                                                             */
/* ------------------------------------------------------------------ */

export type PoseMode =
  | 'idle' | 'run' | 'shoot' | 'dunk' | 'hang' | 'reach' | 'defend' | 'block' | 'fall' | 'cross'
  | 'celebrate' | 'sad' | 'hold' | 'dribble' | 'spin'

export interface Pose {
  facing: 1 | -1
  mode: PoseMode
  /** run cycle phase */
  anim: number
  /** global time (breathing, blinking) */
  t: number
  /** 0..1 wind-up, >1 follow-through (shoot/dunk); 0..1 progress for cross/fall */
  u?: number
  air?: boolean
  moving?: boolean
  dribbleArm?: boolean
  /** 0..1 position in the dribble cycle */
  dribble?: number
  aura?: boolean
  holdBall?: boolean
}

type V = [number, number]
const seg = (o: V, ang: number, len: number): V => [o[0] + Math.sin(ang) * len, o[1] + Math.cos(ang) * len]

/** Two-segment limb that tapers (thicker thigh/biceps, slimmer calf/forearm). */
function limb(ctx: CanvasRenderingContext2D, pts: V[], w: number, color: string, highlight = true) {
  const w0 = w * 1.15
  const w1 = w * 0.86
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const segment = (a: V, b: V, width: number, style: string) => {
    ctx.strokeStyle = style
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.stroke()
  }
  segment(pts[0], pts[1], w0 + 4, OUTLINE)
  segment(pts[1], pts[2], w1 + 4, OUTLINE)
  segment(pts[0], pts[1], w0, color)
  segment(pts[1], pts[2], w1, color)
  // muscle bulge on the first third of the lower segment (calf / forearm)
  const mid: V = [pts[1][0] + (pts[2][0] - pts[1][0]) * 0.3, pts[1][1] + (pts[2][1] - pts[1][1]) * 0.3]
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(mid[0], mid[1], w1 * 0.56, 0, Math.PI * 2)
  ctx.fill()
  if (highlight) {
    ctx.save()
    ctx.translate(1.5, -1)
    segment(pts[0], pts[1], w0 * 0.28, 'rgba(255,255,255,0.2)')
    segment(pts[1], pts[2], w1 * 0.25, 'rgba(255,255,255,0.16)')
    ctx.restore()
  }
}

/** High-top sneaker, side view; p = ankle point on the ground line. */
function shoe(ctx: CanvasRenderingContext2D, p: V, color: string, trim: string, tilt: number) {
  ctx.save()
  ctx.translate(p[0], p[1])
  ctx.rotate(tilt)
  const accent = trim === color ? '#ffffff' : trim
  const upper = () => {
    ctx.beginPath()
    ctx.moveTo(-7, 3)
    ctx.lineTo(-7.5, -9)
    ctx.quadraticCurveTo(-1, -12, 5, -9)
    ctx.lineTo(7, -5)
    ctx.quadraticCurveTo(15, -4, 19, 0)
    ctx.quadraticCurveTo(20.5, 3, 18, 4)
    ctx.closePath()
  }
  upper()
  const g = ctx.createLinearGradient(0, -12, 0, 4)
  g.addColorStop(0, shade(color.startsWith('#') ? color : '#888888', 0.18))
  g.addColorStop(1, color)
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2
  ctx.stroke()
  // toe cap + swoosh + laces + collar
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.beginPath()
  ctx.moveTo(11, -3)
  ctx.quadraticCurveTo(17, -2.5, 18.5, 1)
  ctx.lineTo(11, 1)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(-4, 0)
  ctx.quadraticCurveTo(5, 1, 14, -4)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  for (const lx of [1, 4, 7]) {
    ctx.beginPath()
    ctx.arc(lx, -7 + lx * 0.35, 0.9, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(-7.3, -8.5)
  ctx.quadraticCurveTo(-1, -11.3, 4.8, -8.5)
  ctx.stroke()
  // sole
  ctx.fillStyle = '#f7f7f7'
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1.6
  rr(ctx, -8, 2, 28, 5, 2.5)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.fillRect(-7, 5, 26, 1.4)
  ctx.restore()
}

/** Jersey fill inside an already-clipped torso: soft gradient, pattern, fabric folds. */
function jerseyFill(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, w: number, h: number) {
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  if (look.pattern === 'gradient') {
    g.addColorStop(0, look.jersey)
    g.addColorStop(1, look.jersey2)
  } else {
    g.addColorStop(0, shade(look.jersey, 0.12))
    g.addColorStop(1, shade(look.jersey, -0.08))
  }
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = look.jersey2
  if (look.pattern === 'stripes') {
    for (let sx = x + 2; sx < x + w; sx += 5.5) ctx.fillRect(sx, y, 1.5, h)
  } else if (look.pattern === 'stars') {
    for (let i = 0; i < 14; i++) {
      const sx = x + ((i * 37) % 100) / 100 * w
      const sy = y + ((i * 53) % 100) / 100 * h
      ctx.beginPath()
      ctx.arc(sx, sy, i % 3 === 0 ? 1.4 : 0.9, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (look.pattern === 'sash') {
    ctx.save()
    ctx.translate(x + w / 2, y + h / 2)
    ctx.rotate(-0.65)
    ctx.fillRect(-w, -4.5, w * 2, 9)
    ctx.restore()
  }
  // fabric folds
  ctx.strokeStyle = 'rgba(0,0,0,0.13)'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.moveTo(x + w * 0.25, y + h * 0.62)
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.7, x + w * 0.72, y + h * 0.6)
  ctx.moveTo(x + w * 0.35, y + h * 0.82)
  ctx.quadraticCurveTo(x + w * 0.55, y + h * 0.88, x + w * 0.7, y + h * 0.8)
  ctx.stroke()
}

function hand(ctx: CanvasRenderingContext2D, p: V, color: string) {
  ctx.fillStyle = color
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(p[0], p[1], 5.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

/** Draws a cartoon basketball player with feet at (0,0), ~165 units tall, facing +x. */
export function drawPerson(ctx: CanvasRenderingContext2D, look: Look, pose: Pose) {
  const { mode, anim, t } = pose
  const u = pose.u ?? 0
  const air = !!pose.air
  const skinBack = shade(look.skin, -0.14)

  ctx.save()
  if (pose.facing === -1) ctx.scale(-1, 1)

  if (pose.aura) {
    const pulse = 0.75 + Math.sin(t * 8) * 0.25
    const g = ctx.createRadialGradient(0, -85, 20, 0, -85, 105)
    g.addColorStop(0, `rgba(255,190,60,${0.42 * pulse})`)
    g.addColorStop(1, 'rgba(255,140,20,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(0, -85, 75, 110, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  if (mode === 'fall') {
    // knocked off balance: tip backwards, then scramble up
    const k = u < 0.15 ? u / 0.15 : u > 0.75 ? (1 - u) / 0.25 : 1
    ctx.translate(-16 * k, 0)
    ctx.rotate(-1.05 * k)
  }

  // ---- legs ----
  let fl: [number, number]
  let bl: [number, number]
  if (mode === 'hang') {
    const sw = Math.sin(t * 9) * 0.18
    fl = [0.25 + sw, 0.1 + sw]
    bl = [-0.05 + sw, -0.25 + sw]
  } else if (mode === 'block') {
    fl = [0.15, 0.0]
    bl = [-0.1, -0.35]
  } else if (air || mode === 'dunk' || mode === 'shoot') {
    fl = [0.55, -0.35]
    bl = [-0.1, -0.7]
  } else if (mode === 'fall') {
    fl = [0.9, 0.6]
    bl = [0.6, 0.2]
  } else if (mode === 'run') {
    const s = Math.sin(anim)
    fl = [0.62 * s, 0.62 * s - 0.9 * Math.max(0, -Math.cos(anim))]
    bl = [-0.62 * s, -0.62 * s - 0.9 * Math.max(0, Math.cos(anim))]
  } else if (mode === 'cross') {
    fl = [0.75, -0.15]
    bl = [-0.65, 0.15]
  } else if (mode === 'defend' || mode === 'reach') {
    const sh = pose.moving ? Math.sin(anim * 1.4) * 0.16 : 0
    fl = [0.5 + sh, -0.05]
    bl = [-0.45 + sh, 0.05]
  } else if (mode === 'sad') {
    fl = [0.35, -0.25]
    bl = [0.05, -0.3]
  } else {
    fl = [0.18, 0.02]
    bl = [-0.14, -0.04]
  }
  const thigh = 31
  const shin = 31
  const legLen = (a: [number, number]) => Math.cos(a[0]) * thigh + Math.cos(a[1]) * shin
  let hipY = -64
  if (!air && mode !== 'shoot' && mode !== 'dunk' && mode !== 'hang' && mode !== 'block') {
    hipY = -Math.max(legLen(fl), legLen(bl)) - 4
  }
  if (mode === 'run') hipY -= Math.abs(Math.cos(anim)) * 3
  const breathe = mode === 'idle' || mode === 'hold' || mode === 'dribble' || mode === 'spin' ? Math.sin(t * 2.4) * 1.2 : 0
  const hip: V = [0, hipY]
  const shoulderY = hipY - 52 + breathe
  const lean =
    mode === 'run' ? 7 : mode === 'cross' ? 12 : mode === 'defend' || mode === 'reach' ? 8 : mode === 'sad' ? 16 : mode === 'dribble' ? 3 : 0

  const legPts = (a: [number, number], off: number): V[] => {
    const h0: V = [hip[0] + off, hip[1]]
    const knee = seg(h0, a[0], thigh)
    return [h0, knee, seg(knee, a[1], shin)]
  }

  // ---- arms ----
  type ArmA = [number, number]
  let fa: ArmA
  let ba: ArmA
  const swing = Math.sin(anim)
  const push = Math.max(0, Math.cos((pose.dribble ?? 0) * Math.PI * 2))
  switch (mode) {
    case 'run':
      fa = pose.dribbleArm ? [0.5 + push * 0.25, 1.0 + push * 0.3] : [-0.75 * swing, -0.75 * swing + 1.15]
      ba = [0.75 * swing, 0.75 * swing + 1.15]
      break
    case 'dribble':
      fa = [0.45 + push * 0.25, 0.95 + push * 0.35]
      ba = [-0.3, 0.45]
      break
    case 'cross': {
      const k = Math.sin(u * Math.PI)
      fa = [0.6 - k * 0.9, 0.5 - k * 0.4]
      ba = [-1.0, -0.5]
      break
    }
    case 'shoot': {
      const k = Math.min(1, u)
      const up = 0.9 + k * 1.9
      const wrist = u > 1 ? Math.min(1, (u - 1) * 2.5) : 0
      fa = [up, up + 0.25 - wrist * 1.1]
      ba = [up - 0.15, up + 0.6]
      break
    }
    case 'dunk':
      fa = [0.8 + Math.min(1, u) * 1.9, 0.9 + Math.min(1, u) * 1.75 - (u > 1 ? 1.1 : 0)]
      ba = [-0.6, 0.2]
      break
    case 'hang':
      fa = [2.95, 3.05]
      ba = [2.85, 3.0]
      break
    case 'block':
      fa = [2.9, 3.05]
      ba = [2.7, 2.95]
      break
    case 'reach':
      fa = [1.45, 1.55]
      ba = [-0.6, -0.2]
      break
    case 'defend':
      fa = [1.9 + Math.sin(t * 6) * 0.08, 2.5]
      ba = [-1.4, -2.0]
      break
    case 'fall':
      fa = [2.3 + Math.sin(t * 22) * 0.35, 2.7]
      ba = [-2.1 + Math.cos(t * 20) * 0.35, -2.6]
      break
    case 'celebrate': {
      const pump = Math.sin(t * 9)
      fa = [2.85 + pump * 0.15, 3.0 + pump * 0.3]
      ba = [-2.85 - pump * 0.15, -3.0]
      break
    }
    case 'sad':
      fa = [0.75, 0.25]
      ba = [0.55, 0.1]
      break
    case 'hold':
      fa = [0.4, 1.75]
      ba = [0.25, 1.6]
      break
    case 'spin':
      fa = [2.75, 3.1]
      ba = [-0.15, 0.3]
      break
    default:
      fa = [0.18, 0.45]
      ba = [-0.12, 0.25]
  }
  const upper = 24
  const fore = 22
  const shoulderF: V = [3 + lean, shoulderY + 7]
  const shoulderB: V = [-3 + lean, shoulderY + 7]
  const armPts = (s: V, a: ArmA): V[] => {
    const e = seg(s, a[0], upper)
    return [s, e, seg(e, a[1], fore)]
  }

  // back arm
  const bArm = armPts(shoulderB, ba)
  limb(ctx, bArm, 9, skinBack, false)
  hand(ctx, bArm[2], skinBack)

  // legs: sock above the high-top, then the shoe
  const legWithShoe = (L: V[], skin: string, shoeCol: string, tilt: number, hl: boolean) => {
    limb(ctx, L, 11, skin, hl)
    const k = L[2]
    const d: V = [L[1][0] - k[0], L[1][1] - k[1]]
    const n = Math.hypot(d[0], d[1])
    const at = (v: number): V => [k[0] + (d[0] / n) * v, k[1] + (d[1] / n) * v]
    ctx.lineCap = 'butt'
    ctx.lineWidth = 10.5
    ctx.strokeStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(...at(6))
    ctx.lineTo(...at(16))
    ctx.stroke()
    ctx.strokeStyle = look.trim === '#ffffff' ? look.jersey : look.trim
    ctx.beginPath()
    ctx.moveTo(...at(13))
    ctx.lineTo(...at(14.6))
    ctx.stroke()
    shoe(ctx, k, shoeCol, look.trim, tilt)
  }
  const bLeg = legPts(bl, -4)
  legWithShoe(bLeg, skinBack, shade(look.shoes, -0.12), bl[1] * 0.4, false)
  const fLeg = legPts(fl, 4)
  legWithShoe(fLeg, look.skin, look.shoes, fl[1] * 0.4, true)

  // shorts: waist block + one baggy tube per thigh, so legs never poke out
  {
    type Quad = [V, V, V, V]
    const tube = (a: [number, number], off: number): { q: Quad; hem: [V, V] } => {
      const hx = hip[0] + off
      const hy = hip[1]
      const d: V = [Math.sin(a[0]), Math.cos(a[0])]
      const n: V = [Math.cos(a[0]), -Math.sin(a[0])]
      const top: V = [hx - d[0] * 6, hy - d[1] * 6]
      const bot: V = [hx + d[0] * 27, hy + d[1] * 27]
      const w0 = 10.5
      const w1 = 11.5
      return {
        q: [
          [top[0] + n[0] * w0, top[1] + n[1] * w0],
          [bot[0] + n[0] * w1, bot[1] + n[1] * w1],
          [bot[0] - n[0] * w1, bot[1] - n[1] * w1],
          [top[0] - n[0] * w0, top[1] - n[1] * w0],
        ],
        hem: [
          [bot[0] - d[0] * 3 + n[0] * w1, bot[1] - d[1] * 3 + n[1] * w1],
          [bot[0] - d[0] * 3 - n[0] * w1, bot[1] - d[1] * 3 - n[1] * w1],
        ],
      }
    }
    const back = tube(bl, -4)
    const front = tube(fl, 4)
    const waist: Quad = [
      [-14 + lean * 0.3, hipY - 8],
      [15 + lean * 0.3, hipY - 8],
      [15.5, hipY + 7],
      [-14.5, hipY + 7],
    ]
    const poly = (q: Quad) => {
      ctx.moveTo(q[0][0], q[0][1])
      for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1])
      ctx.closePath()
    }
    const all = () => {
      ctx.beginPath()
      poly(waist)
      poly(back.q)
      poly(front.q)
    }
    // outline first (thick), fill on top → only the outer silhouette keeps a line
    all()
    ctx.lineJoin = 'round'
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 5
    ctx.stroke()
    all()
    ctx.save()
    ctx.clip('nonzero')
    const sg = ctx.createLinearGradient(0, hipY - 8, 0, hipY + 32)
    sg.addColorStop(0, shade(look.shorts, 0.1))
    sg.addColorStop(1, shade(look.shorts, -0.1))
    ctx.fillStyle = sg
    ctx.fillRect(-45, hipY - 12, 90, 50)
    ctx.fillStyle = 'rgba(0,0,0,0.15)'
    ctx.fillRect(-45, hipY - 12, 31, 50)
    ctx.fillStyle = shade(look.shorts, -0.2)
    ctx.fillRect(-45, hipY - 8, 90, 4)
    // trim: hems + side stripe on the front leg
    ctx.strokeStyle = look.trim
    ctx.lineWidth = 3
    ctx.beginPath()
    for (const h of [back.hem, front.hem]) {
      ctx.moveTo(h[0][0], h[0][1])
      ctx.lineTo(h[1][0], h[1][1])
    }
    ctx.moveTo(14 + lean * 0.3, hipY - 5)
    ctx.lineTo((front.q[0][0] + front.q[1][0]) / 2 + 3, (front.q[0][1] + front.q[1][1]) / 2)
    ctx.lineTo(front.hem[0][0] - 1, front.hem[0][1])
    ctx.stroke()
    // crease between the legs
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(front.q[3][0], front.q[3][1] + 6)
    ctx.lineTo(front.q[2][0], front.q[2][1])
    ctx.stroke()
    ctx.restore()
  }

  // torso / jersey — side view (narrow, chest forward)
  ctx.save()
  ctx.translate(0, hipY)
  ctx.rotate(lean * 0.012)
  ctx.translate(0, -hipY)
  const tTop = shoulderY
  const tBot = hipY - 4
  const torsoPath = () => {
    ctx.beginPath()
    ctx.moveTo(-10, tTop + 1)
    ctx.quadraticCurveTo(-3, tTop - 2, 5, tTop)
    ctx.quadraticCurveTo(12, tTop + 2, 13.5, tTop + 13)
    ctx.quadraticCurveTo(15, tTop + 28, 13, tBot)
    ctx.lineTo(-12.5, tBot)
    ctx.quadraticCurveTo(-15, tTop + 24, -12.5, tTop + 11)
    ctx.quadraticCurveTo(-12.5, tTop + 3, -10, tTop + 1)
    ctx.closePath()
  }
  torsoPath()
  ctx.save()
  ctx.clip()
  jerseyFill(ctx, look, -20, tTop - 4, 40, tBot - tTop + 8)
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(-20, tTop - 4, 10, 70)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(8, tTop - 4, 3.5, 70)
  ctx.strokeStyle = look.trim
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.ellipse(0, tTop + 9, 6.5, 10, 0, 0, Math.PI * 2)
  ctx.moveTo(2, tTop + 22)
  ctx.lineTo(2, tBot)
  ctx.stroke()
  ctx.restore()
  torsoPath()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.strokeStyle = look.trim
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(1, tTop - 0.5)
  ctx.quadraticCurveTo(5, tTop + 5, 9, tTop + 1)
  ctx.stroke()
  ctx.save()
  ctx.translate(7, 0)
  if (pose.facing === -1) ctx.scale(-1, 1)
  ctx.fillStyle = look.trim
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `800 15px ${DISPLAY}`
  ctx.fillText(String(look.number), 0, tTop + 38)
  ctx.restore()
  ctx.restore()

  // neck + head
  const headX = 3 + lean * 1.2
  const headY = shoulderY - 19 + (mode === 'sad' ? 6 : 0)
  ctx.fillStyle = shade(look.skin, -0.06)
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.5
  rr(ctx, headX - 5, shoulderY - 9, 9, 12, 3)
  ctx.fill()
  ctx.stroke()
  const tilt =
    mode === 'sad' ? 0.35 : mode === 'shoot' || mode === 'dunk' || mode === 'hang' || mode === 'block' ? -0.22 : mode === 'fall' ? 0.3 : 0
  drawHead(ctx, look, headX, headY, tilt, mode, t)

  if (pose.holdBall) drawBall(ctx, 22 + lean, shoulderY + 34, BALL_R * 1.15, 0.4)

  // front arm + wristband
  const fArm = armPts(shoulderF, fa)
  limb(ctx, fArm, 9, look.skin)
  const wb = seg(fArm[1], fa[1], fore - 8)
  const wb2 = seg(wb, fa[1], 3.5)
  ctx.strokeStyle = look.trim
  ctx.lineWidth = 10
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(wb[0], wb[1])
  ctx.lineTo(wb2[0], wb2[1])
  ctx.stroke()
  hand(ctx, fArm[2], look.skin)

  // the arm comes out of the armhole: repaint the shoulder strap over the top of the arm
  ctx.save()
  ctx.translate(0, hipY)
  ctx.rotate(lean * 0.012)
  ctx.translate(0, -hipY)
  torsoPath()
  ctx.clip()
  ctx.beginPath()
  ctx.rect(-25, tTop - 1, 50, 9.5)
  ctx.clip()
  jerseyFill(ctx, look, -20, tTop - 4, 40, tBot - tTop + 8)
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(8, tTop - 4, 3.5, 14)
  ctx.strokeStyle = look.trim
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.ellipse(0, tTop + 9, 6.5, 10, 0, 0, Math.PI * 2)
  ctx.moveTo(1, tTop - 0.5)
  ctx.quadraticCurveTo(5, tTop + 5, 9, tTop + 1)
  ctx.stroke()
  torsoPath()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.restore()

  ctx.restore()
}

/** Profile head (facing +x), centered at (x, y). */
export function drawHead(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, tilt: number, mode: PoseMode = 'idle', t = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  const r = 16.5
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  if (look.hairStyle === 2) {
    ctx.fillStyle = look.hair
    ctx.beginPath()
    ctx.ellipse(-5, -6, r + 5, r + 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  const headPath = () => {
    ctx.beginPath()
    ctx.moveTo(-r + 1, 7)
    ctx.bezierCurveTo(-r - 2, -12, -6, -r - 3, 4, -r - 1)
    ctx.bezierCurveTo(12, -r + 1, r + 1, -9, r, -2)
    ctx.lineTo(r + 4, 3.5)
    ctx.lineTo(r, 6)
    ctx.quadraticCurveTo(r + 1.5, 10, r - 1, 12.5)
    ctx.quadraticCurveTo(r - 3, r + 2, 4, r + 1)
    ctx.quadraticCurveTo(-6, r + 2, -r + 1, 7)
    ctx.closePath()
  }
  headPath()
  ctx.fillStyle = look.skin
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(0,0,0,0.1)'
  ctx.beginPath()
  ctx.ellipse(-13, 4, 9, 18, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  headPath()
  ctx.stroke()

  // hair
  ctx.fillStyle = look.hair
  ctx.beginPath()
  if (look.hairStyle === 0) {
    ctx.moveTo(-r + 0.5, 9)
    ctx.bezierCurveTo(-r - 4, -10, -8, -r - 6, 2, -r - 3)
    ctx.lineTo(5, -r - 8)
    ctx.lineTo(8, -r - 2)
    ctx.lineTo(13, -r - 5)
    ctx.lineTo(13, -r + 2)
    ctx.quadraticCurveTo(r + 2, -9, r - 1, -5)
    ctx.quadraticCurveTo(8, -9, 3, -7)
    ctx.lineTo(1, -1)
    ctx.lineTo(-1, 5)
    ctx.quadraticCurveTo(-6, 4, -8, 11)
  } else if (look.hairStyle === 1) {
    ctx.moveTo(-r + 1, 7)
    ctx.bezierCurveTo(-r - 1, -12, -6, -r - 2.5, 4, -r - 0.5)
    ctx.quadraticCurveTo(11, -r + 1, 12, -9)
    ctx.quadraticCurveTo(6, -8, 2, -6)
    ctx.lineTo(0, 2)
    ctx.quadraticCurveTo(-6, 4, -r + 1, 7)
  } else {
    ctx.ellipse(-3, -8, r + 2, r - 4, 0, Math.PI * 0.85, Math.PI * 2.05)
    ctx.lineTo(2, -4)
    ctx.lineTo(-1, 3)
  }
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(-3, -4, r - 2, Math.PI * 1.25, Math.PI * 1.45)
  ctx.stroke()

  // ear — profile: on the side of the head
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2
  ctx.fillStyle = look.skin
  ctx.beginPath()
  ctx.ellipse(-3, 2, 3.6, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(-3, 2, 1.8, -0.5 * Math.PI, 0.5 * Math.PI)
  ctx.stroke()

  // blush
  ctx.fillStyle = 'rgba(255,110,110,0.22)'
  ctx.beginPath()
  ctx.ellipse(8, 6, 3.5, 2.2, 0, 0, Math.PI * 2)
  ctx.fill()
  // eye
  const ex = 9
  const blink = (t + x * 0.37) % 4.2 < 0.12
  if (mode === 'fall') {
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(ex - 2, -3)
    ctx.lineTo(ex + 2, 1)
    ctx.moveTo(ex + 2, -3)
    ctx.lineTo(ex - 2, 1)
    ctx.stroke()
  } else if (blink) {
    ctx.fillStyle = OUTLINE
    ctx.fillRect(ex - 2, -1.5, 4, 1.5)
  } else {
    ctx.fillStyle = OUTLINE
    ctx.beginPath()
    ctx.ellipse(ex, -1, 1.9, 2.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(ex + 0.7, -2, 0.75, 0, Math.PI * 2)
    ctx.fill()
  }
  // brow
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (mode === 'sad') {
    ctx.moveTo(6, -6.5)
    ctx.lineTo(12, -8)
  } else if (mode === 'defend' || mode === 'dunk' || mode === 'block') {
    ctx.moveTo(6, -8.5)
    ctx.lineTo(12, -6.5)
  } else {
    ctx.moveTo(6, -7.5)
    ctx.lineTo(12, -8)
  }
  ctx.stroke()
  // mouth
  ctx.lineWidth = 1.6
  ctx.beginPath()
  if (mode === 'sad') {
    ctx.moveTo(r - 6, 11)
    ctx.quadraticCurveTo(r - 4, 8.5, r - 1.5, 10)
    ctx.stroke()
  } else if (mode === 'celebrate' || mode === 'dunk' || mode === 'hang' || mode === 'fall') {
    ctx.fillStyle = '#7a2a1f'
    ctx.ellipse(r - 3, 9.5, 2.8, 2.4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.moveTo(r - 6, 8)
    ctx.quadraticCurveTo(r - 3.5, 11, r - 1, 9)
    ctx.stroke()
  }
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* front-facing player (lobby, locker, avatar)                        */
/* ------------------------------------------------------------------ */

export type FrontMode = 'idle' | 'hold' | 'dribble' | 'spin'

/** Front view, feet at (0,0), ~170 units tall. Draws the ball itself. */
export function drawPersonFront(ctx: CanvasRenderingContext2D, look: Look, pose: { mode: FrontMode; t: number; dribble?: number }) {
  const { mode, t } = pose
  const breathe = Math.sin(t * 2.4) * 1.2
  const skinB = shade(look.skin, -0.12)
  const hipY = -66
  const sy = hipY - 54 + breathe
  ctx.save()

  // legs, socks, high-top shoes
  for (const side of [-1, 1]) {
    const L: V[] = [
      [9 * side, hipY],
      [10 * side, -34],
      [10.5 * side, -8],
    ]
    limb(ctx, L, 12, side < 0 ? skinB : look.skin, side > 0)
    ctx.lineCap = 'butt'
    ctx.lineWidth = 12.5
    ctx.strokeStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(10.5 * side, -24)
    ctx.lineTo(10.5 * side, -12)
    ctx.stroke()
    ctx.strokeStyle = look.trim === '#ffffff' ? look.jersey : look.trim
    ctx.beginPath()
    ctx.moveTo(10.5 * side, -21)
    ctx.lineTo(10.5 * side, -19)
    ctx.stroke()
    const sx = 10.5 * side + 2 * side
    const accent = look.trim === look.shoes ? '#ffffff' : look.trim
    const g = ctx.createLinearGradient(0, -16, 0, 2)
    g.addColorStop(0, shade(look.shoes, 0.18))
    g.addColorStop(1, look.shoes)
    ctx.fillStyle = g
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(sx - 7, -15)
    ctx.quadraticCurveTo(sx, -17, sx + 7, -15)
    ctx.lineTo(sx + 10, -4)
    ctx.quadraticCurveTo(sx + 11, 2, sx, 2)
    ctx.quadraticCurveTo(sx - 11, 2, sx - 10, -4)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.beginPath()
    ctx.ellipse(sx, -2, 6, 2.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.6
    ctx.beginPath()
    for (const ly of [-12, -9, -6]) {
      ctx.moveTo(sx - 3.5, ly)
      ctx.lineTo(sx + 3.5, ly)
    }
    ctx.moveTo(sx - 9.5 * side, -11)
    ctx.quadraticCurveTo(sx - 7 * side, -3, sx + 1 * side, -3.5)
    ctx.stroke()
    ctx.fillStyle = '#f7f7f7'
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 1.6
    rr(ctx, sx - 11, 0, 22, 4.5, 2.2)
    ctx.fill()
    ctx.stroke()
  }

  // shorts: long, baggy, waistband + hem trim
  const shortsPath = () => {
    ctx.beginPath()
    ctx.moveTo(-21, hipY - 8)
    ctx.lineTo(21, hipY - 8)
    ctx.quadraticCurveTo(24, hipY + 10, 25, hipY + 28)
    ctx.lineTo(3, hipY + 28)
    ctx.lineTo(0, hipY + 14)
    ctx.lineTo(-3, hipY + 28)
    ctx.lineTo(-25, hipY + 28)
    ctx.quadraticCurveTo(-24, hipY + 10, -21, hipY - 8)
    ctx.closePath()
  }
  shortsPath()
  ctx.save()
  ctx.clip()
  const sg = ctx.createLinearGradient(0, hipY - 8, 0, hipY + 28)
  sg.addColorStop(0, shade(look.shorts, 0.1))
  sg.addColorStop(1, shade(look.shorts, -0.1))
  ctx.fillStyle = sg
  ctx.fillRect(-30, hipY - 10, 60, 42)
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.fillRect(-30, hipY - 10, 13, 42)
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(12, hipY - 10, 4, 42)
  ctx.fillStyle = shade(look.shorts, -0.2)
  ctx.fillRect(-30, hipY - 8, 60, 4)
  ctx.fillStyle = look.trim
  ctx.fillRect(-30, hipY + 24, 60, 3)
  ctx.strokeStyle = look.trim
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-21, hipY - 6)
  ctx.quadraticCurveTo(-23.5, hipY + 10, -24, hipY + 26)
  ctx.moveTo(21, hipY - 6)
  ctx.quadraticCurveTo(23.5, hipY + 10, 24, hipY + 26)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.13)'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(-12, hipY + 6)
  ctx.quadraticCurveTo(-9, hipY + 16, -12, hipY + 23)
  ctx.moveTo(12, hipY + 6)
  ctx.quadraticCurveTo(9, hipY + 16, 12, hipY + 23)
  ctx.stroke()
  ctx.restore()
  shortsPath()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.5
  ctx.stroke()

  // arms are posed first: they're drawn BEHIND the jersey so they come out of the armholes
  const relaxed = (side: number): V[] => [
    [16 * side, sy + 8],
    [24 * side, sy + 30],
    [24 * side, sy + 52],
  ]
  let left: V[] = relaxed(-1)
  let right: V[] = relaxed(1)
  const push = Math.max(0, Math.cos((pose.dribble ?? 0) * Math.PI * 2))
  if (mode === 'hold') {
    left = [[-16, sy + 8], [-26, sy + 29], [-12, sy + 41]]
    right = [[16, sy + 8], [26, sy + 29], [12, sy + 41]]
  } else if (mode === 'dribble') {
    right = [[16, sy + 8], [28, sy + 27], [31, sy + 45 + push * 5]]
  } else if (mode === 'spin') {
    right = [[16, sy + 8], [30, sy - 12], [26, sy - 38]]
  }
  const wristband = (pts: V[]) => {
    const at = (k: number): V => [pts[1][0] + (pts[2][0] - pts[1][0]) * k, pts[1][1] + (pts[2][1] - pts[1][1]) * k]
    const a = at(0.72)
    const b = at(0.86)
    ctx.strokeStyle = look.trim
    ctx.lineWidth = 10.5
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(a[0], a[1])
    ctx.lineTo(b[0], b[1])
    ctx.stroke()
  }
  const arm = (pts: V[], col: string, hl: boolean) => {
    limb(ctx, pts, 10, col, hl)
    wristband(pts)
    hand(ctx, pts[2], col)
  }
  /** re-draw the forearm in front of the jersey (holding the ball) */
  const forearm = (pts: V[], col: string) => {
    ctx.lineCap = 'round'
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 8.6 + 4
    ctx.beginPath()
    ctx.moveTo(pts[1][0], pts[1][1])
    ctx.lineTo(pts[2][0], pts[2][1])
    ctx.stroke()
    ctx.strokeStyle = col
    ctx.lineWidth = 8.6
    ctx.stroke()
    wristband(pts)
    hand(ctx, pts[2], col)
  }
  arm(left, skinB, false)
  arm(right, look.skin, true)

  // neck reaches down into the V-neck, the jersey covers the rest
  ctx.fillStyle = shade(look.skin, -0.06)
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.5
  rr(ctx, -6, sy - 10, 12, 14, 3)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-10, sy)
  ctx.quadraticCurveTo(0, sy + 13, 10, sy)
  ctx.closePath()
  ctx.fillStyle = look.skin
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.1)'
  ctx.fill()

  // jersey
  const torsoPath = () => {
    ctx.beginPath()
    ctx.moveTo(-20, sy + 2)
    ctx.lineTo(-10, sy)
    ctx.quadraticCurveTo(0, sy + 13, 10, sy)
    ctx.lineTo(20, sy + 2)
    ctx.quadraticCurveTo(15, sy + 16, 19, sy + 25)
    ctx.lineTo(20, hipY - 3)
    ctx.lineTo(-20, hipY - 3)
    ctx.lineTo(-19, sy + 25)
    ctx.quadraticCurveTo(-15, sy + 16, -20, sy + 2)
    ctx.closePath()
  }
  torsoPath()
  ctx.save()
  ctx.clip()
  jerseyFill(ctx, look, -24, sy - 4, 48, hipY - sy + 4)
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  ctx.fillRect(-24, sy - 4, 9, 70)
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fillRect(11, sy - 4, 4, 70)
  // soft shadow the arms cast into the armholes
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath()
  ctx.ellipse(-17, sy + 14, 4, 10, 0, 0, Math.PI * 2)
  ctx.ellipse(17, sy + 14, 4, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  torsoPath()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.strokeStyle = look.trim
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(-9, sy + 1.5)
  ctx.quadraticCurveTo(0, sy + 12, 9, sy + 1.5)
  ctx.moveTo(-19, sy + 3)
  ctx.quadraticCurveTo(-14.5, sy + 16, -18.5, sy + 24)
  ctx.moveTo(19, sy + 3)
  ctx.quadraticCurveTo(14.5, sy + 16, 18.5, sy + 24)
  ctx.stroke()
  ctx.fillStyle = look.trim
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `800 10px ${DISPLAY}`
  ctx.fillText(look.label, 0, sy + 23)
  ctx.font = `800 24px ${DISPLAY}`
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.strokeText(String(look.number), 0, sy + 45)
  ctx.fillText(String(look.number), 0, sy + 45)

  drawHeadFront(ctx, look, 0, sy - 24, t, mode === 'spin' ? 'happy' : 'idle')

  // ball + forearms in front of the body
  if (mode === 'hold') {
    drawBall(ctx, 0, sy + 40, 14, 0.4)
    forearm(left, skinB)
    forearm(right, look.skin)
  }
  if (mode === 'dribble') {
    const handY = sy + 45 + push * 5
    const bh = 12 + (-handY - 12 - 8) * Math.abs(Math.cos((pose.dribble ?? 0) * Math.PI))
    drawBall(ctx, 31, -bh, 12.5, t * 3, false, bh < 18 ? 0.5 : 0)
    forearm(right, look.skin)
  }
  if (mode === 'spin') drawBall(ctx, 26, sy - 50, 13, t * 25)
  ctx.restore()
}

/** Front-facing head centered at (x, y). */
export function drawHeadFront(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, t = 0, mood: 'idle' | 'happy' = 'idle') {
  ctx.save()
  ctx.translate(x, y)
  const r = 18
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.5
  ctx.lineJoin = 'round'
  if (look.hairStyle === 2) {
    ctx.fillStyle = look.hair
    ctx.beginPath()
    ctx.arc(0, -5, r + 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.fillStyle = look.skin
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(s * (r - 0.5), 2, 3.8, 5.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  const face = () => {
    ctx.beginPath()
    ctx.moveTo(-r + 1, -2)
    ctx.bezierCurveTo(-r + 1, -r - 3, r - 1, -r - 3, r - 1, -2)
    ctx.bezierCurveTo(r - 1, 12, 8, r + 2, 0, r + 2)
    ctx.bezierCurveTo(-8, r + 2, -r + 1, 12, -r + 1, -2)
    ctx.closePath()
  }
  face()
  ctx.fillStyle = look.skin
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  ctx.fillRect(-r, -r, 7, 2 * r + 4)
  ctx.restore()
  face()
  ctx.stroke()

  // hair
  ctx.fillStyle = look.hair
  ctx.beginPath()
  if (look.hairStyle === 0) {
    ctx.moveTo(-r + 0.5, 3)
    ctx.quadraticCurveTo(-r - 3, -r - 1, -5, -r - 3)
    ctx.lineTo(-2, -r - 9)
    ctx.lineTo(2, -r - 3)
    ctx.lineTo(7, -r - 8)
    ctx.lineTo(9, -r - 1)
    ctx.quadraticCurveTo(r + 3, -r + 2, r - 0.5, 3)
    ctx.quadraticCurveTo(r - 3, -8, 9, -9.5)
    ctx.quadraticCurveTo(3, -5, -3, -9)
    ctx.quadraticCurveTo(-10, -11, -r + 3, -3)
  } else if (look.hairStyle === 1) {
    ctx.moveTo(-r + 1, -2)
    ctx.bezierCurveTo(-r + 1, -r - 3.5, r - 1, -r - 3.5, r - 1, -2)
    ctx.quadraticCurveTo(r - 4, -10, 0, -11)
    ctx.quadraticCurveTo(-r + 4, -10, -r + 1, -2)
  } else {
    ctx.ellipse(0, -9, r + 3, r - 4, 0, Math.PI * 0.9, Math.PI * 2.1)
    ctx.quadraticCurveTo(8, -9, 0, -8)
    ctx.quadraticCurveTo(-8, -9, -r - 2, -6)
  }
  ctx.closePath()
  ctx.fill()
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(0, -2, r - 3, Math.PI * 1.2, Math.PI * 1.4)
  ctx.stroke()

  // face
  const blink = t % 4.2 < 0.12
  for (const s of [-1, 1]) {
    const ex = s * 6.5
    if (blink) {
      ctx.fillStyle = OUTLINE
      ctx.fillRect(ex - 2.2, -0.5, 4.4, 1.6)
    } else {
      ctx.fillStyle = OUTLINE
      ctx.beginPath()
      ctx.ellipse(ex, 0, 2.1, 2.9, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(ex + 0.7, -1, 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-9.5, -6.5)
  ctx.lineTo(-4, -7.5)
  ctx.moveTo(4, -7.5)
  ctx.lineTo(9.5, -6.5)
  ctx.moveTo(0, 2)
  ctx.quadraticCurveTo(2, 5.5, -0.5, 6)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,110,110,0.22)'
  ctx.beginPath()
  ctx.ellipse(-10.5, 6, 3.4, 2.2, 0, 0, Math.PI * 2)
  ctx.ellipse(10.5, 6, 3.4, 2.2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  if (mood === 'happy') {
    ctx.fillStyle = '#7a2a1f'
    ctx.arc(0, 9, 4.5, 0, Math.PI)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.arc(0, 8.5, 5, 0.15 * Math.PI, 0.85 * Math.PI)
    ctx.stroke()
  }
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* hoop                                                               */
/* ------------------------------------------------------------------ */

const RIM_RX = 24
const RIM_RY = 7

function rimDy(shake: number, bend: number) {
  return Math.sin(shake * 30) * shake * 2.5 + bend
}

/** Mounting bracket + far half of the rim (drawn behind the ball). */
function drawRimBack(ctx: CanvasRenderingContext2D, shake: number, bend: number) {
  const dy = rimDy(shake, bend)
  const y = RIM_Y + dy
  // bracket plate from the rim to the glass
  ctx.fillStyle = '#8c949c'
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(HOOP_X + RIM_RX - 3, y - 2)
  ctx.lineTo(BB.l, RIM_Y - 6)
  ctx.lineTo(BB.l, RIM_Y + 10)
  ctx.lineTo(HOOP_X + RIM_RX - 3, y + 4)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(HOOP_X + RIM_RX, y - 0.5)
  ctx.lineTo(BB.l - 1, RIM_Y - 4)
  ctx.stroke()
  // far half of the rim
  ctx.strokeStyle = '#6b2408'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.ellipse(HOOP_X, y, RIM_RX, RIM_RY, 0, Math.PI, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#c2410c'
  ctx.lineWidth = 3.5
  ctx.stroke()
}

/** Net (diamond mesh, back strands dimmer) + near half of the rim. */
function drawRimFront(ctx: CanvasRenderingContext2D, swish: number, shake: number, bend: number, t: number) {
  const dy = rimDy(shake, bend)
  const top = RIM_Y + dy
  const rows = 5
  const n = 14
  const sway = Math.sin(t * 22) * (swish * 5 + shake * 2)
  const ring = (k: number, i: number): V => {
    const kk = k / rows
    const r = lerp(RIM_RX - 1, 12, kk) + swish * 6 * Math.sin(kk * Math.PI)
    const a = ((i + (k % 2) * 0.5) / n) * Math.PI * 2
    const ry = lerp(RIM_RY, 3.5, kk)
    return [HOOP_X + Math.cos(a) * r + sway * kk, top + kk * (40 + swish * 12) + Math.sin(a) * ry]
  }
  const isFront = (k: number, i: number) => Math.sin(((i + (k % 2) * 0.5) / n) * Math.PI * 2) > 0
  ctx.lineCap = 'round'
  for (const front of [false, true]) {
    ctx.strokeStyle = front ? 'rgba(250,250,250,0.95)' : 'rgba(215,215,215,0.55)'
    ctx.lineWidth = front ? 1.6 : 1.2
    ctx.beginPath()
    for (let k = 0; k < rows; k++) {
      for (let i = 0; i < n; i++) {
        if (isFront(k, i) !== front) continue
        const p = ring(k, i)
        const next = k % 2 ? 1 : 0
        const a = ring(k + 1, i - 1 + next)
        const b = ring(k + 1, i + next)
        ctx.moveTo(p[0], p[1])
        ctx.lineTo(a[0], a[1])
        ctx.moveTo(p[0], p[1])
        ctx.lineTo(b[0], b[1])
      }
    }
    ctx.stroke()
  }
  // near half of the rim: dark tube outline, orange tube, highlight
  ctx.beginPath()
  ctx.ellipse(HOOP_X, top, RIM_RX, RIM_RY, 0, 0, Math.PI)
  ctx.strokeStyle = '#6b2408'
  ctx.lineWidth = 7
  ctx.stroke()
  ctx.strokeStyle = '#f05a1a'
  ctx.lineWidth = 4.5
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,200,150,0.75)'
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.ellipse(HOOP_X, top - 1.2, RIM_RX - 1, RIM_RY - 1, 0, 0.15 * Math.PI, 0.65 * Math.PI)
  ctx.stroke()
  // net hooks
  ctx.fillStyle = '#c2410c'
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    if (Math.sin(a) <= 0.1) continue
    ctx.fillRect(HOOP_X + Math.cos(a) * RIM_RX - 1, top + Math.sin(a) * RIM_RY + 2, 2, 2.5)
  }
}

/* ------------------------------------------------------------------ */
/* particles                                                          */
/* ------------------------------------------------------------------ */

type PKind = 'puff' | 'spark' | 'star' | 'orbit' | 'ring' | 'text' | 'flame' | 'flash' | 'confetti' | 'streak'

interface Particle {
  kind: PKind
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  rot: number
  vr: number
  g: number
  delay: number
  text?: string
  screen?: boolean
}

const CONFETTI = ['#f28c28', '#2f6fd0', '#ffd23f', '#3fd16b', '#ff6b5b', '#ffffff', '#b46bff']
const rand = (a: number, b: number) => a + Math.random() * (b - a)

const glowCache: Record<string, HTMLCanvasElement> = {}
/** Radial-gradient sprites, built once (creating gradients per particle per frame is slow). */
function glowSprite(kind: 'flameYoung' | 'flameOld' | 'flash') {
  if (glowCache[kind]) return glowCache[kind]
  const s = 64
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  if (kind === 'flash') {
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
  } else if (kind === 'flameYoung') {
    g.addColorStop(0, 'rgba(255,225,120,1)')
    g.addColorStop(0.5, 'rgba(255,115,20,0.7)')
    g.addColorStop(1, 'rgba(200,40,0,0)')
  } else {
    g.addColorStop(0, 'rgba(255,150,80,1)')
    g.addColorStop(0.5, 'rgba(230,70,15,0.6)')
    g.addColorStop(1, 'rgba(160,30,0,0)')
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  glowCache[kind] = c
  return c
}

class Particles {
  list: Particle[] = []

  add(p: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y'>) {
    if (this.list.length > 700) return
    this.list.push({ vx: 0, vy: 0, life: 0, max: 0.6, size: 4, color: '#fff', rot: 0, vr: 0, g: 0, delay: 0, ...p })
  }

  spawn(f: Fx, T: (k: TKey) => string) {
    const y = floorY(f.z) - f.h
    switch (f.type) {
      case 'dust':
      case 'land': {
        const n = f.type === 'land' ? (f.big ? 12 : 8) : 5
        for (let i = 0; i < n; i++)
          this.add({ kind: 'puff', x: f.x + rand(-10, 10), y: y - 2, vx: rand(-70, 70), vy: rand(-40, -10), max: rand(0.35, 0.6), size: rand(4, f.big ? 11 : 7), color: '210,170,120' })
        if (f.big) this.add({ kind: 'ring', x: f.x, y, max: 0.4, size: 30, color: '255,240,220' })
        break
      }
      case 'swish':
        for (let i = 0; i < 16; i++) {
          const a = rand(0, Math.PI * 2)
          const s = rand(80, 220)
          this.add({ kind: 'spark', x: f.x, y: y + 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, g: 380, max: rand(0.5, 0.9), size: rand(2, 4), color: Math.random() < 0.5 ? '#ffe27a' : '#ffffff' })
        }
        this.add({ kind: 'ring', x: f.x, y: y + 4, max: 0.45, size: 40, color: '255,230,140' })
        break
      case 'dunk':
        for (let i = 0; i < 30; i++) {
          const a = rand(0, Math.PI * 2)
          const s = rand(120, 340)
          this.add({ kind: Math.random() < 0.3 ? 'star' : 'spark', x: f.x, y: y + 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, g: 420, max: rand(0.6, 1.1), size: rand(3, 6), color: Math.random() < 0.5 ? '#ffb02e' : '#fff3c4', vr: rand(-8, 8) })
        }
        this.add({ kind: 'ring', x: f.x, y: y + 4, max: 0.5, size: 70, color: '255,190,80' })
        this.add({ kind: 'ring', x: f.x, y: y + 4, max: 0.7, size: 110, color: '255,255,255', delay: 0.08 })
        break
      case 'block':
        for (let i = 0; i < 12; i++) {
          const a = rand(-Math.PI, 0)
          const s = rand(150, 320)
          this.add({ kind: 'streak', x: f.x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, max: rand(0.25, 0.45), size: rand(8, 16) })
        }
        this.add({ kind: 'ring', x: f.x, y, max: 0.35, size: 50, color: '120,190,255' })
        break
      case 'steal':
        for (let i = 0; i < 12; i++) {
          const a = rand(0, Math.PI * 2)
          const s = rand(60, 180)
          this.add({ kind: 'spark', x: f.x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 150, max: rand(0.35, 0.6), size: rand(2, 4), color: Math.random() < 0.5 ? '#7cc4ff' : '#ffffff' })
        }
        break
      case 'ankle':
        for (let i = 0; i < 14; i++)
          this.add({ kind: 'puff', x: f.x + rand(-20, 20), y: y - 2, vx: rand(-90, 90), vy: rand(-50, -10), max: rand(0.4, 0.8), size: rand(6, 12), color: '210,170,120' })
        for (let i = 0; i < 3; i++)
          this.add({ kind: 'orbit', x: f.x - 30, y: y - 70, max: 0.95, size: 6, color: '#ffe27a', rot: (i * Math.PI * 2) / 3, vr: 7 })
        break
      case 'text':
        this.add({ kind: 'text', x: f.x, y, vy: -45, max: f.big ? 1.6 : 1.1, size: f.big ? 34 : 26, color: f.color ?? '#fff', text: f.key ? T(f.key) : f.text })
        break
      case 'fireStart':
        for (let i = 0; i < 26; i++)
          this.add({ kind: 'flame', x: f.x + rand(-18, 18), y: y + rand(-60, 60), vx: rand(-60, 60), vy: rand(-160, -60), max: rand(0.35, 0.7), size: rand(6, 13) })
        break
      case 'flash':
        for (let i = 0; i < 9; i++) {
          const left = Math.random() < 0.5
          this.add({ kind: 'flash', x: left ? rand(10, 360) : rand(600, 950), y: rand(150, 290), max: 0.18, size: rand(10, 18), delay: rand(0, 0.9) })
        }
        break
      case 'confetti':
        for (let i = 0; i < 160; i++)
          this.add({ kind: 'confetti', x: rand(0, W), y: rand(-200, -10), vx: rand(-40, 40), vy: rand(60, 160), max: rand(3, 4.5), size: rand(4, 8), color: CONFETTI[i % CONFETTI.length], rot: rand(0, 6), vr: rand(-10, 10), screen: true, delay: rand(0, 0.6) })
        break
    }
  }

  update(dt: number) {
    for (const p of this.list) {
      if (p.delay > 0) {
        p.delay -= dt
        continue
      }
      p.life += dt
      p.rot += p.vr * dt
      if (p.kind === 'orbit') continue
      p.vy += p.g * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.kind === 'puff') {
        p.vx *= 1 - Math.min(1, dt * 3)
        p.vy *= 1 - Math.min(1, dt * 3)
      }
      if (p.kind === 'confetti') p.vx += Math.sin(p.life * 4 + p.rot) * 30 * dt
    }
    this.list = this.list.filter((p) => p.life < p.max)
  }

  draw(ctx: CanvasRenderingContext2D, screen: boolean) {
    for (const p of this.list) {
      if (p.delay > 0 || !!p.screen !== screen) continue
      const k = p.life / p.max
      const a = 1 - k
      switch (p.kind) {
        case 'puff':
          ctx.fillStyle = `rgba(${p.color},${0.45 * a})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (1 + k * 1.5), 0, Math.PI * 2)
          ctx.fill()
          break
        case 'ring':
          ctx.strokeStyle = `rgba(${p.color},${0.8 * a})`
          ctx.lineWidth = 3 * a + 1
          ctx.beginPath()
          ctx.ellipse(p.x, p.y, p.size * (0.3 + k), p.size * (0.3 + k) * 0.35, 0, 0, Math.PI * 2)
          ctx.stroke()
          break
        case 'spark':
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = a
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
          break
        case 'star':
        case 'orbit': {
          const orbit = p.kind === 'orbit'
          const sx = orbit ? p.x + Math.cos(p.rot) * 24 : p.x
          const sy = orbit ? p.y + Math.sin(p.rot) * 8 : p.y
          ctx.save()
          ctx.translate(sx, sy)
          if (!orbit) ctx.rotate(p.rot)
          ctx.globalAlpha = orbit ? Math.min(1, a * 3) : a
          ctx.fillStyle = p.color
          ctx.strokeStyle = 'rgba(120,70,0,0.6)'
          ctx.lineWidth = 1
          ctx.beginPath()
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? p.size * 0.45 : p.size
            const an = (i * Math.PI) / 5 - Math.PI / 2
            ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r)
          }
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
          ctx.restore()
          break
        }
        case 'streak': {
          const len = p.size * a
          const n = Math.hypot(p.vx, p.vy) || 1
          ctx.strokeStyle = `rgba(255,255,255,${a})`
          ctx.lineWidth = 3
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x - (p.vx / n) * len, p.y - (p.vy / n) * len)
          ctx.stroke()
          break
        }
        case 'flame': {
          const r = Math.max(0.5, p.size * (1 - k * 0.6))
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = a
          ctx.drawImage(glowSprite(k < 0.45 ? 'flameYoung' : 'flameOld'), p.x - r, p.y - r, r * 2, r * 2)
          ctx.restore()
          break
        }
        case 'flash': {
          const r = p.size * 2
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = a
          ctx.drawImage(glowSprite('flash'), p.x - r, p.y - r, r * 2, r * 2)
          ctx.restore()
          break
        }
        case 'confetti':
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rot)
          ctx.globalAlpha = Math.min(1, a * 3)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, (p.size / 2) * Math.abs(Math.cos(p.life * 6 + p.rot)) + 1)
          ctx.restore()
          break
        case 'text': {
          const s = 0.6 + 0.4 * easeOutBack(Math.min(1, p.life / 0.15))
          ctx.save()
          ctx.globalAlpha = Math.min(1, a * 2.5)
          ctx.translate(p.x, p.y)
          ctx.scale(s, s)
          ctx.font = `800 ${p.size}px ${DISPLAY}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineWidth = 6
          ctx.lineJoin = 'round'
          ctx.strokeStyle = 'rgba(30,22,18,0.85)'
          ctx.strokeText(p.text ?? '', 0, 0)
          ctx.fillStyle = p.color
          ctx.fillText(p.text ?? '', 0, 0)
          ctx.restore()
          break
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* match renderer                                                     */
/* ------------------------------------------------------------------ */

const QUALITY_KEY: Record<ShotQuality, TKey | null> = { perfect: 'perfect', good: 'good', early: 'early', late: 'late', auto: null }
const QUALITY_COLOR: Record<ShotQuality, string> = { perfect: '#7dff9a', good: '#ffd23f', early: '#ff8a7a', late: '#ff8a7a', auto: '#fff' }

function poseOf(m: Match, a: Athlete): Pose {
  const hasBall = m.hasBall(a)
  let mode: PoseMode
  let u = 0
  if (a.state === 'hang') mode = 'hang'
  else if (a.state === 'fall') {
    mode = 'fall'
    u = 1 - a.fallT / 0.95
  } else if ((a.state === 'shoot' || a.state === 'dunk') && a.shotKind) {
    mode = a.state === 'dunk' ? 'dunk' : 'shoot'
    u = a.released ? Math.max(1, a.stateT / RELEASE_T[a.shotKind]) : Math.min(0.999, a.stateT / RELEASE_T[a.shotKind])
  } else if (a.state === 'block') mode = 'block'
  else if (a.state === 'reach') mode = 'reach'
  else if (a.state === 'celebrate') mode = 'celebrate'
  else if (a.state === 'sad') mode = 'sad'
  else if (a.moveT > 0) {
    mode = 'cross'
    u = 1 - a.moveT / 0.34
  } else if (m.phase === 'live' && m.ball.state === 'held' && m.away && !hasBall) mode = 'defend'
  else if (a.state === 'run') mode = 'run'
  else if (hasBall) mode = 'dribble'
  else mode = 'idle'
  return {
    facing: a.facing,
    mode,
    anim: a.anim,
    t: m.realTime,
    u,
    air: a.h > 2,
    moving: a.state === 'run',
    dribbleArm: hasBall,
    dribble: hasBall ? m.ball.dribble % 1 : undefined,
    aura: a.power >= 1 && m.phase !== 'over',
  }
}

function drawAthlete(ctx: CanvasRenderingContext2D, m: Match, a: Athlete) {
  const s = persp(a.z)
  ctx.save()
  ctx.translate(a.x, floorY(a.z) - a.h)
  let sq = 0
  if (a.landT < 0.14 && a.h === 0) sq = 0.09 * (1 - a.landT / 0.14)
  else if ((a.state === 'shoot' || a.state === 'dunk' || a.state === 'block') && a.stateT < 0.07) sq = 0.07
  else if (a.vh > 250) sq = -0.05
  ctx.scale(s * (1 + sq * 0.6), s * (1 - sq))
  if (a.stunT > 0 && Math.floor(m.realTime * 16) % 2 === 0) ctx.globalAlpha = 0.75
  drawPerson(ctx, a.look, poseOf(m, a))
  ctx.restore()
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, bg: string, fg = '#fff', size = 15) {
  ctx.font = `700 ${size}px ${DISPLAY}`
  const w = ctx.measureText(text).width + 14
  ctx.fillStyle = bg
  rr(ctx, x - w / 2, y - size * 0.8, w, size * 1.35, size * 0.6)
  ctx.fill()
  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y - size * 0.12)
  ctx.textBaseline = 'alphabetic'
}

function flameIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  const f = 1 + Math.sin(t * 14) * 0.08
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s * f)
  ctx.fillStyle = '#ff6a1a'
  ctx.beginPath()
  ctx.moveTo(0, -12)
  ctx.bezierCurveTo(7, -4, 9, 2, 6, 8)
  ctx.bezierCurveTo(3, 12, -3, 12, -6, 8)
  ctx.bezierCurveTo(-9, 2, -4, -2, 0, -12)
  ctx.fill()
  ctx.fillStyle = '#ffd23f'
  ctx.beginPath()
  ctx.moveTo(0, -3)
  ctx.bezierCurveTo(4, 2, 4, 6, 2, 9)
  ctx.bezierCurveTo(0, 10, -2, 10, -3, 8)
  ctx.bezierCurveTo(-4, 4, -2, 1, 0, -3)
  ctx.fill()
  ctx.restore()
}

function fmtClock(sec: number) {
  if (sec < 10) return sec.toFixed(1)
  const s = Math.ceil(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

let vignetteCache: HTMLCanvasElement | null = null
function getVignette() {
  if (vignetteCache) return vignetteCache
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.68)
  g.addColorStop(0, 'rgba(20,10,5,0)')
  g.addColorStop(1, 'rgba(20,10,5,0.38)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  vignetteCache = c
  return c
}

export class MatchRenderer {
  private particles = new Particles()
  private cam = { x: W / 2, y: H / 2, zoom: 1 }
  private flameAcc = 0
  /** set by the screen when frames get slow: no reflections, fewer flames */
  lowQuality = false

  draw(ctx: CanvasRenderingContext2D, m: Match, T: (k: TKey) => string, dt: number) {
    for (const f of m.fx) this.particles.spawn(f, T)
    m.fx.length = 0
    this.spawnFlames(m, dt)
    this.particles.update(dt)
    this.updateCamera(m, dt)

    const b = m.ball
    const bend = m.athletes.some((a) => a.state === 'hang') ? 5 : 0

    ctx.save()
    const shake = m.shake * m.shake * 9
    ctx.translate(W / 2 + (Math.random() - 0.5) * shake, H / 2 + (Math.random() - 0.5) * shake)
    ctx.scale(this.cam.zoom, this.cam.zoom)
    ctx.translate(-this.cam.x, -this.cam.y)

    drawGym(ctx, m.realTime, m.phase === 'over' ? 0.9 : Math.max(m.hype, m.golden ? 0.4 : 0))

    // glossy floor: mirrored reflections (skipped on slow devices)
    if (!this.lowQuality) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, FLOOR_TOP, W, H - FLOOR_TOP)
      ctx.clip()
      ctx.globalAlpha = 0.14
      for (const a of m.athletes) {
        const s = persp(a.z)
        ctx.save()
        ctx.translate(a.x, floorY(a.z) + a.h)
        ctx.scale(s, -s * 0.85)
        drawPerson(ctx, a.look, poseOf(m, a))
        ctx.restore()
      }
      drawBall(ctx, b.x, floorY(b.z) + b.h, BALL_R * persp(b.z), b.spin)
      ctx.restore()
    }

    for (const a of m.athletes) {
      const s = persp(a.z)
      const k = 1 - Math.min(0.55, a.h / 250)
      drawShadow(ctx, a.x, floorY(a.z), 34 * s * k, 8 * s * k)
    }
    {
      const s = persp(b.z)
      const k = 1 - Math.min(0.7, b.h / 300)
      drawShadow(ctx, b.x, floorY(b.z), 13 * s * k, 4 * s * k, 0.22)
    }

    drawBackboard(ctx, m.rimShake)
    drawRimBack(ctx, m.rimShake, bend)

    if (b.trail.length > 1) {
      const power = b.flight?.kind === 'power'
      for (let i = 0; i < b.trail.length; i++) {
        const p = b.trail[i]
        const k = i / b.trail.length
        ctx.fillStyle = power ? `rgba(255,${150 + k * 80},40,${k * 0.5})` : `rgba(255,170,90,${k * 0.22})`
        ctx.beginPath()
        ctx.arc(p.x, floorY(b.z) - p.y, BALL_R * persp(b.z) * (0.4 + k * 0.7), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    type Item = { z: number; draw: () => void }
    const items: Item[] = m.athletes.filter((a) => a.state !== 'hang').map((a) => ({ z: a.z, draw: () => drawAthlete(ctx, m, a) }))
    items.push({
      z: b.z,
      draw: () => {
        const shooter = b.lastShooter ? m.athlete(b.lastShooter) : null
        const glow = b.flight?.kind === 'power' || (!!shooter?.onFire && (b.state === 'flight' || b.state === 'rattle'))
        drawBall(ctx, b.x, floorY(b.z) - b.h, BALL_R * persp(b.z), b.spin, glow, b.squash)
      },
    })
    items.sort((p, q) => p.z - q.z)
    for (const it of items) it.draw()

    drawRimFront(ctx, m.netSwish, m.rimShake, bend, m.realTime)
    // the dunker hangs in front of the rim
    for (const a of m.athletes) if (a.state === 'hang') drawAthlete(ctx, m, a)

    this.particles.draw(ctx, false)
    this.drawLabels(ctx, m, T)
    ctx.restore()

    ctx.drawImage(getVignette(), 0, 0)
    if (m.timeScale < 0.9) {
      ctx.fillStyle = `rgba(20,30,60,${(1 - m.timeScale) * 0.25})`
      ctx.fillRect(0, 0, W, H)
    }
    this.particles.draw(ctx, true)
    drawHud(ctx, m, T)
  }

  private spawnFlames(m: Match, dt: number) {
    this.flameAcc += dt * (this.lowQuality ? 25 : 60)
    const n = Math.floor(this.flameAcc)
    this.flameAcc -= n
    const b = m.ball
    const shooter = b.lastShooter ? m.athlete(b.lastShooter) : null
    const fireBall =
      b.flight?.kind === 'power' ||
      (!!shooter?.onFire && (b.state === 'flight' || b.state === 'rattle')) ||
      (b.state === 'held' && m.athlete(b.holder!).onFire)
    for (let i = 0; i < n; i++) {
      for (const a of m.athletes) {
        if (!a.onFire || m.phase === 'over' || Math.random() > 0.5) continue
        const s = persp(a.z)
        this.particles.add({ kind: 'flame', x: a.x + rand(-16, 16) * s, y: floorY(a.z) - a.h - rand(30, 150) * s, vx: rand(-15, 15), vy: rand(-90, -40), max: rand(0.25, 0.45), size: rand(4, 9) * s })
      }
      if (fireBall && Math.random() < 0.8) {
        this.particles.add({ kind: 'flame', x: b.x + rand(-4, 4), y: floorY(b.z) - b.h + rand(-4, 4), vx: rand(-20, 20), vy: rand(-60, -20), max: rand(0.2, 0.4), size: rand(5, 9) })
      }
    }
  }

  private updateCamera(m: Match, dt: number) {
    const b = m.ball
    const mid = m.athletes.reduce((s, a) => s + a.x, 0) / m.athletes.length
    // gentle follow; biased towards the hoop so it never leaves the frame
    let tx = m.phase === 'intro' ? W / 2 : 0.3 * b.x + 0.2 * mid + 0.5 * 620
    let ty = H / 2 + 8
    let tz = m.phase === 'intro' ? 1.0 : 1.04
    const hanging = m.athletes.some((a) => a.state === 'hang')
    if (m.focus > 0 || hanging) {
      const k = hanging ? 1 : m.focus
      tx = lerp(tx, HOOP_X - 60, k)
      ty = lerp(ty, RIM_Y + 90, k)
      tz = lerp(tz, 1.3, k)
    }
    if (m.timeScale < 0.9 && (b.state === 'flight' || b.state === 'rattle')) {
      tx = lerp(tx, b.x, 0.5)
      tz = 1.18
    }
    if (m.phase === 'over') tz = 1.12
    const k = Math.min(1, dt * 4)
    this.cam.zoom += (tz - this.cam.zoom) * k
    const hw = W / 2 / this.cam.zoom
    const hh = H / 2 / this.cam.zoom
    this.cam.x = clamp(this.cam.x + (tx - this.cam.x) * k, hw, W - hw)
    this.cam.y = clamp(this.cam.y + (ty - this.cam.y) * k, hh, H - hh)
  }

  private drawLabels(ctx: CanvasRenderingContext2D, m: Match, T: (k: TKey) => string) {
    if (m.away && m.phase !== 'intro' && m.away.state !== 'hang') {
      const a = m.away
      const s = persp(a.z)
      const y = floorY(a.z) - a.h - 192 * s
      pill(ctx, a.x, y, `${a.name} · ${a.level}`, 'rgba(160,40,35,0.8)', '#fff', 13)
      if (a.onFire) flameIcon(ctx, a.x + 48, y, 0.8, m.realTime)
    }
    const a = m.home
    const s = persp(a.z)
    const headY = floorY(a.z) - a.h - 192 * s
    const holding = a.state === 'shoot' && !a.released && a.shotHeld
    const shown = !!a.meter && a.meter.t < 0.9
    if (holding || shown) {
      const tt = holding ? a.stateT : a.meter!.at
      const alpha = holding ? 1 : Math.min(1, (0.9 - a.meter!.t) * 3)
      const mx = a.x + 44 * s
      const my = floorY(a.z) - a.h - 150 * s
      const h = 70
      const w = 11
      const yAt = (v: number) => my + h / 2 - (v / MAX_HOLD) * h
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.fillStyle = 'rgba(30,24,20,0.85)'
      rr(ctx, mx - w / 2 - 3, my - h / 2 - 3, w + 6, h + 6, 6)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,210,63,0.75)'
      ctx.fillRect(mx - w / 2, yAt(PERFECT_T + 0.11), w, yAt(PERFECT_T - 0.11) - yAt(PERFECT_T + 0.11))
      ctx.fillStyle = '#3fd16b'
      ctx.fillRect(mx - w / 2, yAt(PERFECT_T + 0.045), w, yAt(PERFECT_T - 0.045) - yAt(PERFECT_T + 0.045))
      const fy = yAt(Math.min(MAX_HOLD, tt))
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(mx - w / 2, fy, w, my + h / 2 - fy)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(mx - w / 2 - 4, fy - 1.5, w + 8, 3)
      const key = !holding && a.meter ? QUALITY_KEY[a.meter.q] : null
      if (key && a.meter) {
        ctx.font = `800 18px ${DISPLAY}`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(30,22,18,0.9)'
        ctx.strokeText(T(key), mx + 12, fy)
        ctx.fillStyle = QUALITY_COLOR[a.meter.q]
        ctx.fillText(T(key), mx + 12, fy)
      }
      ctx.restore()
    } else if (m.phase === 'live' && m.hasBall(a) && !a.busy) {
      const kind = m.distToHoop(a) < DUNK_R ? 'dunk' : 'jump'
      const p = m.shotChance(a, kind)
      const three = kind === 'jump' && m.distToHoop(a) > THREE_R
      const col = p >= 0.55 ? 'rgba(39,160,90,0.9)' : p >= 0.35 ? 'rgba(220,150,20,0.9)' : 'rgba(200,55,45,0.9)'
      pill(ctx, a.x, headY, `${three ? '3PT ' : ''}${Math.round(p * 100)}%`, col, '#fff', 14)
    }
    if (a.onFire && m.phase !== 'over') flameIcon(ctx, a.x - 42 * s, headY, 0.8, m.realTime)
  }
}

function drawHud(ctx: CanvasRenderingContext2D, m: Match, T: (k: TKey) => string) {
  const cx = W / 2
  ctx.fillStyle = 'rgba(48,42,40,0.88)'
  rr(ctx, cx - 190, 8, 380, 56, 12)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 36px ${DISPLAY}`
  if (m.practice) {
    ctx.fillText(`${T('practiceHud')}  ${m.score.home} ${T('points')}`, cx, 37)
  } else {
    ctx.fillText(`${T('home')} ${m.score.home} - ${m.score.away} ${T('guest')}`, cx, 37)
    if (m.phase === 'live' || m.phase === 'pause') {
      ctx.fillStyle = '#f28c28'
      ctx.beginPath()
      ctx.arc(m.possession === 'home' ? cx - 172 : cx + 172, 36, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (m.home.onFire) flameIcon(ctx, cx - 205, 36, 1.1, m.realTime)
  if (m.away?.onFire) flameIcon(ctx, cx + 205, 36, 1.1, m.realTime)

  ctx.fillStyle = 'rgba(48,42,40,0.88)'
  ctx.beginPath()
  ctx.moveTo(cx - 72, 62)
  ctx.lineTo(cx + 72, 62)
  ctx.lineTo(cx + 60, 104)
  ctx.lineTo(cx - 60, 104)
  ctx.closePath()
  ctx.fill()
  if (m.golden) {
    ctx.fillStyle = '#ffc93c'
    ctx.font = `800 22px ${DISPLAY}`
    ctx.fillText(T('goldenBasket'), cx, 84)
  } else {
    const low = m.clock < 10
    ctx.fillStyle = low ? '#ff6b5b' : '#ffffff'
    ctx.font = `700 ${low ? Math.round(32 + Math.max(0, Math.sin(m.realTime * 12)) * 3) : 32}px ${DISPLAY}`
    ctx.fillText(fmtClock(m.clock), cx, 84)
  }
  if (!m.practice && (m.phase === 'live' || m.phase === 'pause')) {
    const sc = Math.ceil(m.shotClock)
    const col = sc <= 4 ? '#ff6b5b' : '#ffd23f'
    ctx.fillStyle = 'rgba(48,42,40,0.88)'
    ctx.beginPath()
    ctx.arc(cx + 96, 84, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = col
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(cx + 96, 84, 15, -Math.PI / 2, -Math.PI / 2 + (m.shotClock / 14) * Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = col
    ctx.font = `700 20px ${DISPLAY}`
    ctx.fillText(String(sc), cx + 96, 85)
  }
  ctx.fillStyle = 'rgba(48,42,40,0.88)'
  rr(ctx, W - 196, 10, 182, 52, 12)
  ctx.fill()
  drawBall(ctx, W - 168, 36, 15, m.realTime * 1.5)
  ctx.textAlign = 'left'
  ctx.font = `700 32px ${DISPLAY}`
  ctx.fillStyle = '#f28c28'
  ctx.fillText('teb', W - 146, 37)
  const tw = ctx.measureText('teb').width
  ctx.fillStyle = '#ffffff'
  ctx.fillText('Basket', W - 146 + tw, 37)
  ctx.textAlign = 'center'

  if (m.phase === 'intro') {
    const k = Math.min(1, m.phaseT / 0.35)
    ctx.fillStyle = `rgba(20,16,14,${0.6 * k})`
    ctx.fillRect(0, 0, W, H)
    if (m.practice) {
      ctx.fillStyle = '#ffffff'
      ctx.font = `800 64px ${DISPLAY}`
      ctx.fillText(T('practiceHud'), cx, 215)
      ctx.font = `600 20px ${DISPLAY}`
      ctx.fillText(T('controlsHelp'), cx, 265)
      ctx.fillStyle = '#7dff9a'
      ctx.fillText(T('meterHelp'), cx, 298)
    } else {
      const slide = (1 - easeOutBack(k)) * 220
      ctx.save()
      ctx.globalAlpha = 0.85 * k
      ctx.fillStyle = '#2f6fd0'
      ctx.beginPath()
      ctx.moveTo(-slide, 190)
      ctx.lineTo(cx + 20 - slide, 190)
      ctx.lineTo(cx - 20 - slide, 300)
      ctx.lineTo(-slide, 300)
      ctx.fill()
      ctx.fillStyle = '#c22f2f'
      ctx.beginPath()
      ctx.moveTo(W + slide, 190)
      ctx.lineTo(cx + 20 + slide, 190)
      ctx.lineTo(cx - 20 + slide, 300)
      ctx.lineTo(W + slide, 300)
      ctx.fill()
      ctx.restore()
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'right'
      ctx.font = `800 46px ${DISPLAY}`
      ctx.fillText(m.home.name, cx - 70 - slide, 232)
      ctx.font = `600 22px ${DISPLAY}`
      ctx.fillText(`${T('level')} ${m.home.level}`, cx - 70 - slide, 270)
      ctx.textAlign = 'left'
      ctx.font = `800 46px ${DISPLAY}`
      ctx.fillText(m.away!.name, cx + 70 + slide, 232)
      ctx.font = `600 22px ${DISPLAY}`
      ctx.fillText(`${T('level')} ${m.away!.level}`, cx + 70 + slide, 270)
      ctx.textAlign = 'center'
      const vs = 0.6 + 0.4 * easeOutBack(Math.min(1, Math.max(0, (m.phaseT - 0.25) / 0.3)))
      ctx.save()
      ctx.translate(cx, 248)
      ctx.scale(vs, vs)
      ctx.font = `800 72px ${DISPLAY}`
      ctx.lineWidth = 8
      ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(20,16,14,0.9)'
      ctx.strokeText(T('vs'), 0, 0)
      ctx.fillStyle = '#ffc93c'
      ctx.fillText(T('vs'), 0, 0)
      ctx.restore()
      ctx.font = `700 22px ${DISPLAY}`
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.fillText(T(m.mode === 'ranked' ? 'ranked' : 'quickMatch').toUpperCase(), cx, 334)
      ctx.font = `600 17px ${DISPLAY}`
      ctx.fillStyle = '#7dff9a'
      ctx.fillText(T('meterHelp'), cx, 362)
    }
  }
  if (m.phase === 'tipoff') pill(ctx, cx, 150, T('tipoff'), 'rgba(48,42,40,0.8)', '#fff', 18)

  const bn = m.banner
  if (bn) {
    const e = easeOutBack(Math.min(1, bn.t / 0.18))
    const fade = Math.min(1, (bn.dur - bn.t) / 0.3)
    ctx.save()
    ctx.globalAlpha = Math.max(0, fade)
    ctx.translate(cx, 200)
    ctx.rotate(-0.04)
    ctx.scale(0.5 + 0.5 * e, 0.5 + 0.5 * e)
    const text = bn.isKey ? T(bn.text as TKey) : bn.text
    ctx.font = `800 70px ${DISPLAY}`
    ctx.lineWidth = 11
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(30,22,18,0.92)'
    ctx.strokeText(text, 0, 0)
    const g = ctx.createLinearGradient(0, -30, 0, 25)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.45, bn.color)
    g.addColorStop(1, bn.color.length === 7 ? shade(bn.color, -0.3) : bn.color)
    ctx.fillStyle = g
    ctx.fillText(text, 0, 0)
    const sub = bn.sub ? T(bn.sub) : bn.subText
    if (sub) {
      ctx.font = `800 30px ${DISPLAY}`
      ctx.lineWidth = 7
      ctx.strokeText(sub, 0, 48)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(sub, 0, 48)
    }
    ctx.restore()
  }
  ctx.textBaseline = 'alphabetic'
  drawMascotPopup(ctx, m, T)
}

/* ------------------------------------------------------------------ */
/* mascot: "Kosiu", a living TEB basketball                           */
/* ------------------------------------------------------------------ */

const QUIP: Record<MascotKind, TKey> = {
  score: 'quipScore', dunk: 'quipDunk', three: 'quipThree', power: 'quipPower', perfect: 'quipPerfect',
  fire: 'quipFire', block: 'quipBlock', steal: 'quipSteal', ankle: 'quipAnkle', buzzer: 'quipBuzzer', win: 'quipWin',
}

function glove(ctx: CanvasRenderingContext2D, x: number, y: number, r = 7) {
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

function mascotLimb(ctx: CanvasRenderingContext2D, pts: V[]) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 7.5
  ctx.stroke()
  ctx.strokeStyle = '#e06d14'
  ctx.lineWidth = 4
  ctx.stroke()
}

/** Draws the mascot centred on its ball body; t = seconds since it appeared. */
export function drawMascot(ctx: CanvasRenderingContext2D, kind: MascotKind, t: number) {
  const R = 32
  const jump = kind === 'dunk' || kind === 'power' || kind === 'win' || kind === 'buzzer' || kind === 'fire'
  const pump = Math.sin(t * 12)

  if (kind === 'fire' || kind === 'power') {
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.75
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.38
      const r = 30 + Math.sin(t * 14 + i * 1.7) * 6
      const s = 26 + Math.sin(t * 10 + i) * 6
      ctx.drawImage(glowSprite('flameYoung'), Math.cos(a) * r - s / 2, Math.sin(a) * r - s / 2 - 8, s, s)
    }
    ctx.restore()
  }

  // legs + sneakers
  for (const side of [-1, 1]) {
    const knee: V = jump ? [side * 14, R + 4] : [side * 11, R + 10]
    const foot: V = jump ? [side * 8, R + 16] : [side * 12, R + 22]
    mascotLimb(ctx, [[side * 10, R - 6], knee, foot])
    ctx.fillStyle = '#2f6fd0'
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2
    rr(ctx, foot[0] - 9 + side * 3, foot[1] - 4, 18, 9, 4.5)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(foot[0] - 8 + side * 3, foot[1] + 2.5, 16, 2)
  }

  let left: V[]
  let right: V[]
  switch (kind) {
    case 'three':
      left = [[-R + 3, 6], [-R - 12, 16], [-R + 2, 22]]
      right = [[R - 3, -2], [R + 14, -20], [R + 10, -42 + pump * 2]]
      break
    case 'perfect':
      left = [[-R + 3, 6], [-R - 12, 16], [-R + 2, 22]]
      right = [[R - 3, 2], [R + 16, -6], [R + 18, -22]]
      break
    case 'block':
      left = [[-R + 3, 6], [-R - 12, 16], [-R + 2, 22]]
      right = [[R - 3, 0], [R + 4, -24], [-R - 20, -26]]
      break
    case 'ankle':
      left = [[-R + 3, 0], [-R - 18, -4], [-R - 34, -8]]
      right = [[R - 3, 6], [R + 14, 18], [R + 2, 26 + Math.abs(pump) * 3]]
      break
    case 'steal':
      left = [[-R + 3, 6], [-R - 8, 22], [-10, R + 6]]
      right = [[R - 3, 6], [R + 8, 22], [10, R + 6]]
      break
    default:
      // flexing, both arms up
      left = [[-R + 3, -2], [-R - 16, -12 - pump * 3], [-R - 12, -34 - pump * 4]]
      right = [[R - 3, -2], [R + 16, -12 + pump * 3], [R + 12, -34 + pump * 4]]
  }
  mascotLimb(ctx, left)
  mascotLimb(ctx, right)

  // ball body
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.2, 0, 0, R)
  g.addColorStop(0, '#ffb466')
  g.addColorStop(1, '#d9640f')
  ctx.fillStyle = g
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, R - 1.5, 0, Math.PI * 2)
  ctx.clip()
  ctx.strokeStyle = '#7a3a0e'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-R, 6)
  ctx.quadraticCurveTo(0, 14, R, 6)
  ctx.moveTo(-R * 0.62, -R)
  ctx.quadraticCurveTo(-R * 0.15, 0, -R * 0.62, R)
  ctx.moveTo(R * 0.62, -R)
  ctx.quadraticCurveTo(R * 0.15, 0, R * 0.62, R)
  ctx.stroke()
  ctx.fillStyle = '#2f6fd0'
  ctx.beginPath()
  ctx.moveTo(-R, -18)
  ctx.quadraticCurveTo(0, -27, R, -18)
  ctx.lineTo(R, -10)
  ctx.quadraticCurveTo(0, -19, -R, -10)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 9px ${DISPLAY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('TEB', 0, -16.5)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.ellipse(-12, -24, 7, 3, -0.5, 0, Math.PI * 2)
  ctx.fill()

  // face
  if (kind === 'fire') {
    ctx.fillStyle = '#16161a'
    rr(ctx, -19, -7, 16, 10, 4)
    ctx.fill()
    rr(ctx, 3, -7, 16, 10, 4)
    ctx.fill()
    ctx.fillRect(-4, -5, 8, 2.5)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillRect(-16, -5, 5, 2)
    ctx.fillRect(6, -5, 5, 2)
  } else {
    for (const ex of [-10, 10]) {
      if (kind === 'perfect' && ex > 0) {
        ctx.strokeStyle = OUTLINE
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(ex, -1, 5, 1.15 * Math.PI, 1.85 * Math.PI)
        ctx.stroke()
        continue
      }
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = OUTLINE
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(ex, -2, 6, 7.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = OUTLINE
      ctx.beginPath()
      ctx.arc(ex - 1.5, -1, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(ex - 0.5, -2.5, 1, 0, Math.PI * 2)
      ctx.fill()
    }
    const angry = kind === 'block'
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-15, angry ? -14 : -12)
    ctx.lineTo(-5, angry ? -11 : -13)
    ctx.moveTo(5, angry ? -11 : -13)
    ctx.lineTo(15, angry ? -14 : -12)
    ctx.stroke()
  }
  // big grin with tongue
  ctx.fillStyle = '#7a2a1f'
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(-11, 9)
  ctx.quadraticCurveTo(0, 26 + (kind === 'ankle' ? Math.abs(pump) * 3 : 0), 11, 9)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#ff7a8a'
  ctx.beginPath()
  ctx.ellipse(0, 17, 5, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(-7, 9.5, 14, 2.5)
  ctx.fillStyle = 'rgba(255,90,90,0.35)'
  ctx.beginPath()
  ctx.ellipse(-20, 8, 4.5, 3, 0, 0, Math.PI * 2)
  ctx.ellipse(20, 8, 4.5, 3, 0, 0, Math.PI * 2)
  ctx.fill()

  // gloves + gesture details
  const [hx, hy] = right[2]
  if (kind === 'three') {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2
    for (const dx of [-5, 0, 5]) {
      rr(ctx, hx + dx - 2, hy - 15, 4.5, 12, 2.2)
      ctx.fill()
      ctx.stroke()
    }
    glove(ctx, hx, hy)
  } else if (kind === 'perfect') {
    glove(ctx, hx, hy)
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2
    rr(ctx, hx - 2.5, hy - 17, 5, 12, 2.5)
    ctx.fill()
    ctx.stroke()
  } else if (kind === 'block') {
    glove(ctx, hx, hy, 10)
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (const dy of [-5, -1.5, 2]) {
      ctx.moveTo(hx - 9, hy + dy)
      ctx.lineTo(hx - 3, hy + dy)
    }
    ctx.stroke()
  } else if (kind === 'steal') {
    drawBall(ctx, 0, R + 9, 9, t * 6)
    glove(ctx, hx, hy)
  } else {
    glove(ctx, hx, hy)
  }
  if (kind === 'ankle') {
    // pointing finger
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = OUTLINE
    ctx.lineWidth = 2
    rr(ctx, left[2][0] - 13, left[2][1] - 2.5, 10, 5, 2.5)
    ctx.fill()
    ctx.stroke()
  }
  glove(ctx, left[2][0], left[2][1])
  ctx.textBaseline = 'alphabetic'
}

/** Mascot slides in next to the banner, bounces, says something and slides out. */
function drawMascotPopup(ctx: CanvasRenderingContext2D, m: Match, T: (k: TKey) => string) {
  const mc = m.mascot
  if (!mc) return
  const t = mc.t
  const kin = easeOutBack(Math.min(1, t / 0.32))
  const out = Math.max(0, (t - (MASCOT_TIME - 0.3)) / 0.3)
  const x = W / 2 + 270 + (1 - kin) * 300 + out * out * 320
  const y = 230 - Math.abs(Math.sin(t * 7)) * 10
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(Math.sin(t * 5) * 0.06)
  ctx.scale(1.15, 1.15)
  drawMascot(ctx, mc.kind, t)
  ctx.restore()
  // speech bubble
  const text = T(QUIP[mc.kind])
  ctx.save()
  ctx.globalAlpha = Math.min(1, t / 0.25) * (1 - out)
  ctx.font = `800 17px ${DISPLAY}`
  const w = ctx.measureText(text).width + 22
  const bx = x - w / 2 + 6
  const by = y - 108
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.5
  rr(ctx, bx, by, w, 30, 12)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 6, by + 28)
  ctx.lineTo(x + 2, by + 42)
  ctx.lineTo(x + 8, by + 28)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - 6, by + 30)
  ctx.lineTo(x + 2, by + 42)
  ctx.lineTo(x + 8, by + 30)
  ctx.stroke()
  ctx.fillStyle = '#2f6fd0'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, bx + w / 2, by + 15.5)
  ctx.restore()
  ctx.textBaseline = 'alphabetic'
}
