# Project Transcendence — Cube Challenge Multiplayer

<!-- DOC_SYNC: Review after changes to project scope, architecture, gameplay, stack, deployment, or documentation locations. -->

*This project has been created as part of the 42 curriculum by jyniemit.*

> **Repository baseline:** the architecture and development database are set up;
> the application itself has not yet been implemented. Do not claim unfinished
> modules in an evaluation.

## Goal

Cube Challenge Multiplayer is a perspective-drawing game. A player sees one
face of a cube and freehand-draws the remaining structure. They can practise
alone or compete in a synchronized room of **3–10 players**. In a multiplayer
round, everyone receives the same challenge at the same server-controlled time,
draws on a private canvas, and receives an authoritative ranked result when the
round ends.

The game deliberately does not use a shared live canvas: simultaneous players
compete on equivalent private attempts, preventing copying while keeping the
game state small and reliable.

## Stack

| Layer | Selected technology | Reason |
| --- | --- | --- |
| Frontend | React, TypeScript, Tailwind CSS | Qualifying frontend framework and browser drawing UI. |
| Backend | NestJS, TypeScript | Validation, authentication, room lifecycle, and WebSocket boundaries. |
| Data | PostgreSQL + Prisma | Clear relations, migrations, and concurrent persistence. |
| Game engine | TypeScript | Rules, challenge generation, stroke evaluation, and scoring; compiled to JavaScript for browser and server execution. |
| Deployment | Docker Compose, then Caddy HTTPS | Reproducible containers and HTTPS/WSS. |

See [`srcs/md/architecture-baseline.md`](srcs/md/architecture-baseline.md) for
accepted decisions and intentionally deferred details.

## Architecture documentation

- [`srcs/md/project_overview.md`](srcs/md/project_overview.md): product scope,
  game flow, and first vertical slice.
- [`srcs/md/architecture-baseline.md`](srcs/md/architecture-baseline.md):
  accepted technical decisions and protocol boundaries.

## Getting started

### Prerequisites

- Docker Engine with the Compose plugin;
- Git;
- later: Node.js and any implementation toolchains, with versions set by their
  owning tasks.

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
User ──< RoomParticipant >── Room ──< Round
Round ──< Submission ──> User
Round ──> Challenge
```

`RoomParticipant` records membership and connection state. Each `Submission`
contains one player's freehand attempt and its server-calculated score; a unique
constraint must allow at most one final submission per player per round.

The database owner must promote the finalized schema specification to
`srcs/md/` before implementing its Prisma migration.

## Planned gameplay

- Solo practice: complete one cube, submit, and review score and perspective
  guides.
- Multiplayer: create or join a room of 3–10 players; the server synchronizes
  the round timer and assigns the same challenge to every player.
- Freehand drawing: draw only the missing cube edges with pointer, mouse, or
  stylus input.
- Result: server-side validation and scoring produces a ranked result, with a
  clear winner, tie, or loss state.

The first scope excludes a general art workspace, shared live strokes, chat,
matchmaking, rankings across matches, and extra game modes.

## Features and module claims

<!-- HUMAN_CHECK: README_MODULES — verify each claim against the official rubric. -->
Contributors and module points will be listed only after they are implemented,
tested, and demonstrable; the current total is **0 points**.

## Legal pages

Working drafts are in [`docs/privacy-policy.md`](docs/privacy-policy.md) and
[`docs/terms-of-service.md`](docs/terms-of-service.md). Before deployment,
complete their placeholders and expose both as accessible frontend pages.

## Resources and AI use

- Official course subject and evaluation sheet (authoritative);
- Cube Challenge by daromeon, as gameplay inspiration only;
- NestJS, Prisma, React, Tailwind CSS, PostgreSQL, Docker, Caddy, and browser
  Canvas, Pointer Events, and Keyboard Events documentation as implementation
  begins.

AI assistance has been used for planning and this repository baseline. Every
team member remains responsible for reading, understanding, testing, and
explaining their own contributions.

## Contribution rules

Keep planning material in `.scratch/` and promote reviewed decisions to
`srcs/md/`. Commit focused, attributable changes; never commit secrets,
generated dependencies, or unreviewed AI output.
