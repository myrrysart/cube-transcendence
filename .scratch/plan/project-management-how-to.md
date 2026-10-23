# Project management — review draft

Use this guide to keep the first vertical slice small, owned, and reviewable.
The team still needs to agree its actual meeting cadence, communication channel,
and review process; record those choices in the root `README.md` rather than
pretending they are already decided.

## Plan from the vertical slice

The current order is deliberate:

1. Solo drawing and stroke collection.
2. Server-side scoring and feedback.
3. Private multiplayer room and synchronized timer.
4. Persisted submissions and ranked results.

Do not start optional social features, extra modes, or broad art-tool features
before this loop works end to end.

## Turn work into tasks

Create one task for one reviewable outcome. Its description should answer:

- What problem or outcome does this cover?
- Which part of the vertical slice and which directories does it affect?
- What constraints from `srcs/md/` apply?
- How will a reviewer verify it?
- Which task, decision, or teammate blocks it?

Use Tatr for task status and tags. See the Tatr guide for commands and task
record rules.

## Agree the team process

At the first team meeting, select and document:

1. A regular planning/check-in cadence.
2. One communication channel and response expectation.
3. Who owns product priorities, coordination, architecture review, and each
   active implementation task.
4. A pull-request or peer-review rule before merge.
5. How decisions, blockers, and meeting outcomes are recorded.

Keep role names flexible, but make responsibilities explicit. One teammate may
hold several roles; every responsibility still needs one clear owner.

## Definition of ready and done

Start work only when the task has a clear outcome, owner, constraints, and
verification plan. Finish it only when the implementation or document has been
reviewed, relevant checks pass, its task record is updated, and any affected
`DOC_SYNC` documentation is reconciled.

## Review small increments

Prefer a narrow end-to-end change over disconnected layers of scaffolding.
During review, check the task outcome, diff size, tests or manual evidence,
documentation accuracy, and whether the work expands scope. Record a follow-up
task instead of hiding extra work in the current task.
