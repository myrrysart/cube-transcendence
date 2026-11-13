# Promote doc-check to dev-tools and consolidate architecture docs for backend handoff

- STATUS: OPEN
- PRIORITY: 60
- TAGS: review,owner-jyry,kind-docs,architecture

- Promoted `dev-tools/doc-check.sh` with a top-of-file marker registry (`DOC_META`, `DOC_SYNC`, `DOC_TODO`, `HUMAN_CHECK`), automatic Markdown discovery, unknown-marker detection, `DOC_META` readiness (`status=<draft|review|ready> version=<N>`), and `game-engine-api.md` <-> `srcs/core/game-engine/index.ts` version sync.
- Consolidated `.scratch/plan/architecture-baseline.md` into `srcs/md/project_overview.md` and updated `README.md` links.
- Added `"test"` and `"typecheck"` scripts to `srcs/core/game-engine/package.json`.
