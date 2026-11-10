# Load creator-exported challenge JSON in solo practice

- STATUS: CLOSED
- PRIORITY: 50
- TAGS: kind-feat

## Outcome

Allow solo practice to accept a complete creator-exported `SavedChallenge` JSON
record and use its already-compiled `challenge` paths for drawing and local
evaluation.

## Constraints

- Validate the pasted JSON once at the browser input boundary; invalid records
  show an accessible error and never reach the evaluator.
- Do not regenerate geometry from `draft`; only the compiled `challenge` drives
  the drawing surface and scorer.
- Keep the existing built-in practice record as an explicit fallback until a
  valid imported record replaces it. No backend or persistence is in scope.

## Verification

- A JSON record exported by the creator loads and changes the reference paths.
- Malformed or incomplete JSON is rejected without clearing the current valid
  challenge.
- Core tests and frontend typecheck/build pass.

## Review note

Human verified both the downloaded-JSON paste/load path and its changed prompt.
