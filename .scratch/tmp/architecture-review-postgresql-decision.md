# Architecture review — PostgreSQL scoring decision

- Reviewed sender/receiver ownership for solo and future multiplayer flows.
- Confirmed Creator is development-only; runtime challenges will come from a
  database after a challenge-catalog tool exists.
- Identified the multiplayer split between a public round prompt and the
  backend-only scoring challenge.
- Team decision: use a PostgreSQL-backed, claimable, idempotent scoring-job
  queue initially; defer a separate queue service until measured contention or
  queue delay warrants it.
- Team decision: active-round frontend JSON is a `RoundPrompt` containing only
  reference-edge geometry and timing; scoring geometry and settings remain
  backend-only until published results.
