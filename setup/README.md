# Container and developer operations

<!-- DOC_META: status=review version=4 -->
<!-- DOC_SYNC: Review after container, configuration, startup, migration or deployment changes. -->

## Default: complete local application

Copy .env.example to an untracked .env, change the database password, start Docker,
then run from the repository root:

```console
docker compose --env-file .env -f setup/compose.yaml up -d --build --wait
```

The base file now includes PostgreSQL, migrations/seed, API, scoring worker, and
built frontend/Caddy. Only the frontend is published, on 127.0.0.1:8443 by default.
The migration container exits with code 0 after success; this is expected, not a
failed service. Existing database data remains in the project named volume.

Node.js 24 builds/runs the backend. Frontend installation uses Bun 1.4.4 with the
committed frozen lockfile, then a Node build produces static assets. Caddy serves
those assets over HTTPS and forwards /api and /api/*, including WebSocket upgrades, to the
internal API. The frontend runtime is non-root and has no Node dependency.

The first build needs image/package registry access. Teammates need only Git and
Docker on the host. See the root [README](../README.md) for LAN configuration.
Caddy issues certificates using its internal CA; no public hosting/domain is needed.
Follow the root README to export the public CA certificate and trust it on each
player computer. CA keys/certificates persist in the separate caddy-data volume.
Caddy uses SITE_HOST as its default TLS name for IP clients without SNI. It
does not attempt to install OS/browser trust from inside the non-root container.

<!-- DOC_TODO: OPS_LOCAL_TLS — verify CA trust and HTTPS/WSS without warnings on each school evaluation device. -->
<!-- DOC_TODO: OPS_WORKER_HEALTH — define worker readiness and stuck-job alerting before release operation. -->

## Configuration

- WEB_BIND_ADDRESS: 127.0.0.1 for this computer; 0.0.0.0 to serve the school's LAN.
- SITE_HOST: certificate hostname/IP without protocol/port, default localhost; use the host LAN IP for peers.
- WEB_PORT: published TLS frontend port, default 8443.
- APP_ORIGIN: comma-separated exact browser origins; include the actual LAN URL
  when peers connect. Keep protocol/port consistent with the frontend address.
- POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB: initialized on first volume use.
  Changing a password in .env does not change an already initialized database
  role's password. Rotate the database role deliberately; do not delete data to
  repair a configuration mismatch.
- ENABLE_DEV_SESSION: false by default. Normal accounts work without guests.
  Set true only when intentionally using the Backend practice guest flow.

Database URLs are composed from the PostgreSQL variables inside Docker. Use
URL-safe values (a hexadecimal password is convenient) in this local example.
Do not print docker compose config output or commit .env: expanded configuration
contains credentials. docker compose config --quiet validates without displaying it.

The default stack uses NODE_ENV=production, enabling Secure session cookies and
disabling guest sessions even if ENABLE_DEV_SESSION=true. Browser HTTPS/WSS ends
at Caddy; private-container API/database connections remain internal. Only TLS
port 8443 is published. Caddy's HTTP readiness listener binds container loopback
only and is not externally reachable. Do not disable certificate verification to
claim browser trust. This is a local demonstration, not a public service setup.

## Optional host development

The previous compose.backend.yaml filename is retained as an optional override.
It now publishes only the API/database loopback ports for host tools:

```console
docker compose --env-file .env -f setup/compose.yaml -f setup/compose.backend.yaml up -d --build --wait
```

This explicit development override switches the API to NODE_ENV=development,
allows Vite HTTP origins on port 5173, and permits opt-in development guests.
Cookies then lack Secure; do not use this override for evaluation. When running the frontend on the host,
use Node.js 24, install the locked frontend dependencies with Bun, and run its
existing dev command. Container-only teammates do not need this override.
Host backend tooling needs a DATABASE_URL pointing at the published loopback
PostgreSQL port with matching credentials; the container URLs are supplied by
Compose and do not depend on that host variable.

## Checks

```console
docker compose --env-file .env -f setup/compose.yaml ps
docker compose --env-file .env -f setup/compose.yaml run --rm --no-deps -e NODE_ENV=test api sh -c 'node --test dist/backend/test/*.test.js dist/backend/test/*.integration.js'
```

Tests run compiled files because runtime build artifacts are not writable by the
non-root node user. Integration tests create unique temporary PostgreSQL schemas,
apply committed migrations and seed data there, and drop only those schemas.
The running game's rooms and results are unaffected.

Readiness checks PostgreSQL through the API, and the frontend health check calls
that same endpoint through Caddy. The worker is restarted on unexpected process
exit; job leases remain recoverable. Its application-level health/alerting remains
an open item above.

## Stop and preserve data

```console
docker compose --env-file .env -f setup/compose.yaml down
```

Ordinary shutdown keeps the database volume. down -v deletes it and must be used
only for a deliberately disposable database. Do not run different Compose project
names when you intend to share the same existing database; project names identify
separate container networks and volumes.
