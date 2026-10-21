import { useEffect, useRef } from 'react'
import { FLOOR_TOP, H, W } from '../game/constants'
import { drawGym, drawHeadFront, drawPersonFront, drawShadow, type FrontMode } from '../game/render'
import type { Look } from '../lib/outfits'

function useCanvasLoop(draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void, animate = true) {
  const ref = useRef<HTMLCanvasElement>(null)
  const drawRef = useRef(draw)
  drawRef.current = draw
  const frameRef = useRef<() => void>()
  // static canvases repaint whenever their props change
  useEffect(() => {
    if (!animate) frameRef.current?.()
  })
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext('2d')!
    let raf = 0
    let alive = true
    const start = performance.now()
    const frame = () => {
      if (!alive) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr)
        c.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      drawRef.current(ctx, w, h, (performance.now() - start) / 1000)
      if (animate) raf = requestAnimationFrame(frame)
    }
    frameRef.current = frame
    frame()
    const onResize = () => {
      if (!animate) frame()
    }
    window.addEventListener('resize', onResize)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [animate])
  return ref
}

/** Full-bleed gym scene; optionally with the player facing the camera in the middle (lobby). */
export function GymBackdrop({ look, className = '', excite = 0 }: { look?: Look; className?: string; excite?: number }) {
  const ref = useCanvasLoop((ctx, w, h, t) => {
    const s = Math.max(w / W, h / H)
    ctx.save()
    ctx.translate((w - W * s) / 2, (h - H * s) / 2)
    ctx.scale(s, s)
    drawGym(ctx, t, excite)
    if (look) {
      const fy = FLOOR_TOP + 112
      const k = 1.4
      // 9 s loop: dribble → spin the ball on a finger → hold
      const c = t % 9
      const mode: FrontMode = c < 4.5 ? 'dribble' : c < 7 ? 'spin' : 'hold'
      const dribble = (t * 1.9) % 1
      drawShadow(ctx, W / 2, fy, 50, 11)
      if (mode === 'dribble') drawShadow(ctx, W / 2 + 31 * k, fy, 16, 4, 0.18)
      ctx.translate(W / 2, fy)
      ctx.scale(k, k)
      drawPersonFront(ctx, look, { mode, t, dribble })
    }
    ctx.restore()
  })
  return <canvas ref={ref} className={`block h-full w-full ${className}`} />
}

/** Transparent canvas with the player facing the camera (locker). */
export function CharacterPreview({ look, className = '', animate = true }: { look: Look; className?: string; animate?: boolean }) {
  const ref = useCanvasLoop(
    (ctx, w, h, t) => {
      const k = Math.min(w / 110, h / 210)
      drawShadow(ctx, w / 2, h - 10 * k, 34 * k, 7 * k)
      ctx.save()
      ctx.translate(w / 2, h - 10 * k)
      ctx.scale(k, k)
      drawPersonFront(ctx, look, { mode: 'hold', t })
      ctx.restore()
    },
    animate,
  )
  return <canvas ref={ref} className={`block h-full w-full ${className}`} />
}

export function Avatar({ look, className = '' }: { look: Look; className?: string }) {
  const ref = useCanvasLoop((ctx, w, h) => {
    ctx.fillStyle = '#9fc3ea'
    ctx.fillRect(0, 0, w, h)
    const k = w / 56
    ctx.save()
    ctx.translate(w / 2, h * 0.5)
    ctx.scale(k, k)
    ctx.fillStyle = look.jersey
    ctx.strokeStyle = '#2b2320'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.ellipse(0, 34, 24, 15, 0, Math.PI, 0)
    ctx.fill()
    ctx.stroke()
    drawHeadFront(ctx, look, 0, 0)
    ctx.restore()
  }, false)
  return <canvas ref={ref} className={`block h-full w-full ${className}`} />
}

const CONFETTI_COLORS = ['#f28c28', '#2f6fd0', '#ffd23f', '#3fd16b', '#ff6b5b', '#ffffff', '#b46bff']

/** Falling confetti overlay (results screen). */
export function Confetti() {
  const pieces = useRef(
    Array.from({ length: 120 }, (_, i) => ({
      x: Math.random(),
      y: -Math.random() * 1.2,
      v: 0.12 + Math.random() * 0.18,
      s: 5 + Math.random() * 6,
      r: Math.random() * 6,
      vr: (Math.random() - 0.5) * 8,
      c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    })),
  )
  const last = useRef(0)
  const ref = useCanvasLoop((ctx, w, h, t) => {
    const dt = Math.min(0.05, t - last.current)
    last.current = t
    for (const p of pieces.current) {
      p.y += p.v * dt
      p.r += p.vr * dt
      if (p.y > 1.05 && t < 5) p.y = -0.05
      if (p.y > 1.1) continue
      ctx.save()
      ctx.translate(p.x * w + Math.sin(t * 2 + p.r) * 12, p.y * h)
      ctx.rotate(p.r)
      ctx.fillStyle = p.c
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, (p.s / 2) * Math.abs(Math.cos(t * 6 + p.r)) + 1)
      ctx.restore()
    }
  })
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 block h-full w-full" />
}
