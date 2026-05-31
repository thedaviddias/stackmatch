#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# Clean build artifacts, caches, and node_modules across the monorepo.
#
# Usage:
#   bash scripts/clean.sh          # Remove caches + build artifacts only
#   bash scripts/clean.sh --all    # Also remove all node_modules (full reset)
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

clean_all=false
if [ "${1:-}" = "--all" ]; then
  clean_all=true
fi

echo "Cleaning build artifacts and caches..."

# Remove Next.js build output
find . -name '.next' -type d -not -path '*/node_modules/*' -exec rm -rf {} + 2>/dev/null || true

# Remove Turbo cache
find . -name '.turbo' -type d -not -path '*/node_modules/*' -exec rm -rf {} + 2>/dev/null || true

# Remove coverage output
find . -name 'coverage' -type d -not -path '*/node_modules/*' -exec rm -rf {} + 2>/dev/null || true

# Remove TypeScript build info
find . -name 'tsconfig.tsbuildinfo' -not -path '*/node_modules/*' -delete 2>/dev/null || true

echo "  Removed .next, .turbo, coverage, and tsbuildinfo"

if [ "$clean_all" = true ]; then
  echo "Removing all node_modules..."
  find . -name 'node_modules' -type d -prune -exec rm -rf {} + 2>/dev/null || true
  echo "  Removed node_modules from all packages"
  echo ""
  echo "Run 'pnpm install' to reinstall dependencies."
fi

echo "Done."
