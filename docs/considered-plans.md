# ft_transcendence — Considered Architecture Plans

> This document records the alternatives considered during planning, their trade-offs, and the current recommended direction. It is not a claim that any module has been implemented.

## 1. Goals and constraints

The team wants to learn:

- C;
- WebAssembly;
- htmx;
- real-time networking/game architecture;
- SQL persistence and deployment.

At the same time, the project must remain defensible against the supplied rubric: frontend, backend, database, HTTPS, multi-user operation, a one-command containerized deployment, and 14 validated module points.

The guiding rule is:

> Use unfamiliar technology where it creates learning value, but do not make an immature or browser-incompatible technology the only path to a passing project.

## 2. Terminology: the responsibilities must not overlap

| Concern | Correct owner |
| --- | --- |
| Semantic pages, forms, accessibility | Server-rendered HTML and templates |
| Partial page updates | htmx |
| Game drawing and local input | C/WASM attached to a `<canvas>` |
| Browser-compatible live transport | `wss://` WebSocket or Socket.IO |
| Canonical score, state, rules, and winner | Server-authoritative game service |
| Accounts, permissions, friends, matches, tournaments | Backend application |
| Durable data | Relational database |
| TLS termination/routing | Caddy or equivalent reverse proxy |

htmx is appropriate for human-speed interactions such as a profile edit. It is not the game loop. A game should not send high-frequency paddle movement as HTML fragments.

## 3. Rejected or deferred approaches

### 3.1 GameNetworkingSockets as browser transport — rejected for the critical path

Valve GameNetworkingSockets is a native, UDP/ICE/relay-oriented transport. A browser cannot expose arbitrary native TCP/UDP sockets simply because code was compiled to WASM. A WebSocket client cannot directly connect to a GameNetworkingSockets listener.

**Decision:** browser clients use WSS. GameNetworkingSockets may later be explored for a native bot/client or a non-critical experiment, but must not block the web game.

References:

- [GameNetworkingSockets](https://github.com/ValveSoftware/GameNetworkingSockets)
- [Emscripten networking constraints](https://emscripten.org/docs/porting/networking.html)

### 3.2 WASIX as the browser game runtime — deferred

WASIX is valuable for running POSIX-like software under Wasmer. It is not the low-risk choice for a browser canvas game:

- it requires a Wasmer runtime layer rather than direct standard browser WASM instantiation;
- its browser path adds workers, cross-origin isolation, and potentially a network proxy;
- it does not offer Emscripten’s mature canvas, DOM, input, and WebSocket integration;
- it does not bypass browser socket restrictions.

**Decision:** use Emscripten for the browser game. WASIX can be learned in a small independent tool/demo after the project path is stable.

References:

- [WASIX](https://wasix.org/docs/)
- [Wasmer JavaScript runtime](https://docs.wasmer.io/runtime/js/)
- [Emscripten HTML5 API](https://emscripten.org/docs/api_reference/html5.h.html)

### 3.3 React plus htmx in the same main UI — rejected

React and htmx both expect to own DOM updates. Mixing them across normal application pages creates two rendering models, more integration bugs, and little benefit.

**Decision:** if htmx is selected, it owns the surrounding application pages. Keep any JavaScript around the WASM canvas small and isolated.

## 4. Backend alternatives

### Option A — NestJS + htmx + C/WASM

**Shape:** NestJS renders HTML/templates or htmx fragments; it manages sessions, database access, WebSockets, and game rooms. C is compiled to WASM for the game core.

**Strengths**

- Lowest infrastructure risk.
- NestJS clearly qualifies as a backend framework.
- Strong validation, authentication, module boundaries, and WebSocket support.
- Easy PostgreSQL ORM/migration path with Prisma.

**Costs**

- Requires TypeScript in addition to C.
- Does not make the backend itself a C learning exercise.

**Use when:** the priority is passing reliably while keeping C focused on the game.

### Option B — Kore + htmx + native C game service

**Shape:** Kore is the C HTTP/WebSocket backend. It serves htmx fragments, manages sessions and match rooms, talks to PostgreSQL, and can share native C game logic.

**Strengths**

- C-first, event-driven, security-conscious framework.
- Built-in HTTP, WebSockets, TLS support, and PostgreSQL integration.
- Strongest authentic “handmade C backend” option.

**Costs**

- Smaller ecosystem and more framework-specific learning.
- The team must design more of the authentication, validation, migrations, templating, and testing infrastructure.
- More time risk than NestJS.

**Use when:** learning C backend engineering is more important than the lower-risk TypeScript option, and the team accepts the additional scope.

References: [Kore](https://kore.io/) and [Kore source](https://github.com/jorisvink/kore).

### Option C — Drogon + htmx + C game core

**Shape:** Drogon provides the C++ application backend; the game core stays in C and is linked or exposed through a small adapter.

**Strengths**

- Mature application framework: routes, controllers, filters, sessions, templates, WebSockets, ORM, and relational database support.
- Much lower web-plumbing risk than a C server library.
- Clearly defensible as a backend framework.

**Costs**

- C++ rather than C for web application code.

**Use when:** C++ is acceptable and the team wants a lower-level feel with a more complete framework than Kore.

Reference: [Drogon](https://github.com/drogonframework/drogon).

### Not recommended as the main backend

| Technology | Reason |
| --- | --- |
| CivetWeb | Good embedded server, but too much application structure must be invented. |
| Mongoose | Useful embedded networking, but GPL/commercial licensing and weak relational application tooling add risk. |
| Onion | Less current ecosystem and weaker WebSocket/database story. |
| Homemade HTTP server | Educational, but unsuitable as the critical path for authentication, HTTPS, WebSockets, validation, and project deadlines. |

## 5. Database alternatives

### SQLite

SQLite is viable for a single application server if writes are short, WAL mode is enabled, prepared statements are used, and the database file is kept on a persistent local Docker volume. It is a useful learning choice.

However, it allows one writer at a time. It is less convenient when chat, sessions, tournaments, and simultaneous game-result writes are all being built by a new team.

### PostgreSQL — recommended for the main plan

PostgreSQL is the conservative multi-user choice: mature concurrency behavior, good schema tooling, common hosting/deployment knowledge, and strong support from NestJS/Prisma, Kore, and Drogon.

**Decision:** choose PostgreSQL for the evaluated application unless the team deliberately selects Kore/SQLite and fully understands the write/concurrency design.

## 6. Current recommended plans

Choose **one** before implementation. Do not combine plans casually.

### Plan 1: Passing-first, htmx retained

```text
Browser
├── semantic HTML templates + htmx + Tailwind CSS
├── C/WASM game module compiled with Emscripten
└── small JS WebSocket/canvas adapter
              │ HTTPS / WSS
Caddy reverse proxy
              │
NestJS application
├── HTML/htmx routes and server-side validation
├── secure sessions, authorization, rate limits
├── Socket.IO/WebSocket rooms, matchmaking, reconnection
├── authoritative game orchestration
└── Prisma migrations and repositories
              │
PostgreSQL persistent volume
```

Claim backend-framework and ORM modules only; do not claim a frontend-framework module for htmx. Keep C/WASM as the game-specific technical centerpiece.

### Plan 2: C-first, higher learning risk

```text
Browser: HTML + htmx + Tailwind + Emscripten C/WASM + WSS adapter
              │
Caddy
              │
Kore C application: routes, sessions, WebSockets, match rooms, native C game core
              │
PostgreSQL
```

This is defensible if Kore is used as the actual structured backend framework, rather than merely embedding a server library. It requires a stricter early prototype: HTTPS, login, htmx fragment, WebSocket connection, and two-user game room must all work before optional modules are attempted.

## 7. Module strategy when htmx is the frontend

Because htmx is not being claimed as a frontend framework, a game-centered plan can reach 14 points with:

| Module | Points | Minimum evidence |
| --- | ---: | --- |
| Backend framework | 1 | NestJS, Kore, or Drogon used as the actual backend architecture. |
| ORM | 1 | A genuine ORM, not just raw SQL. This fits most naturally with NestJS + Prisma or Drogon ORM. |
| Complete web game | 2 | Live user-vs-user game with clear rules/outcome. |
| Remote players | 2 | Two computers, disconnect/reconnect behavior. |
| User interaction | 2 | Basic persisted chat, profiles, friends. |
| Standard user management | 2 | Profile editing, avatar/default avatar, friends, online status. |
| AI opponent | 2 | Explainable, competent but imperfect opponent. |
| Tournament | 1 | Registration, bracket/order, tracking/management. |
| Game statistics/history | 1 | Persisted results, statistics/history, leaderboard/progression. |
| **Total** | **14** | Every item must be demonstrated. |

Add a well-tested one-point buffer, such as game customization or spectator mode, before considering the score safe.

## 8. Immediate architecture decisions to make

1. Choose **Plan 1 (NestJS)** or **Plan 2 (Kore)**.
2. Choose PostgreSQL unless the team intentionally accepts SQLite’s concurrency constraints.
3. Define the C game-core API: initialization, input, fixed tick, state snapshot, reset, cleanup.
4. Define the WebSocket message protocol: authenticate, join queue, match assigned, input, snapshot, disconnect, reconnect, match result.
5. Create a thin vertical slice before feature work: Docker + HTTPS + signup/login + htmx fragment + database migration + offline WASM game + two-browser WebSocket room.

No optional module should start before this slice works end-to-end.
