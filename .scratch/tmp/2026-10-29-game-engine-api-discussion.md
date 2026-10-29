# Sanitized discussion log — 2026-10-29

- User requested a frontend/backend API boundary for the game-engine black box.
- Agreed: frontend submits normalized final strokes; backend owns identity, challenge assignment, and server timing.
- Agreed: backend calls the deterministic engine once at round close with every participant, using an empty drawing for a player without a frozen submission.
- Agreed: results publish every final drawing ordered by score, with per-point on/off-target feedback parallel to submitted points.
- Agreed: backend determines timeout status from the server clock and challenge rules.
- Proposed operational limits: 256 strokes, 4,096 points per stroke, and 16,384 points per drawing; one-point strokes are valid.
- Challenge-specific tolerance and scoring remain engine-owned; ranking breaks ties by lower server-derived elapsed time, then shared rank.
