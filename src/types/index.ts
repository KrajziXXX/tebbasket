export type Lang = 'pl' | 'en'
export type MatchMode = 'quick' | 'ranked' | 'practice'

export interface Appearance {
  skin: number
  hair: number
  hairColor: number
  number: number
}

export interface Settings {
  sound: boolean
  volume: number
  lang: Lang
}

export interface Profile {
  id: string
  username: string
  level: number
  /** XP progress inside the current level */
  xp: number
  coins: number
  gems: number
  rating: number
  wins: number
  losses: number
  outfit: string
  ownedOutfits: string[]
  appearance: Appearance
  settings: Settings
}

export interface MatchSummary {
  mode: MatchMode
  playerScore: number
  opponentScore: number
  makes: number
  attempts: number
  dunks: number
  steals: number
  blocks?: number
  perfects?: number
  opponentName: string
}

export interface MatchReward {
  won: boolean
  xp: number
  coins: number
  ratingDelta: number
  levelsGained: number
  gems?: number
}

export interface LeaderboardEntry {
  id: string
  username: string
  level: number
  rating: number
  wins: number
  isMe?: boolean
}
