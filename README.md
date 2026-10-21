# Project Transcendence — Infinite Canvas & Cube Challenge

*This project has been created as part of the 42 curriculum by jyniemit.*

> **Repository baseline:** the architecture and development database are set up;
> the application itself has not yet been implemented. Do not claim unfinished
> modules in an evaluation.

## Goal

Project Transcendence will be a multi-user collaborative infinite canvas with
an embedded perspective-drawing game, Cube Challenge. The backend will own
authoritative shared/game state; clients render the UI and submit intent.

## Stack

| Layer | Selected technology | Reason |
| --- | --- | --- |
| Frontend | React, TypeScript, Tailwind CSS | Qualifying frontend framework. |
| Backend | NestJS, TypeScript | Clear modules, validation, and real-time boundaries. |
| Data | PostgreSQL + Prisma | Relations, migrations, and concurrent persistence. |
| Core | C++ compiled to WebAssembly | Deterministic engine work near browser rendering. |
| Deployment | Docker Compose, then Caddy HTTPS | Reproducible containers and HTTPS/WSS. |

See [`srcs/md/architecture-baseline.md`](srcs/md/architecture-baseline.md) for
the decisions and intentionally deferred details.

## Getting started

### Prerequisites

- Docker Engine with the Compose plugin;
- Git;
- later: Node.js and a C++/Wasm toolchain, with versions set by the owning
  implementation tasks.

### Development database

```console
cp .env.example .env
docker compose --env-file .env -f setup/compose.yaml up -d
docker compose --env-file .env -f setup/compose.yaml ps
```

This starts **only PostgreSQL**. It is not a completed application deployment.
Never commit `.env`; use `.env.example` as the safe template.

## Team and project management

<!-- HUMAN_CHECK: README_TEAM — replace every placeholder before evaluation. -->

| Member | 42 login | Role(s) | Responsibility |
| --- | --- | --- | --- |
| <name> | <42-login> | Product Owner | Vision, priorities, backlog validation. |
| <name> | <42-login> | Project Manager / Scrum Master | Meetings, risks, communication. |
| <name> | <42-login> | Technical Lead / Architect | Architecture, reviews, quality. |
| <name> | <42-login> | Developer | Implementation, tests, review, documentation. |

<!-- HUMAN_CHECK: README_PROJECT_PROCESS — document the actual team process. -->
Tasks are managed with [tatr](https://github.com/tsoding/tatr) in `tasks/`.
Record the team’s meeting cadence, communication channel, and review process
here once selected.

## Planned data model

No Prisma schema exists yet. The first schema proposal must document keys,
constraints, and migrations for at least:

```text
User ──< Session
User ──< Canvas ──< CanvasObject
User ──< Match >── User
```

The database owner must promote the finalized schema specification to
`srcs/md/` before implementing its Prisma migration.

## Features and module claims

Planned features include a shared canvas, accounts, Cube Challenge, real-time
synchronization, and durable history. Contributors and module points are
<!-- HUMAN_CHECK: README_MODULES — verify each claim against the official rubric. -->
Only list modules once they are implemented, tested, and demonstrable;
the current total is **0 points**.

## Legal pages

Working drafts are in [`docs/privacy-policy.md`](docs/privacy-policy.md) and
[`docs/terms-of-service.md`](docs/terms-of-service.md). Before deployment,
complete their placeholders and expose both as accessible frontend pages.

## Resources and AI use

- Official course subject and evaluation sheet (authoritative);
- NestJS, Prisma, React, Tailwind CSS, PostgreSQL, Docker, Caddy, and
  Emscripten documentation as implementation begins.

AI assistance has been used for planning and this repository baseline. Every
team member remains responsible for reading, understanding, testing, and
explaining their own contributions.

## Contribution rules

Keep planning material in `.scratch/` and promote reviewed decisions to
`srcs/md/`. Commit focused, attributable changes; never commit secrets,
generated dependencies, or unreviewed AI output.
