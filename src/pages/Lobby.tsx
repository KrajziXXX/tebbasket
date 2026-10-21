import { Avatar, GymBackdrop } from '../components/Canvases'
import { GearIcon, HangerIcon, PodiumIcon, ShopIcon } from '../components/Icons'
import { Currency } from '../components/ui'
import { audio } from '../lib/audio'
import { useT, type TKey } from '../lib/i18n'
import { buildLook } from '../lib/outfits'
import { REWARDS, xpToNext } from '../lib/progression'
import { useGame, type Panel } from '../store/useGame'
import type { MatchMode } from '../types'
import LeaderboardPanel from './panels/LeaderboardPanel'
import LockerPanel from './panels/LockerPanel'
import SettingsPanel from './panels/SettingsPanel'
import ShopPanel from './panels/ShopPanel'

export function LevelBadge({ level, className = '' }: { level: number; className?: string }) {
  return (
    <div className={`relative grid place-items-center ${className}`}>
      <svg viewBox="0 0 40 44" className="absolute inset-0 h-full w-full drop-shadow">
        <path d="M20 2 37 8v14c0 10-7 17-17 20C10 39 3 32 3 22V8z" fill="#2f5fa8" stroke="#e8c45a" strokeWidth="3" />
      </svg>
      <span className="relative font-display text-lg font-bold">{level}</span>
    </div>
  )
}

const MODES: { id: MatchMode; label: TKey; xp: string }[] = [
  { id: 'quick', label: 'quickMatch', xp: `${REWARDS.quick.loss.xp}–${REWARDS.quick.win.xp}` },
  { id: 'ranked', label: 'ranked', xp: `${REWARDS.ranked.loss.xp}–${REWARDS.ranked.win.xp}` },
  { id: 'practice', label: 'practice', xp: `≤${REWARDS.practice.maxXp}` },
]

export default function Lobby() {
  const t = useT()
  const { profile, panel, setPanel, startMatch } = useGame()
  if (!profile) return null
  const look = buildLook(profile.outfit, profile.appearance)
  const need = xpToNext(profile.level)
  const open = (p: Panel) => {
    audio.unlock()
    audio.play('click')
    setPanel(p)
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GymBackdrop look={look} className="absolute inset-0" />

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-black/50 px-2 py-1.5 sm:gap-4 sm:px-4 sm:py-2 short:py-1">
        <button onClick={() => open('locker')} className="flex min-w-0 items-center gap-2">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-white sm:h-14 sm:w-14 short:h-10 short:w-10">
            <Avatar look={look} />
          </div>
          <span className="truncate font-display text-xl font-bold sm:text-2xl">{profile.username}</span>
        </button>
        <div className="flex flex-1 items-center justify-center gap-2" title={`${profile.xp} / ${need} XP`}>
          <LevelBadge level={profile.level} className="h-10 w-9 sm:h-12 sm:w-11" />
          <div className="hidden w-28 sm:block">
            <div className="h-2 overflow-hidden rounded-full bg-black/50">
              <div className="h-full rounded-full bg-gradient-to-r from-brand to-coin" style={{ width: `${(profile.xp / need) * 100}%` }} />
            </div>
            <div className="mt-0.5 text-center text-[11px] font-semibold text-white/70">
              {profile.xp} / {need} XP
            </div>
          </div>
        </div>
        <Currency coins={profile.coins} gems={profile.gems} onAdd={() => open('shop')} />
        <button onClick={() => open('settings')} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-white/60 bg-black/30 hover:bg-white/10 sm:h-11 sm:w-11" aria-label={t('settings')}>
          <GearIcon className="h-6 w-6" />
        </button>
      </div>

      {/* modes */}
      <div className="absolute bottom-16 right-3 top-16 flex w-[clamp(180px,26vw,260px)] flex-col justify-center gap-2.5 sm:bottom-24 sm:right-6 sm:top-24 sm:gap-3.5 short:bottom-12 short:top-12 short:gap-1.5">
        {MODES.map((m, i) => (
          <button
            key={m.id}
            onClick={() => {
              audio.unlock()
              audio.play('click')
              startMatch(m.id)
            }}
            className={`${m.id === 'ranked' ? 'btn-primary' : 'btn-game'} px-4 py-2.5 text-left text-xl sm:py-3 sm:text-2xl short:py-1.5 short:text-lg animate-[slideUp_.3s_ease-out_both]`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="leading-none">{t(m.label)}</div>
            <div className="mt-1 flex justify-between text-xs font-semibold short:mt-0.5 short:text-[11px] normal-case tracking-normal text-white/75 sm:text-sm">
              <span>+{m.xp} XP</span>
              {m.id === 'ranked' && <span>🏆 {profile.rating}</span>}
            </div>
          </button>
        ))}
      </div>

      {/* bottom nav */}
      <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 border-t border-white/10 bg-[#2a2420]/90">
        {(
          [
            ['locker', 'lockerRoom', HangerIcon],
            ['leaderboard', 'leaderboard', PodiumIcon],
            ['shop', 'shop', ShopIcon],
          ] as const
        ).map(([id, label, Icon], i) => (
          <button key={id} onClick={() => open(id)} className={`flex items-center justify-center gap-2 py-2.5 font-display text-lg font-bold uppercase tracking-wide hover:bg-white/10 sm:gap-3 sm:py-4 sm:text-2xl short:py-1.5 short:text-lg ${i ? 'border-l border-white/10' : ''}`}>
            <Icon className="h-7 w-7 sm:h-9 sm:w-9 short:h-6 short:w-6" />
            <span className="hidden xs:inline">{t(label)}</span>
          </button>
        ))}
      </div>

      {panel === 'settings' && <SettingsPanel />}
      {panel === 'locker' && <LockerPanel />}
      {panel === 'shop' && <ShopPanel />}
      {panel === 'leaderboard' && <LeaderboardPanel />}
    </div>
  )
}
