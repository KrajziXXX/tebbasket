import { backend, type ProfilePatch } from './api'
import { translate } from './i18n'
import { useGame } from '../store/useGame'
import type { MatchSummary, Profile } from '../types'

const lang = () => useGame.getState().profile?.settings.lang ?? useGame.getState().guestLang

export function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg === 'notEnough') return translate(lang(), 'notEnough')
  return msg
}

/** run a backend call that returns the new profile; toast on error */
export async function withProfile(fn: () => Promise<Profile>, okText?: string) {
  const g = useGame.getState()
  try {
    const p = await fn()
    g.setProfile(p)
    if (okText) g.showToast(okText)
    return true
  } catch (e) {
    g.showToast(errorText(e), 'err')
    return false
  }
}

export const saveProfile = (patch: ProfilePatch, okText?: string) => withProfile(() => backend.updateProfile(patch), okText)

export async function submitMatch(summary: MatchSummary) {
  const g = useGame.getState()
  const before = g.profile!
  g.setLastMatch({ summary, reward: null, before })
  g.setScreen('results')
  try {
    const { reward, profile } = await backend.finishMatch(summary)
    useGame.getState().setProfile(profile)
    useGame.getState().setLastMatch({ summary, reward, before })
  } catch (e) {
    useGame.getState().setLastMatch({ summary, reward: null, before, error: errorText(e) })
  }
}
