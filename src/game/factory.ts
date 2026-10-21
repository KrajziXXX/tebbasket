import { buildLook } from '../lib/outfits'
import { MATCH_SECONDS, PRACTICE_SECONDS, npcDifficulty, npcLevel, npcStats, statsForLevel } from '../lib/progression'
import type { MatchMode, Profile } from '../types'
import { Athlete, Match, NpcBrain } from './engine'

const NPC_OUTFITS = ['fire-red', 'neon', 'cherry', 'night-black', 'camo', 'lava', 'mint', 'retro-orange', 'cyber']
const RED = ['fire-red', 'cherry', 'retro-orange', 'lava']
const NPC_NAMES = ['Kuba', 'Olek', 'Szymon', 'Filip', 'Bartek', 'Igor', 'Maks', 'Tymon', 'Antek', 'Wiktor', 'Leon', 'Natan', 'Oskar', 'Franek']

export function createMatch(mode: MatchMode, p: Profile): Match {
  const home = new Athlete('home', p.username, p.level, buildLook(p.outfit, p.appearance, 'TEB'), statsForLevel(p.level))
  if (mode === 'practice') {
    return new Match({ mode, home, away: null, brain: null, duration: PRACTICE_SECONDS })
  }
  const diff = npcDifficulty(mode, p.level, p.rating)
  const level = npcLevel(mode, p.level)
  const pool = NPC_OUTFITS.filter((id) => id !== p.outfit && !(RED.includes(id) && RED.includes(p.outfit)))
  const outfit = pool[Math.floor(Math.random() * pool.length)]
  const look = buildLook(
    outfit,
    {
      skin: Math.floor(Math.random() * 5),
      hair: Math.floor(Math.random() * 3),
      hairColor: Math.floor(Math.random() * 4),
      number: 1 + Math.floor(Math.random() * 30),
    },
    'GUEST',
  )
  const name = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)]
  const away = new Athlete('away', name, level, look, npcStats(mode, home.stats))
  return new Match({ mode, home, away, brain: new NpcBrain(diff), duration: MATCH_SECONDS })
}
