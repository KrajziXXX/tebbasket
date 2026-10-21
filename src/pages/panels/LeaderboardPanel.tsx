import { useCallback, useEffect, useState } from 'react'
import { Modal, Spinner } from '../../components/ui'
import { backend } from '../../lib/api'
import { errorText } from '../../lib/actions'
import { useT } from '../../lib/i18n'
import { useGame } from '../../store/useGame'
import type { LeaderboardEntry } from '../../types'
import { LevelBadge } from '../Lobby'

export default function LeaderboardPanel() {
  const t = useT()
  const setPanel = useGame((s) => s.setPanel)
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    backend
      .leaderboard()
      .then((r) => {
        setRows(r)
        setError(null)
      })
      .catch((e) => setError(errorText(e)))
  }, [])

  useEffect(() => {
    load()
    return backend.onLeaderboardChange(load)
  }, [load])

  const myIdx = rows?.findIndex((r) => r.isMe) ?? -1
  const medal = ['#f5c542', '#c9d1d9', '#d08a4a']

  return (
    <Modal title={t('leaderboard')} onClose={() => setPanel(null)}>
      <div className="mb-3 flex items-center justify-between gap-2 text-sm text-white/60">
        <span>
          {backend.kind === 'supabase' ? (
            <>
              <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              {t('liveBoard')}
            </>
          ) : (
            t('localBoard')
          )}
        </span>
        {myIdx >= 0 && (
          <span className="font-display text-lg font-bold text-white">
            {t('yourPlace')}: #{myIdx + 1}
          </span>
        )}
      </div>
      {error && <p className="rounded-lg bg-red-500/25 px-3 py-2 text-sm">{error}</p>}
      {!rows && !error && (
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      )}
      {rows && (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-[3rem_1fr_3.5rem_4.5rem_4rem] bg-black/40 px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-white/50">
            <span>{t('rank')}</span>
            <span>{t('player')}</span>
            <span className="text-center">Lv</span>
            <span className="text-right">{t('rating')}</span>
            <span className="text-right">{t('wins')}</span>
          </div>
          {rows.map((r, i) => (
            <div key={r.id} className={`grid grid-cols-[3rem_1fr_3.5rem_4.5rem_4rem] items-center px-2 py-1.5 font-display text-lg ${r.isMe ? 'bg-brand/30 font-bold' : i % 2 ? 'bg-white/[0.03]' : ''}`}>
              <span className="font-bold" style={{ color: medal[i] }}>
                {i + 1}
              </span>
              <span className="truncate">{r.username}</span>
              <span className="flex justify-center">
                <LevelBadge level={r.level} className="h-7 w-6 text-sm [&>span]:text-sm" />
              </span>
              <span className="text-right font-bold">{r.rating}</span>
              <span className="text-right text-white/70">{r.wins}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
