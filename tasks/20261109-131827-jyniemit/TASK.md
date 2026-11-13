# Build perspective challenge creator

- STATUS: CLOSED
- PRIORITY: 50
- TAGS: kind-feat

## Outcome

Local challenge creator builds one metric 3D cube with size, location, and
yaw/pitch/roll; compiles it through a center-tracking camera using
orthographic, perspective, or equidistant curvilinear-fisheye projection; and
exports the persisted `{ draft, challenge }` JSON.

## Verification

- `srcs/core/game-engine`: `bun test` and strict TypeScript check pass (10
  tests).
- `srcs/frontend`: TypeScript check and Vite production build pass.
- Human browser review is required before treating the authoring flow as
  accepted; approved on 2026-11-09.
