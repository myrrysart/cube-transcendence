# Label creator edges on canvas

- STATUS: CLOSED
- PRIORITY: 50
- TAGS: kind-feat

## Outcome

Show every compiled Creator Studio edge's stable ID at the visual midpoint of
its rendered path.

## Constraints

- Labels follow compiled path geometry, including sampled curvilinear paths;
  do not derive or duplicate cube geometry in the frontend.
- Keep labels legible against every edge role and do not affect exported JSON,
  solo practice, scoring, or the creator compiler.

## Verification

- Every visible Creator Studio edge has one ID label centred on its rendered
  path in perspective and curvilinear previews.
- Frontend typecheck/build passes; human verifies labels in the browser.

## Review note

Human verified legible midpoint labels for every edge in both default and
curvilinear-fisheye previews.
