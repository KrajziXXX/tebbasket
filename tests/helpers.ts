/**
 * Shared test utilities:
 *  - seeded RNG (every random event in the engine becomes reproducible),
 *  - fake data generator (players / profiles with realistic but fictional values),
 *  - match runner (bot vs NPC, headless),
 *  - log writer (results land in docs/testy/logi/ for the school documentation).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { vi } from 'vitest'
import { Athlete, Match, NO_INPUT, NpcBrain, type Controls } from '../src/game/engine'
import { buildLook } from '../src/lib/outfits'
import { npcDifficulty, npcLevel, npcStats, statsForLevel } from '../src/lib/progression'
import type { MatchMode, Profile } from '../src/types'

/* ---------- deterministic randomness ---------- */

export function mulberry32(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Replace Math.random with a seeded generator for the rest of the test. */
export function seedRandom(seed: number) {
  const rng = mulberry32(seed)
  return vi.spyOn(Math, 'random').mockImplementation(rng)
}

/** Force Math.random to a constant (e.g. 0 = "every roll succeeds"). */
export function fixRandom(value: number) {
  return vi.spyOn(Math, 'random').mockReturnValue(value)
}

/* ---------- fake data ---------- */

const FIRST = ['Kuba', 'Ola', 'Szymon', 'Zuza', 'Maks', 'Lena', 'Filip', 'Hania', 'Bartek', 'Natalia', 'Igor', 'Maja', 'Tymon', 'Wiktoria', 'Antek', 'Julia']
const SUFFIX = ['_TEB', '23', '_3pt', 'Dunk', '_PG', '99', '_MVP', '07', 'Hoops', '_GO']

export interface FakePlayer {
  username: string
  level: number
  rating: number
  wins: number
  losses: number
}

/** Fictional players for leaderboard / balance tests. Same seed → same players. */
export function fakePlayers(count: number, seed = 2026): FakePlayer[] {
  const r = mulberry32(seed)
  const used = new Set<string>()
  const out: FakePlayer[] = []
  while (out.length < count) {
    const username = FIRST[Math.floor(r() * FIRST.length)] + SUFFIX[Math.floor(r() * SUFFIX.length)]
    if (used.has(username)) continue
    used.add(username)
    const level = 1 + Math.floor(r() * 30)
    const games = Math.floor(r() * 80)
    const wins = Math.floor(games * (0.35 + r() * 0.4))
    out.push({ username, level, rating: Math.round(800 + level * 20 + (r() - 0.5) * 300), wins, losses: games - wins })
  }
  return out
}

export function fakeProfile(over: Partial<Profile> = {}): Profile {
  return {
    id: 'test-' + (over.username ?? 'player'),
    username: 'Tester_TEB',
    level: 1,
    xp: 0,
    coins: 0,
    gems: 0,
    rating: 1000,
    wins: 0,
    losses: 0,
    outfit: 'teb-blue',
    ownedOutfits: ['teb-blue', 'teb-white'],
    appearance: { skin: 0, hair: 0, hairColor: 0, number: 12 },
    settings: { sound: false, volume: 0, lang: 'pl' },
    ...over,
  }
}

/* ---------- match helpers ---------- */

export const DT = 1 / 60

export function athlete(team: 'home' | 'away', level = 5) {
  return new Athlete(team, team === 'home' ? 'Gracz' : 'NPC', level, buildLook('teb-blue', { skin: 0, hair: 0, hairColor: 0, number: 7 }), statsForLevel(level))
}

/** A match with no AI (the away player stands still unless the test moves it). */
export function bareMatch(mode: MatchMode = 'quick') {
  const home = athlete('home')
  const away = mode === 'practice' ? null : athlete('away')
  return new Match({ mode, home, away, brain: null, duration: 180 })
}

/** Advance until the match reaches the given phase (or fail after maxSeconds). */
export function stepUntil(m: Match, cond: () => boolean, input: Controls = NO_INPUT, maxSeconds = 30) {
  for (let i = 0; i < maxSeconds / DT; i++) {
    if (cond()) return true
    m.update(DT, input)
    m.events.length = 0
    m.fx.length = 0
  }
  return cond()
}

/** Put the ball in a player's hands mid-court, live, and freeze the clock elsewhere. */
export function giveBall(m: Match, team: 'home' | 'away') {
  stepUntil(m, () => m.phase === 'live')
  m.ball.state = 'held'
  m.ball.holder = team
  m.possession = team
  m.shotClock = 14
}

export interface SimResult {
  mode: MatchMode
  playerLevel: number
  rating: number
  home: number
  away: number
  winner: 'home' | 'away' | null
  seconds: number
  golden: boolean
  homeAccuracy: number
  steals: [number, number]
  blocks: [number, number]
}

/**
 * Full headless match: the "player" is a mid-skill bot (NpcBrain 0.4) with the player's
 * level stats; the opponent is built exactly like in the real game (factory rules).
 */
export function simulateMatch(mode: 'quick' | 'ranked', playerLevel: number, rating: number, botSkill = 0.4): SimResult {
  const home = new Athlete('home', 'Bot', playerLevel, buildLook('teb-blue', { skin: 0, hair: 0, hairColor: 0, number: 12 }), statsForLevel(playerLevel))
  const away = new Athlete('away', 'NPC', npcLevel(mode, playerLevel), buildLook('neon', { skin: 1, hair: 1, hairColor: 1, number: 9 }), npcStats(mode, home.stats))
  const m = new Match({ mode, home, away, brain: new NpcBrain(npcDifficulty(mode, playerLevel, rating)), duration: 180 })
  const bot = new NpcBrain(botSkill)
  bot.reset(home)
  let steps = 0
  let golden = false
  while (m.phase !== 'over' && steps < 60 * 900) {
    m.update(DT, m.phase === 'live' ? bot.think(m, home, away, DT) : NO_INPUT)
    m.events.length = 0
    m.fx.length = 0
    if (m.golden) golden = true
    steps++
  }
  const st = m.stats.home
  return {
    mode,
    playerLevel,
    rating,
    home: m.score.home,
    away: m.score.away,
    winner: m.winner,
    seconds: Math.round(steps * DT),
    golden,
    homeAccuracy: st.attempts ? st.makes / st.attempts : 0,
    steals: [m.stats.home.steals, m.stats.away.steals],
    blocks: [m.stats.home.blocks, m.stats.away.blocks],
  }
}

/* ---------- logs for the documentation ---------- */

export const LOG_DIR = resolve(__dirname, '../docs/testy/logi')

export function writeLog(file: string, content: string) {
  const path = resolve(LOG_DIR, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
  return path
}

export const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19)

export function mdTable(head: string[], rows: (string | number)[][]) {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')
}
