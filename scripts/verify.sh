#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# Run all checks to verify nothing is broken.
#
# Runs: lint, typecheck, unit tests, a11y tests, folder size check, build.
# Stops on the first failure.
#
# Usage:
#   bash scripts/verify.sh             # Run everything including build
#   bash scripts/verify.sh --no-build  # Skip the build step (faster)
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

skip_build=false
if [ "${1:-}" = "--no-build" ]; then
  skip_build=true
fi

echo "=== Lint ==="
pnpm turbo lint
echo ""

echo "=== Centralized Constants ==="
pnpm check:constants
echo ""

echo "=== Data Boundary ==="
pnpm check:data-boundary
echo ""

echo "=== No New Magic Numbers (Changed Files) ==="
pnpm check:no-magic-changed
echo ""

echo "=== Typecheck ==="
pnpm turbo typecheck
echo ""

echo "=== Unit Tests ==="
pnpm turbo test
echo ""

echo "=== Accessibility Tests ==="
pnpm --filter @stackmatch/web test:a11y
echo ""

echo "=== Folder Size Check ==="
bash scripts/check-folder-size.sh
echo ""

if [ "$skip_build" = false ]; then
  echo "=== Build ==="
  pnpm turbo build
  echo ""
fi

echo "All checks passed."
