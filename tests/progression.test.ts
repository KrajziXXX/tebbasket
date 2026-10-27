import { describe, expect, it } from 'vitest'
import {
  GEMS_PER_LEVEL, NPC_HANDICAP, REWARDS, applyXp, computeRewards, npcDifficulty, npcLevel, npcStats, statsForLevel, xpToNext,
} from '../src/lib/progression'

describe('Progresja: XP i poziomy', () => {
  it('T-PR-01 próg XP rośnie liniowo: 100 + (lvl−1)·40', () => {
    expect(xpToNext(1)).toBe(100)
    expect(xpToNext(2)).toBe(140)
    expect(xpToNext(10)).toBe(460)
  })

  it('T-PR-02 awans o jeden poziom z przeniesieniem nadwyżki XP', () => {
    expect(applyXp(1, 90, 30)).toEqual({ level: 2, xp: 20, levelsGained: 1 })
  })

  it('T-PR-03 kilka awansów naraz przy dużej nagrodzie', () => {
    // 100 (lvl1) + 140 (lvl2) = 240 → lvl3 z 10 XP
    expect(applyXp(1, 0, 250)).toEqual({ level: 3, xp: 10, levelsGained: 2 })
  })

  it('T-PR-04 brak awansu poniżej progu', () => {
    expect(applyXp(4, 10, 50)).toEqual({ level: 4, xp: 60, levelsGained: 0 })
  })

  it('T-PR-05 za awans przysługuje 10 klejnotów', () => {
    expect(GEMS_PER_LEVEL).toBe(10)
  })
})

describe('Progresja: nagrody za mecz', () => {
  it('T-PR-06 hierarchia XP ze specyfikacji: ranked > quick > trening', () => {
    const ranked = computeRewards('ranked', 30, 20, 0).xp
    const quick = computeRewards('quick', 30, 20, 0).xp
    const practiceMax = computeRewards('practice', 99, 0, 999).xp
    expect(ranked).toBeGreaterThan(quick)
    expect(quick).toBeGreaterThan(practiceMax)
    // nawet przegrany quick daje więcej niż najlepszy trening
    expect(computeRewards('quick', 10, 30, 0).xp).toBeGreaterThan(practiceMax)
  })

  it('T-PR-07 przegrana też daje XP (mniej niż wygrana)', () => {
    for (const mode of ['ranked', 'quick'] as const) {
      const win = computeRewards(mode, 30, 20, 0)
      const loss = computeRewards(mode, 20, 30, 0)
      expect(win.won).toBe(true)
      expect(loss.won).toBe(false)
      expect(loss.xp).toBeGreaterThan(0)
      expect(loss.xp).toBeLessThan(win.xp)
      expect(win.xp).toBe(REWARDS[mode].win.xp)
    }
  })

  it('T-PR-08 trening: 5 XP bazowo + 1 za celny rzut, max 20, nigdy „wygrana”', () => {
    expect(computeRewards('practice', 0, 0, 0)).toMatchObject({ xp: 5, won: false, ratingDelta: 0 })
    expect(computeRewards('practice', 20, 0, 10).xp).toBe(15)
    expect(computeRewards('practice', 99, 0, 500).xp).toBe(20)
  })

  it('T-PR-09 ranking zmienia się tylko w trybie ranked', () => {
    expect(computeRewards('quick', 50, 0, 0).ratingDelta).toBe(0)
    expect(computeRewards('ranked', 20, 18, 0).ratingDelta).toBe(21) // 20 + floor(2/2)
    expect(computeRewards('ranked', 60, 10, 0).ratingDelta).toBe(30) // bonus ograniczony do +10
    expect(computeRewards('ranked', 10, 40, 0).ratingDelta).toBe(-15)
  })
})

describe('Progresja: statystyki z poziomu', () => {
  it('T-PR-10 poziom 1 = statystyki bazowe', () => {
    expect(statsForLevel(1)).toEqual({ speed: 1, shoot: 0, steal: 0 })
  })

  it('T-PR-11 bonusy rosną z poziomem, ale mają limit', () => {
    const s10 = statsForLevel(10)
    const s200 = statsForLevel(200)
    expect(s10.shoot).toBeGreaterThan(0)
    expect(s200).toEqual({ speed: 1.12, shoot: 0.15, steal: 0.1 })
  })
})

describe('Balans: NPC zawsze słabszy od gracza', () => {
  const levels = Array.from({ length: 40 }, (_, i) => i + 1)

  it('T-PR-12 quick: każda statystyka NPC wyraźnie niższa niż gracza (poziomy 1–40)', () => {
    for (const lv of levels) {
      const p = statsForLevel(lv)
      const n = npcStats('quick', p)
      expect(p.speed - n.speed).toBeCloseTo(NPC_HANDICAP.quick.speed)
      expect(p.shoot - n.shoot).toBeCloseTo(NPC_HANDICAP.quick.shoot)
      expect(p.steal - n.steal).toBeCloseTo(NPC_HANDICAP.quick.steal)
    }
  })

  it('T-PR-13 ranked: NPC słabszy, ale mniej niż w quick', () => {
    for (const lv of levels) {
      const p = statsForLevel(lv)
      const r = npcStats('ranked', p)
      const q = npcStats('quick', p)
      expect(r.shoot).toBeLessThan(p.shoot)
      expect(r.shoot).toBeGreaterThan(q.shoot)
      expect(r.speed).toBeLessThan(p.speed)
    }
  })

  it('T-PR-14 inteligencja AI: quick = 0,2, ranked w przedziale 0,28–0,36 dla każdego rankingu (poniżej przeciętnego gracza 0,4)', () => {
    expect(npcDifficulty('quick', 30, 3000)).toBe(0.2)
    for (const rating of [0, 800, 1000, 1500, 2500, 9999]) {
      const d = npcDifficulty('ranked', 10, rating)
      expect(d).toBeGreaterThanOrEqual(0.28)
      expect(d).toBeLessThanOrEqual(0.36)
    }
  })

  it('T-PR-15 poziom NPC nigdy nie przekracza poziomu gracza i nie spada poniżej 1', () => {
    for (let i = 0; i < 300; i++) {
      const lv = 1 + (i % 40)
      for (const mode of ['quick', 'ranked'] as const) {
        const n = npcLevel(mode, lv)
        expect(n).toBeLessThanOrEqual(lv)
        expect(n).toBeGreaterThanOrEqual(1)
      }
    }
  })
})
