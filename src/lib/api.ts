import { supabase } from './supabase'
import { GEMS_PER_LEVEL, applyXp, computeRewards } from './progression'
import { DEFAULT_APPEARANCE, GEM_EXCHANGE, GEM_PACKS, STARTER_OUTFITS, getOutfit } from './outfits'
import type { Appearance, LeaderboardEntry, MatchReward, MatchSummary, Profile, Settings } from '../types'

export type ProfilePatch = Partial<Pick<Profile, 'username' | 'outfit' | 'appearance' | 'settings'>>

export interface Backend {
  kind: 'local' | 'supabase'
  restore(): Promise<Profile | null>
  signIn(email: string, password: string): Promise<Profile>
  /** returns null when e-mail confirmation is required */
  signUp(email: string, password: string, username: string): Promise<Profile | null>
  enterGuest(username: string): Promise<Profile>
  signOut(): Promise<void>
  /** offline mode only */
  resetProgress?(): Promise<Profile>
  updateProfile(patch: ProfilePatch): Promise<Profile>
  finishMatch(summary: MatchSummary): Promise<{ reward: MatchReward; profile: Profile }>
  buyOutfit(id: string): Promise<Profile>
  exchangeGems(id: string): Promise<Profile>
  mockPurchase(id: string): Promise<Profile>
  leaderboard(): Promise<LeaderboardEntry[]>
  onLeaderboardChange(cb: () => void): () => void
}

export const DEFAULT_SETTINGS: Settings = { sound: true, volume: 0.7, lang: 'pl' }
export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/

/* ------------------------------------------------------------------ */
/* Offline backend                                                    */
/* ------------------------------------------------------------------ */

const LS_KEY = 'tebbasket.profile.v1'

function freshProfile(username: string): Profile {
  return {
    id: 'local-' + Math.random().toString(36).slice(2, 10),
    username,
    level: 1,
    xp: 0,
    coins: 0,
    gems: 0,
    rating: 1000,
    wins: 0,
    losses: 0,
    outfit: 'teb-blue',
    ownedOutfits: [...STARTER_OUTFITS],
    appearance: { ...DEFAULT_APPEARANCE },
    settings: { ...DEFAULT_SETTINGS },
  }
}

const SAMPLE_PLAYERS: [string, number, number, number][] = [
  ['Szymon_K', 22, 1480, 61], ['Ola_3pt', 19, 1395, 54], ['Kuba23', 17, 1320, 47],
  ['MaksDunk', 15, 1265, 40], ['Natalia_B', 14, 1210, 35], ['Bartek_TEB', 12, 1150, 30],
  ['Igorek', 11, 1105, 26], ['Zuza_Hoops', 9, 1060, 21], ['Wiktor99', 8, 1020, 18],
  ['Lena_PG', 7, 985, 14], ['Antek', 5, 940, 10], ['Filip_F', 4, 905, 7],
  ['Tymon', 3, 870, 5], ['Hania', 2, 840, 3],
]

class LocalBackend implements Backend {
  kind = 'local' as const
  private listeners = new Set<() => void>()

  private load(): Profile | null {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return null
      const p = JSON.parse(raw) as Profile
      return { ...freshProfile(p.username), ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings } }
    } catch {
      return null
    }
  }
  private persist(p: Profile) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p))
    } catch {
      /* storage unavailable — progress lives only in memory */
    }
    this.mem = p
    return p
  }
  private mem: Profile | null = null
  private need(): Profile {
    const p = this.load() ?? this.mem
    if (!p) throw new Error('No profile')
    return p
  }

  async restore() {
    return this.load()
  }
  async signIn(): Promise<Profile> {
    throw new Error('Offline mode')
  }
  async signUp(): Promise<Profile | null> {
    throw new Error('Offline mode')
  }
  async enterGuest(username: string) {
    const existing = this.load()
    if (existing) return this.persist({ ...existing, username })
    return this.persist(freshProfile(username))
  }
  async signOut() {
    /* keep the local profile so progress isn't lost; just go back to login */
  }
  /** offline only: start over with a fresh profile (0 coins / 0 gems) */
  async resetProgress() {
    const p = this.need()
    return this.persist({ ...freshProfile(p.username), id: p.id, settings: p.settings })
  }
  async updateProfile(patch: ProfilePatch) {
    const p = this.need()
    if (patch.outfit && !p.ownedOutfits.includes(patch.outfit)) throw new Error('Outfit not owned')
    return this.persist({ ...p, ...patch })
  }
  async finishMatch(s: MatchSummary) {
    const p = this.need()
    const r = computeRewards(s.mode, s.playerScore, s.opponentScore, s.makes)
    const lv = applyXp(p.level, p.xp, r.xp)
    const next: Profile = {
      ...p,
      level: lv.level,
      xp: lv.xp,
      coins: p.coins + r.coins,
      gems: p.gems + lv.levelsGained * GEMS_PER_LEVEL,
      rating: Math.max(0, p.rating + r.ratingDelta),
      wins: p.wins + (s.mode !== 'practice' && r.won ? 1 : 0),
      losses: p.losses + (s.mode !== 'practice' && !r.won ? 1 : 0),
    }
    this.persist(next)
    if (s.mode === 'ranked') this.listeners.forEach((l) => l())
    return { reward: { ...r, levelsGained: lv.levelsGained, gems: lv.levelsGained * GEMS_PER_LEVEL }, profile: next }
  }
  async buyOutfit(id: string) {
    const p = this.need()
    const o = getOutfit(id)
    if (p.ownedOutfits.includes(id) || !o.price) return p
    const c = o.price.coins ?? 0
    const g = o.price.gems ?? 0
    if (p.coins < c || p.gems < g) throw new Error('notEnough')
    return this.persist({ ...p, coins: p.coins - c, gems: p.gems - g, ownedOutfits: [...p.ownedOutfits, id] })
  }
  async exchangeGems(id: string) {
    const p = this.need()
    const x = GEM_EXCHANGE.find((e) => e.id === id)
    if (!x) throw new Error('Unknown pack')
    if (p.gems < x.gems) throw new Error('notEnough')
    return this.persist({ ...p, gems: p.gems - x.gems, coins: p.coins + x.coins })
  }
  async mockPurchase(id: string) {
    const p = this.need()
    const pack = GEM_PACKS.find((e) => e.id === id)
    if (!pack) throw new Error('Unknown pack')
    return this.persist({ ...p, gems: p.gems + pack.gems })
  }
  async leaderboard() {
    const me = this.load()
    const rows: LeaderboardEntry[] = SAMPLE_PLAYERS.map(([username, level, rating, wins], i) => ({
      id: 'npc-' + i, username, level, rating, wins,
    }))
    if (me) rows.push({ id: me.id, username: me.username, level: me.level, rating: me.rating, wins: me.wins, isMe: true })
    return rows.sort((a, b) => b.rating - a.rating)
  }
  onLeaderboardChange(cb: () => void) {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }
}

/* ------------------------------------------------------------------ */
/* Supabase backend                                                   */
/* ------------------------------------------------------------------ */

interface ProfileRow {
  id: string
  username: string
  level: number
  xp: number
  coins: number
  gems: number
  rating: number
  wins: number
  losses: number
  outfit: string
  owned_outfits: string[] | null
  appearance: Appearance | null
  settings: Settings | null
}

const fromRow = (r: ProfileRow): Profile => ({
  id: r.id,
  username: r.username,
  level: r.level,
  xp: r.xp,
  coins: r.coins,
  gems: r.gems,
  rating: r.rating,
  wins: r.wins,
  losses: r.losses,
  outfit: r.outfit,
  ownedOutfits: r.owned_outfits ?? [...STARTER_OUTFITS],
  appearance: { ...DEFAULT_APPEARANCE, ...(r.appearance ?? {}) },
  settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
})

class SupabaseBackend implements Backend {
  kind = 'supabase' as const
  private sb = supabase!

  private async me(): Promise<Profile> {
    const { data: auth } = await this.sb.auth.getUser()
    if (!auth.user) throw new Error('Not signed in')
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', auth.user.id).single()
    if (error) throw error
    return fromRow(data as ProfileRow)
  }

  async restore() {
    const { data } = await this.sb.auth.getSession()
    if (!data.session) return null
    return this.me()
  }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password })
    if (error) throw error
    return this.me()
  }
  async signUp(email: string, password: string, username: string) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { data: { username } } })
    if (error) throw error
    if (!data.session) return null
    return this.me()
  }
  async enterGuest(): Promise<Profile> {
    throw new Error('Guest mode is only available offline')
  }
  async signOut() {
    await this.sb.auth.signOut()
  }
  async updateProfile(patch: ProfilePatch) {
    const { data: auth } = await this.sb.auth.getUser()
    if (!auth.user) throw new Error('Not signed in')
    const { data, error } = await this.sb.from('profiles').update(patch).eq('id', auth.user.id).select('*').single()
    if (error) throw error
    return fromRow(data as ProfileRow)
  }
  async finishMatch(s: MatchSummary) {
    const { data, error } = await this.sb.rpc('finish_match', {
      p_mode: s.mode,
      p_player_score: s.playerScore,
      p_opponent_score: s.opponentScore,
      p_makes: s.makes,
    })
    if (error) throw error
    const d = data as { won: boolean; xp: number; coins: number; gems: number; rating_delta: number; levels_gained: number }
    if (s.mode === 'ranked') {
      void this.sb.channel('leaderboard').send({ type: 'broadcast', event: 'changed', payload: {} })
    }
    return {
      reward: { won: d.won, xp: d.xp, coins: d.coins, gems: d.gems, ratingDelta: d.rating_delta, levelsGained: d.levels_gained },
      profile: await this.me(),
    }
  }
  private async rpcThenMe(fn: string, args: Record<string, unknown>) {
    const { error } = await this.sb.rpc(fn, args)
    if (error) throw new Error(error.message.includes('insufficient') ? 'notEnough' : error.message)
    return this.me()
  }
  buyOutfit(id: string) {
    return this.rpcThenMe('buy_outfit', { p_item: id })
  }
  exchangeGems(id: string) {
    return this.rpcThenMe('exchange_gems', { p_pack: id })
  }
  mockPurchase(id: string) {
    return this.rpcThenMe('mock_purchase', { p_pack: id })
  }
  async leaderboard() {
    const { data: auth } = await this.sb.auth.getUser()
    const { data, error } = await this.sb.rpc('get_leaderboard', { p_limit: 50 })
    if (error) throw error
    return (data as LeaderboardEntry[]).map((r) => ({ ...r, isMe: r.id === auth.user?.id }))
  }
  onLeaderboardChange(cb: () => void) {
    const ch = this.sb.channel('leaderboard').on('broadcast', { event: 'changed' }, cb).subscribe()
    return () => {
      void this.sb.removeChannel(ch)
    }
  }
}

export const backend: Backend = supabase ? new SupabaseBackend() : new LocalBackend()
