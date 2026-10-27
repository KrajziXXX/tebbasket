/**
 * Balance simulation — full 3-minute matches played headless by a mid-skill bot
 * (stands in for an average player) against NPCs built with the real game rules.
 * Every match uses its own fixed seed, so the report is reproducible.
 * Reports are written to docs/testy/logi/ for the project documentation.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyXp, computeRewards, npcDifficulty } from '../src/lib/progression'
import { fakePlayers, mdTable, seedRandom, simulateMatch, stamp, writeLog, type SimResult } from './helpers'

afterEach(() => {
  vi.restoreAllMocks()
})

interface Config {
  mode: 'quick' | 'ranked'
  level: number
  rating: number
}

const CONFIGS: Config[] = [
  { mode: 'quick', level: 1, rating: 1000 },
  { mode: 'quick', level: 10, rating: 1000 },
  { mode: 'quick', level: 25, rating: 1000 },
  { mode: 'ranked', level: 5, rating: 1000 },
  { mode: 'ranked', level: 15, rating: 1500 },
  { mode: 'ranked', level: 25, rating: 2000 },
]
const PER_CONFIG = 10

function runAll() {
  const results: { cfg: Config; seed: number; r: SimResult }[] = []
  CONFIGS.forEach((cfg, ci) => {
    for (let i = 0; i < PER_CONFIG; i++) {
      const seed = 1000 + ci * 100 + i
      seedRandom(seed)
      results.push({ cfg, seed, r: simulateMatch(cfg.mode, cfg.level, cfg.rating) })
      vi.restoreAllMocks()
    }
  })
  return results
}

const pct = (x: number) => `${Math.round(x * 100)}%`

describe('Symulacja balansu (60 pełnych meczów)', () => {
  const results = runAll()
  const by = (mode: 'quick' | 'ranked') => results.filter((x) => x.cfg.mode === mode).map((x) => x.r)
  const winRate = (rs: SimResult[]) => rs.filter((r) => r.winner === 'home').length / rs.length
  const margin = (rs: SimResult[]) => rs.reduce((s, r) => s + r.home - r.away, 0) / rs.length

  it('T-SIM-01 każdy mecz kończy się poprawnie (zwycięzca, czas ≈ 3 min + przerwy)', () => {
    for (const { r, seed } of results) {
      expect(r.winner, `seed ${seed}`).not.toBeNull()
      expect(r.home).not.toBe(r.away)
      expect(r.seconds).toBeGreaterThanOrEqual(180)
      expect(r.seconds).toBeLessThan(300)
    }
  })

  it('T-SIM-02 szybki mecz: przeciętny gracz wygrywa ≥ 80% (NPC wyraźnie słabszy)', () => {
    expect(winRate(by('quick'))).toBeGreaterThanOrEqual(0.8)
  })

  it('T-SIM-03 ranked: gracz wygrywa częściej niż przegrywa, ale nie zawsze (NPC tylko trochę słabszy)', () => {
    const w = winRate(by('ranked'))
    expect(w).toBeGreaterThanOrEqual(0.5)
    expect(w).toBeLessThan(1)
  })

  it('T-SIM-04 przewaga punktowa w ranked jest mniejsza niż w szybkim meczu', () => {
    expect(margin(by('ranked'))).toBeLessThan(margin(by('quick')))
    expect(margin(by('ranked'))).toBeGreaterThan(0)
  })

  it('T-SIM-07 w KAŻDEJ konfiguracji (poziom/ranking) gracz ma przewagę — NPC nigdy nie jest silniejszy', () => {
    for (const cfg of CONFIGS) {
      const rs = results.filter((x) => x.cfg === cfg).map((x) => x.r)
      const label = `${cfg.mode} lvl ${cfg.level} ranking ${cfg.rating}`
      expect(winRate(rs), label).toBeGreaterThanOrEqual(0.6)
      expect(margin(rs), label).toBeGreaterThan(0)
    }
  })

  it('T-SIM-05 NPC nie jest bezbronny — zdobywa punkty w każdym meczu', () => {
    for (const { r } of results) expect(r.away).toBeGreaterThan(8)
  })

  it('zapisuje raport do docs/testy/logi/symulacja-balansu.md', () => {
    const summary = CONFIGS.map((cfg) => {
      const rs = results.filter((x) => x.cfg === cfg).map((x) => x.r)
      return [
        cfg.mode === 'quick' ? 'Szybki' : 'Ranked',
        cfg.level,
        cfg.rating,
        npcDifficulty(cfg.mode, cfg.level, cfg.rating).toFixed(2),
        `${rs.filter((r) => r.winner === 'home').length}/${rs.length} (${pct(winRate(rs))})`,
        `${(rs.reduce((s, r) => s + r.home, 0) / rs.length).toFixed(1)} : ${(rs.reduce((s, r) => s + r.away, 0) / rs.length).toFixed(1)}`,
        `${margin(rs) >= 0 ? "+" : ""}${margin(rs).toFixed(1)}`,
        pct(rs.reduce((s, r) => s + r.homeAccuracy, 0) / rs.length),
        rs.filter((r) => r.golden).length,
      ]
    })
    const rows = results.map(({ cfg, seed, r }, i) => [
      i + 1, seed, cfg.mode, cfg.level, cfg.rating, `${r.home}:${r.away}`, r.winner === 'home' ? 'gracz' : 'NPC', r.seconds, pct(r.homeAccuracy),
      `${r.steals[0]}/${r.steals[1]}`, `${r.blocks[0]}/${r.blocks[1]}`, r.golden ? 'tak' : '',
    ])
    const md = [
      '# Raport symulacji balansu',
      '',
      `Wygenerowano automatycznie: ${stamp()} (test \`tests/balance.test.ts\`).`,
      '',
      'Każdy mecz to pełne 3 minuty gry silnika `Match` bez grafiki. Za gracza gra bot o średnich umiejętnościach (`NpcBrain(0.4)`)',
      'ze statystykami wynikającymi z poziomu; przeciwnik jest tworzony dokładnie tak jak w grze (`npcStats`, `npcDifficulty`, `npcLevel`).',
      'Każdy mecz ma własne ziarno losowości (kolumna *seed*), więc wynik można odtworzyć.',
      '',
      '## Podsumowanie',
      '',
      mdTable(['Tryb', 'Poziom gracza', 'Ranking', 'AI NPC', 'Wygrane gracza', 'Średni wynik', 'Średnia przewaga', 'Skuteczność gracza', 'Złote kosze'], summary),
      '',
      `**Szybki mecz łącznie:** ${pct(winRate(by('quick')))} wygranych, średnia przewaga +${margin(by('quick')).toFixed(1)} pkt.  `,
      `**Ranked łącznie:** ${pct(winRate(by('ranked')))} wygranych, średnia przewaga +${margin(by('ranked')).toFixed(1)} pkt.`,
      '',
      '## Wszystkie mecze',
      '',
      mdTable(['#', 'seed', 'tryb', 'lvl', 'ranking', 'wynik', 'wygrał', 'czas [s]', 'skuteczność', 'przechwyty G/N', 'bloki G/N', 'złoty kosz'], rows),
      '',
    ].join('\n')
    writeLog('symulacja-balansu.md', md)
  })
})

describe('Turniej fikcyjnych graczy (fake data)', () => {
  it('T-SIM-06 12 fikcyjnych graczy gra po meczu rankingowym; ranking i XP przeliczone regułami gry', () => {
    const players = fakePlayers(12)
    const rows: (string | number)[][] = []
    players.forEach((p, i) => {
      seedRandom(5000 + i)
      const r = simulateMatch('ranked', p.level, p.rating)
      vi.restoreAllMocks()
      const reward = computeRewards('ranked', r.home, r.away, 0)
      const lv = applyXp(p.level, 0, reward.xp)
      expect(r.winner).not.toBeNull()
      expect(Math.abs(reward.ratingDelta)).toBeLessThanOrEqual(30)
      rows.push([
        p.username, p.level, p.rating, `${r.home}:${r.away}`, reward.won ? 'W' : 'P',
        `${reward.ratingDelta >= 0 ? '+' : ''}${reward.ratingDelta}`, p.rating + reward.ratingDelta, `+${reward.xp}`, lv.level,
      ])
    })
    rows.sort((a, b) => Number(b[6]) - Number(a[6]))
    const md = [
      '# Turniej fikcyjnych graczy',
      '',
      `Wygenerowano automatycznie: ${stamp()} (test \`tests/balance.test.ts\`, T-SIM-06).`,
      '',
      'Gracze są **fikcyjni** (generator `fakePlayers()` z ziarnem 2026), ale wyniki meczów i przeliczenia rankingu/XP',
      'są prawdziwym wynikiem działania silnika gry i funkcji `computeRewards` / `applyXp`.',
      '',
      mdTable(['Gracz', 'Poziom', 'Ranking przed', 'Wynik', 'W/P', 'Zmiana', 'Ranking po', 'XP', 'Poziom po'], rows.map((r, i) => [`${i + 1}. ${r[0]}`, ...r.slice(1)])),
      '',
    ].join('\n')
    writeLog('turniej-fikcyjnych-graczy.md', md)
  })
})
