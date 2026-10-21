import { useState, type FormEvent } from 'react'
import { GymBackdrop } from '../components/Canvases'
import { BallIcon } from '../components/Icons'
import { Spinner } from '../components/ui'
import { USERNAME_RE, backend } from '../lib/api'
import { errorText } from '../lib/actions'
import { audio } from '../lib/audio'
import { useT } from '../lib/i18n'
import { useGame } from '../store/useGame'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 font-display font-bold ${className}`}>
      <BallIcon className="h-[1.1em] w-[1.1em]" />
      <span>
        <span className="text-brand">teb</span>Basket
      </span>
    </div>
  )
}

export default function Login() {
  const t = useT()
  const { setProfile, setScreen, guestLang, setGuestLang } = useGame()
  const online = backend.kind === 'supabase'
  const [signup, setSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    audio.unlock()
    setMsg(null)
    if ((!online || signup) && !USERNAME_RE.test(username)) {
      setMsg({ text: t('usernameRule'), err: true })
      return
    }
    setBusy(true)
    try {
      let p
      if (!online) p = await backend.enterGuest(username)
      else if (signup) p = await backend.signUp(email, password, username)
      else p = await backend.signIn(email, password)
      if (!p) {
        setMsg({ text: t('checkEmail'), err: false })
        setSignup(false)
      } else {
        if (!online) p = await backend.updateProfile({ settings: { ...p.settings, lang: guestLang } })
        setProfile(p)
        setScreen('lobby')
      }
    } catch (err) {
      setMsg({ text: errorText(err), err: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GymBackdrop className="absolute inset-0" />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute right-3 top-3 flex gap-1 rounded-lg bg-black/40 p-1">
        {(['pl', 'en'] as const).map((l) => (
          <button key={l} onClick={() => setGuestLang(l)} className={`rounded-md px-2.5 py-1 font-display font-bold uppercase ${guestLang === l ? 'bg-brand' : 'text-white/70'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="relative flex h-full items-center justify-center overflow-y-auto p-4">
        <form onSubmit={submit} className="panel w-full max-w-sm p-6 animate-[popIn_.2s_ease-out]">
          <Logo className="mb-1 justify-center text-5xl" />
          <p className="mb-5 text-center font-display text-lg uppercase tracking-widest text-white/60">1v1 arcade basketball</p>
          {online && <h2 className="mb-3 font-display text-2xl font-bold uppercase">{signup ? t('signupTitle') : t('loginTitle')}</h2>}
          {online && (
            <>
              <label className="label">{t('email')}</label>
              <input className="input mb-3" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <label className="label">{t('password')}</label>
              <input className="input mb-3" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </>
          )}
          {(!online || signup) && (
            <>
              <label className="label">{t('username')}</label>
              <input className="input mb-1" maxLength={16} required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="TEB_Player12" autoFocus={!online} />
              <p className="mb-3 text-xs text-white/50">{t('usernameRule')}</p>
            </>
          )}
          {msg && <p className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.err ? 'bg-red-500/25 text-red-200' : 'bg-emerald-500/25 text-emerald-100'}`}>{msg.text}</p>}
          <button className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-2xl" disabled={busy}>
            {busy && <Spinner />}
            {!online ? t('playAsGuest') : signup ? t('signup') : t('login')}
          </button>
          {online ? (
            <button type="button" className="mt-3 w-full text-sm text-white/70 underline-offset-2 hover:underline" onClick={() => setSignup((s) => !s)}>
              {signup ? t('haveAccount') : t('noAccount')}
            </button>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-white/55">{t('offlineNote')}</p>
          )}
        </form>
      </div>
    </div>
  )
}
