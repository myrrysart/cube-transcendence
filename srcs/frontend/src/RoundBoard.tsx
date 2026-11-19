import { useEffect, useRef, useState } from 'react'
import type { FinalDrawing, Point, Stroke } from '../../core/game-engine'
import type { Publication, RoundPrompt } from '../../core/protocol'
import { api } from './api'

export function RoundBoard({ prompt, publication, userId }: { prompt: RoundPrompt; publication: Publication | null; userId?: string }) {
  const [strokes, setStrokes] = useState<readonly Stroke[]>([])
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())
  const active = useRef(false)
  const finished = publication?.status === 'complete' ? publication : undefined
  const ownId = finished?.participants.find(p => p.userId === userId)?.participantId
  const player = finished?.result.players.find(p => p.participantId === ownId) ?? (!userId ? finished?.result.players[0] : undefined)
  const displayed = player?.drawing.strokes ?? strokes
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.ceil((Date.parse(prompt.endsAt) - now) / 1000))
  const started = now >= Date.parse(prompt.startsAt)
  const canDraw = started && seconds > 0 && !accepted && !busy && !finished
  const point = (event: React.PointerEvent<SVGSVGElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) }
  }
  const pointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!canDraw || strokes.length >= 256) return
    event.currentTarget.setPointerCapture(event.pointerId); active.current = true
    const first = point(event)
    setStrokes(current => [...current, { points: [first] }])
  }
  const pointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!active.current || !canDraw) return
    const next = point(event)
    setStrokes(current => {
      if ((current[current.length - 1]?.points.length ?? 0) >= 4096 || current.reduce((sum, stroke) => sum + stroke.points.length, 0) >= 16384) return current
      return current.map((stroke, index) => index === current.length - 1 ? { points: [...stroke.points, next] } : stroke)
    })
  }
  const submit = async () => {
    active.current = false; setBusy(true); setError('')
    const drawing: FinalDrawing = { inputVersion: 1, strokes }
    const reply = await api<{ accepted: true }>(`/rounds/${prompt.roundId}/submission`, 'POST', drawing)
    setBusy(false)
    if (!reply.ok) { if (reply.error === 'duplicate') setAccepted(true); setError(reply.error); return }
    setAccepted(true)
  }
  return <div className="practice-layout"><section className="card">
    <p aria-live="polite">{finished ? 'Result saved' : !started ? 'Round starting…' : accepted ? `Drawing accepted · ${seconds}s remaining` : `${seconds}s remaining`}</p>
    <svg viewBox="0 0 1 1" aria-label="Round drawing canvas" role="img" style={{ width: '100%', aspectRatio: '1', background: '#f7faf8', touchAction: 'none', cursor: canDraw ? 'crosshair' : 'default' }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { active.current = false }} onPointerCancel={() => { active.current = false }} onLostPointerCapture={() => { active.current = false }}>
      {prompt.referenceEdges.map((edge, index) => <polyline key={index} points={edge.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#17775c" strokeWidth=".008" />)}
      {finished?.challenge.edges.filter(edge => edge.role === 'target').map(edge => <polyline key={edge.id} points={edge.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#999" strokeDasharray=".012 .008" strokeWidth=".003" />)}
      {displayed.map((stroke, i) => <g key={i}>{stroke.points.length === 1 && <circle cx={stroke.points[0].x} cy={stroke.points[0].y} r=".004" fill={player ? player.feedback.strokes[i].outcomes[0] === 'on_target' ? '#17775c' : '#d95d47' : '#253b45'} />}{stroke.points.slice(1).map((end, j) => <line key={j} x1={stroke.points[j].x} y1={stroke.points[j].y} x2={end.x} y2={end.y} stroke={player ? player.feedback.strokes[i].outcomes[j + 1] === 'on_target' ? '#17775c' : '#d95d47' : '#253b45'} strokeWidth=".005" strokeLinecap="round" />)}</g>)}
    </svg><div className="action-row"><button className="secondary" disabled={!canDraw} onClick={() => setStrokes([])}>Clear drawing</button><button className="primary" disabled={!canDraw} onClick={() => { void submit() }}>Submit final drawing</button></div>{error && <p role="alert" className="import-error">{error}</p>}
  </section><aside className="card result-card" aria-live="polite"><h2>{player ? `Your score: ${Math.round(player.score)}% · rank ${player.rank}` : seconds === 0 ? 'Waiting for scoring…' : 'Drawings stay private until results.'}</h2>
    {finished && <><h3>Official results</h3><ol>{finished.result.players.map(result => <li key={result.participantId}><strong>#{result.rank} {finished.participants.find(p => p.participantId === result.participantId)?.label}</strong>: {Math.round(result.score)}% {finished.participants.find(p => p.participantId === result.participantId)?.timedOut ? '(timed out)' : ''}<svg viewBox="0 0 1 1" aria-label="Final player drawing" style={{ width: '100%', maxWidth: 200, background: '#f7faf8' }}>{prompt.referenceEdges.map((edge, i) => <polyline key={i} points={edge.points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#17775c" strokeWidth=".01" />)}{result.drawing.strokes.map((stroke, i) => <g key={`stroke-${i}`}>{stroke.points.length === 1 && <circle cx={stroke.points[0].x} cy={stroke.points[0].y} r=".008" fill={result.feedback.strokes[i].outcomes[0] === 'on_target' ? '#17775c' : '#d95d47'} />}{stroke.points.slice(1).map((point, j) => <line key={j} x1={stroke.points[j].x} y1={stroke.points[j].y} x2={point.x} y2={point.y} stroke={result.feedback.strokes[i].outcomes[j + 1] === 'on_target' ? '#17775c' : '#d95d47'} strokeWidth=".008" />)}</g>)}</svg></li>)}</ol>{player && <ul>{player.feedback.targets.map(target => <li key={target.edgeId}>{target.edgeId}: {Math.round(target.coverage * 100)}% coverage</li>)}</ul>}<p>Refresh to retrieve this same official result.</p></>}
    <p className="keyboard-note">Round: {prompt.roundId}</p>
  </aside></div>
}
