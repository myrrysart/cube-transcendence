# Project Transcendence — Cube Challenge Multiplayer

## 1. Project vision

Cube Challenge Multiplayer turns a short perspective-drawing drill into a
game. Given one visible face of a cube, a player freehand-draws the missing
structure, submits it, and receives perspective feedback and a score.

- **Solo practice** is the smallest complete learning loop.
- **Multiplayer** supports rooms of 3–10 simultaneous players. Every player
  receives the same prompt and server-controlled timer, but draws on a private
  canvas. The server calculates and publishes the ranked result.
- The game has clear rules, a time limit, and a win/loss/tie result. It is not
  a general drawing application or a shared-canvas collaboration tool.

The core reference is the gameplay loop of daromeon’s Cube Challenge: infer a
cube from one face, draw the rest, and learn from immediate feedback. No code,
artwork, or assets are reused.

## 2. Tech stack and scope boundary

- **Frontend:** React (JSX), TypeScript, Tailwind CSS for the lobby, drawing
  surface, feedback, and results UI.
- **Backend:** NestJS on Node.js with TypeScript for validation, room and round
  state, WebSocket notifications, and authoritative scoring.
- **Database:** PostgreSQL with Prisma for relational user, room, round, and
  submission data.
- **Game engine:** TypeScript implements all game rules, challenge generation,
  stroke evaluation, and scoring. Browser and server code compile to JavaScript;
  the project has no C++ or WebAssembly core.

The game uses browser pointer events for drawing and keyboard events for
shortcuts and accessible controls. React owns application screens and static UI;
the drawing surface and any animation loop remain outside React state updates.
Game rules and network message types must remain independent of the browser UI,
database, and NestJS framework so the server can validate every submission.

The product deliberately excludes infinite-canvas coordinates, paint tools,
colour mixing, screenshots, kitbashing, live shared strokes, chat, and general
asset management.

## 3. Game flow

1. A player chooses solo practice or creates/joins a multiplayer room.
2. A multiplayer room starts only with 3–10 ready participants.
3. The server assigns one challenge and a start/end timestamp to every player.
4. Each player freehand-draws the missing edges on their own canvas.
5. At submission or timeout, the server validates and scores the attempt.
6. The result view shows the score, rank, and correct perspective guides.

The server is authoritative for capacity, room membership, timestamps,
submission acceptance, scoring, and final rankings. Clients never determine
the winner.

## 4. Directory structure and AI policy

- `srcs/md/`: reviewed architectural decisions and specifications.
- `srcs/frontend/`: React application.
- `srcs/backend/`: NestJS application, Prisma schema, and migrations.
- `srcs/core/`: no active source code; game logic is implemented in TypeScript
  within the frontend and backend applications.
- `.scratch/tmp/` and `.scratch/plan/`: disposable planning and generated
  material; decisions require human review before promotion.
- `tasks/`: task tracking managed only through `tatr`.
- `setup/` and `build/`: Docker/Podman configuration.

## 5. First vertical slice

1. Render one challenge and collect freehand strokes in a solo browser flow.
2. Submit strokes to a server-side deterministic scorer and show feedback.
3. Add a 3–10-player room, ready state, synchronized timer, and private
   attempts.
4. Persist final submissions and publish the ranked results.
5. Test the complete flow on separate machines before optional features.

No optional mode or social feature starts until this loop works end to end.
