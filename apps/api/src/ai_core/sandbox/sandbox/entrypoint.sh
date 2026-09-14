#!/bin/sh
set -e

# Seed project source into the bind-mounted /app only.
# Do not copy or pre-seed node_modules — install deps in /app with npm when needed.
if [ ! -f "/app/package.json" ]; then
    echo "[Sandbox] Seeding project template into /app..."
    for item in /template/* /template/.*; do
        base=$(basename "$item")
        if [ "$base" != "." ] && [ "$base" != ".." ] && [ "$base" != "node_modules" ] && [ -e "$item" ]; then
            cp -rf "$item" /app/ 2>/dev/null || true
        fi
    done
fi

exec "$@"
