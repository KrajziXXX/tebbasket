import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Backend } from '../src/lib/api'
import { GEMS_PER_LEVEL, REWARDS } from '../src/lib/progression'
import type { MatchSummary } from '../src/types'

/** In-memory localStorage — the offline backend persists profiles there. */
class MemoryStorage {
  private m = new Map<string, string>()
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v))
  }
  removeItem(k: string) {
    this.m.delete(k)
  }
  clear() {
    this.m.clear()
  }
}

let backend: Backend
let USERNAME_RE: RegExp
const storage = new MemoryStorage()

beforeAll(async () => {
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = storage
  const api = await import('../src/lib/api')
  backend = api.backend
  USERNAME_RE = api.USERNAME_RE
})

beforeEach(() => storage.clear())

const match = (over: Partial<MatchSummary>): MatchSummary => ({
  mode: 'quick', playerScore: 30, opponentScore: 20, makes: 12, attempts: 25, dunks: 1, steals: 2, opponentName: 'Kuba', ...over,
})

describe('Backend offline: konto', () => {
  it('T-API-01 bez zmiennych Supabase gra działa w trybie offline', () => {
    expect(backend.kind).toBe('local')
  })

  it('T-API-02 nowy gracz: poziom 1, 0 monet, 0 klejnotów, 2 stroje startowe, ranking 1000', async () => {
    const p = await backend.enterGuest('Zuza_TEB')
    expect(p).toMatchObject({ username: 'Zuza_TEB', level: 1, xp: 0, coins: 0, gems: 0, rating: 1000, outfit: 'teb-blue' })
    expect(p.ownedOutfits).toEqual(['teb-blue', 'teb-white'])
  })

  it('T-API-03 profil przetrwa „odświeżenie strony” (restore z localStorage)', async () => {
    await backend.enterGuest('Maks99')
    const restored = await backend.restore()
    expect(restored?.username).toBe('Maks99')
  })

  it('T-API-04 walidacja nazwy gracza: 3–16 znaków, litery/cyfry/_', () => {
    for (const ok of ['TEB', 'Ola_3pt', 'Gracz_1234567890']) expect(USERNAME_RE.test(ok), ok).toBe(true)
    for (const bad of ['ab', 'ze spacją', 'Zażółć', 'a'.repeat(17), 'x;drop']) expect(USERNAME_RE.test(bad), bad).toBe(false)
  })

  it('T-API-05 nie da się założyć stroju, którego się nie posiada', async () => {
    await backend.enterGuest('Tester')
    await expect(backend.updateProfile({ outfit: 'gold-legend' })).rejects.toThrow()
    const p = await backend.updateProfile({ outfit: 'teb-white' })
    expect(p.outfit).toBe('teb-white')
  })
})

describe('Backend offline: mecze i nagrody', () => {
  it('T-API-06 wygrany szybki mecz: +70 XP, +35 monet, +1 wygrana, ranking bez zmian', async () => {
    await backend.enterGuest('Tester')
    const { reward, profile } = await backend.finishMatch(match({ mode: 'quick' }))
    expect(reward).toMatchObject({ won: true, xp: REWARDS.quick.win.xp, coins: REWARDS.quick.win.coins, ratingDelta: 0 })
    expect(profile).toMatchObject({ xp: 70, coins: 35, wins: 1, losses: 0, rating: 1000 })
  })

  it('T-API-07 przegrany ranked: −15 rankingu, +1 porażka, XP za udział', async () => {
    await backend.enterGuest('Tester')
    const { profile } = await backend.finishMatch(match({ mode: 'ranked', playerScore: 18, opponentScore: 30 }))
    expect(profile).toMatchObject({ rating: 985, losses: 1, wins: 0, xp: REWARDS.ranked.loss.xp })
  })

  it('T-API-08 awans poziomu daje 10 klejnotów (jedyne darmowe źródło)', async () => {
    await backend.enterGuest('Tester')
    const { reward, profile } = await backend.finishMatch(match({ mode: 'ranked' })) // 120 XP ≥ 100
    expect(reward.levelsGained).toBe(1)
    expect(reward.gems).toBe(GEMS_PER_LEVEL)
    expect(profile).toMatchObject({ level: 2, xp: 20, gems: 10 })
  })

  it('T-API-09 trening nie liczy się do bilansu wygranych/porażek', async () => {
    await backend.enterGuest('Tester')
    const { profile } = await backend.finishMatch(match({ mode: 'practice', playerScore: 40, opponentScore: 0 }))
    expect(profile).toMatchObject({ wins: 0, losses: 0, rating: 1000 })
  })
})

describe('Backend offline: sklep', () => {
  it('T-API-10 zakup za mało środków → błąd, nic się nie zmienia', async () => {
    await backend.enterGuest('Tester')
    await expect(backend.buyOutfit('fire-red')).rejects.toThrow('notEnough')
    const p = await backend.restore()
    expect(p?.ownedOutfits).not.toContain('fire-red')
  })

  it('T-API-11 zarobione monety → zakup stroju → można go założyć', async () => {
    await backend.enterGuest('Tester')
    for (let i = 0; i < 9; i++) await backend.finishMatch(match({ mode: 'quick' })) // 9 × 35 = 315 monet
    const after = await backend.buyOutfit('fire-red') // 300
    expect(after.coins).toBe(15)
    expect(after.ownedOutfits).toContain('fire-red')
    const dressed = await backend.updateProfile({ outfit: 'fire-red' })
    expect(dressed.outfit).toBe('fire-red')
  })

  it('T-API-12 ponowny zakup posiadanego stroju nic nie kosztuje', async () => {
    await backend.enterGuest('Tester')
    for (let i = 0; i < 9; i++) await backend.finishMatch(match({ mode: 'quick' }))
    await backend.buyOutfit('fire-red')
    const again = await backend.buyOutfit('fire-red')
    expect(again.coins).toBe(15)
  })

  it('T-API-13 symulowany zakup klejnotów i wymiana na monety', async () => {
    await backend.enterGuest('Tester')
    const g = await backend.mockPurchase('gems_100')
    expect(g.gems).toBe(100)
    const x = await backend.exchangeGems('x50')
    expect(x).toMatchObject({ gems: 50, coins: 5500 })
    await expect(backend.exchangeGems('x100')).rejects.toThrow('notEnough')
  })

  it('T-API-14 reset postępu wraca do zera, ale zostawia nazwę i ustawienia', async () => {
    await backend.enterGuest('Tester')
    await backend.updateProfile({ settings: { sound: false, volume: 0.3, lang: 'en' } })
    await backend.mockPurchase('gems_1200')
    const r = await backend.resetProgress!()
    expect(r).toMatchObject({ username: 'Tester', gems: 0, coins: 0, level: 1 })
    expect(r.settings.lang).toBe('en')
  })
})

describe('Backend offline: ranking', () => {
  it('T-API-15 ranking jest posortowany malejąco i zawiera gracza', async () => {
    await backend.enterGuest('Tester')
    const rows = await backend.leaderboard()
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].rating).toBeGreaterThanOrEqual(rows[i].rating)
    expect(rows.filter((r) => r.isMe)).toHaveLength(1)
  })

  it('T-API-16 wygrany mecz rankingowy powiadamia otwarty ranking (odświeżenie na żywo)', async () => {
    await backend.enterGuest('Tester')
    let calls = 0
    const off = backend.onLeaderboardChange(() => calls++)
    await backend.finishMatch(match({ mode: 'ranked' }))
    await backend.finishMatch(match({ mode: 'quick' }))
    off()
    await backend.finishMatch(match({ mode: 'ranked' }))
    expect(calls).toBe(1)
  })
})
