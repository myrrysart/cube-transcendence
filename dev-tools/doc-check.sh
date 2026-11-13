#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# dev-tools/doc-check.sh — Documentation Linter, Readiness & Version Sync Tool
# ==============================================================================
#
# HOW THIS TOOL WORKS:
# 1. File Discovery: Automatically finds all Markdown files in the repository
#    (excluding `tasks/` HUID records managed by `tatr` and `.scratch/tmp/` logs).
#    - Durable tier: `README.md`, `AGENTS.md`, `srcs/**/*.md`, `docs/**/*.md`,
#      `dev-tools/**/*.md`, `setup/**/*.md`.
#    - Scratch tier: `.scratch/plan/**/*.md` (disposable planning material).
# 2. Link & Tier Boundary Check: Verifies Markdown links resolve on disk and
#    ensures durable docs never link into `.scratch/`.
# 3. Automatic Marker Catching: Scans every `<!-- UPPERCASE_NAME: ... -->`
#    comment outside fenced code blocks and inline backticks. Any marker name
#    not listed in `KNOWN_MARKERS` below fails immediately with [UNKNOWN_MARKER]
#    so typos are caught and new team markers must be registered in the table.
# 4. Readiness & Version Sync: Reads `DOC_META` from each durable doc, enforces
#    that `status=ready` docs have 0 open `DOC_TODO` markers, and cross-checks
#    contract versions between `srcs/md/game-engine-api.md` and
#    `srcs/core/game-engine/index.ts`.
#
# ==============================================================================
# MARKER REGISTRY TABLE
# ==============================================================================
# ┌───────────────┬────────────────────────────────────────────────────────────┐
# │ Marker        │ Syntax & Enforcement Rule                                  │
# ├───────────────┼────────────────────────────────────────────────────────────┤
# │ DOC_META      │ <!-- DOC_META: status=<draft|review|ready> version=<N> --> │
# │               │ Required once per durable doc (except AGENTS.md).          │
# │               │ Declares readiness and integer version.                    │
# │               │ Rule: `status=ready` forbids any `DOC_TODO` in that file.  │
# ├───────────────┼────────────────────────────────────────────────────────────┤
# │ DOC_SYNC      │ <!-- DOC_SYNC: <review trigger description>. -->           │
# │               │ Marks durable docs that must be reviewed when architecture,│
# │               │ gameplay, protocols, stack, or directory ownership change. │
# ├───────────────┼────────────────────────────────────────────────────────────┤
# │ DOC_TODO      │ <!-- DOC_TODO: <ID> — <unresolved item & resolution>. -->  │
# │               │ Marks an unresolved decision or detail.                    │
# │               │ Rule: `<ID>` must be globally unique across all docs;      │
# │               │ forbidden inside `status=ready` documents.                 │
# ├───────────────┼────────────────────────────────────────────────────────────┤
# │ HUMAN_CHECK   │ <!-- HUMAN_CHECK: <ID> — <verification required>. -->      │
# │               │ Marks text a human must verify or replace before release.  │
# │               │ Rule: `<ID>` must be registered in `docs/human-checks.md`. │
# └───────────────┴────────────────────────────────────────────────────────────┘
#
# Detailed marker reference (to add a new marker, document it here, add its name
# to KNOWN_MARKERS below, and add its validation branch in check_markers_in_file):

# Marker 1: DOC_META
#   Purpose: Communicates document readiness (`draft`, `review`, `ready`) and
#            integer contract/revision version (`version=1`, `version=2`, ...).
#   Syntax:  <!-- DOC_META: status=<draft|review|ready> version=<positive-int> -->

# Marker 2: DOC_SYNC
#   Purpose: Guards architectural documents against silent code/scope drift.
#   Syntax:  <!-- DOC_SYNC: <sentence ending with period>. -->

# Marker 3: DOC_TODO
#   Purpose: Tracks a specific open decision and the condition to resolve it.
#   Syntax:  <!-- DOC_TODO: <UPPER_SNAKE_ID> — <description ending with period>. -->

# Marker 4: HUMAN_CHECK
#   Purpose: Tracks placeholders or claims requiring human sign-off in `docs/human-checks.md`.
#   Syntax:  <!-- HUMAN_CHECK: <UPPER_SNAKE_ID> — <description ending with period>. -->

KNOWN_MARKERS=("DOC_META" "DOC_SYNC" "DOC_TODO" "HUMAN_CHECK")

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

SHOW_TODOS=0
if [[ "${1:-}" == "--todos" ]]; then
  SHOW_TODOS=1
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--todos]" >&2
  exit 2
fi

ERRORS=0
WARNINGS=0

err() {
  printf "ERROR %s\n" "$1"
  ERRORS=$((ERRORS + 1))
}

warn() {
  printf "WARN  %s\n" "$1"
  WARNINGS=$((WARNINGS + 1))
}

is_known_marker() {
  local needle="$1"
  local m
  for m in "${KNOWN_MARKERS[@]}"; do
    [[ "$m" == "$needle" ]] && return 0
  done
  return 1
}

# Discover Markdown files automatically (tracked + untracked in doc/source dirs)
DURABLE_DOCS=()
SCRATCH_DOCS=()

while IFS= read -r f; do
  [[ -z "$f" || ! -f "$f" ]] && continue
  case "$f" in
    tasks/*|.scratch/tmp/*|*/node_modules/*|node_modules/*)
      continue
      ;;
    .scratch/plan/*.md|.scratch/plan/**/*.md)
      SCRATCH_DOCS+=("$f")
      ;;
    *)
      DURABLE_DOCS+=("$f")
      ;;
  esac
done < <(
  {
    git ls-files '*.md'
    find srcs docs dev-tools setup .scratch/plan -name '*.md' 2>/dev/null || true
  } | sed 's|^\./||' | sort -u
)

ALL_DOCS=("${DURABLE_DOCS[@]}" "${SCRATCH_DOCS[@]}")

find_moved_hint() {
  local base="$1"
  local found=()
  local candidate
  for candidate in "${ALL_DOCS[@]}"; do
    if [[ "$(basename "$candidate")" == "$base" ]]; then
      found+=("$candidate")
    fi
  done
  if [[ "${#found[@]}" -gt 0 ]]; then
    printf " (found in %s)" "${found[*]}"
  fi
}

# 1 & 2. Check Markdown links & Tier boundaries (ignoring fenced code blocks)
check_links_in_file() {
  local file="$1"
  local tier="$2"
  local dir
  dir="$(dirname "$file")"

  while IFS=$'\t' read -r lineno target; do
    [[ -z "$target" ]] && continue

    case "$target" in
      http://*|https://*|mailto:*|file://*|conversation://*|'#'*)
        continue
        ;;
    esac

    local clean_target="${target%%#*}"
    [[ -z "$clean_target" ]] && continue

    local resolved="$clean_target"
    if [[ "$dir" != "." ]]; then
      resolved="$dir/$clean_target"
    fi
    resolved="${resolved#./}"

    if [[ "$tier" == "durable" ]] && [[ "$resolved" == .scratch/* || "$clean_target" == *.scratch/* ]]; then
      err "$file:$lineno: [TIER_VIOLATION] durable doc must not link to .scratch/ ('$clean_target')"
      continue
    fi

    if [[ ! -e "$resolved" ]]; then
      local hint=""
      if [[ "$dir" != "." && -e "$clean_target" ]]; then
        hint=" (exists at repo root '$clean_target'; use path relative to '$dir/')"
      else
        hint="$(find_moved_hint "$(basename "$clean_target")")"
      fi

      if [[ "$tier" == "durable" ]]; then
        err "$file:$lineno: [BROKEN_LINK] target '$clean_target' does not exist$hint"
      else
        warn "$file:$lineno: [BROKEN_LINK] scratch link target '$clean_target' does not exist$hint"
      fi
    fi
  done < <(
    awk '
      /^```/ { in_code = !in_code; next }
      !in_code {
        line = $0
        while (match(line, /\[[^]]+\]\([^)]+\)/)) {
          token = substr(line, RSTART, RLENGTH)
          sub(/^\[[^]]+\]\(/, "", token)
          sub(/\)$/, "", token)
          printf "%d\t%s\n", NR, token
          line = substr(line, RSTART + RLENGTH)
        }
      }
    ' "$file"
  )
}

for f in "${DURABLE_DOCS[@]}"; do
  check_links_in_file "$f" "durable"
done

for f in "${SCRATCH_DOCS[@]}"; do
  check_links_in_file "$f" "scratch"
done

# 3. Check Markers, Unknown Markers, Readiness & Version Sync
declare -A SEEN_TODO_IDS=()
declare -A SEEN_HUMAN_IDS=()
declare -A FILE_STATUS=()
declare -A FILE_VERSION=()
declare -A FILE_META_COUNT=()
declare -A FILE_TODO_COUNT=()
declare -A FILE_HUMAN_COUNT=()

DURABLE_TODO_COUNT=0
SCRATCH_TODO_COUNT=0
DOC_SYNC_FILES=()
TODO_REPORT_LINES=()

check_markers_in_file() {
  local file="$1"
  local tier="$2"
  FILE_META_COUNT["$file"]=0
  FILE_TODO_COUNT["$file"]=0
  FILE_HUMAN_COUNT["$file"]=0

  while IFS=$'\t' read -r lineno marker_name line; do
    [[ -z "$marker_name" ]] && continue

    if ! is_known_marker "$marker_name"; then
      err "$file:$lineno: [UNKNOWN_MARKER] unknown marker '$marker_name' (register it in KNOWN_MARKERS at the top of dev-tools/doc-check.sh)"
      continue
    fi

    case "$marker_name" in
      DOC_META)
        if [[ "$line" =~ ^\<!--[[:space:]]*DOC_META:[[:space:]]*status=(draft|review|ready)[[:space:]]+version=([0-9]+)[[:space:]]*--\>$ ]]; then
          local status="${BASH_REMATCH[1]}"
          local version="${BASH_REMATCH[2]}"
          FILE_META_COUNT["$file"]=$(( ${FILE_META_COUNT["$file"]} + 1 ))
          if [[ "${FILE_META_COUNT["$file"]}" -gt 1 ]]; then
            err "$file:$lineno: [MALFORMED_MARKER] duplicate DOC_META in '$file' (only one allowed)"
          fi
          FILE_STATUS["$file"]="$status"
          FILE_VERSION["$file"]="$version"
        else
          err "$file:$lineno: [MALFORMED_MARKER] invalid DOC_META format (expected: <!-- DOC_META: status=<draft|review|ready> version=<N> -->)"
        fi
        ;;

      DOC_TODO)
        if [[ "$line" =~ ^\<!--[[:space:]]*DOC_TODO:[[:space:]]*([A-Z0-9_]+)[[:space:]]*—[[:space:]]*(.+)\.[[:space:]]*--\>$ ]]; then
          local id="${BASH_REMATCH[1]}"
          if [[ -n "${SEEN_TODO_IDS[$id]:-}" ]]; then
            err "$file:$lineno: [MALFORMED_MARKER] duplicate DOC_TODO ID '$id' (first seen at ${SEEN_TODO_IDS[$id]})"
          else
            SEEN_TODO_IDS["$id"]="$file:$lineno"
          fi
          FILE_TODO_COUNT["$file"]=$(( ${FILE_TODO_COUNT["$file"]} + 1 ))
          if [[ "$tier" == "durable" ]]; then
            DURABLE_TODO_COUNT=$((DURABLE_TODO_COUNT + 1))
          else
            SCRATCH_TODO_COUNT=$((SCRATCH_TODO_COUNT + 1))
          fi
          TODO_REPORT_LINES+=("  DOC_TODO    $file:$lineno: $id")
        else
          err "$file:$lineno: [MALFORMED_MARKER] invalid DOC_TODO format (expected: <!-- DOC_TODO: <ID> — <description>. -->)"
        fi
        ;;

      DOC_SYNC)
        if [[ "$line" =~ ^\<!--[[:space:]]*DOC_SYNC:[[:space:]]*(.+)\.[[:space:]]*--\>$ ]]; then
          [[ "$tier" == "durable" ]] && DOC_SYNC_FILES+=("$file")
        else
          err "$file:$lineno: [MALFORMED_MARKER] invalid DOC_SYNC format (expected: <!-- DOC_SYNC: <description>. -->)"
        fi
        ;;

      HUMAN_CHECK)
        if [[ "$line" =~ ^\<!--[[:space:]]*HUMAN_CHECK:[[:space:]]*([A-Z0-9_]+)[[:space:]]*—[[:space:]]*(.+)\.[[:space:]]*--\>$ ]]; then
          local hid="${BASH_REMATCH[1]}"
          SEEN_HUMAN_IDS["$hid"]="${SEEN_HUMAN_IDS[$hid]:-$file:$lineno}"
          FILE_HUMAN_COUNT["$file"]=$(( ${FILE_HUMAN_COUNT["$file"]} + 1 ))
          TODO_REPORT_LINES+=("  HUMAN_CHECK $file:$lineno: $hid")
        else
          err "$file:$lineno: [MALFORMED_MARKER] invalid HUMAN_CHECK format (expected: <!-- HUMAN_CHECK: <ID> — <description>. -->)"
        fi
        ;;
    esac
  done < <(
    awk '
      /^```/ { in_code = !in_code; next }
      !in_code {
        stripped = $0
        gsub(/`[^`]*`/, "", stripped)
        if (match(stripped, /<!--[[:space:]]*[A-Z0-9_]+:/)) {
          tag = substr(stripped, RSTART, RLENGTH)
          sub(/^<!--[[:space:]]*/, "", tag)
          sub(/:$/, "", tag)
          printf "%d\t%s\t%s\n", NR, tag, $0
        }
      }
    ' "$file"
  )

  # Enforce DOC_META presence & readiness invariants on durable docs (excluding AGENTS.md)
  if [[ "$tier" == "durable" && "$file" != "AGENTS.md" ]]; then
    if [[ "${FILE_META_COUNT["$file"]}" -eq 0 ]]; then
      err "$file:1: [MISSING_DOC_META] durable doc must declare <!-- DOC_META: status=<draft|review|ready> version=<N> -->"
    elif [[ "${FILE_STATUS["$file"]:-}" == "ready" && "${FILE_TODO_COUNT["$file"]}" -gt 0 ]]; then
      err "$file:1: [READY_HAS_TODO] doc has status=ready but contains ${FILE_TODO_COUNT["$file"]} unresolved DOC_TODO marker(s)"
    fi
  fi
}

for f in "${DURABLE_DOCS[@]}"; do
  check_markers_in_file "$f" "durable"
done

for f in "${SCRATCH_DOCS[@]}"; do
  check_markers_in_file "$f" "scratch"
done

# 4. Verify Code <-> Doc Contract Version Sync
ENGINE_FILE="srcs/core/game-engine/index.ts"
ENGINE_DOC="srcs/md/game-engine-api.md"
ENGINE_CODE_VERSION=""
ENGINE_SYNC_NOTE=""
if [[ -f "$ENGINE_FILE" && -f "$ENGINE_DOC" ]]; then
  ENGINE_CODE_VERSION="$(sed -n 's/.*challengeVersion:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$ENGINE_FILE" | head -n 1)"
  DOC_VER="${FILE_VERSION["$ENGINE_DOC"]:-}"
  if [[ -n "$ENGINE_CODE_VERSION" && -n "$DOC_VER" ]]; then
    if [[ "$ENGINE_CODE_VERSION" != "$DOC_VER" ]]; then
      err "$ENGINE_DOC:1: [VERSION_DRIFT] doc version=$DOC_VER does not match $ENGINE_FILE challengeVersion=$ENGINE_CODE_VERSION"
      ENGINE_SYNC_NOTE="[DRIFT: code v$ENGINE_CODE_VERSION]"
    else
      ENGINE_SYNC_NOTE="[synced: srcs/core/game-engine v$ENGINE_CODE_VERSION]"
    fi
  fi
fi

# 5. Verify HUMAN_CHECK Registry Sync with docs/human-checks.md
REGISTRY_FILE="docs/human-checks.md"
declare -A REGISTRY_IDS=()
if [[ -f "$REGISTRY_FILE" ]]; then
  while IFS=$'\t' read -r lineno reg_id; do
    [[ -z "$reg_id" ]] && continue
    REGISTRY_IDS["$reg_id"]="$REGISTRY_FILE:$lineno"
    if [[ -z "${SEEN_HUMAN_IDS[$reg_id]:-}" ]]; then
      err "$REGISTRY_FILE:$lineno: [UNTRACKED_HUMAN_CHECK] '$reg_id' is listed in $REGISTRY_FILE but has no matching <!-- HUMAN_CHECK: $reg_id ... --> comment in docs"
    fi
  done < <(
    awk '
      /^\|[[:space:]]*`[A-Z0-9_]+`/ {
        line = $0
        sub(/^\|[[:space:]]*`/, "", line)
        sub(/`.*$/, "", line)
        printf "%d\t%s\n", NR, line
      }
    ' "$REGISTRY_FILE"
  )

  for hid in "${!SEEN_HUMAN_IDS[@]}"; do
    if [[ -z "${REGISTRY_IDS[$hid]:-}" ]]; then
      err "${SEEN_HUMAN_IDS[$hid]}: [UNTRACKED_HUMAN_CHECK] '$hid' is missing from $REGISTRY_FILE table"
    fi
  done
fi

# 6. Check git diff for DOC_SYNC reminder when code changes without doc updates
CHANGED_CODE=$(git status --porcelain -- srcs/core srcs/frontend srcs/backend setup 2>/dev/null | wc -l || true)
CHANGED_DOCS=$(git status --porcelain -- README.md srcs/md 2>/dev/null | wc -l || true)
if [[ "$CHANGED_CODE" -gt 0 && "$CHANGED_DOCS" -eq 0 ]]; then
  warn "repo: [DOC_SYNC_REMINDER] $CHANGED_CODE source/setup path(s) modified with 0 changes in srcs/md/ or README.md. Verify DOC_SYNC triggers in: ${DOC_SYNC_FILES[*]}"
fi

# Print Readiness & Sync Table
printf "\nINFO  Document Readiness & Sync:\n"
printf "      %-32s %-8s %-8s %-9s %-11s %s\n" "FILE" "STATUS" "VERSION" "DOC_TODO" "HUMAN_CHECK" "CONTRACT SYNC"
for f in "${DURABLE_DOCS[@]}"; do
  [[ "$f" == "AGENTS.md" ]] && continue
  st="${FILE_STATUS["$f"]:-missing}"
  ver="${FILE_VERSION["$f"]:-?}"
  td="${FILE_TODO_COUNT["$f"]:-0}"
  hc="${FILE_HUMAN_COUNT["$f"]:-0}"
  note=""
  [[ "$f" == "$ENGINE_DOC" ]] && note="$ENGINE_SYNC_NOTE"
  printf "      %-32s %-8s v%-7s %-9s %-11s %s\n" "$f" "$st" "$ver" "$td" "$hc" "$note"
done

# Print summary & optional --todos listing
printf "\nINFO  Open lifecycle markers:\n"
printf "      - DOC_TODO:    %d in durable docs, %d in .scratch/plan/\n" "$DURABLE_TODO_COUNT" "$SCRATCH_TODO_COUNT"
printf "      - HUMAN_CHECK: %d active (%d registered in %s)\n" "${#SEEN_HUMAN_IDS[@]}" "${#REGISTRY_IDS[@]}" "$REGISTRY_FILE"
printf "      - DOC_SYNC:    %d durable files guarded (%s)\n" "${#DOC_SYNC_FILES[@]}" "${DOC_SYNC_FILES[*]}"

if [[ "$SHOW_TODOS" -eq 1 && "${#TODO_REPORT_LINES[@]}" -gt 0 ]]; then
  printf "\nINFO  Active DOC_TODO & HUMAN_CHECK items (--todos):\n"
  printf "%s\n" "${TODO_REPORT_LINES[@]}"
fi

printf "\n"
if [[ "$ERRORS" -gt 0 ]]; then
  printf "FAIL: %d error(s), %d warning(s).\n" "$ERRORS" "$WARNINGS"
  exit 1
fi

printf "PASS: 0 errors, %d warning(s).\n" "$WARNINGS"
exit 0
