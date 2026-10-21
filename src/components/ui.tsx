import { useEffect, type ReactNode } from 'react'
import { audio } from '../lib/audio'
import { useGame } from '../store/useGame'
import { CloseIcon, CoinIcon, GemIcon } from './Icons'

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-2 animate-[fadeIn_.15s_ease-out]" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`panel flex max-h-[94dvh] w-full flex-col ${wide ? 'max-w-4xl' : 'max-w-xl'} animate-[popIn_.18s_ease-out]`}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 sm:px-5">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide">{title}</h2>
          <button
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => {
              audio.play('click')
              onClose()
            }}
            aria-label="close"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  )
}

export function Currency({ coins, gems, onAdd }: { coins: number; gems: number; onAdd?: () => void }) {
  return (
    <div className="flex items-center gap-3 sm:gap-5">
      <span className="flex items-center gap-1.5 font-display text-lg font-bold sm:text-xl">
        <CoinIcon className="h-6 w-6" />
        {coins.toLocaleString('pl-PL')}
        {onAdd && <AddBtn onClick={onAdd} color="bg-coin" />}
      </span>
      <span className="flex items-center gap-1.5 font-display text-lg font-bold sm:text-xl">
        <GemIcon className="h-6 w-6" />
        {gems.toLocaleString('pl-PL')}
        {onAdd && <AddBtn onClick={onAdd} color="bg-gem" />}
      </span>
    </div>
  )
}

function AddBtn({ onClick, color }: { onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className={`ml-0.5 grid h-5 w-5 place-items-center rounded-full ${color} text-sm leading-none text-black/70 hover:brightness-110`} aria-label="add">
      +
    </button>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string }[] }) {
  return (
    <div className="mb-4 flex gap-1 rounded-xl bg-black/30 p-1">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => {
            audio.play('click')
            onChange(it.id)
          }}
          className={`flex-1 rounded-lg px-3 py-1.5 font-display text-lg font-bold uppercase tracking-wide transition ${value === it.id ? 'bg-brand text-white shadow' : 'text-white/70 hover:bg-white/10'}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function Toast() {
  const toast = useGame((s) => s.toast)
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => useGame.setState((s) => (s.toast?.id === toast.id ? { toast: null } : s)), 2600)
    return () => clearTimeout(id)
  }, [toast])
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-3">
      <div key={toast.id} className={`rounded-xl px-4 py-2 font-display text-lg font-bold shadow-xl animate-[popIn_.18s_ease-out] ${toast.tone === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>
        {toast.text}
      </div>
    </div>
  )
}

export function Spinner() {
  return <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
}
