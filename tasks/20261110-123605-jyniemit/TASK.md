# Add direct Creator Studio controls

- STATUS: CLOSED
- PRIORITY: 50
- TAGS: kind-feat

## Outcome

Creator Studio supports direct preview controls: drag to yaw/pitch the camera,
start at a 75° field of view, and press a compiled edge to choose its
`hidden`, `reference`, or `target` role from a radial menu.

## Constraints

- These controls belong only to Creator Studio; Solo Practice drawing remains
  pointer drawing only.
- Hidden preview edges use a thin ant-line treatment.
- An invalid or degenerate draft remains visibly rendered on a red preview
  background so the author can correct it with the controls. It must not be
  exportable or loadable into Solo Practice.
- Preserve the shared core as the only geometry compiler and role authority.

## Verification

- Dragging changes yaw/pitch and starts at 75° FOV.
- Pressing each preview edge changes its persisted role through the radial
  menu; hidden uses the specified visual treatment.
- A deliberately invalid draft visibly retains a red preview and cannot be
  exported or opened in Solo Practice.
- Core tests and frontend typecheck/build pass; human verifies the creator
  controls without changing Solo Practice input.

## Review note

Human verified diagonal background drag changes both yaw and pitch, and the
radial menu exposes Hidden with a visible thin dashed line treatment.
