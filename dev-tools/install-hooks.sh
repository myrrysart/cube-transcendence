#!/usr/bin/env bash
set -euo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"
case "${1:-}" in ''|--check) ;; *) printf 'Usage: bash dev-tools/install-hooks.sh [--check]\n' >&2; exit 2 ;; esac
[ "$#" -le 1 ] || exit 2
for tool in git awk sed sort mktemp; do
  command -v "$tool" >/dev/null || { printf 'Missing required tool: %s\n' "$tool" >&2; exit 1; }
done
[ -f .githooks/pre-commit ] && [ -f dev-tools/doc-check.sh ] || { printf 'Missing repository harness files.\n' >&2; exit 1; }
current=$(git config --get core.hooksPath || true)
if [ "${1:-}" = --check ]; then
  [ "$current" = .githooks ] && [ -x .githooks/pre-commit ] || { printf 'Hook inactive. Run: bash dev-tools/install-hooks.sh\n' >&2; exit 1; }
  printf 'Contract commit hook is active.\n'; exit 0
fi
if [ -n "$current" ] && [ "$current" != .githooks ]; then
  printf 'Existing core.hooksPath=%s. Preserve/chain that hook before selecting .githooks; nothing changed.\n' "$current" >&2
  exit 1
fi
existing=$(git rev-parse --git-path hooks/pre-commit)
if [ -z "$current" ] && [ -f "$existing" ]; then
  printf 'Existing %s found. Preserve/chain it before selecting .githooks; nothing changed.\n' "$existing" >&2
  exit 1
fi
chmod +x .githooks/pre-commit
git config --local core.hooksPath .githooks
printf 'Installed repository-local commit hook. No global configuration changed.\n'
