#!/usr/bin/env bash
# Integration tests run only inside disposable repositories, never this index.
set -euo pipefail
source_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_PREFIX GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES
export GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null
temp_parent=$(cd "${TMPDIR:-/tmp}" && pwd -P)
temp=$(mktemp -d "$temp_parent/transcendence-harness-tests.XXXXXX")
cleanup() { case "$temp" in "$temp_parent"/transcendence-harness-tests.*) rm -rf -- "$temp" ;; esac; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
registry=srcs/md/file-versions.tsv
mkdir -p "$temp/baseline/dev-tools" "$temp/baseline/.githooks" "$temp/baseline/srcs/md" "$temp/baseline/srcs/core"
cp "$source_root"/dev-tools/doc-check.sh "$source_root"/dev-tools/doc-lint.awk "$source_root"/dev-tools/contract-check.awk "$source_root"/dev-tools/install-hooks.sh "$temp/baseline/dev-tools/"
cp "$source_root/.githooks/pre-commit" "$temp/baseline/.githooks/"
commit() { git -c user.name='Harness test' -c user.email='harness@example.invalid' commit -qm "$1"; }
check() { bash dev-tools/doc-check.sh --staged > result.log 2>&1; }
record() { bash dev-tools/doc-check.sh --record > result.log 2>&1; git add "$registry"; }
reject() {
  if check; then cat result.log; printf 'Expected failure: %s\n' "$1"; return 1; fi
  grep -F "$1" result.log >/dev/null || { cat result.log; return 1; }
}
map_file() { printf '%s\t0\t-\tsrcs/md/contract.md@1\n' "$1" >> "$registry"; }
change_source() { printf 'export const value = 2;\n' > srcs/core/example.ts; git add srcs/core/example.ts; }
bump_contract() { printf '# Contract\n\n<!-- DOC_META: status=ready version=2 -->\n\nReviewed requirements, revision two.\n' > srcs/md/contract.md; git add srcs/md/contract.md; }
(
  cd "$temp/baseline"
  git init -q
  git config core.autocrlf false
  printf '# Contract\n\n<!-- DOC_META: status=ready version=1 -->\n\nAccepted requirements.\n' > srcs/md/contract.md
  printf 'export const value = 1;\n' > srcs/core/example.ts
  printf '*.sh text eol=lf\n.githooks/* text eol=lf\n' > .gitattributes
  printf '*.log\n' > .gitignore
  git add .
  git update-index --chmod=+x .githooks/pre-commit
  printf '# path\trevision\tblob\tcontracts\n' > "$registry"
  while IFS= read -r -d '' file; do
    if [ "$file" = srcs/md/contract.md ]; then printf '%s\t0\t-\t-\n' "$file" >> "$registry"; else map_file "$file"; fi
  done < <(git ls-files -z)
  git add "$registry"
  record
  check
  commit baseline
  bash dev-tools/install-hooks.sh >/dev/null
)
count=0
run() {
  count=$((count+1)); case_dir="$temp/case $count"
  cp -R "$temp/baseline" "$case_dir"
  # Keep this outside an if-condition: Bash disables errexit inside functions
  # invoked as conditions, which would hide failed assertions within a case.
  (cd "$case_dir"; "$2")
  printf 'PASS %02d %s\n' "$count" "$1"
}
unchanged() { check; bash dev-tools/install-hooks.sh --check >/dev/null; }
stale_blob() { change_source; reject CONTENT_DRIFT; }
recorded_change() { change_source; record; check; commit recorded; check; }
idempotent_record() { change_source; record; cp "$registry" before.tsv; bash dev-tools/doc-check.sh --record >/dev/null; cmp before.tsv "$registry"; }
unstaged_registry() { change_source; bash dev-tools/doc-check.sh --record >/dev/null; reject CONTENT_DRIFT; }
unstaged_source() { printf 'unstaged and different\n' > srcs/core/example.ts; check; }
unstaged_contract() { change_source; record; printf 'broken untracked contract edit\n' > srcs/md/contract.md; check; }
contract_no_bump() { printf '\nNew requirement.\n' >> srcs/md/contract.md; git add srcs/md/contract.md; reject CONTRACT_VERSION; }
contract_stale_refs() { bump_contract; reject STALE_CONTRACT; }
contract_refresh() { bump_contract; record; check; awk -F '\t' '$1=="srcs/core/example.ts" {if($2!=1 || $4!="srcs/md/contract.md@2") exit 1}' "$registry"; }
new_file() { printf 'new\n' > 'srcs/core/new file.ts'; git add 'srcs/core/new file.ts'; reject UNMAPPED_FILE; map_file 'srcs/core/new file.ts'; record; check; }
renamed_file() { git mv srcs/core/example.ts 'srcs/core/renamed file.ts'; sed 's|srcs/core/example.ts|srcs/core/renamed file.ts|' "$registry" > changed.tsv; cp changed.tsv "$registry"; record; check; awk -F '\t' '$1=="srcs/core/renamed file.ts" {if($2!=2) exit 1}' "$registry"; }
deleted_file() { git rm -q srcs/core/example.ts; reject ORPHAN_MAPPING; record; check; }
deleted_contract() { git rm -q srcs/md/contract.md; reject CONTRACT_REFERENCE; }
hook_blocks() { change_source; before=$(git rev-parse HEAD); if commit blocked > result.log 2>&1; then return 1; fi; [ "$before" = "$(git rev-parse HEAD)" ]; grep -F CONTENT_DRIFT result.log >/dev/null; }
partial_commit() { change_source; record; if git -c user.name=Test -c user.email=test@example.invalid commit -qm partial --only srcs/core/example.ts > result.log 2>&1; then return 1; fi; grep -F CONTENT_DRIFT result.log >/dev/null; }
alternate_index() { index=$(git rev-parse --git-path index); cp "$index" alternate-index; GIT_INDEX_FILE="$PWD/alternate-index" check; }
missing_mapping() { sed '/^srcs\/core\/example.ts\t/d' "$registry" > changed.tsv; cp changed.tsv "$registry"; git add "$registry"; reject UNMAPPED_FILE; }
duplicate_mapping() { grep '^srcs/core/example.ts' "$registry" >> duplicate.tsv; cat duplicate.tsv >> "$registry"; git add "$registry"; reject DUPLICATE_MAPPING; }
invalid_version() { awk 'BEGIN{FS=OFS="\t"} $1=="srcs/core/example.ts"{$2=0} {print}' "$registry" > changed.tsv; cp changed.tsv "$registry"; git add "$registry"; reject FILE_VERSION; }
missing_staged_doc() { printf '# New\n\n<!-- DOC_META: status=ready version=1 -->\n' > srcs/md/new.md; printf '\n[New](new.md)\n' >> srcs/md/contract.md; sed 's/version=1/version=2/' srcs/md/contract.md > changed.tsv; cp changed.tsv srcs/md/contract.md; git add srcs/md/contract.md; reject BROKEN_LINK; }
ready_with_todo() { bump_contract; printf '\n<!-- DOC_TODO: OPEN_DECISION — settle before acceptance. -->\n' >> srcs/md/contract.md; git add srcs/md/contract.md; reject READY_HAS_TODO; }
setup_idempotent() { bash dev-tools/install-hooks.sh >/dev/null; bash dev-tools/install-hooks.sh >/dev/null; [ "$(git config --get core.hooksPath)" = .githooks ]; }
setup_preserves_custom() { git config core.hooksPath custom-hooks; if bash dev-tools/install-hooks.sh > result.log 2>&1; then return 1; fi; [ "$(git config --get core.hooksPath)" = custom-hooks ]; }
from_subdirectory() { cd srcs/core; bash ../../dev-tools/doc-check.sh --staged > result.log 2>&1; }
old_revision_new_hash() { change_source; record; awk 'BEGIN{FS=OFS="\t"} $1=="srcs/core/example.ts"{$2=1} {print}' "$registry" > changed.tsv; cp changed.tsv "$registry"; git add "$registry"; reject FILE_VERSION; }
preserves_index() { change_source; record; before=$(git write-tree); check; [ "$before" = "$(git write-tree)" ]; }
initial_index() { git symbolic-ref HEAD refs/heads/new-root; record; check; }
crlf_content() { printf 'export const value = 2;\r\n' > srcs/core/example.ts; git add srcs/core/example.ts; record; check; }
schema_independence() {
  printf '# Engine\n\n<!-- DOC_META: status=ready version=7 -->\n\n```ts\ntype Challenge = { challengeVersion: 2 };\n```\n' > srcs/md/game-engine-api.md
  mkdir -p srcs/core/game-engine
  printf 'export type Challenge = { challengeVersion: 2 };\n' > srcs/core/game-engine/index.ts
  printf 'srcs/md/game-engine-api.md\t0\t-\t-\n' >> "$registry"
  printf 'srcs/core/game-engine/index.ts\t0\t-\tsrcs/md/game-engine-api.md@7\n' >> "$registry"
  git add srcs/md/game-engine-api.md srcs/core/game-engine/index.ts
  record; check
  printf 'export type Challenge = { challengeVersion: 3 };\n' > srcs/core/game-engine/index.ts
  git add srcs/core/game-engine/index.ts; reject SCHEMA_DRIFT
}
fresh_clone() {
  git clone -q --no-local "$temp/baseline" "$temp/fresh clone"
  cd "$temp/fresh clone"
  bash dev-tools/doc-check.sh > result.log 2>&1
  if bash dev-tools/install-hooks.sh --check > result.log 2>&1; then return 1; fi
  bash dev-tools/install-hooks.sh >/dev/null
  bash dev-tools/install-hooks.sh --check >/dev/null
  hook_blocks
}
unstaged_checker() {
  change_source
  printf '#!/usr/bin/env bash\nexit 0\n' > dev-tools/doc-check.sh
  if commit blocked > result.log 2>&1; then return 1; fi
  grep -F CONTENT_DRIFT result.log >/dev/null
}
unknown_marker() { bump_contract; printf '\n<!-- WRONG_MARKER: reject this. -->\n' >> srcs/md/contract.md; git add srcs/md/contract.md; reject UNKNOWN_MARKER; }
human_registry() { bump_contract; printf '\n<!-- HUMAN_CHECK: MISSING_OWNER — review before release. -->\n' >> srcs/md/contract.md; git add srcs/md/contract.md; reject UNTRACKED_HUMAN_CHECK; }
duplicate_meta() { bump_contract; printf '\n<!-- DOC_META: status=ready version=3 -->\n' >> srcs/md/contract.md; git add srcs/md/contract.md; reject MALFORMED_MARKER; }
fenced_examples() { bump_contract; printf '\n```markdown\n<!-- DOC_META: status=ready version=99 -->\n<!-- UNKNOWN_MARKER: just an example. -->\n```\n' >> srcs/md/contract.md; git add srcs/md/contract.md; record; check; }
missing_contract_meta() { printf '# Contract with missing metadata\n' > srcs/md/contract.md; git add srcs/md/contract.md; reject MISSING_DOC_META; }
run 'unchanged repository and active hook' unchanged
run 'unrecorded source edit is rejected' stale_blob
run 'recorded implementation change commits' recorded_change
run 'recording the same index is idempotent' idempotent_record
run 'unstaged registry cannot satisfy the hook' unstaged_registry
run 'unstaged source does not contaminate checks' unstaged_source
run 'unstaged contract does not contaminate checks' unstaged_contract
run 'changed contract requires a revision bump' contract_no_bump
run 'contract change invalidates consumer references' contract_stale_refs
run 'contract refresh preserves unchanged file revisions' contract_refresh
run 'new file with spaces requires explicit mapping' new_file
run 'rename retains version lineage' renamed_file
run 'deletion removes stale mapping' deleted_file
run 'referenced contract cannot disappear' deleted_contract
run 'real pre-commit blocks an invalid commit' hook_blocks
run 'git commit --only uses its temporary index' partial_commit
run 'alternate Git index is honored' alternate_index
run 'removing coverage is rejected' missing_mapping
run 'duplicate registry entry is rejected' duplicate_mapping
run 'invalid file version is rejected' invalid_version
run 'unstaged new document cannot repair a staged link' missing_staged_doc
run 'ready document cannot retain open decisions' ready_with_todo
run 'hook installation is idempotent' setup_idempotent
run 'existing hook configuration is preserved' setup_preserves_custom
run 'checker works from a subdirectory' from_subdirectory
run 'fresh content hash alone cannot bypass revision increment' old_revision_new_hash
run 'validation leaves the index unchanged' preserves_index
run 'first commit supports an unborn HEAD' initial_index
run 'CRLF source blobs retain their exact staged identity' crlf_content
run 'document revision is independent of wire schema version' schema_independence
run 'fresh clone runs checks and enables commit hook with one command' fresh_clone
run 'unstaged checker edits cannot weaken the installed hook' unstaged_checker
run 'unknown documentation markers are rejected' unknown_marker
run 'human verification markers require registry entries' human_registry
run 'duplicate document metadata is rejected' duplicate_meta
run 'fenced metadata examples do not change the contract version' fenced_examples
run 'contracts cannot lose their document metadata' missing_contract_meta
printf 'PASS: %s harness integration scenarios.\n' "$count"
