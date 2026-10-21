import { useEffect } from 'react'
import { Spinner, Toast } from './components/ui'
import { backend } from './lib/api'
import { audio } from './lib/audio'
import Lobby from './pages/Lobby'
import Login from './pages/Login'
import MatchScreen from './pages/MatchScreen'
import Results from './pages/Results'
import { useGame } from './store/useGame'

export default function App() {
  const { screen, profile, matchId, setProfile, setScreen } = useGame()

  useEffect(() => {
    backend
      .restore()
      .then((p) => {
        setProfile(p)
        setScreen(p ? 'lobby' : 'login')
      })
      .catch(() => setScreen('login'))
    const unlock = () => audio.unlock()
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [setProfile, setScreen])

  useEffect(() => {
    if (profile) {
      audio.configure(profile.settings.sound, profile.settings.volume)
      document.documentElement.lang = profile.settings.lang
    }
  }, [profile])

  return (
    <>
      {screen === 'boot' && (
        <div className="grid h-full place-items-center">
          <Spinner />
        </div>
      )}
      {screen === 'login' && <Login />}
      {screen === 'lobby' && <Lobby />}
      {screen === 'match' && <MatchScreen key={matchId} />}
      {screen === 'results' && <Results />}
      <Toast />
    </>
  )
}
