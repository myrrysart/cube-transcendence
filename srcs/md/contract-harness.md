# Standalone contract and file revision harness

<!-- DOC_META: status=review version=1 -->
<!-- DOC_SYNC: Review after changes to contract authority, file revision rules, coverage, hook activation, or verification commands. -->
<!-- DOC_TODO: HARNESS_WORKFLOW_REVIEW — review the implemented revision and commit workflow with the team before marking this contract ready. -->

## Authority and purpose

The architectural record is the Markdown in `srcs/md/`. Code implements that
record; changing implementation must not silently redefine requirements.
Developers and agents use the same version checks. No AI service, editor,
GSD installation, Node.js runtime, package installation, or Tatr executable is
needed to run this harness. Tatr still owns task records.

The harness enforces recorded file identity, explicit contract references,
monotonic revision history, and documentation consistency. It cannot infer
whether prose describes code correctly, establish human approval, or replace
behavioral tests. Review the staged diff and relevant tests before recording it.
`status=review` and `status=draft` remain visible; matching their revision is
not a claim that the team has approved their content.

## Three independent versions

1. **File revision:** starts at 1 and increases when a file's content, Git mode,
   or detected rename changes. An implementation fix can retain its contract.
2. **Contract revision:** `DOC_META version=N` in each `srcs/md/*.md` contract.
   Editing a contract requires a higher revision. Even an editorial contract
   edit is recorded conservatively; it does not imply a protocol change.
3. **Protocol version:** fields such as `challengeVersion`, `inputVersion`, and
   `outputVersion`. These change only according to the relevant API contract.
   Document revisions must never be equated with a wire-format version.

## File coverage and registry

[`file-versions.tsv`](file-versions.tsv) has one tab-separated row per covered
file, with four columns:

```text
path<TAB>revision<TAB>Git-blob-object-ID<TAB>contract.md@version[,other.md@version]
```

Use repository-relative paths. Spaces are supported; tabs and newlines in
paths are rejected. Contract paths cannot contain `@` or `,` because those
characters delimit references. Versions are positive decimal integers of at
most nine digits. Contract documents use `-` in the references column: they
are the authority, not consumers of themselves. Every other covered file
must declare at least one existing `srcs/md/` Markdown contract.

All tracked files are covered except:

- `tasks/`: Tatr records and its metadata have their own workflow;
- `.scratch/`: disposable discussion, drafts, and experiments;
- `.gitkeep`: directory placeholders;
- the registry itself, whose changes and history are checked and retained by
  Git, without an impossible self-referential content hash.

This includes source, tests, lockfiles, configuration, documentation, and the
harness tools. New paths are rejected until explicitly mapped. Covered files
must be regular files; symbolic links and submodules are not supported by this
version of the harness. Existing files enter the registry at revision 1; this
is a baseline inventory, not a certification of previously implemented behavior.

Hashes are Git blob IDs of the bytes being committed. Git's normal line-ending
normalization therefore does not create different identities on Windows and
Unix. Renames recognized by Git retain the previous file's revision lineage
and increment it. A rewrite Git cannot recognize as a rename is a deletion
and a new file starting at 1. Deletions remove the current row; prior rows and
content remain in Git history.

## Commit workflow

1. Read the contracts and review the intended change.
2. Change the implementation. If a contract changes, edit it and increment its
   `DOC_META` revision too. Update affected `DOC_SYNC` documents.
3. Stage the reviewed files with `git add`.
4. For new covered files, add a mapping to the working registry. A temporary
   `0` revision and `-` hash are allowed only as input to `--record`:

   ```text
   srcs/core/example.ts<TAB>0<TAB>-<TAB>srcs/md/game-engine-api.md@2
   ```

5. Run `bash dev-tools/doc-check.sh --record`. It reads the staged blobs,
   advances changed file revisions, refreshes the versions of explicitly
   declared contract references, and removes deleted rows. It never invents
   mappings, edits contracts, stages files, or commits. Review its registry
   diff; a reference refresh records your review, not automatic proof.
6. Run `git add srcs/md/file-versions.tsv`.
7. Run `bash dev-tools/doc-check.sh --staged`, the appropriate behavior tests,
   and `git diff --cached`. Commit after human review.

Recording is idempotent relative to HEAD: recording the same staged tree twice
does not increment revisions twice. A contract bump invalidates every consumer
reference, including unchanged files. Refreshing those references leaves an
unchanged file's own revision intact.

The pre-commit hook reads the actual index Git supplies, including the temporary
index for `git commit --only`. Unstaged documents or registry changes cannot
satisfy a staged commit. It also executes the staged checker and its staged
helpers, so unstaged edits to verification code cannot weaken that commit's
check. The checker does not stash, reset, change the index,
or repair anything in hook mode. Amendments and commits that span branches are
checked against their current HEAD by default; refresh the registry after
resolving a rebase or merge. Unresolved index conflicts fail the check.

## Clone and activation

Prerequisites: Git, Bash 3.2 or newer, and standard shell utilities (`awk`,
`sed`, `sort`, `head`, `cp`, `mkdir`, `rm`, `chmod`, and `mktemp`). Git for Windows
provides these in Git Bash; Linux and macOS can use their shell tools.

Immediately after cloning, the checker works directly:

```console
bash dev-tools/doc-check.sh
bash dev-tools/install-hooks.sh
bash dev-tools/install-hooks.sh --check
```

Git deliberately does not activate a repository's hooks on clone. The one-time
installer sets **only this repository's** `core.hooksPath` to `.githooks`.
It is idempotent and refuses to replace an existing custom hook configuration
or pre-commit hook silently. Contributors with custom hooks must deliberately
chain the checker into their existing workflow or select this repository's hook.
No clone command can make local Git hooks unavoidable: `--no-verify`, local
configuration, or changing the checker can bypass them. Use the same checks in
required server-side checks when enforcing acceptance across contributors.

## Verification and history

```console
bash dev-tools/doc-check.sh --todos
bash dev-tools/doc-check.sh --staged
bash dev-tools/test-harness.sh
git log --follow -p -- srcs/core/game-engine/index.ts
git log -p -- srcs/md/file-versions.tsv
git log --follow -p -- srcs/md/game-engine-api.md
```

Git is the version history: commits retain each file, registry row, contract
revision, deletion, author, and reason together. Do not maintain a second
append-only changelog that can diverge from these snapshots.

`--base REV` selects an explicit previous tree for validation. In CI, check
each introduced commit against its parent using a checkout/index of that
commit; for the initial commit the checker uses the empty tree automatically.
Do not substitute a clean working-tree status for the committed diff.

Checks reject missing/duplicate mappings, stale hashes, non-increasing changed
file revisions, changed contracts without revision bumps, missing or stale
contract references, broken local links, malformed/unknown documentation
markers, unresolved TODOs in ready documents, and inconsistent HUMAN_CHECK
registration. The documented game challenge schema version is also compared
with the engine's declared schema version, independently of DOC_META.

The integration suite uses temporary repositories and real commits to exercise
the hook, partial staging, renames, deletions, version changes, and installation.
