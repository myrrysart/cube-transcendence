# Backend Engine Handoff & Session Log (2026-11-13)

## Session Log Summary
- Audited backend onboarding checklist against `game-engine` and `main`.
- Promoted `.scratch/plan/doc-check.sh` to `dev-tools/doc-check.sh` with automatic Markdown file discovery, unknown-marker detection (`KNOWN_MARKERS` table at top of script), `DOC_META` readiness/version header enforcement, and code-to-doc contract version sync (`srcs/md/game-engine-api.md` v2 <-> `srcs/core/game-engine/index.ts` `challengeVersion: 2`).
- Consolidated `.scratch/plan/architecture-baseline.md` and `.scratch/plan/architecture.mmd` into `srcs/md/project_overview.md` and updated `README.md` links.
- Added `"test"` and `"typecheck"` scripts to `srcs/core/game-engine/package.json`.
- Generated deterministic `SavedChallenge`, `GameInput` (winner, tie, empty drawing), and `GameResult` JSON fixtures for backend onboarding.

---

## Ready-to-Send Backend Handoff Message

Here is the checkpoint and handoff summary for `srcs/core/game-engine`:

### 1. Run Tooling, Tests, and Type-Check
From the repository root:
```bash
# 1. Documentation linter, readiness & contract-version sync check
bash dev-tools/doc-check.sh
bash dev-tools/doc-check.sh --todos

# 2. Engine unit tests & strict TypeScript check
cd srcs/core/game-engine
bun install
bun run test
bun run typecheck
```
*(Note: `bun run typecheck` runs `bun --bun x tsc --noEmit` so it uses Bun's runtime instead of any older system `/usr/bin/node`.)*

### 2. Engine Entry Point and Exported Types to Import
- **Entry point:** `srcs/core/game-engine/index.ts` (zero external runtime dependencies; safe to import directly into NestJS on Node.js).
- **Functions:**
  - `evaluateGame(input: GameInput): GameResult` — authoritative closed-round evaluator called by the NestJS scoring worker.
  - `compileChallenge(draft: CreatorDraft): ChallengeCreationResult` — deterministic compiler (only needed when creating/validating a draft; stored `Challenge` JSON is authoritative for gameplay).
- **Types to import:**
  - **Submission payload (`POST /rounds/:roundId/submission`):** `Point`, `Stroke`, `FinalDrawing` (`inputVersion: 1`)
  - **Stored challenge:** `Challenge` (`challengeVersion: 2`), `ProjectedEdge`, `EdgeRole`, `ProjectionKind`, `SavedChallenge`, `CreatorDraft`
  - **Closed-round evaluator input:** `RoundEntry`, `GameInput` (`inputVersion: 1`)
  - **Closed-round evaluator output:** `GameResult` (`outputVersion: 1`), `EnginePlayerResult`, `StrokeFeedback`, `PointOutcome`, `TargetCompletion`

### 3. Example `SavedChallenge`, `GameInput` (Winner, Tie, Empty), and `GameResult`

#### A. `SavedChallenge` (`draft` + compiled `challenge`)
```json
{
  "draft": {
    "sourceVersion": 1,
    "challengeId": "handoff-cube-01",
    "cube": {
      "cubeId": "cube-01",
      "center": { "x": 0, "y": 0, "z": 0 },
      "size": 2,
      "rotationDegrees": { "x": 0, "y": 0, "z": 0 }
    },
    "camera": {
      "orbitDegrees": { "yaw": 35, "pitch": 18 },
      "distance": 4,
      "fieldOfViewDegrees": 75,
      "projection": "perspective"
    },
    "referenceFaceId": "x:1",
    "roles": {
      "x:0:0": "target", "x:0:1": "target", "x:1:0": "hidden", "x:1:1": "hidden",
      "y:0:0": "hidden", "y:0:1": "reference", "y:1:0": "hidden", "y:1:1": "reference",
      "z:0:0": "hidden", "z:0:1": "reference", "z:1:0": "hidden", "z:1:1": "reference"
    },
    "hitTolerance": 0.035
  },
  "challenge": {
    "challengeVersion": 2,
    "challengeId": "handoff-cube-01",
    "projection": "perspective",
    "referenceFaceId": "x:1",
    "edges": [
      { "id": "x:0:0", "role": "target", "points": [{ "x": 0.5284, "y": 0.5602 }, { "x": 0.7227, "y": 0.6642 }] },
      { "id": "x:0:1", "role": "target", "points": [{ "x": 0.5319, "y": 0.3205 }, { "x": 0.7625, "y": 0.3351 }] },
      { "id": "x:1:0", "role": "hidden", "points": [{ "x": 0.3002, "y": 0.6255 }, { "x": 0.4464, "y": 0.8016 }] },
      { "id": "x:1:1", "role": "hidden", "points": [{ "x": 0.2688, "y": 0.3295 }, { "x": 0.4324, "y": 0.3566 }] },
      { "id": "y:0:0", "role": "hidden", "points": [{ "x": 0.5284, "y": 0.5602 }, { "x": 0.5319, "y": 0.3205 }] },
      { "id": "y:0:1", "role": "reference", "points": [{ "x": 0.7227, "y": 0.6642 }, { "x": 0.7625, "y": 0.3351 }] },
      { "id": "y:1:0", "role": "hidden", "points": [{ "x": 0.3002, "y": 0.6255 }, { "x": 0.2688, "y": 0.3295 }] },
      { "id": "y:1:1", "role": "reference", "points": [{ "x": 0.4464, "y": 0.8016 }, { "x": 0.4324, "y": 0.3566 }] },
      { "id": "z:0:0", "role": "hidden", "points": [{ "x": 0.5284, "y": 0.5602 }, { "x": 0.3002, "y": 0.6255 }] },
      { "id": "z:0:1", "role": "reference", "points": [{ "x": 0.7227, "y": 0.6642 }, { "x": 0.4464, "y": 0.8016 }] },
      { "id": "z:1:0", "role": "hidden", "points": [{ "x": 0.5319, "y": 0.3205 }, { "x": 0.2688, "y": 0.3295 }] },
      { "id": "z:1:1", "role": "reference", "points": [{ "x": 0.7625, "y": 0.3351 }, { "x": 0.4324, "y": 0.3566 }] }
    ],
    "hitTolerance": 0.035,
    "completionThreshold": 0.8
  }
}
```

#### B. `GameInput` (4 entries: full coverage winner, 2-way tie, and empty drawing)
```json
{
  "inputVersion": 1,
  "challenge": "<same challenge object as SavedChallenge.challenge above>",
  "entries": [
    {
      "participantId": "player-winner",
      "elapsedMs": 4200,
      "drawing": {
        "inputVersion": 1,
        "strokes": [
          { "points": [{ "x": 0.5284, "y": 0.5602 }, { "x": 0.7227, "y": 0.6642 }] },
          { "points": [{ "x": 0.5319, "y": 0.3205 }, { "x": 0.7625, "y": 0.3351 }] }
        ]
      }
    },
    {
      "participantId": "player-tie-a",
      "elapsedMs": 3100,
      "drawing": {
        "inputVersion": 1,
        "strokes": [
          { "points": [{ "x": 0.5284, "y": 0.5602 }, { "x": 0.7227, "y": 0.6642 }] }
        ]
      }
    },
    {
      "participantId": "player-tie-b",
      "elapsedMs": 3100,
      "drawing": {
        "inputVersion": 1,
        "strokes": [
          { "points": [{ "x": 0.5284, "y": 0.5602 }, { "x": 0.7227, "y": 0.6642 }] }
        ]
      }
    },
    {
      "participantId": "player-empty",
      "elapsedMs": 15000,
      "drawing": {
        "inputVersion": 1,
        "strokes": []
      }
    }
  ]
}
```

#### C. Expected `GameResult` from `evaluateGame(input)`
```json
{
  "outputVersion": 1,
  "players": [
    {
      "participantId": "player-winner",
      "elapsedMs": 4200,
      "drawing": {
        "inputVersion": 1,
        "strokes": [
          { "points": [{ "x": 0.5284, "y": 0.5602 }, { "x": 0.7227, "y": 0.6642 }] },
          { "points": [{ "x": 0.5319, "y": 0.3205 }, { "x": 0.7625, "y": 0.3351 }] }
        ]
      },
      "rank": 1,
      "score": 100,
      "feedback": {
        "strokes": [
          { "outcomes": ["on_target", "on_target"] },
          { "outcomes": ["on_target", "on_target"] }
        ],
        "targets": [
          { "edgeId": "x:0:0", "coverage": 1, "meetsThreshold": true },
          { "edgeId": "x:0:1", "coverage": 1, "meetsThreshold": true }
        ]
      }
    },
    {
      "participantId": "player-tie-a",
      "elapsedMs": 3100,
      "drawing": {
        "inputVersion": 1,
        "strokes": [
          { "points": [{ "x": 0.5284, "y": 0.5602 }, { "x": 0.7227, "y": 0.6642 }] }
        ]
      },
      "rank": 2,
      "score": 50,
      "feedback": {
        "strokes": [
          { "outcomes": ["on_target", "on_target"] }
        ],
        "targets": [
          { "edgeId": "x:0:0", "coverage": 1, "meetsThreshold": true },
          { "edgeId": "x:0:1", "coverage": 0, "meetsThreshold": false }
        ]
      }
    },
    {
      "participantId": "player-tie-b",
      "elapsedMs": 3100,
      "drawing": {
        "inputVersion": 1,
        "strokes": [
          { "points": [{ "x": 0.5284, "y": 0.5602 }, { "x": 0.7227, "y": 0.6642 }] }
        ]
      },
      "rank": 2,
      "score": 50,
      "feedback": {
        "strokes": [
          { "outcomes": ["on_target", "on_target"] }
        ],
        "targets": [
          { "edgeId": "x:0:0", "coverage": 1, "meetsThreshold": true },
          { "edgeId": "x:0:1", "coverage": 0, "meetsThreshold": false }
        ]
      }
    },
    {
      "participantId": "player-empty",
      "elapsedMs": 15000,
      "drawing": {
        "inputVersion": 1,
        "strokes": []
      },
      "rank": 4,
      "score": 0,
      "feedback": {
        "strokes": [],
        "targets": [
          { "edgeId": "x:0:0", "coverage": 0, "meetsThreshold": false },
          { "edgeId": "x:0:1", "coverage": 0, "meetsThreshold": false }
        ]
      }
    }
  ]
}
```

### 4. Scoring, Completion Coverage, Tie-Breaking, and Backend-Owned Boundaries
- **Point accuracy:** Every drawn point is tested against all segments of edges where `role === "target"` (`reference` and `hidden` edges are ignored). If Euclidean distance to any target segment is `<= challenge.hitTolerance` (inclusive), the point is `"on_target"`, else `"off_target"`. `pointAccuracy = onTargetPoints / totalPoints` (`0` for an empty drawing).
- **Completion coverage & multiplier:** Each `"target"` polyline is sampled at 100 equidistant arc-length positions (`0/99` to `99/99`). A sample counts as covered if it is within `hitTolerance` of any drawn stroke segment (1-point strokes are treated as zero-length segments). `coverage = coveredSamples / 100` and `meetsThreshold = coverage >= 0.8`. The completion multiplier is the average over all target edges of `min(coverage / 0.8, 1)`.
- **Score formula:** `score = 100 * pointAccuracy * completionMultiplier` (unrounded float in `[0, 100]`).
- **Tie-breaking & competition ranking:** Entries are ordered by `score` descending, then `elapsedMs` ascending. Entries with identical `score` and `elapsedMs` share the same standard competition rank (`1, 2, 2, 4`).
- **What the engine does NOT do (NestJS owns these at the boundary):**
  - **Input validation:** Validate untrusted `FinalDrawing` once at `POST /rounds/:roundId/submission` (max 256 strokes, max 4,096 points/stroke, max 16,384 points/drawing, finite coordinates in `[0, 1]`).
  - **Timeouts:** If a participant does not submit before `endsAt`, NestJS passes an empty drawing (`strokes: []`) to `evaluateGame` and records any `timed_out` status in PostgreSQL.
  - **Active-round prompt filtering:** At round start, NestJS sends `RoundPrompt` containing only `referenceEdges` (`role === "reference"` points) and timestamps—never target/hidden edges or tolerances.

### 5 & 6. Challenge Format (`challengeVersion: 2`) and Engine Location (`srcs/core/game-engine`)
- Confirmed: `challengeVersion: 2` (with `edges: readonly ProjectedEdge[]` and roles `"reference" | "target" | "hidden"`) and `srcs/core/game-engine/` are authoritative.
- Both `srcs/md/game-engine-api.md` (`DOC_META: status=ready version=2`) and `srcs/md/project_overview.md` (`DOC_META: status=review version=2`) are updated on `game-engine` and verified automatically by `bash dev-tools/doc-check.sh`.
