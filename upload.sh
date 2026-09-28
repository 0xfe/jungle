#!/usr/bin/env bash
# Upload the existing dist/ build to muthanna.com/jungle/ with five-minute caching.
# Run npm run build first to include your latest changes.
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

gcloud storage rsync dist/ gs://muthanna.com/jungle/ \
  --recursive \
  --checksums-only \
  --predefined-acl=publicRead \
  --cache-control="public,max-age=300" \
  --gzip-in-flight=html,css,js
