import type { Sfx } from '../lib/audio'
import type { TKey } from '../lib/i18n'
import type { Look } from '../lib/outfits'
import type { AthleteStats } from '../lib/progression'
import type { MatchMode, MatchSummary } from '../types'
import {
  BALL_R, BASELINE_X, DEPTH, DUNK_R, GRAVITY, HOOP_X, HOOP_Z, POWER_FILL_SECONDS, RIM_H, SHOT_CLOCK, THREE_R,
  X_MAX, X_MIN, clamp, lerp, persp,
} from './constants'

export type Team = 'home' | 'away'
export type AthleteState = 'idle' | 'run' | 'shoot' | 'dunk' | 'hang' | 'reach' | 'block' | 'fall' | 'celebrate' | 'sad'
export type ShotKind = 'jump' | 'dunk' | 'power'
export type ShotQuality = 'perfect' | 'good' | 'early' | 'late' | 'auto'
export type Phase = 'intro' | 'tipoff' | 'live' | 'pause' | 'over'

export interface Controls {
  mx: number
  mz: number
  /** edge: shoot when holding the ball, steal/block when defending */
  action: boolean
  /** level: action button still held (shot timing meter) */
  actionHeld: boolean
  /** edge: powershot */
  power: boolean
  /** edge: crossover dribble move */
  move: boolean
}
export const NO_INPUT: Controls = { mx: 0, mz: 0, action: false, actionHeld: false, power: false, move: false }

export const RELEASE_T: Record<ShotKind, number> = { jump: 0.3, power: 0.34, dunk: 0.4 }
/** jump apex — release here for a perfect shot */
export const PERFECT_T = 0.36
export const MAX_HOLD = 0.66
const TAP_T = 0.11
const QUALITY_BONUS: Record<ShotQuality, number> = { perfect: 0.2, good: 0.06, early: -0.14, late: -0.14, auto: 0 }
export const CROSS_COOLDOWN = 2.2

export function judgeRelease(t: number): ShotQuality {
  const d = t - PERFECT_T
  if (Math.abs(d) <= 0.045) return 'perfect'
  if (Math.abs(d) <= 0.11) return 'good'
  return d < 0 ? 'early' : 'late'
}

export type FxType = 'dust' | 'land' | 'swish' | 'dunk' | 'block' | 'steal' | 'text' | 'ankle' | 'flash' | 'confetti' | 'fireStart'
export type MascotKind = 'score' | 'dunk' | 'three' | 'power' | 'perfect' | 'fire' | 'block' | 'steal' | 'ankle' | 'buzzer' | 'win'
export const MASCOT_TIME = 2
export interface Fx {
  type: FxType
  x: number
  z: number
  h: number
  text?: string
  key?: TKey
  color?: string
  big?: boolean
}

export class Athlete {
  x = 0
  z = 0.5
  h = 0
  vh = 0
  vx = 0
  vz = 0
  facing: 1 | -1 = 1
  state: AthleteState = 'idle'
  stateT = 0
  anim = 0
  stealCd = 0
  blockCd = 0
  stunT = 0
  fallT = 0
  hangT = 0
  /** time since last landing (squash animation) */
  landT = 1
  /** crossover */
  moveT = 0
  moveCd = 0
  moveDir = 0
  /** 0..1, powershot is available at 1 */
  power = 0.35
  streak = 0
  onFire = false
  shotKind: ShotKind | null = null
  released = false
  shotHeld = false
  autoRelease = false
  quality: ShotQuality = 'auto'
  /** last shot-meter result, for the HUD */
  meter: { q: ShotQuality; t: number; at: number } | null = null
  dunkFrom = { x: 0, z: 0 }
  private lastMx = 0

  constructor(
    public team: Team,
    public name: string,
    public level: number,
    public look: Look,
    public stats: AthleteStats,
  ) {}

  get busy() {
    return this.state === 'shoot' || this.state === 'dunk' || this.state === 'hang'
  }
  get grounded() {
    return this.h === 0 && this.vh === 0
  }
  setState(s: AthleteState) {
    if (this.state !== s) {
      this.state = s
      this.stateT = 0
    }
  }
  /** returns true when the horizontal direction just reversed (sneaker squeak) */
  turned(mx: number) {
    const flip = mx !== 0 && this.lastMx !== 0 && Math.sign(mx) !== Math.sign(this.lastMx)
    if (mx !== 0) this.lastMx = mx
    return flip
  }
}

interface Flight {
  sx: number
  sz: number
  sh: number
  tx: number
  tz: number
  th: number
  t: number
  dur: number
  peak: number
  willScore: boolean
  points: number
  kind: ShotKind
  shooter: Team
}

export class Ball {
  x = 0
  z = 0.5
  h = BALL_R
  vx = 0
  vz = 0
  vh = 0
  state: 'held' | 'flight' | 'rattle' | 'loose' | 'through' | 'dead' = 'held'
  holder: Team | null = null
  flight: Flight | null = null
  rattle = { t: 0, hops: 1 }
  lastShooter: Team | null = null
  dribble = 0
  spin = 0
  looseT = 0
  /** 0..1 squash after a floor bounce */
  squash = 0
  trail: { x: number; y: number }[] = []
}

export interface Banner {
  text: string
  isKey: boolean
  sub?: TKey
  subText?: string
  color: string
  t: number
  dur: number
}

interface TeamStats {
  makes: number
  attempts: number
  dunks: number
  threes: number
  steals: number
  blocks: number
  perfects: number
}
const emptyStats = (): TeamStats => ({ makes: 0, attempts: 0, dunks: 0, threes: 0, steals: 0, blocks: 0, perfects: 0 })

export const worldDist = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, (a.z - b.z) * DEPTH)

/* ------------------------------------------------------------------ */
/* NPC brain                                                          */
/* ------------------------------------------------------------------ */

export class NpcBrain {
  private tx = 600
  private tz = 0.5
  private retarget = 0
  private decide = 0.5
  private trackX = 600
  private trackZ = 0.5
  private lunge = 0
  private blockTried = false
  private wantBlock = false
  private blockDelay = 0

  constructor(public diff: number) {}

  reset(me: Athlete) {
    this.retarget = 0
    this.lunge = 0
    this.decide = 0.5 + Math.random() * 0.3
    this.trackX = me.x
    this.trackZ = me.z
    this.blockTried = false
    this.wantBlock = false
  }

  /** NPC shot timing skill */
  rollQuality(): ShotQuality {
    const r = Math.random()
    if (r < this.diff * 0.28) return 'perfect'
    if (r < this.diff * 0.28 + 0.3) return 'good'
    if (r > 0.9 - this.diff * 0.1) return 'early'
    return 'auto'
  }

  think(m: Match, me: Athlete, foe: Athlete, dt: number): Controls {
    const out: Controls = { ...NO_INPUT }
    if (me.fallT > 0) return out
    const b = m.ball
    const seek = (x: number, z: number, tol = 8) => {
      const dx = x - me.x
      const dz = (z - me.z) * DEPTH
      if (Math.abs(dx) > tol) out.mx = Math.sign(dx) * Math.min(1, Math.abs(dx) / 40)
      if (Math.abs(dz) > tol) out.mz = Math.sign(dz) * Math.min(1, Math.abs(dz) / 40)
    }
    const dFoe = worldDist(me, foe)

    if (b.state === 'held' && b.holder === me.team) {
      // --- attack ---
      this.retarget -= dt
      if (this.retarget <= 0 || Math.abs(this.tx - me.x) < 18) {
        const r = Math.random()
        const driveW = 0.3 + this.diff * 0.25
        const threeW = 0.25 + this.diff * 0.15
        this.tx = r < driveW ? HOOP_X - 50 - Math.random() * 40 : r < driveW + threeW ? HOOP_X - THREE_R - 15 - Math.random() * 50 : HOOP_X - 160 - Math.random() * 110
        this.tz = 0.12 + Math.random() * 0.76
        this.retarget = 1 + Math.random() * 1.3
      }
      seek(this.tx, this.tz)
      const between = foe.x > me.x - 5
      if (dFoe < 85 && between && foe.stunT <= 0 && foe.fallT <= 0) {
        out.mz = foe.z > me.z ? -1 : 1
        if (me.z < 0.08) out.mz = 1
        if (me.z > 0.92) out.mz = -1
        if (me.moveCd <= 0 && dFoe < 80 && Math.random() < (0.25 + this.diff * 0.5) * dt) out.move = true
      }
      this.decide -= dt
      if (this.decide <= 0) {
        this.decide = 0.32 - this.diff * 0.14 + Math.random() * 0.15
        const d = m.distToHoop(me)
        const open = foe.fallT > 0 || foe.stunT > 0
        if (d < DUNK_R) {
          if (Math.random() < 0.55 + 0.4 * this.diff || open) out.action = true
        } else {
          const p = m.shotChance(me, 'jump')
          const thr = 0.6 - this.diff * 0.1 - (d > THREE_R ? 0.13 : 0) - (me.onFire ? 0.1 : 0)
          if (me.power >= 1 && (d > THREE_R ? Math.random() < 0.55 : Math.random() < 0.1)) out.power = true
          else if ((p > thr || (open && p > 0.3)) && Math.random() < 0.6) out.action = true
        }
        if (!m.practice && m.shotClock < 2.2) {
          if (me.power >= 1) out.power = true
          else out.action = true
        }
      }
    } else if (b.state === 'held') {
      // --- defend ---
      const shooting = foe.state === 'shoot' || foe.state === 'dunk'
      if (shooting && !foe.released && foe.shotKind !== 'power') {
        if (!this.blockTried) {
          this.blockTried = true
          this.wantBlock = dFoe < 95 && Math.random() < 0.18 + this.diff * 0.5
          this.blockDelay = 0.04 + (1 - this.diff) * 0.16 + Math.random() * 0.1
        }
        seek(foe.x + 30, foe.z, 4)
        if (this.wantBlock) {
          this.blockDelay -= dt
          if (this.blockDelay <= 0) {
            out.action = true
            this.wantBlock = false
          }
        }
        return out
      }
      if (!shooting) this.blockTried = false
      const gap = 64 + (1 - this.diff) * 26
      let gx = Math.min(foe.x + gap, HOOP_X - 25)
      let gz = foe.z + (HOOP_Z - foe.z) * 0.2
      this.lunge -= dt
      const ready = me.stealCd <= 0 && me.stunT <= 0 && !foe.busy && foe.moveT <= 0
      if (this.lunge <= 0 && ready && dFoe < gap + 30 && Math.random() < (0.3 + this.diff * 0.8) * dt) this.lunge = 0.45
      if (this.lunge > 0) {
        gx = foe.x + 22 * Math.sign(me.x - foe.x || 1)
        gz = foe.z
        if (ready && dFoe < 60) {
          out.action = true
          this.lunge = 0
        }
      }
      const k = Math.min(1, dt * (this.lunge > 0 ? 10 : 2.2 + this.diff * 6))
      this.trackX += (gx - this.trackX) * k
      this.trackZ += (gz - this.trackZ) * k
      seek(this.trackX, this.trackZ, 6)
    } else if (b.state === 'flight' || b.state === 'rattle') {
      seek(HOOP_X - 120, HOOP_Z + (me.z < HOOP_Z ? -0.15 : 0.15))
      this.trackX = me.x
      this.trackZ = me.z
    } else {
      seek(b.x, b.z, 4)
      this.trackX = me.x
      this.trackZ = me.z
    }
    return out
  }
}

/* ------------------------------------------------------------------ */
/* Match                                                              */
/* ------------------------------------------------------------------ */

export interface MatchConfig {
  mode: MatchMode
  home: Athlete
  away: Athlete | null
  brain: NpcBrain | null
  duration: number
}

export class Match {
  readonly mode: MatchMode
  readonly practice: boolean
  readonly home: Athlete
  readonly away: Athlete | null
  readonly brain: NpcBrain | null
  readonly ball = new Ball()
  readonly athletes: Athlete[]

  phase: Phase = 'intro'
  phaseT = 0
  /** simulation time (slows down with slow-mo) */
  time = 0
  /** wall time, for UI animation */
  realTime = 0
  clock: number
  shotClock = SHOT_CLOCK
  clockEnded = false
  golden = false
  possession: Team = 'home'
  score = { home: 0, away: 0 }
  stats = { home: emptyStats(), away: emptyStats() }
  banner: Banner | null = null
  events: Sfx[] = []
  fx: Fx[] = []
  hype = 0
  netSwish = 0
  rimShake = 0
  /** camera shake 0..1 */
  shake = 0
  hitstop = 0
  /** 0..1, how much the camera should punch in (dunks) */
  focus = 0
  timeScale = 1
  winner: Team | null = null
  /** the TEB mascot pops up to celebrate the player's big plays */
  mascot: { kind: MascotKind; t: number } | null = null

  private pending: Team | null = null
  private overPending = false
  private practiceReturnT = -1
  private buzzerShot = false

  constructor(cfg: MatchConfig) {
    this.mode = cfg.mode
    this.practice = cfg.mode === 'practice'
    this.home = cfg.home
    this.away = cfg.away
    this.brain = cfg.brain
    this.clock = cfg.duration
    this.athletes = this.away ? [this.home, this.away] : [this.home]
    this.home.x = 330
    this.home.z = 0.55
    if (this.away) {
      this.away.x = 520
      this.away.z = 0.45
      this.away.facing = -1
    }
    this.ball.holder = 'home'
  }

  /* ---------- helpers ---------- */

  athlete(team: Team): Athlete {
    return team === 'home' ? this.home : (this.away ?? this.home)
  }
  other(a: Athlete): Athlete | null {
    if (!this.away) return null
    return a === this.home ? this.away : this.home
  }
  distToHoop(a: { x: number; z: number }) {
    return Math.hypot(HOOP_X - a.x, (a.z - HOOP_Z) * DEPTH)
  }
  private emit(s: Sfx) {
    this.events.push(s)
  }
  private cheer(kind: MascotKind, team: Team) {
    // only the player's big plays; a plain 2-pointer doesn't summon the mascot
    if (team !== 'home' || kind === 'score') return
    // keep it special: routine plays at most every 6 s, the big moments always
    const big = kind === 'dunk' || kind === 'fire' || kind === 'buzzer' || kind === 'win'
    if (!big && this.realTime - this.lastMascotAt < 6) return
    this.lastMascotAt = this.realTime
    this.mascot = { kind, t: 0 }
  }
  private lastMascotAt = -99
  private addFx(f: Fx) {
    this.fx.push(f)
  }
  private setBanner(text: string, isKey: boolean, color: string, dur = 1.3, sub?: TKey, subText?: string) {
    this.banner = { text, isKey, color, t: 0, dur, sub, subText }
  }
  hasBall(a: Athlete) {
    return this.ball.state === 'held' && this.ball.holder === a.team
  }
  get rimFx() {
    return { x: HOOP_X, z: HOOP_Z, h: RIM_H }
  }

  shotChance(a: Athlete, kind: ShotKind, quality: ShotQuality = 'auto') {
    if (kind === 'power') return 1
    const d = this.distToHoop(a)
    let p = kind === 'dunk' ? 0.86 : clamp(0.82 - (d - 70) * 0.00135, 0.08, 0.82)
    p += a.stats.shoot + (a.onFire ? 0.1 : 0)
    if (kind === 'jump') p += QUALITY_BONUS[quality]
    const def = this.other(a)
    if (def && def.stunT <= 0 && def.fallT <= 0) {
      const dd = worldDist(a, def)
      if (dd < 100) {
        const between = (def.x - a.x) * (HOOP_X - a.x) > 0
        const c = (1 - dd / 100) * (between ? 0.3 : 0.12)
        p -= kind === 'dunk' ? c * 0.7 : c
      }
    }
    return clamp(p, 0.04, 0.97)
  }

  /** what the action button would do right now for this athlete */
  actionFor(a: Athlete): 'shoot' | 'dunk' | 'steal' | 'block' | null {
    if (this.phase !== 'live') return null
    if (this.hasBall(a)) return this.distToHoop(a) < DUNK_R ? 'dunk' : 'shoot'
    if (this.ball.state === 'held' && this.away) {
      const h = this.athlete(this.ball.holder!)
      if ((h.state === 'shoot' || h.state === 'dunk') && !h.released) return 'block'
      return 'steal'
    }
    return null
  }

  handPos(a: Athlete) {
    const s = persp(a.z)
    switch (a.shotKind) {
      case 'dunk':
        return { x: a.x + 28 * a.facing * s, h: a.h + 158 * s }
      case 'jump':
      case 'power':
        return { x: a.x + 15 * a.facing * s, h: a.h + 172 * s }
      default:
        return { x: a.x + 34 * a.facing * s, h: a.h + 80 * s }
    }
  }

  /* ---------- main loop ---------- */

  update(rawDt: number, input: Controls) {
    this.realTime += rawDt
    if (this.banner) {
      this.banner.t += rawDt
      if (this.banner.t > this.banner.dur) this.banner = null
    }
    this.shake = Math.max(0, this.shake - rawDt * 2.2)
    if (this.mascot) {
      this.mascot.t += rawDt
      if (this.mascot.t > MASCOT_TIME) this.mascot = null
    }
    this.focus = Math.max(0, this.focus - rawDt * 0.9)
    for (const a of this.athletes) if (a.meter) a.meter.t += rawDt

    let dt = rawDt
    if (this.hitstop > 0) {
      this.hitstop -= rawDt
      dt = 0
    }
    const b = this.ball
    const dramatic = (this.buzzerShot || this.golden) && (b.state === 'flight' || b.state === 'rattle')
    this.timeScale += ((dramatic ? 0.38 : 1) - this.timeScale) * Math.min(1, rawDt * 10)
    dt *= this.timeScale

    this.time += dt
    this.hype = Math.max(0, this.hype - dt * 0.4)
    this.netSwish = Math.max(0, this.netSwish - dt * 2.2)
    this.rimShake = Math.max(0, this.rimShake - dt * 3.5)

    switch (this.phase) {
      case 'intro':
        this.phaseT += dt
        this.updateBodies(dt)
        this.updateBall(dt)
        if (this.phaseT >= (this.practice ? 1.6 : 2.6)) this.startTipoff()
        break
      case 'tipoff':
        this.updateTipoff(dt)
        break
      case 'live':
        this.updateLive(dt, input)
        break
      case 'pause':
        this.phaseT -= dt
        this.updateBodies(dt)
        this.updateBall(dt)
        if (this.phaseT <= 0) this.afterPause()
        break
      case 'over':
        this.phaseT += dt
        this.updateBodies(dt)
        this.updateBall(dt)
        break
    }
  }

  private startTipoff() {
    if (this.practice) {
      this.resetPossession('home')
      return
    }
    const away = this.away!
    this.phase = 'tipoff'
    this.phaseT = 0
    this.home.x = 395
    this.home.z = 0.5
    this.home.facing = 1
    away.x = 445
    away.z = 0.5
    away.facing = -1
    for (const a of this.athletes) a.setState('idle')
    const b = this.ball
    b.state = 'dead'
    b.holder = null
    b.x = 420
    b.z = 0.5
    b.h = 120
    b.vx = 0
    b.vz = 0
    b.vh = 640
    this.emit('whistle')
  }

  private updateTipoff(dt: number) {
    const prev = this.phaseT
    this.phaseT += dt
    if (prev < 0.42 && this.phaseT >= 0.42) {
      for (const a of this.athletes) {
        a.vh = 430
        a.setState('block')
      }
      this.emit('jump')
    }
    this.updateBodies(dt)
    const b = this.ball
    b.vh -= GRAVITY * dt
    b.h += b.vh * dt
    b.spin += dt * 6
    if (this.phaseT >= 0.78) {
      const winner: Team = Math.random() < 0.5 ? 'home' : 'away'
      b.state = 'held'
      b.holder = winner
      this.addFx({ type: 'steal', x: b.x, z: b.z, h: b.h })
      this.setBanner(winner === 'home' ? 'yourBall' : 'theirBall', true, winner === 'home' ? '#4da3ff' : '#ff6b5b', 1.1)
      this.toPause(1.0, winner)
    }
  }

  private updateLive(dt: number, input: Controls) {
    const b = this.ball
    if (!this.clockEnded && !this.golden) {
      this.clock -= dt
      if (this.clock <= 0) {
        this.clock = 0
        this.clockEnded = true
        this.emit('buzzer')
        // a shot already in the air can still win it
        if (b.state === 'flight' || b.state === 'rattle' || this.athletes.some((a) => a.busy && !a.released)) this.buzzerShot = true
      }
    }
    if (!this.practice && b.state === 'held' && !this.athlete(b.holder!).busy) {
      this.shotClock -= dt
      if (this.shotClock <= 0) {
        this.shotClock = 0
        const loser = this.athlete(b.holder!)
        this.turnover(this.other(loser)!.team, 'shotClock')
        return
      }
    }
    for (const a of this.athletes) {
      const rate = (this.practice ? 1.8 : 1) * (a.onFire ? 1.8 : 1)
      a.power = Math.min(1, a.power + (dt / POWER_FILL_SECONDS) * rate)
    }

    this.control(this.home, input, dt)
    if (this.away && this.brain) {
      const c = dt > 0 ? this.brain.think(this, this.away, this.home, dt) : NO_INPUT
      this.control(this.away, c, dt)
    }

    this.updateBodies(dt)
    this.separate()
    this.updateBall(dt)

    if (this.practice && this.practiceReturnT >= 0) {
      this.practiceReturnT -= dt
      if (this.practiceReturnT < 0) this.giveBall(this.home)
    }
    if (this.practice && b.state === 'loose' && b.looseT > 2.2) this.giveBall(this.home)

    if (this.phase === 'live' && this.clockEnded && !this.golden && b.state !== 'flight' && b.state !== 'rattle' && !this.athletes.some((a) => a.busy && !a.released)) {
      this.endRegulation()
    }
  }

  private control(a: Athlete, c: Controls, dt: number) {
    if (this.phase !== 'live') return
    // shot timing: release when the button is let go
    if (a.state === 'shoot' && !a.released && a.shotHeld) {
      if (!c.actionHeld) {
        a.shotHeld = false
        if (a.stateT < TAP_T) a.autoRelease = true
        else this.release(a, judgeRelease(a.stateT))
      } else if (a.stateT >= MAX_HOLD) {
        a.shotHeld = false
        this.release(a, 'late')
      }
      return
    }
    if (a.busy || a.fallT > 0 || dt === 0) return

    const hasBall = this.hasBall(a)
    let mx = c.mx
    let mz = c.mz
    const len = Math.hypot(mx, mz)
    if (len > 1) {
      mx /= len
      mz /= len
    }
    let speed = 235 * a.stats.speed * (hasBall ? 0.9 : 1)
    if (a.stunT > 0) speed *= 0.35
    if (a.state === 'reach') speed *= 0.5
    if (a.h > 0) speed *= 0.4
    a.vx = mx * speed
    a.vz = (mz * speed * 0.85) / DEPTH
    a.x = clamp(a.x + a.vx * dt, X_MIN, X_MAX)
    a.z = clamp(a.z + a.vz * dt, 0.04, 0.96)
    if (a.moveT > 0) {
      // crossover burst
      a.z = clamp(a.z + a.moveDir * 1.35 * dt, 0.04, 0.96)
      a.x = clamp(a.x + a.facing * 95 * dt, X_MIN, X_MAX)
    }
    const moving = len > 0.1
    if (moving) {
      a.anim += (dt * speed) / 26
      if (a.state === 'idle') a.setState('run')
    } else if (a.state === 'run') a.setState('idle')
    if (moving && a.turned(mx) && a.h === 0) {
      if (Math.random() < 0.7) this.emit('squeak')
      this.addFx({ type: 'dust', x: a.x, z: a.z, h: 0 })
    }

    const foe = this.other(a)
    if (mx > 0.1) a.facing = 1
    else if (mx < -0.1) a.facing = -1
    else if (!moving) {
      if (hasBall) a.facing = a.x <= HOOP_X ? 1 : -1
      else if (foe) a.facing = foe.x >= a.x ? 1 : -1
    }

    if (hasBall && a.h === 0) {
      if (c.move && a.moveCd <= 0) this.startCross(a, c.mz)
      else if (c.power && a.power >= 1) this.startShot(a, 'power', false)
      else if (c.action) this.startShot(a, this.distToHoop(a) < DUNK_R ? 'dunk' : 'jump', c.actionHeld)
    } else if (c.action && this.ball.state === 'held' && this.ball.holder !== a.team) {
      const h = this.athlete(this.ball.holder!)
      if ((h.state === 'shoot' || h.state === 'dunk') && !h.released && h.shotKind !== 'power') this.tryBlock(a)
      else this.trySteal(a)
    }
  }

  private startShot(a: Athlete, kind: ShotKind, held: boolean) {
    a.setState(kind === 'dunk' ? 'dunk' : 'shoot')
    a.shotKind = kind
    a.released = false
    a.shotHeld = held && kind === 'jump'
    a.autoRelease = !a.shotHeld
    a.quality = a === this.away && this.brain && kind === 'jump' ? this.brain.rollQuality() : 'auto'
    a.facing = a.x <= HOOP_X ? 1 : -1
    a.vx = 0
    a.vz = 0
    a.moveT = 0
    if (kind === 'dunk') {
      a.vh = 420
      a.dunkFrom = { x: a.x, z: a.z }
      this.emit('jump')
      this.focus = 1
    } else if (kind === 'power') {
      a.vh = 420
      a.power = 0
      this.emit('power')
      this.addFx({ type: 'fireStart', x: a.x, z: a.z, h: 80 })
    } else {
      a.vh = 390
      this.emit('jump')
    }
    this.addFx({ type: 'dust', x: a.x, z: a.z, h: 0 })
  }

  private startCross(a: Athlete, mz: number) {
    const foe = this.other(a)
    a.moveT = 0.34
    a.moveCd = CROSS_COOLDOWN
    a.moveDir = mz !== 0 ? Math.sign(mz) : foe ? (foe.z > a.z ? -1 : 1) : a.z > 0.5 ? -1 : 1
    if ((a.moveDir < 0 && a.z < 0.12) || (a.moveDir > 0 && a.z > 0.88)) a.moveDir = -a.moveDir
    this.emit('squeak')
    this.addFx({ type: 'dust', x: a.x, z: a.z, h: 0 })
    if (!foe || foe.fallT > 0 || foe.h > 0) return
    const d = worldDist(a, foe)
    if (d > 95) return
    let p = 0.12 + (a.level - foe.level) * 0.006 + a.stats.shoot * 0.4
    if (foe.stunT > 0 || foe.state === 'reach') p += 0.3
    p = clamp(p, 0.1, 0.75)
    if (Math.random() < p) {
      foe.fallT = 0.95
      foe.setState('fall')
      foe.vx = 0
      this.setBanner('ankleBanner', true, a.team === 'home' ? '#4da3ff' : '#ff6b5b', 1.2)
      this.cheer('ankle', a.team)
      this.emit('ooh')
      this.addFx({ type: 'ankle', x: foe.x, z: foe.z, h: 0 })
      this.hype = Math.max(this.hype, 0.75)
      this.hitstop = 0.1
      this.shake = Math.max(this.shake, 0.35)
    }
  }

  private release(a: Athlete, q: ShotQuality) {
    a.released = true
    a.quality = q
    const kind = a.shotKind!
    const b = this.ball
    const hand = this.handPos(a)
    b.lastShooter = a.team
    b.trail = []
    this.stats[a.team].attempts++
    if (kind === 'jump' && q !== 'auto') {
      a.meter = { q, t: 0, at: a.stateT }
      if (q === 'perfect') {
        this.stats[a.team].perfects++
        if (a === this.home) this.emit('perfect')
      }
    }

    // block check
    const def = this.other(a)
    if (def && def.state === 'block' && def.h > 12 && kind !== 'power') {
      const dd = worldDist(a, def)
      if (dd < 82) {
        let p = 0.62 - dd / 160 + def.stats.steal
        if (kind === 'dunk') p *= 0.6
        if (Math.random() < clamp(p, 0.05, 0.7)) {
          b.state = 'loose'
          b.holder = null
          b.flight = null
          b.looseT = 0
          b.x = hand.x
          b.z = a.z
          b.h = hand.h
          b.vx = -a.facing * (240 + Math.random() * 160)
          b.vz = (Math.random() - 0.5) * 0.8
          b.vh = 140 + Math.random() * 140
          this.stats[def.team].blocks++
          this.emit('block')
          this.addFx({ type: 'block', x: hand.x, z: a.z, h: hand.h })
          this.setBanner('blockBanner', true, def.team === 'home' ? '#4da3ff' : '#ff6b5b', 1.1)
          this.cheer('block', def.team)
          this.hitstop = 0.09
          this.shake = Math.max(this.shake, 0.5)
          this.hype = Math.max(this.hype, 0.8)
          if (kind === 'dunk') a.setState('idle')
          return
        }
      }
    }

    const d = kind === 'dunk' ? 0 : this.distToHoop(a)
    const points = kind === 'dunk' ? 2 : d > THREE_R ? 3 : 2
    const willScore = Math.random() < this.shotChance(a, kind, q)
    b.state = 'flight'
    b.holder = null
    const miss = (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 6)
    b.flight = {
      sx: hand.x,
      sz: a.z,
      sh: hand.h,
      tx: HOOP_X + (willScore ? 0 : miss),
      tz: HOOP_Z,
      th: RIM_H + (willScore ? 4 : 8),
      t: 0,
      dur: kind === 'dunk' ? 0.14 : kind === 'power' ? 0.8 + d / 1700 : 0.7 + d / 1500,
      peak: kind === 'dunk' ? 4 : kind === 'power' ? 60 + d * 0.18 : 40 + d * 0.16,
      willScore,
      points,
      kind,
      shooter: a.team,
    }
  }

  private tryBlock(a: Athlete) {
    if (a.blockCd > 0 || a.h > 0 || a.stunT > 0) return
    a.setState('block')
    a.blockCd = 1.0
    a.vh = 440
    this.emit('jump')
  }

  private trySteal(a: Athlete) {
    if (a.stealCd > 0 || a.h > 0 || a.stunT > 0) return
    a.setState('reach')
    a.stealCd = 0.85
    this.emit('swipe')
    const handler = this.athlete(this.ball.holder!)
    const d = worldDist(a, handler)
    if (handler.busy || d > 75 || handler.moveT > 0) {
      a.stunT = d > 75 ? 0.15 : 0.35
      return
    }
    let p = 0.3 + a.stats.steal - handler.stats.steal * 0.5
    if (Math.abs(a.z - handler.z) * DEPTH < 25) p += 0.06
    p = clamp(p, 0.1, 0.6)
    if (Math.random() < p) {
      this.stats[a.team].steals++
      a.power = Math.min(1, a.power + 0.2)
      handler.stunT = 0.3
      this.ball.holder = a.team
      this.emit('steal')
      this.addFx({ type: 'steal', x: this.ball.x, z: this.ball.z, h: this.ball.h })
      this.setBanner('stealBanner', true, a.team === 'home' ? '#4da3ff' : '#ff6b5b', 1.1)
      this.cheer('steal', a.team)
      this.toPause(1.0, a.team)
    } else {
      a.stunT = 0.45
    }
  }

  private updateBodies(dt: number) {
    for (const a of this.athletes) {
      a.stateT += dt
      a.landT += dt
      a.stealCd = Math.max(0, a.stealCd - dt)
      a.blockCd = Math.max(0, a.blockCd - dt)
      a.stunT = Math.max(0, a.stunT - dt)
      a.moveT = Math.max(0, a.moveT - dt)
      a.moveCd = Math.max(0, a.moveCd - dt)
      if (a.fallT > 0) {
        a.fallT -= dt
        if (a.fallT <= 0) {
          a.fallT = 0
          a.setState('idle')
        }
      }

      if (a.state === 'hang') {
        a.hangT -= dt
        a.vh = 0
        if (a.hangT <= 0) {
          a.setState('idle')
          a.shotKind = null
          a.vh = -40
        }
      } else if (a.h > 0 || a.vh > 0) {
        const fallSpeed = a.vh
        a.vh -= GRAVITY * dt
        a.h += a.vh * dt
        if (a.h <= 0) {
          a.h = 0
          a.vh = 0
          a.landT = 0
          if (fallSpeed < -250) this.addFx({ type: 'land', x: a.x, z: a.z, h: 0, big: fallSpeed < -420 })
          if (a.state === 'block') a.setState('idle')
        }
      }

      if (a.state === 'shoot' || a.state === 'dunk') {
        const kind = a.shotKind!
        const rt = RELEASE_T[kind]
        if (a.state === 'dunk' && !a.released) {
          const u = Math.min(1, a.stateT / rt)
          const e = 1 - (1 - u) * (1 - u)
          a.x = lerp(a.dunkFrom.x, HOOP_X - 22, e)
          a.z = lerp(a.dunkFrom.z, HOOP_Z, e)
        }
        if (!a.released && a.autoRelease && a.stateT >= rt && this.phase === 'live') this.release(a, a.quality)
        if (a.released && a.h === 0 && a.stateT > 0.1) {
          a.setState('idle')
          a.shotKind = null
        }
      } else if (a.state === 'reach' && a.stateT > 0.28) {
        a.setState('idle')
      } else if (a.state === 'celebrate' && a.h === 0 && Math.random() < dt * 1.6) {
        a.vh = 300
      }
    }
  }

  private separate() {
    const a = this.home
    const b = this.away
    if (!b || a.busy || b.busy || a.fallT > 0 || b.fallT > 0) return
    const dx = b.x - a.x
    const dz = (b.z - a.z) * DEPTH
    let d = Math.hypot(dx, dz)
    const min = 46
    if (d >= min) return
    let nx = 1
    let nz = 0
    if (d > 0.001) {
      nx = dx / d
      nz = dz / d
    } else d = 0
    const push = (min - d) / 2
    a.x = clamp(a.x - nx * push, X_MIN, X_MAX)
    a.z = clamp(a.z - (nz * push) / DEPTH, 0.04, 0.96)
    b.x = clamp(b.x + nx * push, X_MIN, X_MAX)
    b.z = clamp(b.z + (nz * push) / DEPTH, 0.04, 0.96)
  }

  private updateBall(dt: number) {
    const b = this.ball
    b.squash = Math.max(0, b.squash - dt * 6)
    switch (b.state) {
      case 'held': {
        const a = this.athlete(b.holder!)
        const s = persp(a.z)
        b.z = a.z + 0.004
        if (a.busy && !a.released) {
          const u = Math.min(1, a.stateT / RELEASE_T[a.shotKind!])
          const hand = this.handPos(a)
          b.x = lerp(a.x + 26 * a.facing * s, hand.x, u)
          b.h = lerp(a.h + 95 * s, hand.h + BALL_R, u)
        } else if (a.moveT > 0) {
          // crossover: ball whips low across the body
          const u = 1 - a.moveT / 0.34
          b.x = a.x + lerp(34, -6, Math.sin(u * Math.PI)) * a.facing * s
          b.h = a.h + BALL_R + 22 * s * Math.abs(Math.cos(u * Math.PI * 2))
          if (u > 0.45 && u < 0.55) this.emit('dribble')
        } else if (this.phase === 'live' || this.phase === 'pause' || this.phase === 'intro') {
          const moving = a.state === 'run'
          const prev = b.dribble
          b.dribble += dt * (moving ? 2.7 : 1.9)
          if (Math.floor(prev + 0.5) !== Math.floor(b.dribble + 0.5)) {
            this.emit('dribble')
            b.squash = 0.5
          }
          const p = b.dribble % 1
          const handH = 80 * s
          b.x = a.x + 34 * a.facing * s
          b.h = a.h + BALL_R + (handH - BALL_R) * Math.abs(Math.cos(p * Math.PI))
        } else {
          b.x = a.x + 22 * a.facing * s
          b.h = a.h + 92 * s
        }
        b.spin += dt * 3
        break
      }
      case 'flight': {
        const f = b.flight!
        f.t += dt
        const u = Math.min(1, f.t / f.dur)
        b.x = lerp(f.sx, f.tx, u)
        b.z = lerp(f.sz, f.tz, u)
        b.h = lerp(f.sh, f.th, u) + 4 * f.peak * u * (1 - u)
        b.spin += dt * 9
        b.trail.push({ x: b.x, y: b.h })
        if (b.trail.length > (f.kind === 'power' ? 16 : 7)) b.trail.shift()
        if (u >= 1) this.arriveAtRim()
        break
      }
      case 'rattle': {
        const r = b.rattle
        const hopDur = 0.22
        const prevHop = Math.floor(r.t / hopDur)
        r.t += dt
        const hop = Math.floor(r.t / hopDur)
        const u = (r.t % hopDur) / hopDur
        b.x = HOOP_X + 13 * Math.cos(Math.PI * (hop + u))
        b.z = HOOP_Z
        b.h = RIM_H + 9 + Math.sin(Math.PI * u) * Math.max(8, 26 - hop * 9)
        b.spin += dt * 5
        if (hop !== prevHop && hop < r.hops) {
          this.emit('rim')
          this.rimShake = 0.6
        }
        if (r.t >= r.hops * hopDur) this.resolveShot()
        break
      }
      case 'through':
      case 'loose':
      case 'dead': {
        b.looseT += dt
        b.vh -= GRAVITY * dt
        b.h += b.vh * dt
        if (b.h <= BALL_R) {
          b.h = BALL_R
          if (b.vh < -90) {
            b.squash = Math.min(1, -b.vh / 600)
            b.vh = -b.vh * 0.58
            this.emit('bounce')
          } else b.vh = 0
          b.vx *= 1 - Math.min(1, 1.6 * dt)
          b.vz *= 1 - Math.min(1, 1.6 * dt)
          if (b.state === 'through') b.state = 'dead'
        }
        b.x += b.vx * dt
        b.z += b.vz * dt
        if (b.x < X_MIN) {
          b.x = X_MIN
          b.vx = Math.abs(b.vx) * 0.5
        }
        if (b.x > BASELINE_X + 10) {
          b.x = BASELINE_X + 10
          b.vx = -Math.abs(b.vx) * 0.5
        }
        if (b.z < 0.03 || b.z > 0.97) {
          b.z = clamp(b.z, 0.03, 0.97)
          b.vz = -b.vz * 0.5
        }
        b.spin += b.vx * dt * 0.05
        if (b.trail.length) b.trail.shift()
        if (b.state === 'loose' && this.phase === 'live') this.checkPickup()
        break
      }
    }
  }

  /** ball reached the rim: maybe rattle around first */
  private arriveAtRim() {
    const b = this.ball
    const f = b.flight!
    const rattle = f.kind === 'jump' && Math.random() < (f.willScore ? 0.22 : 0.5)
    if (rattle) {
      b.state = 'rattle'
      b.rattle = { t: 0, hops: 1 + (Math.random() < 0.45 ? 1 : 0) }
      this.emit('rim')
      this.rimShake = 0.8
      return
    }
    this.resolveShot()
  }

  private resolveShot() {
    const b = this.ball
    const f = b.flight!
    b.flight = null
    b.trail = []
    if (f.willScore) {
      b.state = 'through'
      b.x = HOOP_X
      b.z = HOOP_Z
      b.h = RIM_H
      b.vx = 0
      b.vz = 0
      b.vh = -70
      this.netSwish = 1
      if (f.kind === 'dunk') {
        const s = this.athlete(f.shooter)
        if (s.state === 'dunk') {
          s.setState('hang')
          s.hangT = 0.42
          s.vh = 0
          s.x = HOOP_X - 22 * s.facing
          s.h = Math.max(0, RIM_H - 150 * persp(s.z))
        }
        this.emit('dunk')
        this.rimShake = 1.4
        this.shake = 1
        this.hitstop = 0.1
        this.addFx({ type: 'dunk', ...this.rimFx })
      } else {
        this.emit('swish')
        this.addFx({ type: 'swish', ...this.rimFx })
      }
      this.scored(f.shooter, f.points, f.kind)
    } else {
      this.emit('rim')
      this.rimShake = 1
      b.state = 'loose'
      b.looseT = 0
      b.vx = -(130 + Math.random() * 230)
      b.vz = (Math.random() - 0.5) * 0.9
      b.vh = 280 + Math.random() * 200
      if (this.practice) {
        const s = this.athlete(f.shooter)
        s.streak = 0
        s.onFire = false
      }
      if (this.buzzerShot) this.emit('ooh')
    }
  }

  private checkPickup() {
    const b = this.ball
    if (b.looseT < 0.15) return
    for (const a of this.athletes) {
      if (a.busy || a.stunT > 0 || a.fallT > 0) continue
      if (worldDist(a, b) < 38 && b.h < a.h + 125 * persp(a.z)) {
        this.grab(a)
        return
      }
    }
  }

  private grab(a: Athlete) {
    const b = this.ball
    b.state = 'held'
    b.holder = a.team
    b.trail = []
    if (this.practice || a.team === b.lastShooter) {
      this.shotClock = Math.max(this.shotClock, SHOT_CLOCK * 0.6)
      this.possession = a.team
      this.emit('dribble')
    } else {
      this.setBanner('rebound', true, a.team === 'home' ? '#4da3ff' : '#ff6b5b', 0.9)
      this.toPause(0.8, a.team)
    }
  }

  private giveBall(a: Athlete) {
    this.practiceReturnT = -1
    const b = this.ball
    b.state = 'held'
    b.holder = a.team
    b.trail = []
    this.emit('dribble')
  }

  private scored(team: Team, points: number, kind: ShotKind) {
    this.score[team] += points
    const st = this.stats[team]
    st.makes++
    if (kind === 'dunk') st.dunks++
    if (points === 3) st.threes++
    const color = team === 'home' ? '#ffd23f' : '#ff6b5b'
    const sub = `+${points}`
    const shooter = this.athlete(team)
    this.cheer(this.buzzerShot ? 'buzzer' : kind === 'power' ? 'power' : kind === 'dunk' ? 'dunk' : points === 3 ? 'three' : shooter.quality === 'perfect' ? 'perfect' : 'score', team)
    if (this.buzzerShot) this.setBanner('buzzerBeater', true, '#ffc93c', 2, undefined, sub)
    else if (kind === 'power') this.setBanner('powerBanner', true, '#ffb02e', 1.4, undefined, sub)
    else if (kind === 'dunk') this.setBanner('dunkBanner', true, color, 1.4, undefined, sub)
    else if (points === 3) this.setBanner('threeBanner', true, color, 1.4, undefined, sub)
    else if (shooter.quality === 'perfect') this.setBanner('perfect', true, '#7dff9a', 1.1, undefined, sub)
    this.addFx({ type: 'text', ...this.rimFx, h: RIM_H + 30, text: sub, color })
    this.addFx({ type: 'flash', x: 0, z: 0, h: 0 })
    this.hype = 1
    this.emit('cheer')

    // streak / on fire
    shooter.streak++
    const foe = this.other(shooter)
    if (foe) {
      foe.streak = 0
      foe.onFire = false
    }
    if (!shooter.onFire && shooter.streak >= 3) {
      this.cheer('fire', team)
      shooter.onFire = true
      this.emit('fire')
      this.addFx({ type: 'text', x: shooter.x, z: shooter.z, h: 210, key: 'onFire', color: '#ff8a1f', big: true })
      this.addFx({ type: 'fireStart', x: shooter.x, z: shooter.z, h: 80 })
    }

    if (this.practice) {
      this.practiceReturnT = 0.9
      return
    }
    if (this.golden || this.buzzerShot) {
      this.overPending = true
      this.toPause(this.buzzerShot && !this.golden ? 2 : 1.8, null)
    } else {
      this.toPause(1.4, team === 'home' ? 'away' : 'home')
    }
  }

  private turnover(team: Team, key: TKey) {
    this.ball.state = 'held'
    this.ball.holder = team
    this.emit('whistle')
    this.setBanner(key, true, '#ffffff', 1.2)
    this.toPause(1.2, team)
  }

  private toPause(t: number, next: Team | null) {
    this.phase = 'pause'
    this.phaseT = t
    this.pending = next
  }

  private afterPause() {
    if (this.overPending) {
      // a buzzer beater only ends it if it actually decided the game
      if (this.golden || this.score.home !== this.score.away || this.practice) return this.finish()
      this.overPending = false
    }
    if (this.clockEnded && !this.golden) return this.endRegulation()
    this.resetPossession(this.pending ?? 'home')
  }

  private endRegulation() {
    this.buzzerShot = false
    if (this.practice || this.score.home !== this.score.away) return this.finish()
    this.golden = true
    this.setBanner('goldenBasket', true, '#ffc93c', 2.2, 'goldenSub')
    this.resetPossession(this.pending ?? (Math.random() < 0.5 ? 'home' : 'away'))
  }

  private finish() {
    this.phase = 'over'
    this.phaseT = 0
    this.buzzerShot = false
    this.winner = this.practice ? null : this.score.home > this.score.away ? 'home' : 'away'
    for (const a of this.athletes) {
      a.shotKind = null
      a.fallT = 0
      a.setState(this.practice || a.team === this.winner ? 'celebrate' : 'sad')
    }
    if (!this.clockEnded) this.emit('buzzer')
    this.emit('cheer')
    if (this.practice || this.winner === 'home') {
      this.addFx({ type: 'confetti', x: 0, z: 0, h: 0 })
      this.cheer('win', 'home')
    }
  }

  private resetPossession(team: Team) {
    const att = this.athlete(team)
    const def = this.other(att)
    const place = (a: Athlete, x: number, z: number, facing: 1 | -1) => {
      a.x = x
      a.z = z
      a.h = 0
      a.vh = 0
      a.facing = facing
      a.stunT = 0
      a.fallT = 0
      a.moveT = 0
      a.shotKind = null
      a.released = false
      a.shotHeld = false
      a.setState('idle')
    }
    place(att, 330, 0.5, 1)
    if (def) place(def, 480, 0.5, -1)
    const b = this.ball
    b.state = 'held'
    b.holder = team
    b.trail = []
    b.flight = null
    this.shotClock = SHOT_CLOCK
    this.possession = team
    this.phase = 'live'
    this.practiceReturnT = -1
    if (this.away && this.brain) this.brain.reset(this.away)
  }

  summary(): MatchSummary {
    const st = this.stats.home
    return {
      mode: this.mode,
      playerScore: this.score.home,
      opponentScore: this.score.away,
      makes: st.makes,
      attempts: st.attempts,
      dunks: st.dunks,
      steals: st.steals,
      blocks: st.blocks,
      perfects: st.perfects,
      opponentName: this.away?.name ?? '',
    }
  }
}
