# Architecture Baseline

**Status:** accepted for the first vertical slice, 2026-10-21.

## Decisions

| Concern | Decision | Why |
| --- | --- | --- |
| UI | React, TypeScript, Tailwind CSS | Qualifies as a frontend framework and keeps one browser rendering model. |
| Backend | NestJS, TypeScript | Provides conventional modules, validation boundaries, and WebSocket support for a team project. |
| Persistence | PostgreSQL 16 with Prisma | Clear relational schema, migrations, and reliable concurrent writes. |
| Game core | C++ compiled to browser WebAssembly | Keeps deterministic drawing/game calculations isolated from application concerns. |
| Coordinates | Sector-based floating origin | Avoids precision loss as the canvas moves far from its initial origin. |
| Container engine | Docker Compose | Lowest team onboarding risk; Podman compatibility can be checked later. |
| HTTPS | Caddy reverse proxy | Final deployment will terminate HTTPS and expose WSS for real-time traffic. |

## Repository ownership

- `srcs/frontend/`: React UI only.
- `srcs/backend/`: NestJS application, Prisma schema, and migrations.
- `srcs/core/`: reviewed C++/Wasm engine only.
- `setup/`: container and deployment configuration.
- `srcs/md/`: durable decisions and specifications.
- `.scratch/`: ignored, disposable AI/planning material.

The older empty `srcs/front/` and `srcs/back/` directories are local remnants;
the tracked convention is `srcs/frontend/` and `srcs/backend/`.

## Deferred decisions

1. Initial Prisma entities and relations.
2. Authentication/session strategy.
3. WebSocket message protocol and authoritative game-state cadence.
4. Exact module claims and owners; do not claim points before implementation.
5. Production domain, TLS contact address, and data-retention period.
