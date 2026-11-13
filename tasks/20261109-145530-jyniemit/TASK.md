# Add solo draw-and-judge browser flow

- STATUS: CLOSED
- PRIORITY: 50
- TAGS: kind-feat

## Outcome

Load one saved `{ draft, challenge }` record in the browser, collect a solo
normalized freehand drawing, evaluate it through the shared core engine, and
render score plus point feedback.

## Constraints

- The browser uses the compiled `Challenge` path data; it does not regenerate
  geometry.
- Keep drawing input, submission conversion, and result rendering separate from
  the dependency-free core evaluator.
- No backend, persistence, room, or live-stroke work belongs in this slice.

## Verification

- Core scoring tests remain green.
- Frontend typecheck/build passes.
- Human verifies one successful judged drawing and one visibly off-target
  drawing in the browser.

## Review note

- The shared evaluator is explicitly permitted for browser-only solo practice;
  multiplayer remains backend-authoritative.
- Core tests and the frontend production build pass. The development server now
  starts with `bun run dev`; human browser verification passed for left/right
  pointer tracking plus on-target and off-target feedback.
