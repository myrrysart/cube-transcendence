# Visualize round data packets

- STATUS: CLOSED
- PRIORITY: 50
- TAGS: kind-feat

## Outcome

Provide a team-facing, local Protocol Inspector with readable text boxes that
follow one drawing from normalized coordinates through its submitted strokes,
server game input, engine result, and published result.

## Packets

- Frontend → backend: the documented `FinalDrawing` submission body.
- Backend → game engine: documented `GameInput` with challenge and round entry.
- Game engine → backend: documented `GameResult`, including point and target
  completion feedback.
- Backend → frontend: an explicitly **illustrative** result-publication
  envelope that combines public player label, challenge, final drawing, and
  engine result; it is not a transport contract.

## Constraints

- Build examples from the current local challenge/drawing/result where
  available, from point → stroke → drawing → round entries; never create
  alternate game geometry or scoring.
- Keep the inspector separate from Solo Practice drawing controls and clearly
  mark it as a team aid, not live network traffic.
- No backend, WebSocket, persistence, or new dependency work is in scope.

## Verification

- Each direction is labelled with sender, receiver, purpose, and its JSON-like
  data shape.
- The visualized submission reflects a drawn normalized stroke; judged output
  reflects current engine feedback.
- The illustrative backend-to-frontend wrapper is clearly labelled.
- Frontend build passes; human verifies the flow is comprehensible.

## Review note

Human verified all four labelled payload panels are understandable and the
backend-to-frontend publication wrapper is clearly marked illustrative.
