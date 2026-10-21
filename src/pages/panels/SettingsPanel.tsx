import { useRef, useState } from 'react'
import { Currency, Modal } from '../../components/ui'
import { USERNAME_RE, backend } from '../../lib/api'
import { saveProfile, withProfile } from '../../lib/actions'
import { audio } from '../../lib/audio'
import { useT } from '../../lib/i18n'
import { useGame } from '../../store/useGame'
import type { Settings } from '../../types'

export default function SettingsPanel() {
  const t = useT()
  const { profile, setPanel, setProfile, setScreen, showToast } = useGame()
  const [name, setName] = useState(profile!.username)
  const [volume, setVolume] = useState(profile!.settings.volume)
  const volTimer = useRef<ReturnType<typeof setTimeout>>()
  if (!profile) return null
  const s = profile.settings

  const setSettings = (patch: Partial<Settings>) => {
    const next = { ...s, ...patch }
    // optimistic so toggles feel instant
    setProfile({ ...profile, settings: next })
    void saveProfile({ settings: next })
  }

  return (
    <Modal title={t('settings')} onClose={() => setPanel(null)}>
      <div className="space-y-5">
        <section>
          <h3 className="label">{t('sound')}</h3>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-black/30 p-1">
              {[true, false].map((on) => (
                <button key={String(on)} onClick={() => setSettings({ sound: on })} className={`rounded-md px-4 py-1 font-display text-lg font-bold ${s.sound === on ? 'bg-brand' : 'text-white/60'}`}>
                  {on ? t('on') : t('off')}
                </button>
              ))}
            </div>
            <span className="ml-2 text-sm text-white/60">{t('volume')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              disabled={!s.sound}
              onChange={(e) => {
                const v = Number(e.target.value)
                setVolume(v)
                audio.configure(s.sound, v)
                clearTimeout(volTimer.current)
                volTimer.current = setTimeout(() => {
                  audio.play('dribble')
                  setSettings({ volume: v })
                }, 250)
              }}
              className="flex-1 accent-[#f28c28]"
            />
          </div>
        </section>

        <section>
          <h3 className="label">{t('username')}</h3>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!USERNAME_RE.test(name)) return showToast(t('usernameRule'), 'err')
              await saveProfile({ username: name }, t('saved'))
            }}
          >
            <input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
            <button className="btn-primary px-4" disabled={name === profile.username}>
              {t('save')}
            </button>
          </form>
        </section>

        <section>
          <h3 className="label">{t('language')}</h3>
          <div className="flex w-fit rounded-lg bg-black/30 p-1">
            {(
              [
                ['pl', 'Polski'],
                ['en', 'English'],
              ] as const
            ).map(([l, label]) => (
              <button key={l} onClick={() => setSettings({ lang: l })} className={`rounded-md px-4 py-1 font-display text-lg font-bold ${s.lang === l ? 'bg-brand' : 'text-white/60'}`}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="label">{t('controls')}</h3>
          <p className="text-sm text-white/75">{t('controlsHelp')}</p>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/20 p-3">
          <h3 className="label">
            {t('account')} · {t('wallet')}
          </h3>
          <Currency coins={profile.coins} gems={profile.gems} />
          <p className="mt-2 text-xs text-white/50">{t('walletNote')}</p>
          <button
            className="btn-game mt-3 px-4 py-1.5 text-base"
            onClick={async () => {
              await backend.signOut()
              setPanel(null)
              setProfile(null)
              setScreen('login')
            }}
          >
            {t('logout')}
          </button>
          {backend.resetProgress && (
            <button
              className="btn-game ml-2 mt-3 border-red-300/70 px-4 py-1.5 text-base text-red-200"
              onClick={async () => {
                if (!window.confirm(t('resetConfirm'))) return
                await withProfile(() => backend.resetProgress!(), t('saved'))
              }}
            >
              {t('resetProgress')}
            </button>
          )}
        </section>
      </div>
    </Modal>
  )
}
