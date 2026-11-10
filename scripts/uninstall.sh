#!/usr/bin/env bash
# ==============================================================================
# Cloud Agent Daemon Uninstaller
# Completely removes Cloud Agent configurations, background services, and files.
# ==============================================================================
set -e

RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
CYAN="\033[36m"
BOLD="\033[1m"
RESET="\033[0m"

echo -e ""
echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"
echo -e "${CYAN}${BOLD}       Cloud Agent Uninstaller — Complete System Cleanup        ${RESET}"
echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"
echo -e ""

# 1. Stop and remove systemd user unit (Linux)
if command -v systemctl >/dev/null 2>&1; then
  echo -e "  ${YELLOW}•${RESET} Stopping systemd user service..."
  systemctl --user stop cloud-agent.service >/dev/null 2>&1 || true
  systemctl --user disable cloud-agent.service >/dev/null 2>&1 || true
  rm -f "$HOME/.config/systemd/user/cloud-agent.service" 2>/dev/null || true
  systemctl --user daemon-reload >/dev/null 2>&1 || true
  echo -e "  ${GREEN}✔${RESET} Systemd user unit disabled and removed."
fi

# 2. Stop and remove launchd agent (macOS)
if command -v launchctl >/dev/null 2>&1; then
  LAUNCHD_PLIST="$HOME/Library/LaunchAgents/com.cloudagent.daemon.plist"
  if [ -f "$LAUNCHD_PLIST" ]; then
    echo -e "  ${YELLOW}•${RESET} Unloading macOS LaunchAgent..."
    launchctl unload "$LAUNCHD_PLIST" >/dev/null 2>&1 || true
    rm -f "$LAUNCHD_PLIST" 2>/dev/null || true
    echo -e "  ${GREEN}✔${RESET} LaunchAgent removed."
  fi
fi

# 3. Kill any running daemon process from PID file
PID_FILE="$HOME/.cloud-agent/daemon.pid"
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo -e "  ${YELLOW}•${RESET} Stopping active daemon process (PID: $PID)..."
    kill "$PID" 2>/dev/null || true
    sleep 1
    kill -9 "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE" 2>/dev/null || true
fi

# 4. Remove binary links
echo -e "  ${YELLOW}•${RESET} Removing executable links..."
rm -f "$HOME/.local/bin/ca" "$HOME/.local/bin/cloud-agent-daemon" 2>/dev/null || true
if [ -w "/usr/local/bin" ]; then
  rm -f "/usr/local/bin/ca" "/usr/local/bin/cloud-agent-daemon" 2>/dev/null || true
fi

# 5. Clean shell rc profile PATH additions
echo -e "  ${YELLOW}•${RESET} Cleaning PATH exports from shell config..."
for RC in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
  if [ -f "$RC" ] && grep -q '\.cloud-agent/bin' "$RC" 2>/dev/null; then
    sed -i.bak '/\.cloud-agent\/bin/d' "$RC" 2>/dev/null || sed -i '' '/\.cloud-agent\/bin/d' "$RC" 2>/dev/null || true
    rm -f "${RC}.bak" 2>/dev/null || true
    echo -e "    ${GREEN}✔${RESET} Cleaned $RC"
  fi
done

# 6. Remove ~/.cloud-agent directory
if [ -d "$HOME/.cloud-agent" ]; then
  echo -e "  ${YELLOW}•${RESET} Removing ~/.cloud-agent directory..."
  rm -rf "$HOME/.cloud-agent"
  echo -e "  ${GREEN}✔${RESET} ~/.cloud-agent removed."
fi

echo -e ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}✔ Cloud Agent was completely removed from your system.${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"
echo -e ""
