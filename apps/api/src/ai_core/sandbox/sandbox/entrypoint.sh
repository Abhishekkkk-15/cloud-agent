#!/bin/sh
set -e

# If the mounted /app directory is missing package.json, copy project files
# (exclude node_modules — copied separately to avoid nested symlink pain).
if [ ! -f "/app/package.json" ]; then
    echo "[Sandbox] Seeding fullstack project files into /app..."
    for item in /template/* /template/.*; do
        base=$(basename "$item")
        if [ "$base" != "." ] && [ "$base" != ".." ] && [ "$base" != "node_modules" ] && [ -e "$item" ]; then
            cp -rf "$item" /app/ 2>/dev/null || true
        fi
    done
fi

# Prefer a real copy of node_modules over a symlink so Windows bind mounts
# and tools that cannot follow nested links keep working.
if [ ! -f "/app/node_modules/.bin/vite" ]; then
    echo "[Sandbox] Copying node_modules into /app..."
    rm -rf /app/node_modules 2>/dev/null || true
    if [ -d "/template/node_modules" ]; then
        cp -a /template/node_modules /app/node_modules
    else
        echo "[Sandbox] No prebuilt node_modules; running npm install in /app..."
        (cd /app && npm install)
    fi
fi

exec "$@"
