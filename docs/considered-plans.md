# Cube Challenge Multiplayer — Considered Plans

> This document records the selected product boundary and rejected scope. It is
> not a claim that any feature or module has been implemented.
<!-- DOC_TODO: PLANS_PROMOTION_REVIEW — promote only team-reviewed decisions from this planning record into durable architecture documents. -->

## Product decision

The first deliverable is a perspective-drawing game, not an art workspace.
Each round presents one visible face of a cube. The player freehand-draws the
missing structure, submits it, and receives a score plus perspective feedback.

The game works in two modes:

- **Solo practice:** one player completes and reviews one challenge.
- **Multiplayer room:** 1–4 players join a private room, receive the same
  challenge at the same server-owned start time, draw simultaneously on
  separate private canvases, and receive a ranked result at round end.

This follows the learning loop of daromeon’s Cube Challenge as gameplay
inspiration only. It does not reuse its code, assets, or presentation.

## Selected architecture

```text
React + TypeScript + Tailwind browser client
├── lobby, private drawing surface, feedback, results
└── HTTPS / WSS
             │
        Caddy reverse proxy
             │
        NestJS application
        ├── authentication and validation
        ├── room and round lifecycle
        ├── WebSocket presence/state notifications
        ├── authoritative scoring and ranking
        └── Prisma persistence
             │
        PostgreSQL
```

The initial scorer is deterministic TypeScript.

## Room and round protocol

1. An authenticated player creates or joins a room.
2. The server permits 1–4 room participants and tracks ready/disconnected
   status.
3. The server starts the round, assigns the challenge, and publishes absolute
   start/end timestamps.
4. Every client collects freehand points locally on its own canvas.
5. A client submits one final drawing; timeout also closes the drawing phase.
6. The server validates the submission, calculates its score, persists it, and
   computes the final ranking after the round closes.
7. The server publishes the result and feedback availability to every player.

WebSockets carry presence and state changes, not live drawing points. This is
both sufficient for simultaneous competition and lower risk than collaborative
stroke synchronization.

## Scope explicitly rejected for the first delivery

- infinite canvas, sector coordinates, paint simulation, colour mixing;
- screenshot/reference import, kitbashing, layers, and general art tools;
- live shared canvas, live cursors, or streamed strokes;
- chat, friends, profiles beyond required scope, matchmaking, spectators, and
  tournaments;
- additional challenges or modes such as endless, daily, double-cube, or
  persistent leaderboards;

## First validation sequence

1. Verify that a freehand solo attempt can be captured, scored, and explained
   with perspective guides.
2. Verify that three browsers receive the same challenge and start time.
3. Verify that separate computers can finish a room, disconnect/reconnect, and
   receive one consistent ranked result.
4. Only then evaluate optional work against the official module checklist.

The official subject and evaluation checklist remains authoritative over this
planning document.
