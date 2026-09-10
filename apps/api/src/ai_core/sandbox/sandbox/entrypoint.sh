#!/bin/sh
set -e

# If the mounted /app directory is missing package.json, copy project files (excluding node_modules to avoid slow bind-mount copies)
if [ ! -f "/app/package.json" ]; then
    echo "[Sandbox] Seeding fullstack project files into /app..."
    for item in /template/* /template/.*; do
        base=$(basename "$item")
        if [ "$base" != "." ] && [ "$base" != ".." ] && [ "$base" != "node_modules" ] && [ -e "$item" ]; then
            cp -rf "$item" /app/ 2>/dev/null || true
        fi
    done
fi

# Ensure node_modules is linked instantly into /app without slow bind-mount copying
if [ ! -f "/app/node_modules/.bin/vite" ]; then
    echo "[Sandbox] Linking node_modules into /app..."
    rm -rf /app/node_modules 2>/dev/null || true
    ln -sf /template/node_modules /app/node_modules
fi

exec "$@"
