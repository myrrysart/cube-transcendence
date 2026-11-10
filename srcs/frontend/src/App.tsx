import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as engine from '../../core/game-engine/index'
import { type CreatorDraft, type FinalDrawing, type Point, type SavedChallenge, type Stroke, type EdgeRole, type ProjectionKind } from '../../core/game-engine/index'

const saved: SavedChallenge = {
  draft: {
    sourceVersion: 1, challengeId: 'practice-cube-01',
    cube: { cubeId: 'cube-01', center: { x: 0, y: 0, z: 0 }, size: 1, rotationDegrees: { x: 0, y: 0, z: 0 } },
    camera: { orbitDegrees: { yaw: 35, pitch: 18 }, distance: 4, fieldOfViewDegrees: 48, projection: 'perspective' },
    referenceFaceId: 'x:1',
    roles: { 'x:0:0': 'target', 'x:0:1': 'target', 'x:1:0': 'reference', 'x:1:1': 'reference', 'y:0:0': 'target', 'y:0:1': 'reference', 'y:1:0': 'hidden', 'y:1:1': 'hidden', 'z:0:0': 'target', 'z:0:1': 'reference', 'z:1:0': 'hidden', 'z:1:1': 'hidden' },
    hitTolerance: 0.035,
  },
  challenge: {
    challengeVersion: 2, challengeId: 'practice-cube-01', projection: 'perspective', referenceFaceId: 'x:1', hitTolerance: 0.035, completionThreshold: 0.8,
    edges: [
      { id: 'reference-top', role: 'reference', points: [{ x: .28, y: .28 }, { x: .62, y: .28 }] },
      { id: 'reference-right', role: 'reference', points: [{ x: .62, y: .28 }, { x: .62, y: .62 }] },
      { id: 'reference-bottom', role: 'reference', points: [{ x: .62, y: .62 }, { x: .28, y: .62 }] },
      { id: 'reference-left', role: 'reference', points: [{ x: .28, y: .62 }, { x: .28, y: .28 }] },
      { id: 'target-top-right', role: 'target', points: [{ x: .62, y: .28 }, { x: .78, y: .18 }] },
      { id: 'target-right-back', role: 'target', points: [{ x: .62, y: .62 }, { x: .78, y: .52 }] },
      { id: 'target-bottom-back', role: 'target', points: [{ x: .78, y: .52 }, { x: .78, y: .18 }] },
      { id: 'target-top-back', role: 'target', points: [{ x: .28, y: .28 }, { x: .44, y: .18 }] },
      { id: 'hidden-1', role: 'hidden', points: [{ x: .28, y: .62 }, { x: .44, y: .52 }] },
      { id: 'hidden-2', role: 'hidden', points: [{ x: .44, y: .18 }, { x: .78, y: .18 }] },
      { id: 'hidden-3', role: 'hidden', points: [{ x: .44, y: .52 }, { x: .78, y: .52 }] },
      { id: 'hidden-4', role: 'hidden', points: [{ x: .44, y: .18 }, { x: .44, y: .52 }] },
    ],
  },
}

type Result = engine.GameResult['players'][number]

type JsonRecord = Record<string, unknown>
type ImportResult = { ok: true; record: SavedChallenge } | { ok: false; error: string }

const edgeIds = ['x:0:0', 'x:0:1', 'x:1:0', 'x:1:1', 'y:0:0', 'y:0:1', 'y:1:0', 'y:1:1', 'z:0:0', 'z:0:1', 'z:1:0', 'z:1:1']
const faceIds = ['x:0', 'x:1', 'y:0', 'y:1', 'z:0', 'z:1']
const faceEdges: Record<string, string[]> = { 'x:0': ['y:0:0', 'y:1:0', 'z:0:0', 'z:1:0'], 'x:1': ['y:0:1', 'y:1:1', 'z:0:1', 'z:1:1'], 'y:0': ['x:0:0', 'x:1:0', 'z:0:0', 'z:0:1'], 'y:1': ['x:0:1', 'x:1:1', 'z:1:0', 'z:1:1'], 'z:0': ['x:0:0', 'x:1:0', 'y:0:0', 'y:1:0'], 'z:1': ['x:0:1', 'x:1:1', 'y:0:1', 'y:1:1'] }
const defaultRoles = Object.fromEntries(edgeIds.map((id) => [id, faceEdges['x:1'].includes(id) ? 'reference' : 'target'])) as Record<string, EdgeRole>
const creatorStart: CreatorDraft = { sourceVersion: 1, challengeId: 'my-cube-challenge', cube: { cubeId: 'cube-01', center: { x: 0, y: 0, z: 0 }, size: 2, rotationDegrees: { x: 0, y: 0, z: 0 } }, camera: { orbitDegrees: { yaw: 35, pitch: 18 }, distance: 4, fieldOfViewDegrees: 75, projection: 'perspective' }, referenceFaceId: 'x:1', roles: defaultRoles, hitTolerance: 0.035 }

const isRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isProjection = (value: unknown): value is SavedChallenge['challenge']['projection'] => value === 'orthographic' || value === 'perspective' || value === 'curvilinear_fisheye'
const isRole = (value: unknown): value is 'reference' | 'target' | 'hidden' => value === 'reference' || value === 'target' || value === 'hidden'
const isPoint = (value: unknown): boolean => isRecord(value) && isFiniteNumber(value.x) && value.x >= 0 && value.x <= 1 && isFiniteNumber(value.y) && value.y >= 0 && value.y <= 1
const creatorEdgeIds = edgeIds

const validateSavedChallenge = (value: unknown): ImportResult => {
  if (!isRecord(value) || !isRecord(value.draft) || !isRecord(value.challenge)) return { ok: false, error: 'Record must contain both draft and challenge objects.' }
  const draft = value.draft
  const challenge = value.challenge
  const cube = draft.cube
  const camera = draft.camera
  const orbit = isRecord(camera) ? camera.orbitDegrees : undefined
  const center = isRecord(cube) ? cube.center : undefined
  const rotation = isRecord(cube) ? cube.rotationDegrees : undefined
  const roles = draft.roles
  if (draft.sourceVersion !== 1 || typeof draft.challengeId !== 'string' || !draft.challengeId || !isRecord(cube) || typeof cube.cubeId !== 'string' || !isRecord(center) || !isFiniteNumber(center.x) || !isFiniteNumber(center.y) || !isFiniteNumber(center.z) || !isFiniteNumber(cube.size) || !isRecord(rotation) || !isFiniteNumber(rotation.x) || !isFiniteNumber(rotation.y) || !isFiniteNumber(rotation.z) || !isRecord(camera) || !isRecord(orbit) || !isFiniteNumber(orbit.yaw) || !isFiniteNumber(orbit.pitch) || !isFiniteNumber(camera.distance) || !isFiniteNumber(camera.fieldOfViewDegrees) || !isProjection(camera.projection) || typeof draft.referenceFaceId !== 'string' || !draft.referenceFaceId || !isRecord(roles) || !Object.values(roles).every(isRole) || !creatorEdgeIds.every((id) => isRole(roles[id])) || !isFiniteNumber(draft.hitTolerance)) return { ok: false, error: 'Draft is incomplete or has invalid values.' }
  if (challenge.challengeVersion !== 2 || typeof challenge.challengeId !== 'string' || !challenge.challengeId || challenge.challengeId !== draft.challengeId || !isProjection(challenge.projection) || typeof challenge.referenceFaceId !== 'string' || !challenge.referenceFaceId || !isFiniteNumber(challenge.hitTolerance) || challenge.hitTolerance <= 0 || !isFiniteNumber(challenge.completionThreshold) || challenge.completionThreshold !== 0.8 || !Array.isArray(challenge.edges) || challenge.edges.length === 0) return { ok: false, error: 'Challenge metadata is incomplete or invalid.' }
  const edges = challenge.edges
  if (!edges.every((edge) => isRecord(edge) && typeof edge.id === 'string' && edge.id.length > 0 && isRole(edge.role) && Array.isArray(edge.points) && edge.points.length >= 2 && edge.points.every(isPoint))) return { ok: false, error: 'Challenge edges must contain normalized point paths.' }
  if (!edges.some((edge) => isRecord(edge) && edge.role === 'reference') || !edges.some((edge) => isRecord(edge) && edge.role === 'target')) return { ok: false, error: 'Challenge needs reference and target paths.' }
  return { ok: true, record: value as unknown as SavedChallenge }
}

const parseSavedChallenge = (text: string): ImportResult => {
  try {
    return validateSavedChallenge(JSON.parse(text) as unknown)
  } catch {
    return { ok: false, error: 'Paste valid JSON before loading the challenge.' }
  }
}

const normalizedPoint = (event: React.PointerEvent<SVGSVGElement>, surface: SVGSVGElement): Point => {
  const transform = surface.getScreenCTM()
  if (!transform) return { x: 0, y: 0 }
  const screenPoint = surface.createSVGPoint()
  screenPoint.x = event.clientX
  screenPoint.y = event.clientY
  const viewBoxPoint = screenPoint.matrixTransform(transform.inverse())
  return { x: Math.max(0, Math.min(1, viewBoxPoint.x)), y: Math.max(0, Math.min(1, viewBoxPoint.y)) }
}

const pointsToString = (points: readonly Point[]): string => points.map((point) => `${point.x},${point.y}`).join(' ')

function DrawingSurface({ surfaceRef, challenge, strokes, feedback, onStart, onMove, onEnd }: { surfaceRef: React.RefObject<SVGSVGElement | null>; challenge: SavedChallenge['challenge']; strokes: readonly Stroke[]; feedback: Result['feedback'] | undefined; onStart: (event: React.PointerEvent<SVGSVGElement>) => void; onMove: (event: React.PointerEvent<SVGSVGElement>) => void; onEnd: () => void }) {
  return <svg ref={surfaceRef} className="drawing-surface" viewBox="0 0 1 1" role="img" aria-label="Drawing surface. The solid square is your reference face." onPointerDown={onStart} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} onLostPointerCapture={onEnd}>
    <rect width="1" height="1" className="surface-grid" />
    {challenge.edges.filter((edge) => edge.role === 'reference').map((edge) => <polyline key={edge.id} points={pointsToString(edge.points)} className="reference-path" />)}
    {feedback && challenge.edges.filter((edge) => edge.role === 'target').map((edge) => <polyline key={edge.id} points={pointsToString(edge.points)} className="answer-guide" />)}
    {strokes.map((stroke, strokeIndex) => <polyline key={strokeIndex} points={pointsToString(stroke.points)} className="player-stroke" />)}
    {feedback && strokes.map((stroke, strokeIndex) => stroke.points.slice(1).map((point, pointIndex) => { const previous = stroke.points[pointIndex]; const outcome = feedback.strokes[strokeIndex]?.outcomes[pointIndex + 1]; return previous ? <line key={`${strokeIndex}-${pointIndex}`} x1={previous.x} y1={previous.y} x2={point.x} y2={point.y} className={outcome === 'on_target' ? 'feedback-on' : 'feedback-off'} /> : null }))}
  </svg>
}

function Creator({ draft, setDraft, onOpenSolo }: { draft: CreatorDraft; setDraft: (next: CreatorDraft) => void; onOpenSolo: (record: SavedChallenge) => void }) {
  const compiled = engine.compileChallenge(draft)
  const edgeRefs = useRef<Record<string, SVGPolylineElement | null>>({})
  const [edgeLabelPositions, setEdgeLabelPositions] = useState<Record<string, Point>>({})
  const [lastValidEdges, setLastValidEdges] = useState<engine.Challenge['edges'] | undefined>(undefined)
  const [roleMenu, setRoleMenu] = useState<{ edgeId: string; x: number; y: number } | undefined>(undefined)
  const dragStart = useRef<{ x: number; y: number; yaw: number; pitch: number } | undefined>(undefined)
  const previewRef = useRef<SVGSVGElement | null>(null)
  useEffect(() => { if (compiled.ok) setLastValidEdges(compiled.challenge.edges) }, [draft])
  useLayoutEffect(() => {
    if (!compiled.ok) {
      setEdgeLabelPositions({})
      return
    }
    const positions = Object.fromEntries(compiled.challenge.edges.map((edge) => {
      const path = edgeRefs.current[edge.id]
      if (!path) return [edge.id, undefined]
      const midpoint = path.getPointAtLength(path.getTotalLength() / 2)
      return [edge.id, { x: midpoint.x, y: midpoint.y }]
    }).filter((entry): entry is [string, Point] => entry[1] !== undefined)) as Record<string, Point>
    setEdgeLabelPositions(positions)
  }, [draft, compiled.ok])
  const update = (patch: Partial<CreatorDraft>) => setDraft({ ...draft, ...patch })
  const updateCube = (key: keyof CreatorDraft['cube'], value: number | string | CreatorDraft['cube']['center'] | CreatorDraft['cube']['rotationDegrees']) => update({ cube: { ...draft.cube, [key]: value } as CreatorDraft['cube'] })
  const updateCamera = (key: string, value: number | ProjectionKind) => {
    if (key === 'projection') update({ camera: { ...draft.camera, projection: value as ProjectionKind } })
    else if (key === 'yaw' || key === 'pitch') update({ camera: { ...draft.camera, orbitDegrees: { ...draft.camera.orbitDegrees, [key]: value as number } } })
    else update({ camera: { ...draft.camera, [key]: value } as CreatorDraft['camera'] })
  }
  const startOrbit = (event: React.PointerEvent<SVGRectElement>) => {
    const svg = previewRef.current
    if (!svg) return
    svg.setPointerCapture(event.pointerId)
    dragStart.current = { x: event.clientX, y: event.clientY, yaw: draft.camera.orbitDegrees.yaw, pitch: draft.camera.orbitDegrees.pitch }
    setRoleMenu(undefined)
  }
  const moveOrbit = (event: React.PointerEvent<SVGSVGElement>) => {
    const start = dragStart.current
    if (!start) return
    const yaw = start.yaw + (event.clientX - start.x) * 0.45
    const pitch = Math.max(-88, Math.min(88, start.pitch - (event.clientY - start.y) * 0.35))
    update({ camera: { ...draft.camera, orbitDegrees: { yaw, pitch } } })
  }
  const finishOrbit = (event: React.PointerEvent<SVGSVGElement>) => {
    if (previewRef.current?.hasPointerCapture(event.pointerId)) previewRef.current.releasePointerCapture(event.pointerId)
    dragStart.current = undefined
  }
  const openRoleMenu = (event: React.PointerEvent<SVGGElement>, edgeId: string) => {
    event.stopPropagation()
    const bounds = previewRef.current?.getBoundingClientRect()
    if (!bounds) return
    setRoleMenu({ edgeId, x: ((event.clientX - bounds.left) / bounds.width) * 100, y: ((event.clientY - bounds.top) / bounds.height) * 100 })
  }
  const cachedEdges = lastValidEdges?.map((edge) => ({ ...edge, role: draft.roles[edge.id] ?? edge.role }))
  const previewEdges = compiled.ok ? compiled.challenge.edges : cachedEdges
  const compileError = compiled.ok ? undefined : compiled.error
  const numberInput = (label: string, value: number, onChange: (value: number) => void, step = '1') => <label className="creator-field">{label}<input type="number" value={value} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>
  const roleName = (id: string) => `${id[0].toUpperCase()} axis · ${id.slice(2).replace(':', ', ')}`
  return <main className="creator-shell">
    <header className="creator-header"><div><p className="eyebrow">Creator studio · local only</p><h1>Build a cube worth drawing.</h1><p className="lede">Tune the scene, assign what players should find, and compile a deterministic challenge. Nothing leaves this browser.</p></div><span className="record-badge"><span className={compiled.ok ? 'status-dot ready' : 'status-dot'} />{compiled.ok ? 'preview valid' : 'needs attention'}</span></header>
     <div className="creator-layout"><section className="card creator-preview"><div className="section-line"><span>01 / live preview</span><span className="coordinate-badge">{compiled.ok ? 'compiled geometry' : 'last valid geometry'}</span></div>{previewEdges ? <div className={`creator-preview-stage ${compiled.ok ? '' : 'invalid-cache'}`}><svg ref={previewRef} className="creator-canvas" viewBox="0 0 1 1" role="img" aria-label="Cube preview. Drag the background to orbit the camera." onPointerMove={moveOrbit} onPointerUp={finishOrbit} onPointerCancel={finishOrbit} onLostPointerCapture={() => { dragStart.current = undefined }}><rect width="1" height="1" className="surface-grid" onPointerDown={startOrbit} />{previewEdges.map((edge) => { const labelPosition = compiled.ok ? edgeLabelPositions[edge.id] : undefined; return <g key={edge.id} onPointerDown={(event) => openRoleMenu(event, edge.id)}><polyline points={pointsToString(edge.points)} className="creator-edge-hit" aria-label={`${edge.id}, ${edge.role}`} /><polyline ref={(path) => { edgeRefs.current[edge.id] = path }} points={pointsToString(edge.points)} className={`creator-edge role-${edge.role}`} />{labelPosition && <text x={labelPosition.x} y={labelPosition.y} fontSize=".026" className={`creator-edge-label role-${edge.role}`} textAnchor="middle" dominantBaseline="central">{edge.id}</text>}</g> })}</svg>{!compiled.ok && <div className="preview-invalid-label" role="alert"><strong>Invalid draft</strong><span>{compileError?.replace('_', ' ')} · showing last valid geometry</span></div>}{roleMenu && <div className="role-menu" role="menu" aria-label={`Set role for ${roleMenu.edgeId}`} style={{ left: `${roleMenu.x}%`, top: `${roleMenu.y}%` }}>{(['hidden', 'reference', 'target'] as EdgeRole[]).map((role) => <button key={role} type="button" role="menuitem" className={`role-${role}`} onClick={() => { update({ roles: { ...draft.roles, [roleMenu.edgeId]: role } }); setRoleMenu(undefined) }}>{role}</button>)}</div>}</div> : <div className="creator-invalid" role="alert"><strong>Preview cannot compile yet.</strong><span>{compileError?.replace('_', ' ')}. Adjust the controls on the right.</span></div>}<div className="legend"><span><i className="swatch ref" /> reference</span><span><i className="swatch target" /> target</span><span><i className="swatch hidden" /> hidden</span></div>{compiled.ok && <button className="primary" type="button" onClick={() => onOpenSolo({ draft, challenge: compiled.challenge })}>Open this challenge in solo practice <span aria-hidden="true">→</span></button>}</section>
      <section className="card creator-controls" aria-labelledby="creator-controls-title"><div className="section-line"><span>02 / authoring controls</span><span className="coordinate-badge">draft v1</span></div><h2 id="creator-controls-title">Scene recipe</h2><p className="helper">Change a value, then watch the shared compiler redraw the cube.</p><label className="creator-field">Challenge name<input value={draft.challengeId} onChange={(event) => update({ challengeId: event.target.value })} /></label><div className="control-group"><h3>Cube</h3><div className="field-grid">{numberInput('Size', draft.cube.size, (value) => updateCube('size', value), '0.1')}{numberInput('Center X', draft.cube.center.x, (value) => updateCube('center', { ...draft.cube.center, x: value }), '0.1')}{numberInput('Center Y', draft.cube.center.y, (value) => updateCube('center', { ...draft.cube.center, y: value }), '0.1')}{numberInput('Center Z', draft.cube.center.z, (value) => updateCube('center', { ...draft.cube.center, z: value }), '0.1')}</div><div className="field-grid">{numberInput('Rotate X°', draft.cube.rotationDegrees.x, (value) => updateCube('rotationDegrees', { ...draft.cube.rotationDegrees, x: value }))}{numberInput('Rotate Y°', draft.cube.rotationDegrees.y, (value) => updateCube('rotationDegrees', { ...draft.cube.rotationDegrees, y: value }))}{numberInput('Rotate Z°', draft.cube.rotationDegrees.z, (value) => updateCube('rotationDegrees', { ...draft.cube.rotationDegrees, z: value }))}</div></div><div className="control-group"><h3>Camera</h3><div className="field-grid">{numberInput('Yaw°', draft.camera.orbitDegrees.yaw, (value) => updateCamera('yaw', value))}{numberInput('Pitch°', draft.camera.orbitDegrees.pitch, (value) => updateCamera('pitch', value))}{numberInput('Distance', draft.camera.distance, (value) => updateCamera('distance', value), '0.1')}{numberInput('Field of view°', draft.camera.fieldOfViewDegrees, (value) => updateCamera('fieldOfViewDegrees', value))}</div><label className="creator-field">Projection<select value={draft.camera.projection} onChange={(event) => updateCamera('projection', event.target.value as ProjectionKind)}><option value="orthographic">Orthographic</option><option value="perspective">Perspective</option><option value="curvilinear_fisheye">Curvilinear fisheye</option></select></label><label className="creator-field">Reference face<select value={draft.referenceFaceId} onChange={(event) => update({ referenceFaceId: event.target.value })}>{faceIds.map((face) => <option key={face} value={face}>{face}</option>)}</select></label></div><div className="control-group"><h3>Edge roles <small>reference edges must border the selected face</small></h3><div className="role-list">{edgeIds.map((id) => <label key={id} className="role-row"><span>{roleName(id)}</span><select value={draft.roles[id]} onChange={(event) => update({ roles: { ...draft.roles, [id]: event.target.value as EdgeRole } })}><option value="reference">Reference</option><option value="target">Target</option><option value="hidden">Hidden</option></select></label>)}</div></div>{numberInput('Hit tolerance', draft.hitTolerance, (value) => update({ hitTolerance: value }), '0.005')}</section></div>
    <footer className="practice-footer"><button className="text-button" type="button" onClick={() => setDraft(creatorStart)}>Reset draft</button><span>Export is the exact {`{ draft, challenge }`} SavedChallenge shape.</span><button className="text-button" type="button" onClick={() => { if (!compiled.ok) return; const blob = new Blob([JSON.stringify({ draft, challenge: compiled.challenge }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${draft.challengeId || 'challenge'}.json`; link.click(); URL.revokeObjectURL(link.href) }}>Download JSON</button></footer>
  </main>
}

function ProtocolInspector({ challenge, strokes, result }: { challenge: SavedChallenge['challenge']; strokes: readonly Stroke[]; result: Result | undefined }) {
  const drawing: FinalDrawing = { inputVersion: 1, strokes }
  const gameInput: engine.GameInput = { inputVersion: 1, challenge, entries: [{ participantId: 'solo-local', drawing, elapsedMs: 0 }] }
  const gameResult: engine.GameResult = { outputVersion: 1, players: result ? [result] : [] }
  const publication = { type: 'result.published', player: { label: 'You' }, challenge, drawing, engineResult: gameResult }
  const payload = (value: unknown) => JSON.stringify(value, null, 2)
  const panel = (step: string, sender: string, receiver: string, purpose: string, status: 'Documented' | 'Illustrative', value: unknown) => <section className="card protocol-panel"><div className="protocol-meta"><span>{step}</span><span className={status === 'Documented' ? 'protocol-doc' : 'protocol-illustrative'}>{status}</span></div><h2>{sender} <span aria-hidden="true">→</span> {receiver}</h2><p className="helper"><strong>Purpose:</strong> {purpose}</p><label className="protocol-label" htmlFor={`protocol-${step}`}>Payload</label><textarea id={`protocol-${step}`} className="protocol-payload" readOnly value={payload(value)} aria-label={`${sender} to ${receiver} payload`} /></section>
  return <main className="protocol-shell"><header className="protocol-header"><div><p className="eyebrow">Local protocol inspector · no network</p><h1>Follow one round of data.</h1><p className="lede">This view makes the hand-offs visible without pretending to connect a backend. It mirrors the documented shapes using the challenge and drawing currently on this page.</p></div><span className="record-badge"><span className="status-dot ready" /> local snapshot</span></header><section className="card protocol-teach" aria-labelledby="nesting-title"><p className="eyebrow">The nesting, plainly</p><h2 id="nesting-title">Points make strokes. Strokes make a drawing.</h2><p className="helper"><strong>Point</strong> is one normalized {`{ x, y }`} location. A <strong>stroke</strong> is the ordered points from one pointer gesture. A <strong>drawing</strong> is all strokes together. An <strong>entry</strong> adds that drawing to a participant and elapsed time for the engine.</p><div className="nesting-chain"><span>point</span><b>→</b><span>stroke</span><b>→</b><span>drawing</span><b>→</b><span>entry</span></div></section><div className="protocol-grid">{panel('01', 'Frontend', 'Backend', 'Submit the player’s finished, normalized strokes. No score, rank, identity, or challenge is sent in this documented body.', 'Documented', drawing)}{panel('02', 'Backend', 'Game Engine', 'The backend combines the authoritative challenge with round entries. This local snapshot shows one solo entry.', 'Documented', gameInput)}{panel('03', 'Game Engine', 'Backend', 'The engine returns ranked players, stroke point feedback, score, and per-target completion coverage.', 'Documented', gameResult)}{panel('04', 'Backend', 'Frontend', 'Illustrative publication shape: a public label is paired with the challenge, final drawing, and engine result for the result screen. No network message is implemented here.', 'Illustrative', publication)}</div><footer className="practice-footer"><span>Current challenge: {challenge.challengeId}</span><span>{strokes.length} stroke{strokes.length === 1 ? '' : 's'} · {result ? 'judged result available' : 'not judged yet'}</span></footer></main>
}

export function App() {
  const [screen, setScreen] = useState<'practice' | 'creator' | 'protocol'>('practice')
  const [draft, setDraft] = useState<CreatorDraft>(creatorStart)
  const [record, setRecord] = useState<SavedChallenge>(saved)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [drawing, setDrawing] = useState(false)
  const [result, setResult] = useState<Result | undefined>()
  const surfaceRef = useRef<SVGSVGElement | null>(null)
  const activeStroke = useRef<number | undefined>(undefined)
  const start = (event: React.PointerEvent<SVGSVGElement>) => { const surface = surfaceRef.current; if (!surface) return; if (typeof surface.setPointerCapture === 'function') surface.setPointerCapture(event.pointerId); setResult(undefined); setDrawing(true); activeStroke.current = strokes.length; setStrokes((current) => [...current, { points: [normalizedPoint(event, surface)] }]) }
  const move = (event: React.PointerEvent<SVGSVGElement>) => { const surface = surfaceRef.current; if (!surface || !drawing || activeStroke.current === undefined) return; const point = normalizedPoint(event, surface); setStrokes((current) => current.map((stroke, index) => index === activeStroke.current ? { points: [...stroke.points, point] } : stroke)) }
  const end = (event?: React.PointerEvent<SVGSVGElement>) => { const surface = surfaceRef.current; if (surface && event && typeof surface.hasPointerCapture === 'function' && surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId); setDrawing(false); activeStroke.current = undefined }
  const clear = () => { setStrokes([]); setResult(undefined) }
  const loadImported = () => { const parsed = parseSavedChallenge(importText); if (!parsed.ok) { setImportError(parsed.error); return } setRecord(parsed.record); setImportError(''); setStrokes([]); setResult(undefined) }
  const challenge = record.challenge
  const judge = () => { const drawing: FinalDrawing = { inputVersion: 1, strokes }; const judged = engine.evaluateGame({ inputVersion: 1, challenge, entries: [{ participantId: 'solo', drawing, elapsedMs: 0 }] }); setResult(judged.players[0]) }
  const score = result?.score ?? 0
  const targets = result?.feedback.targets ?? []
  if (screen === 'creator') return <><nav className="mode-nav" aria-label="Game mode"><button className="mode-link" type="button" onClick={() => setScreen('practice')}>Solo practice</button><button className="mode-link active" type="button">Creator studio</button></nav><Creator draft={draft} setDraft={setDraft} onOpenSolo={(next) => { const parsed = parseSavedChallenge(JSON.stringify(next)); if (!parsed.ok) return; setRecord(parsed.record); setImportText(JSON.stringify(next)); setImportError(''); setStrokes([]); setResult(undefined); setScreen('practice') }} /></>
  if (screen === 'protocol') return <><nav className="mode-nav" aria-label="Game mode"><button className="mode-link" type="button" onClick={() => setScreen('practice')}>Solo practice</button><button className="mode-link" type="button" onClick={() => setScreen('creator')}>Creator studio</button><button className="mode-link active" type="button">Protocol inspector</button></nav><ProtocolInspector challenge={challenge} strokes={strokes} result={result} /></>
  return <><nav className="mode-nav" aria-label="Game mode"><button className="mode-link active" type="button">Solo practice</button><button className="mode-link" type="button" onClick={() => setScreen('creator')}>Creator studio <span aria-hidden="true">↗</span></button><button className="mode-link" type="button" onClick={() => setScreen('protocol')}>Protocol inspector <span aria-hidden="true">↗</span></button></nav><main className="practice-shell">
    <header className="practice-header"><div><p className="eyebrow">Solo practice · {challenge.challengeId}</p><h1>Draw the missing edges.</h1><p className="lede">Use the solid face as your anchor. Sketch the cube you think continues behind it, then ask the judge to compare every point.</p></div><div className="record-badge"><span className="status-dot" /> saved challenge</div></header>
    <section className="card import-card" aria-labelledby="import-title"><div className="section-line"><span>Load a creator export</span><span className="coordinate-badge">JSON · compiled paths</span></div><div className="import-content"><div><h2 id="import-title">Bring your own challenge.</h2><p className="helper">Paste the complete <code>SavedChallenge</code> record exported by the creator. The compiled challenge is used as-is; its draft is never regenerated.</p></div><div className="import-controls"><label htmlFor="challenge-json">SavedChallenge JSON</label><textarea id="challenge-json" value={importText} onChange={(event) => setImportText(event.target.value)} placeholder="Paste exported JSON here…" spellCheck={false} aria-describedby="import-help import-error" /><div className="import-actions"><button className="secondary" type="button" onClick={() => { setImportText(''); setImportError('') }}>Clear</button><button className="primary" type="button" onClick={loadImported} disabled={!importText.trim()}>Load challenge</button></div><p id="import-help" className="keyboard-note">The built-in practice challenge remains available until a valid record loads.</p>{importError && <p id="import-error" className="import-error" role="alert">{importError}</p>}</div></div></section>
    <div className="practice-layout"><section className="card prompt-card" aria-labelledby="prompt-title"><div className="section-line"><span>01 / prompt</span><span className="coordinate-badge">normalized 0—1</span></div><h2 id="prompt-title">One face is known.</h2><p className="helper">The green square is visible. The rest is hidden until you judge your drawing.</p><DrawingSurface surfaceRef={surfaceRef} challenge={challenge} strokes={strokes} feedback={result?.feedback} onStart={start} onMove={move} onEnd={end} /><div className="legend"><span><i className="swatch ref" /> reference face</span><span><i className="swatch ink" /> your stroke</span>{result && <><span><i className="swatch good" /> on target</span><span><i className="swatch bad" /> off target</span></>}</div><div className="action-row"><button className="secondary" type="button" onClick={clear} disabled={strokes.length === 0}>Clear drawing</button><button className="primary" type="button" onClick={judge} disabled={strokes.length === 0}>Judge drawing <span aria-hidden="true">→</span></button></div><p className="keyboard-note">Pointer or touch input · draw in separate strokes · no live data leaves this page</p></section>
      <aside className="card result-card" aria-live="polite" aria-labelledby="result-title"><div className="section-line"><span>02 / feedback</span>{result && <span className="result-state">judged</span>}</div>{result ? <><div className="score-wrap"><span className="score-label">Your score</span><strong>{Math.round(score)}<small>%</small></strong></div><h2 id="result-title">{score >= 70 ? 'Strong spatial read.' : score > 0 ? 'Good start. Look closer.' : 'A clean miss is still useful.'}</h2><p className="helper">Each segment is coloured from the point you drew. Green landed within the challenge tolerance; coral wandered away.</p>{targets.length > 0 && <section className="target-feedback" aria-labelledby="target-feedback-title"><h3 id="target-feedback-title">Target completion</h3><p className="keyboard-note">A target clears when it reaches 80% coverage.</p><ul>{targets.map((target) => <li key={target.edgeId}><span>{target.edgeId}</span><strong>{Math.round(target.coverage * 100)}%</strong><span className={target.meetsThreshold ? 'target-status meets' : 'target-status'}>{target.meetsThreshold ? 'Complete' : 'Keep practicing'}</span></li>)}</ul></section>}<div className="result-stats"><div><strong>{result.drawing.strokes.length}</strong><span>strokes</span></div><div><strong>{result.drawing.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0)}</strong><span>points</span></div><div><strong>#{result.rank}</strong><span>rank</span></div></div><button className="text-button" type="button" onClick={clear}>Try the challenge again <span aria-hidden="true">↗</span></button></> : <div className="empty-result"><span className="empty-mark">✦</span><h2 id="result-title">Your result will live here.</h2><p className="helper">Make your best guess, then press <strong>Judge drawing</strong>. The shared evaluator scores the saved paths locally.</p></div>}</aside></div>
    <footer className="practice-footer"><span>Challenge paths are compiled once and treated as authoritative.</span><span>Solo / {challenge.projection.replace('_', ' ')}</span></footer>
   </main></>
}
