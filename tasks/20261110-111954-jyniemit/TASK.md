# Restore creator-to-solo challenge flow

- STATUS: CLOSED
- PRIORITY: 50
- TAGS: kind-feat

## Outcome

Provide a reachable local creator flow that exports a complete
`SavedChallenge` JSON record, then makes it practical to load that record into
solo practice without rebuilding its compiled challenge geometry.

## Constraints

- Reuse the existing creator and core compilation behavior where recoverable;
  do not duplicate game geometry or scoring in the frontend.
- Keep creator authoring separate from player drawing and local-only. No
  backend, persistence, room, or live-stroke work is in scope.
- Preserve the paste-and-validate import boundary from 20261109-150718-jyniemit.

## Verification

- A user can reach the creator, export its JSON, and load it into solo practice.
- The imported compiled paths become the solo prompt; malformed imports retain
  the current valid record.
- Core tests and frontend typecheck/build pass; human verifies the creator to
  solo handoff in the browser.

## Review note

The recovered flow is a new local Creator Studio because no prior browser UI
source existed in Git history or stashes. It uses the shared core compiler and
routes its valid output through the existing solo import validation boundary.
Human verified both direct creator-to-solo loading and downloaded JSON paste
loading, including a changed prompt.
