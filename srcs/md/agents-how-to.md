# Working with project coding agents — review draft

<!-- DOC_TODO: AGENTS_GUIDE_REVIEW — finalize this review draft after the team confirms the agent workflow. -->

Coding agents can accelerate research and routine edits. They do not own a
decision or a commit: the teammate requesting the work remains responsible for
understanding, reviewing, testing, and explaining it.

## Before asking an agent

1. Read the relevant task and existing documentation.
2. State the outcome, constraints, files or boundaries, and how success will
   be checked.
3. Separate a product decision from an implementation request. Decide the
   former as a team; delegate only the latter.

Example prompt shape:

```text
Implement <outcome> in <boundary>. Preserve <constraint>.
Run <check> and report changed files and any limitation.
```

## Repository contract

The repository's `AGENTS.md` is mandatory reading for agents and contributors.
In particular:

- Read every file in `srcs/md/` before planning or changing source or docs.
- Keep final source in `srcs/frontend/`, `srcs/backend/`, or `srcs/core/`;
  keep reviewed architectural records in `srcs/md/`.
- Keep temporary plans and generated material in `.scratch/`; do not promote
  it until a human has reviewed it.
- Manage task records through `tatr`.
- Do not introduce technology outside React/TypeScript/Tailwind, NestJS/
  TypeScript, PostgreSQL/Prisma, and TypeScript game rules.
- Search for `DOC_SYNC` before a change affecting architecture, scope,
  gameplay, stack, protocol, deployment, or directory ownership.

## Documentation markers

`DOC_SYNC` marks review triggers. `DOC_TODO` marks outstanding decisions or
changeable details; every newly created or edited project document must use
`<!-- DOC_TODO: <ID> — <specific unresolved item and resolution condition>. -->`
for each such item, and remove or resolve it when finalized. `HUMAN_CHECK`
marks human verification or replacement. Grep for `DOC_TODO` before review.

## Delegate deliberately

Use agents for bounded work where the review cost is lower than doing it
yourself. Give them precise ownership so parallel work does not overlap.

Good examples:

- locate existing patterns or documentation;
- write a narrowly scoped test after the behaviour is specified;
- implement a small, accepted change with an explicit verification command.

Do not delegate unresolved scope, security decisions, module claims, or a task
you cannot personally review.

## Review every result

Before accepting an agent's work:

1. Read the diff and all generated files.
2. Verify it meets the task and project boundaries.
3. Run the relevant checks locally.
4. Test the user-visible or API behaviour when applicable.
5. Remove unnecessary abstraction, generated files, and unrelated edits.
6. Update the task and affected durable documentation.

Never commit credentials, cookies, access tokens, private URLs, or unreviewed
agent output. If the agent is unsure or validation fails, stop and clarify or
fix the issue before continuing.

## When to stop an agent

Pause the work when it changes the requested scope, proposes a new dependency
or architecture, conflicts with project documentation, or cannot show a
reproducible check. Record the question in the task and get a human decision.
