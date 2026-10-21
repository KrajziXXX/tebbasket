import { useEffect, useState } from 'react'
import { Confetti, GymBackdrop } from '../components/Canvases'
import { CoinIcon, GemIcon } from '../components/Icons'
import { Spinner } from '../components/ui'
import { submitMatch } from '../lib/actions'
import { audio } from '../lib/audio'
import { useT } from '../lib/i18n'
import { buildLook } from '../lib/outfits'
import { xpToNext } from '../lib/progression'
import { useGame } from '../store/useGame'
import { LevelBadge } from './Lobby'

export default function Results() {
  const t = useT()
  const { lastMatch, profile, startMatch, setScreen } = useGame()
  const [bar, setBar] = useState(0)
  const reward = lastMatch?.reward

  useEffect(() => {
    if (!reward || !profile) return
    if (reward.levelsGained > 0) audio.play('cheer')
    const id = requestAnimationFrame(() => setBar(profile.xp / xpToNext(profile.level)))
    return () => cancelAnimationFrame(id)
  }, [reward, profile])

  if (!lastMatch || !profile) return null
  const { summary: s, before } = lastMatch
  const practice = s.mode === 'practice'
  const won = !practice && s.playerScore > s.opponentScore
  const title = practice ? t('practiceDone') : won ? t('victory') : t('defeat')
  const acc = s.attempts ? Math.round((s.makes / s.attempts) * 100) : 0
  const startBar = reward && reward.levelsGained > 0 ? 0 : before.xp / xpToNext(before.level)

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GymBackdrop look={buildLook(profile.outfit, profile.appearance)} excite={won ? 0.9 : 0} className="absolute inset-0" />
      {(won || practice) && <Confetti />}
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative flex h-full items-center justify-center overflow-y-auto p-3">
        <div className="panel w-full max-w-lg p-5 text-center animate-[popIn_.25s_ease-out]">
          <h1 className={`font-display text-5xl font-extrabold uppercase sm:text-6xl ${practice ? 'text-white' : won ? 'text-coin' : 'text-red-400'}`}>{title}</h1>
          <div className="my-2 font-display text-5xl font-bold">
            {practice ? (
              <>
                {s.playerScore} <span className="text-2xl text-white/60">{t('points')}</span>
              </>
            ) : (
              <>
                <span className="text-sky-300">{s.playerScore}</span>
                <span className="mx-3 text-white/40">:</span>
                <span className="text-red-300">{s.opponentScore}</span>
              </>
            )}
          </div>
          {!practice && (
            <div className="mb-3 text-white/60">
              {profile.username} vs {s.opponentName}
            </div>
          )}

          <div className="mb-4 grid grid-cols-3 gap-2">
            {(
              [
                [t('makes'), `${s.makes}/${s.attempts}`],
                [t('accuracy'), `${acc}%`],
                [t('dunks'), s.dunks],
                [t('steals'), s.steals],
                [t('blocks'), s.blocks ?? 0],
                [t('perfects'), s.perfects ?? 0],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-black/30 py-2">
                <div className="font-display text-2xl font-bold">{v}</div>
                <div className="text-[11px] uppercase tracking-wide text-white/55">{k}</div>
              </div>
            ))}
          </div>

          {lastMatch.error ? (
            <div className="mb-4 rounded-xl bg-red-500/20 p-3 text-sm">
              <p className="mb-2 font-bold">{t('saveError')}</p>
              <p className="mb-2 text-white/70">{lastMatch.error}</p>
              <button className="btn-game px-4 py-1 text-base" onClick={() => void submitMatch(s)}>
                ↻
              </button>
            </div>
          ) : !reward ? (
            <div className="mb-4 flex items-center justify-center gap-2 text-white/70">
              <Spinner /> {t('saving')}
            </div>
          ) : (
            <div className="mb-4 rounded-xl bg-black/30 p-3">
              <div className="mb-2 flex items-center justify-center gap-4 font-display text-2xl font-bold">
                <span className="text-sky-300">+{reward.xp} XP</span>
                <span className="flex items-center gap-1 text-coin">
                  +{reward.coins} <CoinIcon className="h-6 w-6" />
                </span>
                {!!reward.gems && (
                  <span className="flex items-center gap-1 text-gem" title={t('gemsLevel')}>
                    +{reward.gems} <GemIcon className="h-6 w-6" />
                  </span>
                )}
                {s.mode === 'ranked' && (
                  <span className={reward.ratingDelta >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                    🏆 {reward.ratingDelta >= 0 ? '+' : ''}
                    {reward.ratingDelta}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <LevelBadge level={profile.level} className="h-11 w-10" />
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/50">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand to-coin transition-[width] duration-1000 ease-out" style={{ width: `${(bar || startBar) * 100}%` }} />
                </div>
                <span className="w-20 text-right text-sm text-white/70">
                  {profile.xp}/{xpToNext(profile.level)}
                </span>
              </div>
              {reward.levelsGained > 0 && <div className="mt-2 animate-bounce font-display text-2xl font-extrabold uppercase text-coin">{t('levelUp')}</div>}
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-game flex-1 py-3 text-xl" onClick={() => setScreen('lobby')} disabled={!reward && !lastMatch.error}>
              {t('backToLobby')}
            </button>
            <button
              className="btn-primary flex-1 py-3 text-xl"
              onClick={() => {
                audio.play('click')
                startMatch(s.mode)
              }}
              disabled={!reward && !lastMatch.error}
            >
              {t('playAgain')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
