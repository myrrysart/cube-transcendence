# Onboarding-guide session log

<!-- DOC_TODO: SCRATCH_GUIDE_PROMOTION — confirm which onboarding drafts are approved and promote them only after human review. -->

- 2026-10-26: Requested a documentation-wide 1–4 player capacity standard and
  a `DOC_TODO` convention for unresolved or changeable details; applied and
  checked the affected documentation.
- 2026-10-26: Removed deprecated game-engine alternatives from project
  documentation and planning material.

- User selected the Tatr and coding-agent how-to guides; they are handling the
  Anki deck/guide separately.
- Intended final location: `docs/onboarding/`.
- Reviewed the current architecture records and local Tatr CLI help.
- Researched the official Tatr workflow, including task status updates.
- Drafted all onboarding guides except Anki in `.scratch/plan/`, pending human
  review and promotion.
- The project-management draft deliberately leaves team cadence, communication,
  and review choices for the team to decide and document.
- Expanded the Tatr draft with verified HUID extraction, exact-path lookup,
  quoted query examples, and a caution that the installed CLI does not expose a
  documented status-update command.
- Updated the project rule: Tatr owns task creation, HUID directories, listing,
  and queries; teammates may edit Markdown titles and bodies for standups and
  task context while preserving metadata.
- Added verified Bash/Zsh and Fish `topen` examples that search open and closed
  task output and open every match in Vim tabs.
- Established `tasks/tags` as the Tatr tag registry: one `ready`, `work`, or
  `review` workflow tag per open task; `owner-<42-login>` for active/review
  ownership; `kind-*` tags model Conventional Commit categories.
- The installed Tatr binary has no `ls -update` support. Policy now permits
  teammates to maintain existing task metadata while preserving its format;
  current tasks were placed in `ready`, except the active Anki task in `work`
  with `owner-jyniemit`.

- 2026-10-28: Added an initial Mermaid architecture rendition to the accepted
  baseline. It visualizes the documented browser, edge proxy, NestJS authority,
  and PostgreSQL/Prisma boundaries without introducing new architecture.
- 2026-10-28: Added `srcs/md/architecture.mmd` as the raw Mermaid input after
  a renderer was given the surrounding Markdown document rather than the fenced
  diagram source.
