# Game engine API boundary

<!-- DOC_SYNC: Review after changes to game rules, challenge geometry, submission protocol, scoring, ranking, or result visibility. -->

## Purpose and ownership

This document defines the boundary around the deterministic TypeScript game
engine. The frontend never calls the engine directly. The NestJS backend
validates client input, owns round state and timestamps, persists submissions,
and calls the engine once after a round closes.

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
type TargetEdge = { id: string; from: Point; to: Point };
type Challenge = { challengeId: string; targetEdges: readonly TargetEdge[]; hitTolerance: number };
type RoundEntry = { participantId: string; drawing: FinalDrawing; elapsedMs: number };
type GameInput = { inputVersion: 1; challenge: Challenge; entries: readonly RoundEntry[] };
```

`participantId` is an opaque correlation value assigned by the backend. The
engine preserves it in output but does not authenticate or authorize it.
`elapsedMs` is server-derived and is used only for the defined tie-break rule.
Challenge-specific `hitTolerance` and all scoring behaviour belong to the
challenge and engine, not to the frontend or HTTP API.

## Engine result

For every entry, the engine classifies each point against the challenge, scores
the drawing, and ranks all entries. `on_target` means the point is on or within
the challenge's tolerance around a target edge; `off_target` means it is not.
Points exactly on that tolerance boundary are `on_target`.

```ts
type PointOutcome = "on_target" | "off_target";
type StrokeFeedback = { outcomes: readonly PointOutcome[] };
type EnginePlayerResult = RoundEntry & { rank: number; score: number; feedback: { strokes: readonly StrokeFeedback[] } };
type GameResult = { outputVersion: 1; players: readonly EnginePlayerResult[] };
```

The engine returns `players` in rank order. Higher score ranks first; equal
scores rank by lower `elapsedMs`; entries still equal share a rank.

For each player result, the following invariants are mandatory:

- `feedback.strokes.length === drawing.strokes.length`;
- `feedback.strokes[i].outcomes.length === drawing.strokes[i].points.length`;
- `outcomes[j]` classifies `drawing.strokes[i].points[j]`;
- each input `participantId` appears exactly once in the result.

The engine returns semantic point outcomes, not CSS colours. The frontend uses
these labels to render the original strokes with an accessible on-target or
off-target treatment. For a path segment from point `i - 1` to point `i`, the
frontend uses the outcome at `i`.

## Backend-to-frontend result publication

The backend persists `GameResult`, associates opaque participant identifiers
with public player labels, and publishes the result after the round closes.
Every participant receives the challenge geometry, all players' final drawings,
their point feedback, scores, ranks, and any backend-decided timeout status.
No live stroke data is sent during an active round.
