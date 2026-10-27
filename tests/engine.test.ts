import { afterEach, describe, expect, it, vi } from 'vitest'
import { DUNK_R, HOOP_X, HOOP_Z, SHOT_CLOCK } from '../src/game/constants'
import { MAX_HOLD, Match, NO_INPUT, PERFECT_T, judgeRelease, type Athlete, type Controls, type NpcBrain } from '../src/game/engine'
import { DT, athlete, bareMatch, fixRandom, giveBall, seedRandom, stepUntil } from './helpers'

afterEach(() => {
  vi.restoreAllMocks()
})

const press = (extra: Partial<Controls> = {}): Controls => ({ ...NO_INPUT, ...extra })
type Internals = { scored(team: 'home' | 'away', points: number, kind: 'jump' | 'dunk' | 'power'): void; cheer(kind: string, team: 'home' | 'away'): void }
const internals = (m: Match) => m as unknown as Internals

describe('Silnik: przebieg meczu', () => {
  it('T-EN-01 mecz startuje od intro, potem rzut sędziowski, potem gra', () => {
    seedRandom(1)
    const m = bareMatch()
    expect(m.phase).toBe('intro')
    expect(stepUntil(m, () => m.phase === 'tipoff')).toBe(true)
    expect(stepUntil(m, () => m.phase === 'live')).toBe(true)
    expect(['home', 'away']).toContain(m.possession)
  })

  it('T-EN-02 rzut sędziowski jest losowy — w 40 meczach piłkę dostają obie strony', () => {
    const won = { home: 0, away: 0 }
    for (let s = 0; s < 40; s++) {
      seedRandom(100 + s)
      const m = bareMatch()
      stepUntil(m, () => m.phase === 'live')
      won[m.possession]++
      vi.restoreAllMocks()
    }
    expect(won.home).toBeGreaterThan(5)
    expect(won.away).toBeGreaterThan(5)
  })

  it('T-EN-03 trening: bez przeciwnika, bez rzutu sędziowskiego, kończy się po czasie bez zwycięzcy', () => {
    seedRandom(2)
    const m = new Match({ mode: 'practice', home: athlete('home'), away: null, brain: null, duration: 120 })
    expect(m.away).toBeNull()
    stepUntil(m, () => m.phase !== 'intro')
    expect(m.phase).toBe('live')
    expect(stepUntil(m, () => m.phase === 'over', NO_INPUT, 130)).toBe(true)
    expect(m.winner).toBeNull()
  })

  it('T-EN-04 zegar akcji: po 14 s bez rzutu piłka przechodzi do rywala', () => {
    seedRandom(3)
    const m = bareMatch()
    giveBall(m, 'home')
    let banner = ''
    for (let i = 0; i < (SHOT_CLOCK + 3) / DT; i++) {
      m.update(DT, NO_INPUT)
      if (m.banner?.text === 'shotClock') banner = 'shotClock'
      if (m.possession === 'away' && m.phase === 'live') break
    }
    expect(banner).toBe('shotClock')
    expect(m.possession).toBe('away')
  })

  it('T-EN-05 remis po czasie → złoty kosz; pierwszy kosz kończy mecz', () => {
    seedRandom(4)
    const m = bareMatch()
    giveBall(m, 'home')
    m.score = { home: 10, away: 10 }
    m.clock = 0.05
    stepUntil(m, () => m.golden)
    expect(m.golden).toBe(true)
    expect(m.phase).toBe('live')
    internals(m).scored('away', 2, 'jump')
    expect(stepUntil(m, () => m.phase === 'over')).toBe(true)
    expect(m.winner).toBe('away')
    expect(m.score).toEqual({ home: 10, away: 12 })
  })

  it('T-EN-06 buzzer beater: rzut w powietrzu w chwili syreny się liczy i wygrywa mecz', () => {
    fixRandom(0) // każdy rzut trafia
    const m = bareMatch()
    giveBall(m, 'home')
    m.score = { home: 10, away: 12 }
    m.clock = 0.4
    m.update(DT, press({ action: true, actionHeld: true }))
    let sawBuzzerBanner = false
    for (let i = 0; i < 8 / DT && m.phase !== 'over'; i++) {
      m.update(DT, NO_INPUT)
      if (m.banner?.text === 'buzzerBeater') sawBuzzerBanner = true
    }
    expect(m.phase).toBe('over')
    expect(m.score).toEqual({ home: 13, away: 12 })
    expect(m.winner).toBe('home')
    expect(sawBuzzerBanner).toBe(true)
  })
})

describe('Silnik: rzuty', () => {
  it('T-EN-07 okno idealnego rzutu: ±0,045 s od szczytu wyskoku', () => {
    expect(judgeRelease(PERFECT_T)).toBe('perfect')
    expect(judgeRelease(PERFECT_T + 0.04)).toBe('perfect')
    expect(judgeRelease(PERFECT_T - 0.08)).toBe('good')
    expect(judgeRelease(PERFECT_T - 0.2)).toBe('early')
    expect(judgeRelease(PERFECT_T + 0.2)).toBe('late')
  })

  it('T-EN-08 przytrzymanie i puszczenie na szczycie = rzut „IDEALNIE”', () => {
    seedRandom(5)
    const m = bareMatch()
    giveBall(m, 'home')
    m.update(DT, press({ action: true, actionHeld: true }))
    const frames = Math.round(PERFECT_T / DT) - 1
    for (let i = 0; i < frames; i++) m.update(DT, press({ actionHeld: true }))
    m.update(DT, NO_INPUT)
    expect(m.home.released).toBe(true)
    expect(m.home.meter?.q).toBe('perfect')
    expect(m.stats.home.perfects).toBe(1)
  })

  it('T-EN-09 szybkie kliknięcie = zwykły rzut bez celownika', () => {
    seedRandom(6)
    const m = bareMatch()
    giveBall(m, 'home')
    m.update(DT, press({ action: true, actionHeld: true }))
    stepUntil(m, () => m.home.released, NO_INPUT, 2)
    expect(m.home.quality).toBe('auto')
    expect(m.home.meter).toBeNull()
  })

  it('T-EN-10 zbyt długie trzymanie → automatyczne „ZA PÓŹNO”', () => {
    seedRandom(7)
    const m = bareMatch()
    giveBall(m, 'home')
    m.update(DT, press({ action: true, actionHeld: true }))
    stepUntil(m, () => m.home.released, press({ actionHeld: true }), MAX_HOLD + 0.5)
    expect(m.home.meter?.q).toBe('late')
  })

  it('T-EN-11 szansa trafienia: bliżej = łatwiej, obrońca przeszkadza, wynik w [4%, 97%]', () => {
    const m = bareMatch()
    const shooter = m.home
    const def = m.away!
    def.x = 0
    shooter.z = HOOP_Z
    shooter.x = HOOP_X - 120
    const close = m.shotChance(shooter, 'jump')
    shooter.x = HOOP_X - 500
    const far = m.shotChance(shooter, 'jump')
    expect(close).toBeGreaterThan(far)
    def.x = shooter.x + 30
    def.z = shooter.z
    expect(m.shotChance(shooter, 'jump')).toBeLessThan(far)
    for (const x of [0, 200, 500, 800, 870]) {
      shooter.x = x
      const p = m.shotChance(shooter, 'jump', 'perfect')
      expect(p).toBeGreaterThanOrEqual(0.04)
      expect(p).toBeLessThanOrEqual(0.97)
    }
  })

  it('T-EN-12 powershot trafia zawsze (100%), nawet przy najgorszym losowaniu', () => {
    fixRandom(0.999)
    const m = bareMatch()
    giveBall(m, 'home')
    m.home.power = 1
    m.update(DT, press({ power: true }))
    expect(m.home.power).toBe(0) // pasek zużyty
    stepUntil(m, () => m.score.home > 0, NO_INPUT, 5)
    expect(m.score.home).toBe(3) // z daleka = za 3
    expect(m.shotChance(m.home, 'power')).toBe(1)
  })

  it('T-EN-13 wsad: blisko kosza akcja zmienia się we wsad, zawodnik wisi na obręczy, +2 pkt', () => {
    fixRandom(0)
    const m = bareMatch()
    giveBall(m, 'home')
    m.home.x = HOOP_X - 60
    m.home.z = HOOP_Z
    m.away!.x = 200
    expect(m.distToHoop(m.home)).toBeLessThan(DUNK_R)
    expect(m.actionFor(m.home)).toBe('dunk')
    m.update(DT, press({ action: true }))
    expect(m.home.state).toBe('dunk')
    expect(stepUntil(m, () => m.home.state === 'hang', NO_INPUT, 3)).toBe(true)
    expect(m.score.home).toBe(2)
    expect(m.stats.home.dunks).toBe(1)
  })
})

describe('Silnik: obrona i zagrania specjalne', () => {
  function stealSetup() {
    const m = bareMatch()
    giveBall(m, 'away')
    m.away!.x = 400
    m.away!.z = 0.5
    m.home.x = 360
    m.home.z = 0.5
    return m
  }

  it('T-EN-14 udany przechwyt zabiera piłkę, liczy się w statystykach i ładuje powershot', () => {
    fixRandom(0)
    const m = stealSetup()
    const powerBefore = m.home.power
    m.update(DT, press({ action: true }))
    expect(m.ball.holder).toBe('home')
    expect(m.stats.home.steals).toBe(1)
    expect(m.home.power).toBeGreaterThan(powerBefore)
    expect(m.phase).toBe('pause')
  })

  it('T-EN-15 nieudany przechwyt „zamraża” obrońcę — nie da się spamować', () => {
    fixRandom(0.99)
    const m = stealSetup()
    m.update(DT, press({ action: true }))
    expect(m.ball.holder).toBe('away')
    expect(m.home.stunT).toBeGreaterThan(0.3)
    expect(m.home.stealCd).toBeGreaterThan(0)
  })

  it('T-EN-16 przechwyt z daleka (> 75 px) nie ma szans', () => {
    fixRandom(0)
    const m = stealSetup()
    m.home.x = 200
    m.update(DT, press({ action: true }))
    expect(m.ball.holder).toBe('away')
    expect(m.stats.home.steals).toBe(0)
  })

  it('T-EN-17 blok: obrońca w powietrzu w chwili wypuszczenia piłki zbija rzut', () => {
    fixRandom(0)
    const blocker = {
      diff: 0.5,
      reset() {},
      rollQuality: () => 'auto',
      think: (_m: Match, me: Athlete, foe: Athlete) => ({ ...NO_INPUT, action: foe.state === 'shoot' && !foe.released && foe.stateT > 0.04 && me.h === 0 }),
    } as unknown as NpcBrain
    const m = new Match({ mode: 'quick', home: athlete('home'), away: athlete('away'), brain: blocker, duration: 180 })
    giveBall(m, 'home')
    m.home.x = 400
    m.home.z = 0.5
    m.away!.x = 440
    m.away!.z = 0.5
    m.update(DT, press({ action: true, actionHeld: true }))
    stepUntil(m, () => m.home.released, NO_INPUT, 2)
    expect(m.stats.away.blocks).toBe(1)
    expect(m.ball.state).toBe('loose')
    expect(m.banner?.text).toBe('blockBanner')
  })

  it('T-EN-18 zwód przy sięgającym obrońcy przewraca go („ZWÓD!”)', () => {
    fixRandom(0)
    const m = bareMatch()
    giveBall(m, 'home')
    m.home.x = 400
    m.away!.x = 440
    m.home.z = m.away!.z = 0.5
    m.away!.setState('reach')
    m.update(DT, press({ move: true }))
    expect(m.away!.state).toBe('fall')
    expect(m.away!.fallT).toBeGreaterThan(0)
    expect(m.banner?.text).toBe('ankleBanner')
    expect(m.home.moveCd).toBeGreaterThan(2)
  })

  it('T-EN-19 „W OGNIU”: 3 kosze z rzędu bez odpowiedzi, gaśnie po koszu rywala', () => {
    seedRandom(8)
    const m = bareMatch()
    giveBall(m, 'home')
    const s = internals(m)
    s.scored('home', 2, 'jump')
    s.scored('home', 2, 'jump')
    expect(m.home.onFire).toBe(false)
    s.scored('home', 2, 'jump')
    expect(m.home.onFire).toBe(true)
    expect(m.mascot?.kind).toBe('fire')
    expect(m.shotChance(m.home, 'jump') - (() => {
      m.home.onFire = false
      const v = m.shotChance(m.home, 'jump')
      m.home.onFire = true
      return v
    })()).toBeCloseTo(0.1, 5)
    s.scored('away', 2, 'jump')
    expect(m.home.onFire).toBe(false)
    expect(m.home.streak).toBe(0)
  })

  it('T-EN-20 maskotka: tylko akcje gracza, zwykłe max co 6 s, wielkie zawsze', () => {
    seedRandom(9)
    const m = bareMatch()
    const s = internals(m)
    s.cheer('three', 'away')
    expect(m.mascot).toBeNull()
    s.cheer('score', 'home')
    expect(m.mascot).toBeNull()
    s.cheer('steal', 'home')
    expect(m.mascot?.kind).toBe('steal')
    s.cheer('block', 'home')
    expect(m.mascot?.kind).toBe('steal') // za wcześnie
    s.cheer('dunk', 'home')
    expect(m.mascot?.kind).toBe('dunk') // wsad zawsze
  })
})
