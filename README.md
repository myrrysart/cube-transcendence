*This project has been created as part of the 42 curriculum by jyniemit.*

# Cube Challenge Multiplayer

<!-- DOC_META: status=review version=4 -->
<!-- DOC_SYNC: Review after changes to scope, architecture, gameplay, stack, startup, protocols or deployment. -->

## Description

A perspective-drawing game: players see one face of a cube, draw the missing
edges, and receive feedback and a score. Rooms support 1–4 players with the same
server-controlled timer. Drawings stay private until the ranked result appears.

## Instructions

### Start the whole application

**You need Git and Docker with a running daemon and a recent Compose plugin.**
Node.js, Bun and PostgreSQL run inside containers; teammates do not install them
on their computers. Check Docker with `docker info` and `docker compose version`.

1. Clone the repository and enter its directory:

   ```console
   git clone https://github.com/myrrysart/cube-transcendence.git
   cd cube-transcendence
   ```

2. Create your local configuration:

   ```console
   cp .env.example .env
   ```

   Edit `.env` and replace `POSTGRES_PASSWORD` with a long random URL-safe
   password, such as a hexadecimal value. Do not commit `.env`. You do not need
   to create the database or configure a separate database URL for this setup.

3. Build and start everything with one command:

   ```console
   docker compose --env-file .env -f setup/compose.yaml up -d --build --wait
   ```

4. Export and trust the local CA certificate using the next section.

5. Open **https://localhost:8443** and select **Multiplayer**. Create an account,
   create/join a room, mark players ready, and let the host start the round.

The first build needs registry/internet access to download images and dependencies.
The running game can then be used on the local network. Migrations and the seeded
challenge are installed automatically. Do not run a separate Vite server for this
containerized setup.

### Trust HTTPS on each player's computer

HTTPS encrypts browser traffic and checks that the server presents a certificate
for the address you opened. Caddy creates a local certificate authority (CA) and
uses it to issue/renew the game's certificate. No public domain or internet
hosting is needed. The browser must trust this CA before it trusts the game.

After startup, export only the public root certificate:

```console
docker compose --env-file .env -f setup/compose.yaml cp frontend:/data/caddy/pki/authorities/local/root.crt setup/local-ca.crt
```

Give `setup/local-ca.crt` to each player through a trusted channel. Confirm its
SHA-256 fingerprint with the host before trusting it:

```console
openssl x509 -in setup/local-ca.crt -noout -fingerprint -sha256
```

- macOS: import it into Keychain Access, open the certificate's Trust settings,
  and explicitly trust it for SSL. Use the login keychain if system changes are restricted.
- Windows: import it into the current user's Trusted Root Certification Authorities.
- Linux/Chrome: use the browser/OS certificate manager to import it as a trusted
  local certificate authority. Managed school devices may require school IT.

Restart the browser if needed and open the configured HTTPS address. Do not use
certificate-warning bypasses as the evaluation procedure. Trust only the CA of a
host you know: a trusted CA can issue certificates. Remove this local trust after
the demo if it is no longer needed. Never share Caddy's CA private key or copy the
whole `caddy-data` volume to players. The exported public certificate is Git-ignored.

Caddy stores its CA and certificates in a persistent volume. Normal shutdowns
preserve it; deleting that volume creates a new CA, requiring trust setup again.
For a command-line check that verifies the certificate without changing OS trust:

```console
curl --cacert setup/local-ca.crt https://localhost:8443/api/ready
```

### Play across the school/local network

**One computer runs the containers. All players use that same computer's address.**
If everyone starts their own stack, each stack has a different database and rooms.

On the host, find its LAN IPv4 address in the operating system's network settings.
Edit these values in `.env`, replacing `<HOST-LAN-IP>` with that address:

```dotenv
WEB_BIND_ADDRESS=0.0.0.0
WEB_PORT=8443
SITE_HOST=<HOST-LAN-IP>
APP_ORIGIN=https://<HOST-LAN-IP>:8443
```

`SITE_HOST` is the hostname or IP in the certificate, without a scheme or port.
For the LAN configuration, the host also opens the LAN address. Run the same
startup command again, export the same CA as above and trust it on every player's computer. Other players open
`https://<HOST-LAN-IP>:8443` in Chrome. They do not use `localhost` and do not need
Docker installed. The host must permit TCP port 8443 under the school's network
rules. Client isolation on some Wi-Fi networks can block connections between PCs.

`APP_ORIGIN` must match the browser address exactly, including `https://` and the
port. If you change `WEB_PORT`, update the origins too. For two accounts on one
computer, use independent browser profiles or normal/private browsing contexts.

<!-- DOC_TODO: README_LAN_ACCEPTANCE — verify the school network's host address, permitted port and separate-machine reconnect before claiming LAN acceptance. -->

### What runs inside Docker

| Service | Responsibility |
| --- | --- |
| frontend | Builds React with the committed Bun lockfile; Caddy serves HTTPS files and proxies HTTPS/WSS browser requests. |
| api | NestJS accounts, sessions, room rules, validation and accepted submissions. |
| worker | Scores closed rounds using the shared engine and saves the official result. |
| db | PostgreSQL accounts, rooms, drawings, jobs and results. |
| migrate | Applies committed Prisma migrations and seeds a challenge, then exits successfully. |

Only the frontend port is published by default. The API and database remain
inside Docker's network. The default host binding is loopback; LAN binding is an
explicit `.env` setting. Data survives container restarts in a named Docker volume.

Browser connections now use **HTTPS/WSS**. Caddy terminates TLS and forwards to
NestJS over the private Docker network. API/database ports are not published in
the default stack. Production-mode sessions use Secure cookies; guest sessions
are disabled. The frontend automatically chooses WSS when opened over HTTPS.
Only TLS port 8443 is published: use `https://` explicitly; there is no public
HTTP listener or HTTP-to-HTTPS redirect. Verify certificate trust on each actual
evaluation device before claiming the secure-connection requirement complete.
<!-- DOC_TODO: README_EVALUATION_TLS — verify trusted HTTPS/WSS without browser certificate warnings on every evaluation device. -->

### Everyday commands

Run these from the repository root:

```console
docker compose --env-file .env -f setup/compose.yaml ps
docker compose --env-file .env -f setup/compose.yaml logs --tail=80 api worker frontend
docker compose --env-file .env -f setup/compose.yaml down
```

`down` stops/removes containers but keeps the database volume. Do not add `-v`
unless you intentionally want to erase the local database. After pulling changes,
run the startup command again to rebuild images and apply new migrations.
When upgrading the previous HTTP setup, set SITE_HOST=localhost, WEB_PORT=8443
and APP_ORIGIN=https://localhost:8443 in your existing .env, preserving database
credentials. Trust the exported CA, then sign in again.

For a different local port, edit `WEB_PORT` and `APP_ORIGIN`. An HTTP 403 usually
means the browser origin is missing from `APP_ORIGIN`; a 502/failed readiness check
means the API/database is unavailable. Inspect service status and logs first.

### Tests and developer workflow

The image includes compiled tests. With the stack running:

```console
docker compose --env-file .env -f setup/compose.yaml run --rm --no-deps -e NODE_ENV=test api sh -c 'node --test dist/backend/test/*.test.js dist/backend/test/*.integration.js'
```

NODE_ENV=test applies only to this disposable test process, allowing the legacy
guest-flow tests; the running API remains in production mode. Integration tests
use unique temporary database schemas and remove only those
schemas. They do not reset the application's saved rooms or results. See
[setup/README.md](setup/README.md) for host development, diagnosis and migration
notes. A real Chrome/mobile/multi-computer walkthrough is still required in
addition to automated tests.

## Technical Stack

| Part | Technology | Reason |
| --- | --- | --- |
| Frontend | React, TypeScript, Tailwind CSS, Vite | Interactive drawing UI, shared types, styling and a static production build. |
| Backend | NestJS, Node.js 24, TypeScript | HTTP/WebSocket boundaries and authoritative account, room and round rules. |
| Database | PostgreSQL 16, Prisma | Relational constraints, transactions, typed queries and versioned migrations. |
| Game engine | Shared TypeScript | Geometry, stroke evaluation, scoring and ranking used by browser/server tooling. |
| Operations | Docker Compose, Caddy 2 | One-command startup, static files and a same-origin API/WebSocket proxy. |

The frontend image builds with Bun 1.4.4 and the committed lockfile. Backend
packages use `npm ci`. Dependencies and scripts are recorded in each component's
`package.json`; image versions are defined in `setup/`. A separate scoring worker
keeps closed-round scoring outside the request path without adding a queue service.

## Database Schema

```text
User ──< Session
User ──< RoomParticipant >── Room ──< Round ──> Challenge
User ──< RoundParticipant >── Round
RoundParticipant ── Submission
Round ── ScoringJob
Round ── RoundResult
```

| Model | Key fields and types | Purpose / constraints |
| --- | --- | --- |
| User | `id UUID`, `label text`, `email text?`, `passwordHash text?` | Unique email for accounts; nullable credentials also support development guests. |
| Session | `tokenHash text` primary key, `userId UUID`, `kind enum`, `expiresAt timestamptz` | Expiring account/guest session belonging to a user. |
| Challenge | `id text`, `geometry JSONB` | Engine geometry reused by rounds. |
| Room | `id UUID`, `hostId UUID`, `activeRoundId UUID?` | Host and current round; membership is stored separately. |
| RoomParticipant | composite key `roomId UUID, userId UUID`, `ready boolean`, `lastSeenAt timestamptz?` | Room membership, readiness and presence. |
| Round | `id UUID`, `challengeId text`, `roomId UUID?`, `startsAt/endsAt timestamptz` | Server-owned challenge and time window. |
| RoundParticipant | `id UUID`, `roundId UUID`, `userId UUID` | Unique user/round pair; freezes participating users. |
| Submission | `participantId UUID` primary key, `drawing JSONB`, `receivedAt timestamptz` | At most one accepted drawing per participant. |
| ScoringJob | `roundId UUID` primary key, `status enum`, `claimToken UUID?`, `leaseUntil timestamptz?`, `attempts integer` | Durable work with expiring claims and retry protection. |
| RoundResult | `roundId UUID` primary key, `result JSONB`, `createdAt timestamptz` | One persisted official result per round. |

See [the authoritative Prisma schema](srcs/backend/prisma/schema.prisma) and
[committed migrations](srcs/backend/prisma/migrations). Passwords are salted
scrypt hashes; only session-token hashes are stored. Foreign keys preserve the
relationships shown above.

## Team, process and contributions

<!-- HUMAN_CHECK: README_TEAM — replace every placeholder before evaluation. -->
<!-- DOC_TODO: README_TEAM — confirm all team logins, required roles and per-person contributions before evaluation. -->

| Member / 42 login | Role | Responsibility |
| --- | --- | --- |
| <name / login> | Product Owner | Scope, priorities and completed-work validation. |
| <name / login> | Project Manager | Coordination, task ownership and meeting records. |
| <name / login> | Technical Lead | Architecture, reviews and integration quality. |
| <names / logins> | Developers | Implementation, testing and explaining individual contributions. |

<!-- HUMAN_CHECK: README_PROJECT_PROCESS — document the actual team process. -->
<!-- DOC_TODO: README_PROJECT_PROCESS — record the team's actual meeting cadence, communication and review process before evaluation. -->

Tasks use Tatr in `tasks/`; see [the task workflow](srcs/md/tatr-how-to.md).
The implementation includes engine/creator/solo tooling, accounts and sessions,
rooms/readiness, private drawings, scoring jobs, ranked results and live snapshots.
The [backend contribution summary](srcs/md/backend-contribution.md) explains the
backend increment. Confirm contributor attribution in the roster before evaluation.

## Project Management

The team/process section above retains the current role and workflow placeholders.
Tatr task records in `tasks/` are the shared task source; Git branches and pull
requests provide change review. Actual meeting cadence, communication channels and
work distribution still require the team confirmation marked above.

## Features List

| Implemented feature | What it does | Contribution area |
| --- | --- | --- |
| Engine and authoring tools | Cube geometry, challenge creation/import, stroke feedback, scoring and ranking; browser creator and solo tools. | Engine/frontend tooling |
| Accounts and sessions | Email/password registration and login, logout, expiring cookie sessions and authentication limits. | Backend/data |
| Multiplayer interface | Account forms, room controls, drawing canvas, timer and result display connected to the API. | Frontend/backend integration |
| Rooms and timed rounds | Up to four members, readiness, host-only start and a shared server-owned deadline. | Backend/data + frontend integration |
| Private submissions | Boundary validation, one accepted drawing per player and no live sharing of strokes. | Backend/data + engine |
| Live state and results | Authenticated WebSocket snapshots, presence, reconnect and persisted ranked results. | Backend/data + frontend integration |
| Durable scoring | PostgreSQL job claims, retry leases and a separate scoring worker. | Backend/infrastructure + engine |
| Local/LAN containers | React/Caddy, API, worker, migrations and PostgreSQL started together; persistent database volume. | Backend/infrastructure |

These are contribution areas, not verified individual attribution. The unchanged
team section above remains the place to confirm names and ownership.
<!-- DOC_TODO: README_FEATURE_OWNERS — replace contribution areas with confirmed member attribution after the team verifies feature ownership. -->

## Modules

<!-- HUMAN_CHECK: README_MODULES — verify each claim against the official rubric. -->
<!-- DOC_TODO: README_MODULE_PLAN — agree, demonstrate and document at least 14 valid module points and their contributors before claiming evaluation readiness. -->

The following is a **candidate assessment**, not a validated point claim. Only a
complete demonstration against the supplied subject can establish module credit.

| Candidate module | Points | Implementation / remaining evidence | Contribution area |
| --- | ---: | --- | --- |
| Major: frontend and backend frameworks | 2 | React + NestJS are implemented. Do not also count their alternative minor framework modules. | Frontend + backend |
| Minor: ORM | 1 | Prisma models, migrations and PostgreSQL-backed queries are implemented. | Backend/data |
| Major: real-time features | 2 | WebSocket room/round/result updates and reconnect exist; complete the browser disconnect/reconnect demonstration. | Backend + integration |
| Major: complete web game | 2 | Timed competitive drawing and ranked outcomes exist; demonstrate the full rules, scoring and win/tie/loss interpretation in the UI. | Engine + frontend + backend |
| Major: multiplayer, more than two players | 2 | Four-player capacity and synchronized rounds exist; demonstrate a complete round with at least three players. | Backend + integration |
| Major: remote players | 2 | Shared-server LAN setup exists; verify separate computers, latency, disconnects and reconnects. | Infrastructure + integration |

**Subtotal represented in code: 9 candidate points. Remote-player acceptance
could bring the potential total to 11. The subject requires at least 14.** Thus
at least 3 additional points are needed if all six candidates are accepted; more
are needed if any candidate fails its complete criteria. Module contributors must
be confirmed using the team roster before evaluation.

Possible additional modules to discuss with the team are OAuth (1), two additional
supported browsers beyond Chrome (1), and health/status monitoring with automated
backups and disaster recovery (1). These are suggestions, not selected or completed
modules. The existing health endpoint alone does not complete the operations module.
<!-- DOC_TODO: README_EXTRA_MODULES — select and implement additional modules with the team, record owners and acceptance evidence, and preferably exceed the 14-point minimum. -->

Registration/login is mandatory and does not by itself complete standard user
management: profiles, avatars and friends are missing. Containers alone do not earn
DevOps module points. A standalone admin dashboard is not mandatory; claiming
advanced permissions would require the complete roles and user-management module.

## Individual Contributions

The existing team section is intentionally retained pending team confirmation.
The [backend contribution summary](srcs/md/backend-contribution.md) describes the
backend/infrastructure work: accounts and sessions, relational persistence, rooms,
submission rules, durable scoring, live snapshots, tests and container startup.
Important implementation challenges include concurrent submissions, worker retries
and publishing the same official result after reconnect.

The final individual account must also identify who implemented engine/tooling,
frontend integration and each claimed module, explaining their challenges and
solutions. Git history supports this review but does not replace team confirmation.
<!-- DOC_TODO: README_INDIVIDUAL_CONTRIBUTIONS — add the verified per-person feature/module ownership and challenges/solutions before evaluation, retaining the current team section until confirmed. -->

## Remaining evaluation requirements

- Confirm the team roster, all required roles and individual contributions. The
  supplied subject specifies **4–5 members**; the previously described three-person
  team needs an official clarification or an eligible team arrangement.
- Complete and demonstrate at least **14 module points**, with clear owners.
- Verify **HTTPS/WSS** and local CA trust on the actual evaluation computers;
  public hosting is not required.
- Have the operator review the implemented legal pages, contact mailbox and
  data-request/deletion procedure; approve a concrete data-deletion schedule.
- Complete a real Chrome walkthrough with no console errors/warnings, responsive
  layouts, keyboard/accessibility checks and client/server input validation checks.
- Run the complete three-or-more-player, separate-computer LAN flow, including
  disconnect/reconnect and persisted results after restart.
- Have every member review and explain their changes and demonstrate meaningful
  contributions in Git. Automated tests do not replace the evaluator demonstration.

The app exposes [Privacy Policy](docs/privacy-policy.md) at `/privacy` and
[Terms of Service](docs/terms-of-service.md) at `/terms`. Footer links are available
on all screens and open separately so an unfinished drawing is not discarded.
These pages describe current local operation and use the supplied team contact.
They do not implement account deletion/export or complete a GDPR module.
<!-- DOC_TODO: README_LEGAL_REVIEW — have the team verify the published policy, contact mailbox and request/deletion procedure before evaluation. -->

## Resources

- [React documentation](https://react.dev/learn)
- [NestJS documentation](https://docs.nestjs.com/)
- [Prisma documentation](https://www.prisma.io/docs)
- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [Tailwind CSS documentation](https://tailwindcss.com/docs)
- [Docker Compose documentation](https://docs.docker.com/compose/)
- [Caddy documentation](https://caddyserver.com/docs/)
- [Project architecture](srcs/md/project_overview.md) and [engine contract](srcs/md/game-engine-api.md)

The supplied official subject and evaluation sheet define acceptance criteria.
The gameplay was inspired by daromeon's Cube Challenge; its code and assets are
not reused.

### AI assistance

AI assistance was used for architecture discussion, backend/infrastructure drafts
and implementation, documentation, test preparation and verification. Every
contributor remains responsible for reviewing, testing and explaining the code
they contribute. Commit only understood changes; keep disposable learning notes
and generated experiments in `.scratch/`.
