# Teammate setup — review draft

<!-- DOC_TODO: SCRATCH_REPO_URL — replace the repository URL placeholder when the canonical remote is confirmed. -->
<!-- DOC_TODO: SCRATCH_TOOLCHAIN_VERSIONS — set Node.js and application-tool versions when implementation tasks introduce them. -->

This setup prepares the current repository baseline. It starts the development
database only; the frontend and backend have not been implemented yet.

## Prerequisites

- Git
- Docker Engine with the Compose plugin
- The repository's `tatr` task-tracker command

Node.js and application-specific tooling are intentionally not required yet.
Their versions belong to the tasks that introduce the frontend and backend.

## First-time setup

Clone the repository, then create a private local environment file:

```console
git clone <repository-url>
cd transcendence
cp .env.example .env
```

Never commit `.env`. Replace the example database password before starting a
shared or exposed environment.

Start PostgreSQL and confirm that it is healthy:

```console
docker compose --env-file .env -f setup/compose.yaml up -d
docker compose --env-file .env -f setup/compose.yaml ps
```

The expected service is `db`. This does not start the game, an API, Caddy, or
HTTPS; claiming otherwise would be inaccurate at this stage.

## Daily work

1. Pull the current branch and read the relevant task.
2. Check the backlog with `tatr ls`.
3. Read `AGENTS.md` and the current records in `srcs/md/` before planning or
   modifying source or documentation.
4. Start the database only if the task needs it.
5. Make a focused, reviewable change and run its documented checks.

Stop the database without deleting data when finished:

```console
docker compose --env-file .env -f setup/compose.yaml down
```

Use `down -v` only when you deliberately want to erase local PostgreSQL data.

## Where things belong

- `srcs/frontend/`: React UI.
- `srcs/backend/`: NestJS app, Prisma schema, and migrations.
- `srcs/md/`: reviewed architecture and specifications.
- `.scratch/`: disposable drafts, plans, and agent material.
- `tasks/`: task records managed with Tatr.
- `setup/`: current container baseline.

Ask before adding a dependency, changing the stack, storing credentials, or
promoting generated material from `.scratch/`.
