import { useState } from 'react'
import { CoinIcon, GemIcon, Jersey } from '../../components/Icons'
import { Currency, Modal, Tabs } from '../../components/ui'
import { backend } from '../../lib/api'
import { withProfile } from '../../lib/actions'
import { audio } from '../../lib/audio'
import { useT } from '../../lib/i18n'
import { GEM_EXCHANGE, GEM_PACKS, OUTFITS } from '../../lib/outfits'
import { useGame } from '../../store/useGame'
import type { Profile } from '../../types'

export default function ShopPanel() {
  const t = useT()
  const { profile, setPanel } = useGame()
  const [tab, setTab] = useState<'outfits' | 'coins' | 'gems'>('outfits')
  const [busy, setBusy] = useState<string | null>(null)
  if (!profile) return null
  const lang = profile.settings.lang

  const run = async (id: string, fn: () => Promise<Profile>) => {
    setBusy(id)
    const ok = await withProfile(fn, t('purchased'))
    if (ok) audio.play('cheer')
    setBusy(null)
  }

  return (
    <Modal title={t('shop')} onClose={() => setPanel(null)} wide>
      <div className="mb-3 flex justify-end">
        <Currency coins={profile.coins} gems={profile.gems} />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'outfits', label: t('outfits') },
          { id: 'coins', label: t('coins') },
          { id: 'gems', label: t('gems') },
        ]}
      />

      {tab === 'outfits' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {OUTFITS.filter((o) => o.price).map((o) => {
            const owned = profile.ownedOutfits.includes(o.id)
            const c = o.price!.coins ?? 0
            const g = o.price!.gems ?? 0
            const afford = profile.coins >= c && profile.gems >= g
            return (
              <div key={o.id} className="flex flex-col rounded-xl border border-white/15 bg-black/25 p-2">
                <Jersey jersey={o.jersey} jersey2={o.jersey2} pattern={o.pattern} trim={o.trim} shorts={o.shorts} number={profile.appearance.number} className="mx-auto mb-1 h-24 w-20" />
                <div className="mb-2 text-center font-display text-lg font-bold">{o.name[lang]}</div>
                {owned ? (
                  <div className="mt-auto rounded-lg bg-emerald-600/30 py-1.5 text-center font-display font-bold uppercase text-emerald-200">{t('owned')}</div>
                ) : (
                  <button
                    className="btn-primary mt-auto flex items-center justify-center gap-1.5 py-1.5 text-lg"
                    disabled={!afford || busy !== null}
                    title={afford ? '' : t('notEnough')}
                    onClick={() => run(o.id, () => backend.buyOutfit(o.id))}
                  >
                    {c > 0 ? <CoinIcon className="h-5 w-5" /> : <GemIcon className="h-5 w-5" />}
                    {(c || g).toLocaleString('pl-PL')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'coins' && (
        <div className="grid gap-3 sm:grid-cols-3">
          {GEM_EXCHANGE.map((x) => (
            <div key={x.id} className="flex flex-col items-center rounded-xl border border-white/15 bg-black/25 p-4">
              <CoinIcon className="mb-1 h-12 w-12" />
              <div className="font-display text-3xl font-bold">{x.coins.toLocaleString('pl-PL')}</div>
              <button className="btn-primary mt-3 flex w-full items-center justify-center gap-1.5 py-1.5 text-lg" disabled={profile.gems < x.gems || busy !== null} onClick={() => run(x.id, () => backend.exchangeGems(x.id))}>
                {t('exchange')} <GemIcon className="h-5 w-5" /> {x.gems}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'gems' && (
        <>
          <p className="mb-3 rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-100">{t('demoPayments')}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {GEM_PACKS.map((x) => (
              <div key={x.id} className="flex flex-col items-center rounded-xl border border-white/15 bg-black/25 p-4">
                <GemIcon className="mb-1 h-12 w-12" />
                <div className="font-display text-3xl font-bold">{x.gems.toLocaleString('pl-PL')}</div>
                <button className="btn-primary mt-3 w-full py-1.5 text-lg" disabled={busy !== null} onClick={() => run(x.id, () => backend.mockPurchase(x.id))}>
                  {x.price}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
