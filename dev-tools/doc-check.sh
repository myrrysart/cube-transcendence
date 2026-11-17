#!/usr/bin/env bash
# Standalone contract gate: Bash 3.2+, Git, awk and standard shell utilities.
set -euo pipefail
export LC_ALL=C

usage() {
  printf '%s\n' 'Usage: bash dev-tools/doc-check.sh [--staged | --record] [--base REV] [--todos]'
  printf '%s\n' '  --staged  Validate the exact commit index (including partial commits).'
  printf '%s\n' '  --record  Record reviewed staged blobs/revisions in the working registry; never stage files.'
  printf '%s\n' '  --base    Compare history against REV instead of HEAD (also usable in CI).'
}
mode=working
base=HEAD
show_todos=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --staged|--record)
      [ "$mode" = working ] || { usage >&2; exit 2; }
      mode=${1#--} ;;
    --base)
      [ "$#" -ge 2 ] || { usage >&2; exit 2; }
      base=$2; shift ;;
    --todos) show_todos=1 ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
  shift
done
tool_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(git rev-parse --show-toplevel) || exit 2
cd "$repo"
registry=srcs/md/file-versions.tsv
temp_parent=$(cd "${TMPDIR:-/tmp}" && pwd -P)
temp=$(mktemp -d "$temp_parent/transcendence-doc-check.XXXXXX")
cleanup() {
  case "$temp" in "$temp_parent"/transcendence-doc-check.*) rm -rf -- "$temp" ;; esac
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir "$temp/tree"
: > "$temp/data"
: > "$temp/docs"
: > "$temp/links"
if base_tree=$(git rev-parse --verify "${base}^{tree}" 2>/dev/null); then
  :
elif [ "$base" = HEAD ] && ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  base_tree=$(git hash-object -w -t tree --stdin < /dev/null)
else
  printf 'ERROR [BASE] Cannot resolve %s\n' "$base" >&2; exit 2
fi

safe_path() {
  case "$1" in
    *$'\t'*|*$'\n'*|*$'\r'*) printf 'ERROR [PATH] Tabs/newlines are unsupported in repository paths.\n' >&2; exit 1 ;;
  esac
}
governed() {
  case "$1" in
    .scratch/*|tasks/*|.gitkeep|*/.gitkeep|"$registry") return 1 ;;
    *) return 0 ;;
  esac
}
document() {
  case "$1" in tasks/*|.scratch/tmp/*|*/node_modules/*) return 1 ;; *.md) return 0 ;; *) return 1 ;; esac
}
contract_meta() {
  awk -v tag="$1" -v file="$2" '
    { sub(/\r$/, "") }
    /^[ ]*```/ || /^[ ]*~~~/ {
      token=$0; sub(/^[ ]*/,"",token); token=substr(token,1,3)
      if (!fence) fence=token; else if (fence==token) fence=""
      next
    }
    !fence && /^<!--[ ]*DOC_META: status=(draft|review|ready) version=[1-9][0-9]* -->$/ {
      status=$3; sub(/^status=/,"",status); version=$4; sub(/^version=/,"",version)
      print tag "\t" file "\t" version "\t" status
    }' "$3" >> "$temp/data"
}

# Snapshot raw Git blobs, without checkout filters, working-tree edits or symlinks.
git ls-tree -r -z "$base_tree" > "$temp/base-files"
while IFS= read -r -d '' entry; do
  path=${entry#*$'\t'}; safe_path "$path"
  info=${entry%%$'\t'*}; file_mode=${info%% *}; oid=${info##* }
  governed "$path" || continue
  printf 'B\t%s\t%s\t%s\n' "$path" "$oid" "$file_mode" >> "$temp/data"
  case "$path" in srcs/md/*.md)
    git cat-file blob "$oid" > "$temp/old-doc"
    contract_meta E "$path" "$temp/old-doc" ;;
  esac
done < "$temp/base-files"
if git cat-file -e "$base_tree:$registry" 2>/dev/null; then
  git cat-file blob "$base_tree:$registry" > "$temp/old-registry"
  awk 'BEGIN {FS=OFS="\t"} {sub(/\r$/, "")} !/^#/ && NF {print "P",$0}' "$temp/old-registry" >> "$temp/data"
fi

if [ "$mode" != working ]; then
  tree=$(git write-tree) || { printf 'ERROR [INDEX] Resolve index conflicts first.\n' >&2; exit 1; }
  git ls-tree -r -z "$tree" > "$temp/files"
  while IFS= read -r -d '' entry; do
    path=${entry#*$'\t'}; safe_path "$path"
    info=${entry%%$'\t'*}; file_mode=${info%% *}; oid=${info##* }
    if governed "$path"; then
      case "$file_mode" in 100644|100755) ;; *) printf 'ERROR [FILE_TYPE] %s must be a regular file.\n' "$path" >&2; exit 1 ;; esac
      printf 'A\t%s\t%s\t%s\n' "$path" "$oid" "$file_mode" >> "$temp/data"
    fi
    case "$file_mode" in 100644|100755)
      mkdir -p "$temp/tree/$(dirname -- "$path")"
      git cat-file blob "$oid" > "$temp/tree/$path"
      ;;
    esac
    if document "$path"; then printf '%s\n' "$path" >> "$temp/docs"; fi
  done < "$temp/files"
  scan_root=$temp/tree
  git diff --name-status -z --find-renames "$base_tree" "$tree" > "$temp/changes"
else
  scan_root=$repo
  git ls-files --cached --others --exclude-standard -z > "$temp/files"
  while IFS= read -r -d '' path; do
    safe_path "$path"
    [ -e "$path" ] || continue
    if governed "$path"; then
      [ -f "$path" ] && [ ! -L "$path" ] || { printf 'ERROR [FILE_TYPE] %s must be a regular file.\n' "$path" >&2; exit 1; }
      oid=$(git hash-object --path="$path" -- "$path")
      info=$(git ls-files -s -- "$path"); file_mode=${info%% *}
      [ -n "$file_mode" ] || file_mode=100644
      printf 'A\t%s\t%s\t%s\n' "$path" "$oid" "$file_mode" >> "$temp/data"
    fi
    if document "$path"; then printf '%s\n' "$path" >> "$temp/docs"; fi
  done < "$temp/files"
  git diff --name-status -z --find-renames "$base_tree" > "$temp/changes"
fi
# Git's rename detection carries the previous revision to the destination.
while IFS= read -r -d '' status; do
  IFS= read -r -d '' path
  case "$status" in R*)
    IFS= read -r -d '' destination
    printf 'R\t%s\t%s\n' "$destination" "$path" >> "$temp/data" ;;
  esac
done < "$temp/changes"

sort -u "$temp/docs" -o "$temp/docs"
while IFS= read -r path; do
  case "$path" in srcs/md/*.md) contract_meta D "$path" "$scan_root/$path" ;; esac
done < "$temp/docs"
if [ "$mode" = record ]; then manifest=$repo/$registry; else manifest=$scan_root/$registry; fi
[ -f "$manifest" ] || { printf 'ERROR [REGISTRY] Missing %s.\n' "$registry" >&2; exit 1; }
awk 'BEGIN {FS=OFS="\t"} {sub(/\r$/, "")} !/^#/ && NF {print "C",$0}' "$manifest" >> "$temp/data"

errors=0
# The validator code is repository-owned; staged mode uses its staged helpers.
helpers=$tool_dir
if [ "$mode" = staged ]; then helpers=$scan_root/dev-tools; fi
if ! (cd "$scan_root"; awk -v list="$temp/docs" -v links="$temp/links" -v todos="$show_todos" -f "$helpers/doc-lint.awk"); then errors=1; fi
while IFS=$'\t' read -r path line target; do
  case "$target" in http://*|https://*|mailto:*|file://*|conversation://*|'#'*) continue ;; esac
  target=${target%%#*}; [ -n "$target" ] || continue
  resolved=$(dirname -- "$path")/$target
  case "$path:$target" in .scratch/*:*) tier=scratch ;; *) tier=durable ;; esac
  if [ "$tier" = durable ] && [[ "$resolved" = *'.scratch/'* ]]; then
    printf 'ERROR %s:%s [TIER_VIOLATION] Durable document links to scratch.\n' "$path" "$line"; errors=1
  elif [ ! -e "$scan_root/$resolved" ]; then
    if [ "$tier" = scratch ]; then printf 'WARN %s:%s [BROKEN_LINK] %s\n' "$path" "$line" "$target"
    else printf 'ERROR %s:%s [BROKEN_LINK] %s\n' "$path" "$line" "$target"; errors=1; fi
  fi
done < "$temp/links"

# Wire-format versions are distinct from document revisions.
engine=srcs/core/game-engine/index.ts
engine_doc=srcs/md/game-engine-api.md
if [ -f "$scan_root/$engine" ] && [ -f "$scan_root/$engine_doc" ]; then
  schema_field='match($0,/challengeVersion:[[:space:]]*[0-9]+/) {v=substr($0,RSTART,RLENGTH); sub(/.*:[[:space:]]*/,"",v); print v; exit}'
  code_version=$(awk "$schema_field" "$scan_root/$engine")
  schema_version=$(awk "$schema_field" "$scan_root/$engine_doc")
  if [ -z "$code_version" ] || [ -z "$schema_version" ] || [ "$code_version" != "$schema_version" ]; then
    printf 'ERROR [SCHEMA_DRIFT] Documented and implemented challengeVersion differ or are absent.\n'; errors=1
  fi
fi
if ! awk -v operation="$mode" -v output="$temp/recorded" -f "$helpers/contract-check.awk" "$temp/data"; then errors=1; fi
if [ "$errors" -ne 0 ]; then printf 'FAIL: contract/document checks failed.\n'; exit 1; fi
if [ "$mode" = record ]; then
  { printf '# path\trevision\tblob\tcontracts\n'; sort "$temp/recorded"; } > "$temp/new-registry"
  cp "$temp/new-registry" "$registry"
  printf 'Recorded reviewed staged files in %s. Review and stage this file explicitly.\n' "$registry"
fi
printf 'PASS: documentation and file-contract versions (%s).\n' "$mode"
