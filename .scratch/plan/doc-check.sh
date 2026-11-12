#!/usr/bin/env bash
set -euo pipefail

# doc-check.sh — Deterministic documentation linter & lifecycle checker.
# Enforces link resolution, tier boundaries (.scratch vs durable docs),
# marker syntax (DOC_TODO, DOC_SYNC, HUMAN_CHECK), and human-checks registry sync.

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

# Collect target files by tier
DURABLE_DOCS=()
for f in README.md AGENTS.md srcs/md/*.md docs/*.md; do
  [[ -f "$f" ]] && DURABLE_DOCS+=("$f")
done

SCRATCH_DOCS=()
for f in .scratch/plan/*.md; do
  [[ -f "$f" ]] && SCRATCH_DOCS+=("$f")
done

ALL_DOCS=("${DURABLE_DOCS[@]}" "${SCRATCH_DOCS[@]}")

# Helper: find if a missing filename exists elsewhere in doc directories
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
  local tier="$2" # "durable" or "scratch"
  local dir
  dir="$(dirname "$file")"

  while IFS=$'\t' read -r lineno target; do
    [[ -z "$target" ]] && continue

    # Ignore external links and pure anchors
    case "$target" in
      http://*|https://*|mailto:*|file://*|conversation://*|'#'*)
        continue
        ;;
    esac

    # Strip anchor suffix (#...)
    local clean_target="${target%%#*}"
    [[ -z "$clean_target" ]] && continue

    # Resolve relative to the markdown file's directory
    local resolved="$clean_target"
    if [[ "$dir" != "." ]]; then
      resolved="$dir/$clean_target"
    fi

    # Normalize leading ./
    resolved="${resolved#./}"

    # Rule 2: Tier Violation — durable docs must never link into .scratch/
    if [[ "$tier" == "durable" ]] && [[ "$resolved" == .scratch/* || "$clean_target" == *.scratch/* ]]; then
      err "$file:$lineno: [TIER_VIOLATION] durable doc must not link to .scratch/ ('$clean_target')"
      continue
    fi

    # Rule 1: Broken Link check
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

# 3. Check Lifecycle Marker Syntax & Duplicate IDs (ignoring fenced code blocks)
declare -A SEEN_TODO_IDS=()
declare -A SEEN_HUMAN_IDS=()
DURABLE_TODO_COUNT=0
SCRATCH_TODO_COUNT=0
DOC_SYNC_FILES=()
TODO_REPORT_LINES=()

check_markers_in_file() {
  local file="$1"
  local tier="$2"

  while IFS=$'\t' read -r lineno line; do
    if [[ "$line" == *"DOC_TODO"* ]]; then
      if [[ "$line" =~ ^\<!--[[:space:]]*DOC_TODO:[[:space:]]*([A-Z0-9_]+)[[:space:]]*—[[:space:]]*(.+)\.[[:space:]]*--\>$ ]]; then
        local id="${BASH_REMATCH[1]}"
        if [[ -n "${SEEN_TODO_IDS[$id]:-}" ]]; then
          err "$file:$lineno: [MALFORMED_MARKER] duplicate DOC_TODO ID '$id' (first seen at ${SEEN_TODO_IDS[$id]})"
        else
          SEEN_TODO_IDS["$id"]="$file:$lineno"
        fi
        if [[ "$tier" == "durable" ]]; then
          DURABLE_TODO_COUNT=$((DURABLE_TODO_COUNT + 1))
        else
          SCRATCH_TODO_COUNT=$((SCRATCH_TODO_COUNT + 1))
        fi
        TODO_REPORT_LINES+=("  DOC_TODO    $file:$lineno: $id")
      else
        err "$file:$lineno: [MALFORMED_MARKER] invalid DOC_TODO format (expected: <!-- DOC_TODO: <ID> — <description>. -->)"
      fi
    fi

    if [[ "$line" == *"DOC_SYNC"* ]]; then
      if [[ "$line" =~ ^\<!--[[:space:]]*DOC_SYNC:[[:space:]]*(.+)\.[[:space:]]*--\>$ ]]; then
        [[ "$tier" == "durable" ]] && DOC_SYNC_FILES+=("$file")
      else
        err "$file:$lineno: [MALFORMED_MARKER] invalid DOC_SYNC format (expected: <!-- DOC_SYNC: <description>. -->)"
      fi
    fi

    if [[ "$line" == *"HUMAN_CHECK"* ]]; then
      if [[ "$line" =~ ^\<!--[[:space:]]*HUMAN_CHECK:[[:space:]]*([A-Z0-9_]+)[[:space:]]*—[[:space:]]*(.+)\.[[:space:]]*--\>$ ]]; then
        local hid="${BASH_REMATCH[1]}"
        SEEN_HUMAN_IDS["$hid"]="${SEEN_HUMAN_IDS[$hid]:-$file:$lineno}"
        TODO_REPORT_LINES+=("  HUMAN_CHECK $file:$lineno: $hid")
      else
        err "$file:$lineno: [MALFORMED_MARKER] invalid HUMAN_CHECK format (expected: <!-- HUMAN_CHECK: <ID> — <description>. -->)"
      fi
    fi
  done < <(
    awk '
      /^```/ { in_code = !in_code; next }
      !in_code {
        stripped = $0
        gsub(/`[^`]*`/, "", stripped)
        if (stripped ~ /<!--.*(DOC_TODO|DOC_SYNC|HUMAN_CHECK)/) {
          printf "%d\t%s\n", NR, $0
        }
      }
    ' "$file"
  )
}

for f in "${DURABLE_DOCS[@]}"; do
  check_markers_in_file "$f" "durable"
done

for f in "${SCRATCH_DOCS[@]}"; do
  check_markers_in_file "$f" "scratch"
done

# 4. Verify HUMAN_CHECK Registry Sync with docs/human-checks.md
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

# 5. Check git diff for DOC_SYNC reminder when code changes without doc updates
CHANGED_CODE=$(git status --porcelain -- srcs/core srcs/frontend srcs/backend setup 2>/dev/null | wc -l || true)
CHANGED_DOCS=$(git status --porcelain -- README.md srcs/md 2>/dev/null | wc -l || true)
if [[ "$CHANGED_CODE" -gt 0 && "$CHANGED_DOCS" -eq 0 ]]; then
  warn "repo: [DOC_SYNC_REMINDER] $CHANGED_CODE source/setup path(s) modified with 0 changes in srcs/md/ or README.md. Verify DOC_SYNC triggers in: ${DOC_SYNC_FILES[*]}"
fi

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
