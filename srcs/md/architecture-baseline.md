# Architecture Baseline

<!-- DOC_SYNC: Review after changes to accepted architecture, stack, gameplay, protocols, deployment, or directory ownership. -->

**Status:** accepted for the Cube Challenge Multiplayer first vertical slice,
2026-10-22.
<!-- DOC_TODO: ARCH_STATUS_REVIEW — reconfirm accepted baseline after the team finalizes deferred decisions. -->

## Decisions

| Concern | Decision | Why |
| --- | --- | --- |
| Product loop | Complete a cube from one visible face, then receive score and feedback. | A small, repeatable perspective exercise with a clear game result. |
| Modes | Solo practice and private multiplayer rooms. | Solo validates the scorer; multiplayer fulfils simultaneous-play requirements. |
| Multiplayer | 1–4 players receive one challenge and one server-controlled timer. | Bounds room complexity while supporting fair synchronized play. |
| Drawing visibility | Private per-player canvases during a round. | Prevents copying and avoids unnecessary live-stroke synchronization. |
| Authority | Server owns room state, timestamps, accepted submissions, scores, and rank. | Clients must not decide an outcome. |
| UI | React, TypeScript, Tailwind CSS. | Qualifies as a frontend framework and keeps one browser rendering model. |
| Backend | NestJS, TypeScript. | Conventional modules, validation boundaries, and WebSocket support. |
| Persistence | PostgreSQL 16 with Prisma. | Clear relational schema, migrations, and reliable concurrent writes. |
| Game implementation | TypeScript implements the rules, challenge generation, stroke evaluation, and scoring. | A simple 2D drawing game does not justify a second-language engine. |
| Browser interaction | Pointer events capture drawing; keyboard events provide shortcuts and accessible controls. | These browser APIs provide native mouse, stylus, touch, and keyboard support. |
| Rendering boundary | React renders application UI; the drawing surface and any animation loop avoid per-frame React state. | Keeps UI rendering separate from high-frequency interaction work. |
| Container engine | Docker Compose. | Lowest team onboarding risk; Podman compatibility can be checked later. |
<!-- DOC_TODO: ARCH_PODMAN_COMPATIBILITY — decide whether Podman compatibility is required after Docker Compose onboarding is validated. -->
| HTTPS | Caddy reverse proxy. | Final deployment will terminate HTTPS and expose WSS for real-time traffic. |
<!-- DOC_TODO: ARCH_TOOLCHAIN_VERSIONS — confirm Node.js and application toolchain versions when implementation tasks select them. -->
<!-- DOC_TODO: ARCH_CADDY_TIMING — decide when Caddy enters the deployment slice after application services exist. -->

## First-slice protocol boundary

- HTTP handles authentication, room creation/joining, and final submission.
- A WebSocket communicates presence, ready state, round start/end, disconnect,
  reconnect, and result availability. It does **not** stream drawing strokes.
- A round records server `startsAt` and `endsAt` timestamps. A submission is
  accepted only from a room participant during the valid round window.
- The final submission includes normalized freehand stroke points. The server
  validates size and shape limits, computes the score against the fixed
  challenge geometry, and persists the result atomically.
- Shared game rules and message types are framework-independent TypeScript.
  TypeScript types do not validate runtime input: the server validates every
  client message before applying it.
- When a round closes, the server ranks accepted submissions and sends the same
  authoritative result to all connected room participants.

## Repository ownership

- `srcs/frontend/`: React UI only.
- `srcs/backend/`: NestJS application, Prisma schema, and migrations.
- `srcs/core/`: no active source code; no separate engine is planned.
- `setup/`: container and deployment configuration.
- `srcs/md/`: durable decisions and specifications.
- `.scratch/`: ignored, disposable AI/planning material.

## Deferred decisions

<!-- DOC_TODO: ARCH_DEFERRED_DECISIONS — resolve each numbered architecture decision before the dependent implementation is finalized. -->

1. Exact Prisma keys, indexes, and retention policy for strokes/submissions.
2. Authentication/session strategy and reconnect identity proof.
3. Challenge generation and the scoring formula, including accessibility and
   anti-cheat limits.
4. Exact module claims and owners; do not claim points before implementation.
5. Production domain, TLS contact address, and data-retention period.
