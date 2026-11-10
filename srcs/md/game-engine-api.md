# Game engine API boundary

<!-- DOC_SYNC: Review after changes to game rules, challenge geometry, submission protocol, scoring, ranking, or result visibility. -->

## Purpose and ownership

This document defines the boundary around the deterministic TypeScript game
engine. Solo practice may call the dependency-free evaluator locally against a
saved compiled challenge; it has no room state, persistence, or authority over
another player. For multiplayer, the NestJS backend validates client input,
owns round state and timestamps, persists submissions, and calls the engine
once after a round closes.

The engine receives all final round drawings together, evaluates them against
the supplied challenge, and returns those drawings ordered by rank with
per-point feedback. Drawings remain private while a round is active and become
visible to every room participant only in the published result.

## Shared drawing format

All challenge and drawing coordinates use the same normalized coordinate space:
`{ x: 0, y: 0 }` is the top-left corner and `{ x: 1, y: 1 }` is the bottom-right
corner. Browser pixel coordinates must be converted before submission.

```ts
type Point = { x: number; y: number };
type Stroke = { points: readonly Point[] };
type FinalDrawing = { inputVersion: 1; strokes: readonly Stroke[] };
```

A stroke is one continuous pointer gesture from pointer-down to pointer-up.
Its points are ordered. A drawing may contain any number of strokes, including
one-point strokes and no strokes.

## Frontend-to-backend submission

The frontend sends one `FinalDrawing` to `POST /rounds/:roundId/submission`
when a player selects **Judge**. The request body contains only `FinalDrawing`.
It must not contain user identity, challenge identity, a timestamp, score, or
rank.

The backend derives the authenticated participant and challenge assignment,
records the server receive time, validates the data once at this boundary, and
freezes the first accepted drawing for that participant. A further submission
does not replace it.

The backend enforces these input limits:

- at most 256 strokes in one drawing;
- at most 4,096 points in one stroke;
- at most 16,384 points in one drawing;
- every coordinate is finite and within the normalized coordinate space.

## Closed-round engine input

At round closure, the backend creates one entry for every round participant.
For a participant without an accepted final submission, it supplies an empty
`FinalDrawing` with `strokes: []`. The backend decides any `timed_out` status
from its clock and the applicable challenge rules; the engine does not read a
clock or infer timeout from missing strokes.

```ts
type EdgeRole = "reference" | "target" | "hidden";
type ProjectionKind = "orthographic" | "perspective" | "curvilinear_fisheye";
type ProjectedEdge = { id: string; role: EdgeRole; points: readonly Point[] };
type Challenge = { challengeVersion: 2; challengeId: string; projection: ProjectionKind; referenceFaceId: string; edges: readonly ProjectedEdge[]; hitTolerance: number; completionThreshold: 0.8 };
type RoundEntry = { participantId: string; drawing: FinalDrawing; elapsedMs: number };
type GameInput = { inputVersion: 1; challenge: Challenge; entries: readonly RoundEntry[] };
```

`participantId` is an opaque correlation value assigned by the backend. The
engine preserves it in output but does not authenticate or authorize it.
`elapsedMs` is server-derived and is used only for the defined tie-break rule.
Challenge-specific `hitTolerance`, `completionThreshold`, and all scoring behaviour belong to the
challenge and engine, not to the frontend or HTTP API.

`referenceFaceId` is the camera-nearest cube face derived by the compiler; its
boundary edges have the `reference` role and form the solid closest-player
prompt. A draft whose selected face is not camera-nearest is rejected. Every cube edge
remains in `edges` with a persisted role: `reference` is shown but never
scored, `target` is hidden during play and scored, and `hidden` is neither
shown nor scored. `points` is a normalized polyline: two points for
orthographic or perspective projection, and a deterministic sampled curve for
curvilinear fisheye projection. Point classification considers every segment
of `target` paths only.

## Challenge creation input

The creator keeps a separate, editor-only `CreatorDraft` and deterministically
compiles the persisted `Challenge` from it. It starts with a metric unit cube,
applies the cube transform, places a camera that always looks at the cube
center, then projects its paths. This guarantees equal 3D edge lengths and
right-angle corners before projection.

```ts
type Vector3 = { x: number; y: number; z: number };
type CreatorDraft = {
  sourceVersion: 1;
  challengeId: string;
  cube: { cubeId: string; center: Vector3; size: number; rotationDegrees: Vector3 };
  camera: { orbitDegrees: { yaw: number; pitch: number }; distance: number; fieldOfViewDegrees: number; projection: ProjectionKind };
  referenceFaceId: string;
  roles: Readonly<Record<string, EdgeRole>>;
  hitTolerance: number;
};
```

The compiler emits fixed vertex and edge IDs, so role assignments survive
editing. It accepts only finite inputs that produce a non-degenerate cube
inside the normalized canvas, with one role for each edge and at least one
`target` edge. The camera has fixed roll; its orbit position is computed from
the cube center, so cube location is persisted but does not affect a one-cube
render. `curvilinear_fisheye` means the equidistant fisheye model, sampled
deterministically into paths.

A saved authoring record stores both forms:

```ts
type SavedChallenge = { draft: CreatorDraft; challenge: Challenge };
```

The compiled `Challenge` is authoritative for gameplay and scoring. The draft
exists only to reopen the authoring tool; the scorer never regenerates it.
The compiler sets `completionThreshold` to `0.8`: completion is deliberately
separate from the geometric `hitTolerance` and is not author-editable in the
first creator flow.

## Solo challenge import

Solo practice may replace its built-in record with one pasted JSON
`SavedChallenge`. The browser parses and validates that untrusted record once
at this input boundary before replacing its current challenge. A rejected
record leaves the current challenge and drawing intact and presents an
accessible error. The browser uses only the validated record's compiled
`challenge` paths for prompt rendering and local evaluation; it never
recompiles geometry from the imported `draft`.

## Engine result

For every entry, the engine classifies each point against the challenge, scores
the drawing, and ranks all entries. `on_target` means the point is on or within
the challenge's tolerance around any segment of a target path; `off_target` means it is not.
Points exactly on that tolerance boundary are `on_target`.

The engine separately measures every target path's coverage. It samples 100
equally spaced arc-length positions along each target polyline and counts a
sample covered when it lies within `hitTolerance` of any submitted drawing
point or drawn path segment. A one-point stroke is treated as a zero-length
segment. This same rule supports straight and sampled curved targets.

Point accuracy is `onTargetPointCount / totalPointCount` (or `0` for an empty
drawing). The completion multiplier is the average over every target path of
`min(pathCoverage / completionThreshold, 1)`. The final score is
`100 * pointAccuracy * completionMultiplier`. Thus each target path at or
above the 80% completion threshold takes no points away, while a well-placed
dab cannot produce a perfect score. The engine does not round the score; a
presentation layer chooses how to display it. `elapsedMs` is used only after
this score comparison.

```ts
type PointOutcome = "on_target" | "off_target";
type StrokeFeedback = { outcomes: readonly PointOutcome[] };
type TargetCompletion = { edgeId: string; coverage: number; meetsThreshold: boolean };
type EnginePlayerResult = RoundEntry & { rank: number; score: number; feedback: { strokes: readonly StrokeFeedback[]; targets: readonly TargetCompletion[] } };
type GameResult = { outputVersion: 1; players: readonly EnginePlayerResult[] };
```

The engine returns `players` in rank order. Higher score ranks first; equal
scores rank by lower `elapsedMs`; entries still equal share a competition rank
(`1, 1, 3`).

For each player result, the following invariants are mandatory:

- `feedback.strokes.length === drawing.strokes.length`;
- `feedback.strokes[i].outcomes.length === drawing.strokes[i].points.length`;
- `outcomes[j]` classifies `drawing.strokes[i].points[j]`;
- `feedback.targets` contains exactly one completion result for every target
  edge, in challenge edge order;
- each input `participantId` appears exactly once in the result.

The engine returns semantic point outcomes, not CSS colours. The frontend uses
these labels to render the original strokes with an accessible on-target or
off-target treatment. For a path segment from point `i - 1` to point `i`, the
frontend uses the outcome at `i`. It may also display target completion as
percentages or threshold status without remeasuring geometry.

## Backend-to-frontend result publication

The backend persists `GameResult`, associates opaque participant identifiers
with public player labels, and publishes the result after the round closes.
Every participant receives the challenge geometry, all players' final drawings,
their point feedback, scores, ranks, and any backend-decided timeout status.
No live stroke data is sent during an active round.
