# Penalize unfinished target edges in scoring

- STATUS: CLOSED
- PRIORITY: 50
- TAGS: kind-feat

## Outcome

Score both point accuracy and target-edge completion. A drawing with one
well-placed click must not receive a perfect score when it leaves most target
paths unfinished.

## Rules to specify and implement

- Keep `hitTolerance` for classifying drawing points near a target path.
- Add a distinct per-target-line completion threshold: each target path must
  be covered by at least that percentage before it avoids a completion penalty.
- Define deterministic coverage measurement for straight and sampled curved
  target polylines, then expose completion feedback separately from point-hit
  feedback.
- Preserve deterministic ranking and all existing input/result invariants.

## Verification

- A single on-target click scores below a completed drawing of the same target.
- A drawing that covers every target path above the configured threshold avoids
  completion penalties.
- Tests cover partial paths, every target edge, thresholds, and deterministic
  results; frontend/build consumers remain compatible or are updated together.

## Decision

- Each target path uses an 80% completion threshold.
- Final score is point-hit accuracy multiplied by the average capped per-target
  completion ratio: `average(min(coverage / 0.8, 1))`.

## Review note

Human verified the Creator Studio default/reset cube size is 2, a single
on-target dab scores lower than completed paths, and Solo Practice displays
per-target completion against the 80% threshold.
