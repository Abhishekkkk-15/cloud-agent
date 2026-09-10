#!/bin/sh
set -e

# If the mounted /app directory is empty or missing package.json, seed it from the pre-built template
if [ ! -f "/app/package.json" ]; then
    echo "[Sandbox] Seeding fullstack template into /app..."
    cp -a /template/. /app/
    echo "[Sandbox] Workspace initialized with fullstack project."
fi

exec "$@"
