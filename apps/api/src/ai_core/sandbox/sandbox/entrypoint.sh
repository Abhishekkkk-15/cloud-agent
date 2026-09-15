#!/bin/sh
set -e

# Host prepare_workspace() seeds the Cloud Agent template or clones a GitHub
# import before the container starts. Never overlay /template onto a prepared
# workspace — that mixed imported repos with the Vite/Express starter.
#
# Only seed when /app is still completely empty (legacy / unprepared mounts).
# Skip when SKIP_TEMPLATE_SEED is set, a git clone exists, or any files exist.
if [ "${SKIP_TEMPLATE_SEED:-0}" = "1" ]; then
    echo "[Sandbox] SKIP_TEMPLATE_SEED=1; not seeding template"
elif [ -d "/app/.git" ]; then
    echo "[Sandbox] /app is a git repo; not seeding template"
elif [ -n "$(ls -A /app 2>/dev/null)" ]; then
    echo "[Sandbox] /app is non-empty; not seeding template"
elif [ -d "/template" ]; then
    echo "[Sandbox] Empty /app; seeding project template..."
    for item in /template/* /template/.*; do
        base=$(basename "$item")
        if [ "$base" != "." ] && [ "$base" != ".." ] && [ "$base" != "node_modules" ] && [ -e "$item" ]; then
            cp -rf "$item" /app/ 2>/dev/null || true
        fi
    done
fi

exec "$@"
