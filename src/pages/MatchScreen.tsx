import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { H, W } from '../game/constants'
import { CROSS_COOLDOWN, type Controls, type Match } from '../game/engine'
import { createMatch } from '../game/factory'
import { MatchRenderer } from '../game/render'
import { PauseIcon } from '../components/Icons'
import { submitMatch } from '../lib/actions'
import { audio } from '../lib/audio'
import { useT } from '../lib/i18n'
import { useGame } from '../store/useGame'

interface Held {
  left: boolean
  right: boolean
  up: boolean
  down: boolean
}

interface HudState {
  action: 'shoot' | 'dunk' | 'steal' | 'block' | null
  power: number
  canPower: boolean
  /** 0..1 crossover cooldown remaining, -1 = not available (no ball) */
  move: number
  /** 0..1 cooldown remaining */
  steal: number
  block: number
}

const ACTION_KEYS = ['Space', 'KeyJ']

export default function MatchScreen() {
  const t = useT()
  const { profile, mode, matchId, setScreen } = useGame()
  const match = useMemo<Match>(() => createMatch(mode, profile!), [matchId]) // eslint-disable-line react-hooks/exhaustive-deps
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const keys = useRef<Held>({ left: false, right: false, up: false, down: false })
  const pad = useRef({ mx: 0, mz: 0 })
  const edges = useRef({ action: false, power: false, move: false })
  const held = useRef({ key: false, touch: false })
  const paused = useRef(false)
  const [isPaused, setPaused] = useState(false)
  const [hud, setHud] = useState<HudState>({ action: null, power: 0, canPower: false, move: -1, steal: 0, block: 0 })
  const [portrait, setPortrait] = useState(false)
  const touch = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])
  const tRef = useRef(t)
  tRef.current = t

  const setPause = (p: boolean) => {
    paused.current = p
    setPaused(p)
    audio.setCrowd(p ? 0 : 0.4)
  }

  // keyboard
  useEffect(() => {
    const map: Record<string, keyof Held> = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    }
    const down = (e: KeyboardEvent) => {
      audio.unlock()
      if (map[e.code]) {
        keys.current[map[e.code]] = true
        e.preventDefault()
      } else if (ACTION_KEYS.includes(e.code)) {
        e.preventDefault()
        if (!e.repeat) {
          edges.current.action = true
          held.current.key = true
        }
      } else if ((e.code === 'KeyE' || e.code === 'KeyK') && !e.repeat) {
        edges.current.power = true
      } else if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') && !e.repeat) {
        edges.current.move = true
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        if (match.phase !== 'over') setPause(!paused.current)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (map[e.code]) keys.current[map[e.code]] = false
      if (ACTION_KEYS.includes(e.code)) held.current.key = false
    }
    const blur = () => {
      keys.current = { left: false, right: false, up: false, down: false }
      held.current = { key: false, touch: false }
      if (document.hidden && match.phase !== 'over') setPause(true)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', blur)
      audio.setCrowd(0)
    }
  }, [match])

  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth && window.matchMedia('(pointer: coarse)').matches)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // game loop
  useEffect(() => {
    const c = canvasRef.current!
    const ctx = c.getContext('2d')!
    const renderer = new MatchRenderer()
    // adaptive quality: measures our own work per frame (not the frame interval, which a
    // throttled tab or battery saver also stretches). ~2 s over 12 ms → drop reflections,
    // extra flames and hi-dpi rendering.
    let workEma = 0.004
    let slowFor = 0
    let dprCap = 2
    let raf = 0
    let last = performance.now()
    let hudT = 0
    let finished = false
    let alive = true
    void document.fonts?.load('700 32px "Barlow Condensed"')
    if (import.meta.env.DEV) (window as unknown as { __match: Match }).__match = match
    audio.setCrowd(0.4)

    const frame = (now: number) => {
      if (!alive) return
      const frameDt = Math.min(0.1, (now - last) / 1000)
      const dt = Math.min(0.05, frameDt)
      slowFor = workEma > 0.012 && !paused.current ? slowFor + frameDt : 0
      if (slowFor > 2 && !renderer.lowQuality) {
        renderer.lowQuality = true
        dprCap = 1
      }
      last = now
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1)
      const cw = Math.round(c.clientWidth * dpr)
      const ch = Math.round(c.clientHeight * dpr)
      if (c.width !== cw || c.height !== ch) {
        c.width = cw
        c.height = ch
      }

      const step = paused.current ? 0 : dt
      if (!paused.current) {
        const k = keys.current
        const mx = Math.max(-1, Math.min(1, pad.current.mx + (k.right ? 1 : 0) - (k.left ? 1 : 0)))
        const mz = Math.max(-1, Math.min(1, pad.current.mz + (k.down ? 1 : 0) - (k.up ? 1 : 0)))
        const input: Controls = {
          mx,
          mz,
          action: edges.current.action,
          actionHeld: held.current.key || held.current.touch,
          power: edges.current.power,
          move: edges.current.move,
        }
        match.update(dt, input)
        for (const e of match.events) audio.play(e)
        match.events.length = 0
        audio.setCrowd(0.35 + match.hype * 0.65)
      }
      edges.current = { action: false, power: false, move: false }

      ctx.setTransform(c.width / W, 0, 0, c.height / H, 0, 0)
      ctx.fillStyle = '#1a1512'
      ctx.fillRect(0, 0, W, H)
      renderer.draw(ctx, match, tRef.current, step)

      hudT += dt
      if (hudT > 0.07) {
        hudT = 0
        const h = match.home
        const next: HudState = {
          action: match.actionFor(h),
          power: h.power,
          canPower: h.power >= 1 && match.hasBall(h) && match.phase === 'live',
          move: match.hasBall(h) && match.phase === 'live' ? h.moveCd / CROSS_COOLDOWN : -1,
          steal: Math.max(h.stealCd / 0.85, h.stunT / 0.45),
          block: h.blockCd,
        }
        setHud((p) =>
          p.action === next.action && Math.abs(p.power - next.power) < 0.01 && p.canPower === next.canPower && Math.abs(p.move - next.move) < 0.02 && Math.abs(p.steal - next.steal) < 0.03 && Math.abs(p.block - next.block) < 0.03 ? p : next,
        )
      }

      workEma = workEma * 0.95 + ((performance.now() - now) / 1000) * 0.05

      if (!finished && match.phase === 'over' && match.phaseT > 3) {
        finished = true
        audio.setCrowd(0)
        void submitMatch(match.summary())
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [match])

  // ---------- touch D-pad (supports diagonals and sliding) ----------
  const padRef = useRef<HTMLDivElement>(null)
  const padPointer = useRef<number | null>(null)
  const [padDir, setPadDir] = useState({ mx: 0, mz: 0 })
  const updatePad = (e: RPointerEvent) => {
    const r = padRef.current!.getBoundingClientRect()
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    const dead = 0.22
    const mx = Math.abs(dx) > dead ? Math.sign(dx) : 0
    const mz = Math.abs(dy) > dead ? Math.sign(dy) : 0
    pad.current = { mx, mz }
    setPadDir((p) => (p.mx === mx && p.mz === mz ? p : { mx, mz }))
  }
  const releasePad = (e: RPointerEvent) => {
    if (padPointer.current !== e.pointerId) return
    padPointer.current = null
    pad.current = { mx: 0, mz: 0 }
    setPadDir({ mx: 0, mz: 0 })
  }

  const actionLabel = hud.action ? t(hud.action) : t('shoot')
  const actionColor =
    hud.action === 'steal' ? 'border-sky-200 bg-sky-700/75' : hud.action === 'block' ? 'border-violet-200 bg-violet-700/80' : hud.action === 'dunk' ? 'border-amber-200 bg-orange-600/80' : 'border-white/70 bg-[#3a302a]/75'
  const releaseAction = () => {
    held.current.touch = false
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div className="relative aspect-video select-none animate-[fadeIn_.3s_ease-out]" style={{ width: 'min(100vw, calc(100dvh * 16 / 9))', containerType: 'inline-size', touchAction: 'none' }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        <button
          onClick={() => setPause(true)}
          className="absolute left-[1.5%] top-[2.5%] grid aspect-square w-[5.5%] place-items-center rounded-[1.2cqw] border-2 border-white/70 bg-[#3a302a]/75 text-white"
          aria-label={t('pause')}
        >
          <PauseIcon className="h-1/2 w-1/2" />
        </button>

        {touch && (
        <>
        {/* D-pad */}
        <div
          ref={padRef}
          className="absolute bottom-[3%] left-[2.5%] aspect-square w-[26%]"
          onPointerDown={(e) => {
            audio.unlock()
            padPointer.current = e.pointerId
            e.currentTarget.setPointerCapture(e.pointerId)
            updatePad(e)
          }}
          onPointerMove={(e) => padPointer.current === e.pointerId && updatePad(e)}
          onPointerUp={releasePad}
          onPointerCancel={releasePad}
        >
          {(
            [
              ['up', 'left-1/3 top-0', 0, -1, 'rotate-0'],
              ['left', 'left-0 top-1/3', -1, 0, '-rotate-90'],
              ['down', 'left-1/3 top-2/3', 0, 1, 'rotate-180'],
              ['right', 'left-2/3 top-1/3', 1, 0, 'rotate-90'],
            ] as const
          ).map(([id, pos, x, z, rot]) => {
            const on = (x !== 0 && padDir.mx === x) || (z !== 0 && padDir.mz === z)
            return (
              <div key={id} className={`absolute ${pos} grid h-1/3 w-1/3 place-items-center p-[4%]`}>
                <div className={`grid h-full w-full place-items-center rounded-[1.2cqw] border-2 border-white/60 transition ${on ? 'scale-95 bg-[#5a4a40]/90' : 'bg-[#3a302a]/70'}`}>
                  <svg viewBox="0 0 20 20" className={`h-1/2 w-1/2 ${rot}`}>
                    <path d="M10 3 18 16H2z" fill="#e8e2dc" />
                  </svg>
                </div>
              </div>
            )
          })}
        </div>

        {/* action buttons */}
        <div className="absolute bottom-[4%] right-[2.5%] flex items-end gap-[1.2cqw]">
          <div className="flex flex-col items-center gap-[1.2cqw]">
            <button
              onPointerDown={(e) => {
                e.preventDefault()
                audio.unlock()
                edges.current.move = true
              }}
              disabled={hud.move < 0}
              className="relative grid aspect-square w-[9cqw] place-items-center rounded-full border-2 border-white/60 bg-[#3a302a]/70 font-display text-[1.7cqw] font-extrabold uppercase text-white transition active:scale-95 disabled:opacity-35"
              style={{ backgroundImage: hud.move > 0 ? `conic-gradient(rgba(0,0,0,0.55) ${hud.move * 360}deg, transparent 0)` : undefined }}
            >
              {t('move')}
            </button>
            <button
              onPointerDown={(e) => {
                e.preventDefault()
                audio.unlock()
                edges.current.power = true
              }}
              className={`relative grid aspect-square w-[11cqw] place-items-center rounded-full border-2 font-display text-[2cqw] font-extrabold transition ${hud.canPower ? 'animate-pulse border-amber-200 bg-gradient-to-b from-amber-400 to-orange-600 text-white shadow-[0_0_2.5cqw_rgba(255,170,40,0.8)]' : 'border-white/50 bg-[#3a302a]/70 text-white/60'}`}
              style={{ backgroundImage: hud.canPower ? undefined : `conic-gradient(rgba(242,140,40,0.75) ${hud.power * 360}deg, transparent 0)` }}
            >
              {t('power')}
            </button>
          </div>
          <button
            onPointerDown={(e) => {
              e.preventDefault()
              audio.unlock()
              e.currentTarget.setPointerCapture(e.pointerId)
              edges.current.action = true
              held.current.touch = true
            }}
            onPointerUp={releaseAction}
            onPointerCancel={releaseAction}
            className={`grid aspect-square w-[14cqw] place-items-center rounded-[2cqw] border-2 font-display text-[2.6cqw] font-bold transition active:scale-95 ${actionColor}`}
          >
            {actionLabel}
          </button>
        </div>
        </>
        )}

        <CooldownHud hud={hud} touch={touch} />

        {isPaused && (
          <div className="absolute inset-0 grid place-items-center bg-black/60">
            <div className="panel flex w-[44cqw] flex-col gap-[1.4cqw] p-[2.5cqw] text-center animate-[popIn_.15s_ease-out]">
              <h2 className="font-display text-[4.5cqw] font-bold uppercase leading-none">{t('pause')}</h2>
              <p className="text-[1.4cqw] text-white/70">{t('controlsHelp')}</p>
              <p className="text-[1.4cqw] text-emerald-300">{t('meterHelp')}</p>
              <button className="btn-primary py-[1cqw] text-[2.4cqw]" onClick={() => setPause(false)}>
                {t('resume')}
              </button>
              <button className="btn-game py-[1cqw] text-[2.4cqw]" onClick={() => setScreen('lobby')}>
                {t('quit')}
              </button>
              <p className="text-[1.3cqw] text-white/50">{t('quitWarn')}</p>
            </div>
          </div>
        )}
      </div>

      {portrait && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6 text-center">
          <div>
            <div className="mb-3 text-6xl">📱↻</div>
            <p className="font-display text-2xl font-bold">{t('rotate')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function Key({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-[2.3cqw] min-w-[2.3cqw] items-center justify-center rounded-[0.5cqw] border border-white/60 bg-white/10 px-[0.5cqw] font-display text-[1.2cqw] font-bold leading-none text-white shadow-[0_0.2cqw_0_rgba(0,0,0,0.55)]">
      {children}
    </span>
  )
}

/** 0..1 cooldown remaining → bar that fills up as it recharges */
function Bar({ left, color, glow = false }: { left: number; color: string; glow?: boolean }) {
  const ready = Math.max(0, Math.min(1, 1 - left))
  return (
    <span className="relative h-[0.75cqw] w-[6.5cqw] overflow-hidden rounded-full bg-black/55">
      <span className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-75 ${color} ${glow ? 'shadow-[0_0_1cqw_rgba(255,180,60,0.9)]' : ''}`} style={{ width: `${ready * 100}%` }} />
    </span>
  )
}

/** Corner panel: key bindings + live cooldowns */
function CooldownHud({ hud, touch }: { hud: HudState; touch: boolean }) {
  const t = useT()
  const defending = hud.action === 'steal' || hud.action === 'block'
  const actionKey = hud.action === 'block' ? 'keyBlock' : hud.action === 'steal' ? 'keySteal' : 'keyShoot'
  const actionLeft = hud.action === 'block' ? hud.block : hud.action === 'steal' ? hud.steal : 0
  const row = 'flex items-center gap-[0.7cqw]'
  const label = 'w-[7.5cqw] truncate font-display text-[1.35cqw] font-bold uppercase tracking-wide'
  return (
    <div
      className={`pointer-events-none absolute flex flex-col gap-[0.55cqw] rounded-[1cqw] border border-white/15 bg-[#221c18]/70 p-[0.9cqw] backdrop-blur-sm ${touch ? 'left-[1.5%] top-[12%] scale-90 origin-top-left' : 'bottom-[2.5%] left-[1.5%]'}`}
    >
      <div className={`${row} ${hud.canPower ? 'text-amber-300' : 'text-white'}`}>
        <Key>E</Key>
        <span className={label}>{t('keyPower')}</span>
        {hud.power >= 1 ? (
          <span className="animate-pulse font-display text-[1.25cqw] font-extrabold text-amber-300">{t('ready')}</span>
        ) : (
          <Bar left={1 - hud.power} color="bg-gradient-to-r from-orange-500 to-amber-300" />
        )}
      </div>
      <div className={`${row} ${hud.move < 0 ? 'opacity-45' : ''}`}>
        <Key>Shift</Key>
        <span className={label}>{t('keyCross')}</span>
        <Bar left={Math.max(0, hud.move)} color="bg-sky-400" />
      </div>
      <div className={row}>
        <Key>{t('keySpace')}</Key>
        <span className={`${label} ${defending ? (hud.action === 'block' ? 'text-violet-300' : 'text-sky-300') : ''}`}>{t(actionKey)}</span>
        <Bar left={actionLeft} color={hud.action === 'block' ? 'bg-violet-400' : 'bg-emerald-400'} />
      </div>
      {!touch && (
        <>
          <div className={row}>
            <span className="flex gap-[0.25cqw]">
              <Key>W</Key>
              <Key>A</Key>
              <Key>S</Key>
              <Key>D</Key>
            </span>
            <span className="font-display text-[1.35cqw] font-bold uppercase tracking-wide text-white/80">{t('keyMove')}</span>
          </div>
          <div className={row}>
            <Key>Esc</Key>
            <span className="font-display text-[1.35cqw] font-bold uppercase tracking-wide text-white/80">{t('keyPause')}</span>
          </div>
        </>
      )}
    </div>
  )
}
