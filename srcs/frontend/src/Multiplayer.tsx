import { useEffect, useState } from 'react'
import type { Account, RoomView } from '../../core/protocol'
import { api } from './api'
import { RoundBoard } from './RoundBoard'

const roomKey = 'cube-room'
export function Multiplayer({ onBack }: { onBack: () => void }) {
  const [account, setAccount] = useState<Account>()
  const [checked, setChecked] = useState(false)
  const [signup, setSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [label, setLabel] = useState('')
  const [roomId, setRoomId] = useState<string | null>(() => localStorage.getItem(roomKey))
  const [room, setRoom] = useState<RoomView>()
  const [joinId, setJoinId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [connection, setConnection] = useState('Disconnected')

  useEffect(() => {
    void api<Account>('/auth/me').then(reply => { if (reply.ok) setAccount(reply.data); setChecked(true) })
  }, [])
  useEffect(() => {
    if (!account || !roomId) return
    const state = { stopped: false, socket: undefined as WebSocket | undefined, timer: 0, attempts: 0 }
    const connect = () => {
      if (state.stopped) return
      setConnection('Connecting…')
      const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/events?roomId=${encodeURIComponent(roomId)}`)
      state.socket = socket
      socket.onopen = () => { state.attempts = 0; setConnection('Connected') }
      socket.onmessage = event => {
        // Messages originate from our same-origin authenticated backend snapshot stream.
        void Promise.resolve(String(event.data)).then(raw => {
          const snapshot = JSON.parse(raw) as { type: string; room: RoomView }
          if (snapshot.type === 'room.snapshot') setRoom(snapshot.room)
        }).catch(() => socket.close(1002, 'Invalid server message.'))
      }
      socket.onerror = () => socket.close()
      socket.onclose = event => {
        if (state.stopped) return
        setConnection('Reconnecting…')
        if (event.code === 1008) { setError('Your session or room membership ended. Sign in or leave this room.'); setConnection('Disconnected'); return }
        state.attempts += 1
        state.timer = window.setTimeout(connect, Math.min(5000, 500 * state.attempts))
      }
    }
    void api<RoomView>(`/rooms/${roomId}`).then(reply => {
      if (state.stopped) return
      if (!reply.ok) { setError(reply.error); return }
      setRoom(reply.data); connect()
    })
    return () => { state.stopped = true; clearTimeout(state.timer); state.socket?.close() }
  }, [account?.id, roomId])

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault(); setError('')
    if (signup && !/^[\p{L}\p{N} _-]{2,32}$/u.test(label.trim())) { setError('Use a 2–32 character name with letters, numbers, spaces, underscores or hyphens.'); return }
    setBusy(true)
    const reply = await api<Account>(`/auth/${signup ? 'signup' : 'login'}`, 'POST', { email: email.trim(), password, ...(signup ? { label: label.trim() } : {}) })
    setBusy(false); setPassword('')
    if (!reply.ok) { setError(reply.error); return }
    setAccount(reply.data); setRoom(undefined)
  }
  const act = async (path: string, body?: unknown) => {
    setBusy(true); setError('')
    const reply = await api<RoomView>(path, 'POST', body)
    setBusy(false)
    if (!reply.ok) { setError(reply.error); return }
    setRoom(reply.data); setRoomId(reply.data.roomId); localStorage.setItem(roomKey, reply.data.roomId)
  }
  const leave = async () => {
    if (roomId) {
      const reply = await api(`/rooms/${roomId}/leave`, 'POST')
      if (!reply.ok && reply.status !== 404 && reply.status !== 401) { setError(reply.error); return }
    }
    setRoomId(null); setRoom(undefined); localStorage.removeItem(roomKey); setError('')
  }
  const logout = async () => {
    if (roomId) await api(`/rooms/${roomId}/leave`, 'POST')
    const reply = await api('/auth/logout', 'POST')
    if (!reply.ok) { setError(reply.error); return }
    setAccount(undefined); setRoom(undefined); setRoomId(null); localStorage.removeItem(roomKey)
  }
  const me = room?.members.find(member => member.userId === account?.id)
  const activeRound = !!room?.prompt && room.publication?.status !== 'complete'

  return <main className="practice-shell"><header className="practice-header"><div><p className="eyebrow">Multiplayer · 1–4 players</p><h1>Draw together. Compare afterward.</h1><p className="lede">Everyone receives the same prompt and server timer. Your strokes stay private until scoring.</p></div><button className="secondary" onClick={onBack}>Back to local tools</button></header>
    {error && <section className="card"><p role="alert" className="import-error">{error}</p></section>}
    {!checked ? <p>Checking session…</p> : !account ? <section className="card"><h2>{signup ? 'Create an account' : 'Sign in'}</h2><form onSubmit={event => { void authenticate(event) }} className="creator-controls"><label className="creator-field">Email<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>{signup && <label className="creator-field">Display name<input required minLength={2} maxLength={32} value={label} onChange={event => setLabel(event.target.value)} /></label>}<label className="creator-field">Password (15–128 characters)<input type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={15} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></label><button className="primary" disabled={busy}>{busy ? 'Working…' : signup ? 'Create account' : 'Sign in'}</button></form><button className="text-button" onClick={() => { setSignup(!signup); setError('') }}>{signup ? 'Already registered? Sign in' : 'Create an account'}</button></section> : <>
      <section className="card"><div className="action-row"><strong>{account.label}</strong><button className="text-button" onClick={() => { void logout() }}>Sign out</button></div>{!roomId ? <><button className="primary" disabled={busy} onClick={() => { void act('/rooms') }}>Create room</button><form className="action-row" onSubmit={event => { event.preventDefault(); if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(joinId.trim())) { setError('Enter a complete room ID.'); return } void act(`/rooms/${joinId.trim()}/join`) }}><label>Room ID<input required aria-label="Room ID" value={joinId} onChange={event => setJoinId(event.target.value)} /></label><button className="secondary" disabled={busy}>Join room</button></form></> : <><p>Room ID: <strong style={{ overflowWrap: 'anywhere' }}>{roomId}</strong></p><p>{connection} · Share this ID with up to three other players.</p><ul>{room?.members.map(member => <li key={member.userId}>{member.label}{member.userId === account.id ? ' (you)' : ''}{member.userId === room.hostId ? ' · host' : ''} · {member.connected ? 'online' : 'offline'} · {member.ready ? 'ready' : 'not ready'}</li>)}</ul><div className="action-row"><button className="secondary" disabled={busy || activeRound || !room} onClick={() => { void act(`/rooms/${roomId}/ready`, { ready: !me?.ready }) }}>{me?.ready ? 'Not ready' : 'Ready'}</button>{room?.hostId === account.id && <button className="primary" disabled={busy || activeRound || !room.members.every(member => member.ready)} onClick={() => { void act(`/rooms/${roomId}/start`) }}>Start round</button>}<button className="text-button" onClick={() => { void leave() }}>Leave room</button></div></>}</section>
      {room?.prompt && <RoundBoard key={room.prompt.roundId} prompt={room.prompt} publication={room.publication} userId={account.id} />}
    </>}
  </main>
}
