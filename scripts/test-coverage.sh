#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for repo in commerce-platform-backend commerce-platform-frontend commerce-platform-scrapers; do
  echo "==> $repo"
  (cd "$ROOT/$repo" && npm run test:coverage)
done
