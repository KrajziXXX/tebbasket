import type { MatchMode } from '../types'

/**
 * Game-economy numbers. Keep in sync with finish_match() in supabase/schema.sql.
 * XP order required by spec: ranked > quick > practice (practice max 20 < quick loss 25).
 */
export const REWARDS = {
  ranked: { win: { xp: 120, coins: 60 }, loss: { xp: 45, coins: 15 } },
  quick: { win: { xp: 70, coins: 35 }, loss: { xp: 25, coins: 10 } },
  practice: { maxXp: 20, baseXp: 5, coins: 5 },
}

export const MATCH_SECONDS = 180
export const PRACTICE_SECONDS = 120

/** gems granted for every level-up (the only free gem source) */
export const GEMS_PER_LEVEL = 10

export const xpToNext = (level: number) => 100 + (level - 1) * 40

export function computeRewards(mode: MatchMode, playerScore: number, opponentScore: number, makes: number) {
  const won = mode !== 'practice' && playerScore > opponentScore
  if (mode === 'practice') {
    return { won, xp: Math.min(REWARDS.practice.maxXp, REWARDS.practice.baseXp + Math.min(makes, 15)), coins: REWARDS.practice.coins, ratingDelta: 0 }
  }
  const r = REWARDS[mode][won ? 'win' : 'loss']
  const ratingDelta = mode === 'ranked' ? (won ? 20 + Math.min(10, Math.floor((playerScore - opponentScore) / 2)) : -15) : 0
  return { won, xp: r.xp, coins: r.coins, ratingDelta }
}

export function applyXp(level: number, xp: number, gained: number) {
  let lv = level
  let cur = xp + gained
  let levelsGained = 0
  while (cur >= xpToNext(lv)) {
    cur -= xpToNext(lv)
    lv++
    levelsGained++
  }
  return { level: lv, xp: cur, levelsGained }
}

export interface AthleteStats {
  /** movement speed multiplier */
  speed: number
  /** additive bonus to shot probability */
  shoot: number
  /** additive bonus to steal probability */
  steal: number
}

/** Level really improves the player in matches (spec §2). Capped so skill still matters. */
export function statsForLevel(level: number): AthleteStats {
  const l = Math.max(0, level - 1)
  return {
    speed: 1 + Math.min(0.12, l * 0.004),
    shoot: Math.min(0.15, l * 0.005),
    steal: Math.min(0.1, l * 0.004),
  }
}

/**
 * NPCs are always tuned relative to the player, never stronger:
 *  - quick match: clearly weaker (a relaxed game you should usually win),
 *  - ranked: only slightly weaker (rating nudges the AI's decision-making up, but capped).
 */
export const NPC_HANDICAP = {
  quick: { speed: 0.08, shoot: 0.1, steal: 0.07, levels: [1, 3] as const },
  ranked: { speed: 0.03, shoot: 0.04, steal: 0.03, levels: [0, 1] as const },
}

/** NPC brain quality 0..1 (reactions, shot selection, steal/block eagerness). */
export function npcDifficulty(mode: MatchMode, _level: number, rating: number) {
  if (mode === 'ranked') return Math.max(0.3, Math.min(0.42, 0.3 + (rating - 1000) / 4000))
  return 0.2
}

export function npcStats(mode: MatchMode, player: AthleteStats): AthleteStats {
  const h = mode === 'ranked' ? NPC_HANDICAP.ranked : NPC_HANDICAP.quick
  return { speed: player.speed - h.speed, shoot: player.shoot - h.shoot, steal: player.steal - h.steal }
}

/** NPC level shown in the intro: a bit below the player's. */
export function npcLevel(mode: MatchMode, playerLevel: number) {
  const [lo, hi] = mode === 'ranked' ? NPC_HANDICAP.ranked.levels : NPC_HANDICAP.quick.levels
  return Math.max(1, playerLevel - lo - Math.floor(Math.random() * (hi - lo + 1)))
}
