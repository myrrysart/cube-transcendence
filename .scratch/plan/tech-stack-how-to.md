# Technology stack — review draft

<!-- DOC_TODO: SCRATCH_STACK_REVIEW — promote or discard this draft after human review of versions and deployment timing. -->

The project is a TypeScript cube-drawing game. The selected stack is a boundary,
not a menu of interchangeable tools.

| Concern | Technology | Responsibility |
| --- | --- | --- |
| Browser UI | React, TypeScript, Tailwind CSS | Screens, lobby, feedback, results, and static UI. |
| Drawing input | Browser Pointer and Keyboard Events | Freehand input and accessible shortcuts. |
| Server | NestJS on Node.js, TypeScript | Validation, rooms, round lifecycle, scoring authority, and WebSocket events. |
| Data | PostgreSQL 16 with Prisma | Relational data, migrations, and persisted results. |
| Game rules | TypeScript | Challenge generation, stroke evaluation, and scoring. |
| Containers | Docker Compose | Reproducible local services. |
| Deployment edge | Caddy, later | HTTPS and WSS termination after the application services exist. |
<!-- DOC_TODO: SCRATCH_CADDY_TIMING — choose the deployment milestone for Caddy after application services exist. -->

## Keep the boundaries clear

React renders application UI, but high-frequency drawing and animation must not
depend on a React state update for every pointer event. The browser normalizes
input; the server validates every submitted message and determines accepted
submissions, scores, and multiplayer rankings.

Do not add a general drawing canvas, shared live strokes, chat, matchmaking,
or unrelated art tooling.

## Use the protocol deliberately

- HTTP: authentication, room creation/joining, and final submission.
- WebSocket: presence, ready state, round lifecycle, reconnects, and result
  availability.
- Submission: normalized freehand stroke points, validated and scored by the
  server during the authoritative round window.

Multiplayer supports 1–4 participants. Players share one challenge and
server-controlled timing but draw privately.

## Before implementing a layer

Read `srcs/md/project_overview.md` and `srcs/md/game-engine-api.md`.
Keep framework-independent game rules and message types separate from browser,
database, and NestJS details. If a proposed change affects scope, stack,
protocol, gameplay, deployment, or directory ownership, search for `DOC_SYNC`
and update only the affected record after team review.

## Current implementation state

The repository has an accepted architecture and a PostgreSQL development
baseline. It does not yet contain the frontend, NestJS application, Prisma
schema, scoring engine, or final deployment. Do not claim those modules before
they are implemented, tested, and demonstrable.
