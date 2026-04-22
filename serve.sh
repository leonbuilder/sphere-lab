#!/usr/bin/env bash
# Serve this directory at http://localhost:8000/ — needed because ES modules
# can't load over file://. Ctrl-C to stop.
set -euo pipefail
cd "$(dirname "$0")"
exec python3 -m http.server 8000
