# Backend and infrastructure contribution

<!-- DOC_META: status=review version=1 -->
<!-- DOC_SYNC: Review after changes to backend, database, room protocol or local startup. -->

I added the backend and database flow around the existing drawing engine.
The engine still calculates geometry, feedback, scores and rankings. The backend
controls who can play, when a round runs, which drawing is accepted, and what is
saved.

## What I added

- Email/password signup, login and logout. Passwords are salted and hashed;
  sessions use HttpOnly cookies and hashed tokens in the database.
- PostgreSQL/Prisma tables and migrations for accounts, rooms, rounds, drawings,
  scoring jobs and results.
- Rooms for 1–4 players, ready state, host-controlled starts and one shared timer.
- Drawing validation and a first-submission rule: an accepted drawing cannot be
  replaced, and other drawings stay private until results.
- A separate worker that calls the existing engine after a round closes and saves
  one official result. Expired worker claims can recover after interruption.
- Authenticated WebSocket room/result updates and reconnect recovery.
- Multiplayer and Backend practice screens to test the real server flow.
- Local Docker configuration, API health checks and automated tests.

The flow is: **draw → submit → validate and save → score after closure → save and
show the official result**. PostgreSQL retains the result across restarts.
Unsubmitted browser strokes are not saved.

## Run locally

Use Docker Compose, Node.js 24 and npm. Copy .env.example to an untracked .env and
replace the example database password. Use a URL-safe password in the Compose
connection-string example. This setup is local development, not public deployment.

From the repository root:

```console
docker compose --env-file .env -f setup/compose.yaml -f setup/compose.backend.yaml up -d --build --wait
cd srcs/frontend
npm install --package-lock=false
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort
```

Open http://127.0.0.1:5173 and select Multiplayer. Use separate browser profiles
or normal/private contexts for independent accounts. Create a room, share its ID,
mark players ready, then let the host start. The demonstration uses one seeded
challenge and a 15-second drawing interval.

## Verification and remaining work

Backend tests run with npm test and npm run test:integration from srcs/backend.
Integration tests migrate/seed isolated temporary schemas and clean up only those
schemas. Frontend/backend builds, account/drawing checks, four-player HTTP/WS
integration tests, existing engine tests/typecheck and a live timed two-account
round passed. The Node.js 24 image and compiled integration tests also passed.

<!-- DOC_TODO: CONTRIBUTION_BROWSER_ACCEPTANCE — verify Chrome drawing, touch, layout, keyboard controls and separate-machine reconnect before accepting the feature for release. -->
<!-- DOC_TODO: CONTRIBUTION_PUBLIC_RELEASE — complete account recovery/verification, retention, worker monitoring/retry policy, shared rate limits and HTTPS/WSS deployment review before public release. -->

Public deployment is deferred. Presence currently targets one API instance.
The frontend still includes the original browser-only creator and solo tools.
No evaluation module points are claimed by this contribution summary.
