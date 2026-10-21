import { useState } from 'react'
import { Avatar, CharacterPreview } from '../../components/Canvases'
import { Jersey, LockIcon } from '../../components/Icons'
import { Modal, Tabs } from '../../components/ui'
import { saveProfile } from '../../lib/actions'
import { useT } from '../../lib/i18n'
import { HAIR_COLORS, HAIR_STYLES, OUTFITS, SKIN_TONES, buildLook } from '../../lib/outfits'
import { useGame } from '../../store/useGame'

export default function LockerPanel() {
  const t = useT()
  const { profile, setPanel } = useGame()
  const [tab, setTab] = useState<'outfits' | 'look'>('outfits')
  const [outfit, setOutfit] = useState(profile!.outfit)
  const [ap, setAp] = useState(profile!.appearance)
  const [saving, setSaving] = useState(false)
  if (!profile) return null
  const lang = profile.settings.lang
  const look = buildLook(outfit, ap)
  const dirty = outfit !== profile.outfit || JSON.stringify(ap) !== JSON.stringify(profile.appearance)

  const swatch = (color: string, active: boolean, onClick: () => void, key: string | number) => (
    <button key={key} onClick={onClick} className={`h-9 w-9 rounded-full border-2 ${active ? 'border-brand ring-2 ring-brand/60' : 'border-white/30'}`} style={{ background: color }} />
  )

  return (
    <Modal title={t('lockerRoom')} onClose={() => setPanel(null)} wide>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="mx-auto h-56 w-36 shrink-0 rounded-xl bg-gradient-to-b from-white/5 to-white/15 sm:h-80 sm:w-48">
          <CharacterPreview look={look} />
        </div>
        <div className="min-w-0 flex-1">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'outfits', label: t('outfits') },
              { id: 'look', label: t('look') },
            ]}
          />
          {tab === 'outfits' ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {OUTFITS.map((o) => {
                const owned = profile.ownedOutfits.includes(o.id)
                const active = outfit === o.id
                return (
                  <button
                    key={o.id}
                    onClick={() => (owned ? setOutfit(o.id) : setPanel('shop'))}
                    className={`relative rounded-xl border-2 p-1.5 text-left transition ${active ? 'border-brand bg-brand/15' : 'border-white/15 bg-black/20 hover:border-white/40'}`}
                    title={owned ? '' : t('locked')}
                  >
                    <Jersey jersey={o.jersey} jersey2={o.jersey2} pattern={o.pattern} trim={o.trim} shorts={o.shorts} number={ap.number} className="mx-auto h-20 w-16" />
                    <div className="truncate text-center font-display text-sm font-bold">{o.name[lang]}</div>
                    {!owned && (
                      <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/55">
                        <LockIcon className="h-6 w-6 text-white/80" />
                      </div>
                    )}
                    {active && <div className="absolute right-1 top-1 rounded bg-brand px-1 text-[10px] font-bold uppercase">{t('equipped')}</div>}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <span className="label">{t('skin')}</span>
                <div className="flex flex-wrap gap-2">{SKIN_TONES.map((c, i) => swatch(c, ap.skin === i, () => setAp({ ...ap, skin: i }), i))}</div>
              </div>
              <div>
                <span className="label">{t('hair')}</span>
                <div className="flex gap-2">
                  {Array.from({ length: HAIR_STYLES }, (_, i) => (
                    <button key={i} onClick={() => setAp({ ...ap, hair: i })} className={`h-16 w-16 overflow-hidden rounded-full border-[3px] ${ap.hair === i ? 'border-brand' : 'border-white/20'}`}>
                      <Avatar look={buildLook(outfit, { ...ap, hair: i })} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="label">{t('hairColor')}</span>
                <div className="flex flex-wrap gap-2">{HAIR_COLORS.map((c, i) => swatch(c, ap.hairColor === i, () => setAp({ ...ap, hairColor: i }), i))}</div>
              </div>
              <div>
                <span className="label">{t('jerseyNumber')}</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  className="input w-24 text-center font-display text-xl font-bold"
                  value={ap.number}
                  onChange={(e) => setAp({ ...ap, number: Math.max(0, Math.min(99, Math.floor(Number(e.target.value) || 0))) })}
                />
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button
              className="btn-primary px-6 py-2 text-xl"
              disabled={!dirty || saving}
              onClick={async () => {
                setSaving(true)
                await saveProfile({ outfit, appearance: ap }, t('saved'))
                setSaving(false)
              }}
            >
              {t('save')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
