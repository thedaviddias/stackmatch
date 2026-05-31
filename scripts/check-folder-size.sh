#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# Enforce max 7 source files per directory.
#
# Exemptions:
#   - __tests__/ directories (test files mirror source structure)
#   - Workspace roots (apps/web/, repo root — contain config files)
#   - Generated/build dirs (node_modules, .next, _generated, coverage, dist)
#   - Convex directories (API paths are generated from file structure)
#   - Next.js App Router root (app/ — framework convention)
#   - Package src/ roots (shared libraries naturally have more exports)
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

MAX_FILES=7
violations=0

while IFS= read -r dir; do
  # Skip workspace roots (contain config files)
  case "$dir" in
    apps/web|.) continue ;;
  esac

  # Skip Convex directories (API paths coupled to file structure)
  case "$dir" in
    apps/web/convex|apps/web/convex/mutations|apps/web/convex/queries|apps/web/convex/github|apps/web/convex/stack|apps/web/convex/classification|apps/web/convex/lib) continue ;;
  esac

  # Skip Next.js App Router root
  case "$dir" in
    apps/web/app) continue ;;
  esac

  # Skip package src/ roots (shared libraries naturally have more exports)
  case "$dir" in
    packages/*/src) continue ;;
  esac

  count=$(find "$dir" -maxdepth 1 -type f | wc -l | tr -d ' ')
  if [ "$count" -gt "$MAX_FILES" ]; then
    echo "FAIL  $dir has $count files (max $MAX_FILES)"
    violations=$((violations + 1))
  fi
done < <(find apps packages -type d \
  -not -path '*/__tests__*' \
  -not -path '*/node_modules/*' \
  -not -path '*/.next*' \
  -not -path '*/_generated/*' \
  -not -name 'coverage' -not -path '*/coverage/*' \
  -not -path '*/dist/*' \
  -not -path '*/.convex/*' \
  -not -path '*/.turbo/*' \
)

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "$violations directory(s) exceed the $MAX_FILES-file limit."
  exit 1
else
  echo "All directories within the $MAX_FILES-file limit."
  exit 0
fi
