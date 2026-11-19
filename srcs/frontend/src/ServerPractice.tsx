import { useEffect, useState } from 'react'
import type { Publication, RoundPrompt } from '../../core/protocol'
import { api } from './api'
import { RoundBoard } from './RoundBoard'

const storageKey = 'cube-development-round'
export function ServerPractice({ onBack }: { onBack: () => void }) {
  const [roundId, setRoundId] = useState<string | null>(() => localStorage.getItem(storageKey))
  const [prompt, setPrompt] = useState<RoundPrompt>()
  const [publication, setPublication] = useState<Publication>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!roundId) return
    const controller = new AbortController()
    const state = { stopped: false, timer: 0 }
    const refresh = async () => {
      const round = await api<RoundPrompt>(`/rounds/${roundId}`, 'GET', undefined, controller.signal)
      if (state.stopped) return
      if (!round.ok) { setError(round.error); return }
      setPrompt(round.data)
      const result = await api<Publication>(`/rounds/${roundId}/result`, 'GET', undefined, controller.signal)
      if (state.stopped) return
      if (!result.ok) { setError(result.error); return }
      setPublication(result.data)
      if (result.data.status !== 'complete') state.timer = window.setTimeout(() => { void refresh() }, 750)
    }
    void refresh()
    return () => { state.stopped = true; controller.abort(); window.clearTimeout(state.timer) }
  }, [roundId])

  const start = async () => {
    setBusy(true); setError('')
    const session = await api('/dev/session', 'POST')
    if (!session.ok) { setError(session.error); setBusy(false); return }
    const round = await api<RoundPrompt>('/rounds', 'POST')
    setBusy(false)
    if (!round.ok) { setError(round.error); return }
    localStorage.setItem(storageKey, round.data.roundId)
    setPublication(undefined); setPrompt(round.data); setRoundId(round.data.roundId)
  }
  return <main className="practice-shell"><header className="practice-header"><div><p className="eyebrow">Backend practice · local development</p><h1>One round, saved on the server.</h1><p className="lede">Submit once and retrieve the official result after scoring.</p></div><button className="secondary" onClick={onBack}>Back to local tools</button></header><section className="card"><button className="primary" disabled={busy || (!!prompt && publication?.status !== 'complete')} onClick={() => { void start() }}>{busy ? 'Working…' : 'Start a 15-second round'}</button>{error && <p role="alert" className="import-error">{error}</p>}{error && <button className="text-button" onClick={() => { setRoundId(null); setPrompt(undefined); localStorage.removeItem(storageKey); setError('') }}>Forget saved round</button>}</section>{prompt && <RoundBoard key={prompt.roundId} prompt={prompt} publication={publication ?? null} />}</main>
}
