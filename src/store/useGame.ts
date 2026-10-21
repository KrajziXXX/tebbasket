import { create } from 'zustand'
import type { Lang, MatchMode, MatchReward, MatchSummary, Profile } from '../types'

export type Screen = 'boot' | 'login' | 'lobby' | 'match' | 'results'
export type Panel = null | 'settings' | 'locker' | 'shop' | 'leaderboard'

export interface LastMatch {
  summary: MatchSummary
  reward: MatchReward | null
  before: Profile
  error?: string
}

interface GameState {
  screen: Screen
  panel: Panel
  profile: Profile | null
  guestLang: Lang
  mode: MatchMode
  /** bumping this remounts the match */
  matchId: number
  lastMatch: LastMatch | null
  setScreen: (s: Screen) => void
  setPanel: (p: Panel) => void
  setProfile: (p: Profile | null) => void
  setGuestLang: (l: Lang) => void
  startMatch: (m: MatchMode) => void
  setLastMatch: (m: LastMatch | null) => void
  toast: { id: number; text: string; tone: 'ok' | 'err' } | null
  showToast: (text: string, tone?: 'ok' | 'err') => void
}

export const useGame = create<GameState>((set) => ({
  screen: 'boot',
  panel: null,
  profile: null,
  guestLang: 'pl',
  mode: 'quick',
  matchId: 0,
  lastMatch: null,
  setScreen: (screen) => set({ screen }),
  setPanel: (panel) => set({ panel }),
  setProfile: (profile) => set({ profile }),
  setGuestLang: (guestLang) => set({ guestLang }),
  startMatch: (mode) => set((s) => ({ mode, screen: 'match', panel: null, matchId: s.matchId + 1, lastMatch: null })),
  setLastMatch: (lastMatch) => set({ lastMatch }),
  toast: null,
  showToast: (text, tone = 'ok') => set({ toast: { id: Date.now(), text, tone } }),
}))
