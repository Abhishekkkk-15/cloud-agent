#!/usr/bin/env bash
# ==============================================================================
# Cloud Agent Daemon Installer (Linux & macOS)
# Installs 'ca' and 'cloud-agent-daemon' on your workstation, laptop, or VPS.
# Usage:
#   curl -fsSL https://gateway.cloud-agent.abhishekkkk.in/install.sh | bash
# ==============================================================================

set -e

RESET='\033[0m'
BOLD='\033[1m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
GRAY='\033[90m'

echo -e ""
echo -e "${CYAN}${BOLD}┌───────────────────────────────────────────────┐${RESET}"
echo -e "${CYAN}${BOLD}│         Cloud Agent Daemon Installer          │${RESET}"
echo -e "${CYAN}${BOLD}│       Zero-DB Pluggable Coding Agent          │${RESET}"
echo -e "${CYAN}${BOLD}└───────────────────────────────────────────────┘${RESET}"
echo -e ""

# 1. Detect OS & Architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux*)  PLATFORM="Linux" ;;
  Darwin*) PLATFORM="macOS" ;;
  *)       PLATFORM="Unknown ($OS)" ;;
esac

echo -e "${GRAY}Detecting platform...${RESET} ${BOLD}${PLATFORM} (${ARCH})${RESET}"

# 2. Check Prerequisites: Node.js (>= 20)
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

echo -e "${GRAY}Checking prerequisites...${RESET}"

if ! command_exists node; then
  echo -e "${YELLOW}Node.js is not installed.${RESET}"
  echo -e "${CYAN}Installing Node.js (LTS >= 20)...${RESET}"
  if [ "$PLATFORM" = "macOS" ]; then
    if command_exists brew; then
      brew install node
    else
      echo -e "${RED}Homebrew not found. Please install Node.js 20+ from https://nodejs.org${RESET}"
      exit 1
    fi
  elif [ "$PLATFORM" = "Linux" ]; then
    if command_exists curl; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      sudo apt-get install -y nodejs || sudo yum install -y nodejs || sudo pacman -S --noconfirm nodejs npm
    else
      echo -e "${RED}Please install Node.js 20+ from https://nodejs.org${RESET}"
      exit 1
    fi
  fi
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${RED}Node.js version is $(node -v). Cloud Agent requires Node.js >= 20.${RESET}"
  echo -e "Please update your Node.js runtime."
  exit 1
fi
echo -e "  ${GREEN}✔${RESET} Node.js Runtime     : ${BOLD}$(node -v)${RESET}"

if ! command_exists git; then
  echo -e "${YELLOW}Git is not installed. Installing git...${RESET}"
  if [ "$PLATFORM" = "macOS" ]; then
    brew install git
  elif [ "$PLATFORM" = "Linux" ]; then
    sudo apt-get update && sudo apt-get install -y git || sudo yum install -y git || sudo pacman -S --noconfirm git
  fi
fi
echo -e "  ${GREEN}✔${RESET} Git Version         : ${BOLD}$(git --version)${RESET}"

# Check/Install pnpm
if ! command_exists pnpm; then
  echo -e "${GRAY}pnpm not detected. Installing pnpm...${RESET}"
  npm install -g pnpm >/dev/null 2>&1 || curl -fsSL https://get.pnpm.io/install.sh | sh -
fi
echo -e "  ${GREEN}✔${RESET} Package Manager     : ${BOLD}pnpm $(pnpm -v 2>/dev/null || echo '')${RESET}"

# 3. Setup Install Directories
INSTALL_DIR="$HOME/.cloud-agent"
RUNTIME_DIR="$INSTALL_DIR/runtime"
BIN_DIR="$INSTALL_DIR/bin"

mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# 4. Clone or Update Runtime
REPO_URL="https://github.com/Abhishekkkk-15/cloud-agent.git"

if [ -d "$RUNTIME_DIR/.git" ]; then
  echo -e "${CYAN}Updating Cloud Agent Daemon runtime...${RESET}"
  cd "$RUNTIME_DIR"
  git fetch --depth=1 origin main
  git reset --hard origin/main
else
  echo -e "${CYAN}Cloning Cloud Agent Daemon into ${RUNTIME_DIR}...${RESET}"
  rm -rf "$RUNTIME_DIR"
  git clone --depth=1 "$REPO_URL" "$RUNTIME_DIR"
  cd "$RUNTIME_DIR"
fi

# 5. Build Daemon Package
echo -e "${CYAN}Building Cloud Agent Daemon dependencies...${RESET}"
pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install >/dev/null 2>&1
pnpm --filter @cloud-agent/daemon build >/dev/null 2>&1 || true

# 6. Create Global Executable Wrappers
WRAPPER_FILE="$BIN_DIR/ca"
cat << 'EOF' > "$WRAPPER_FILE"
#!/usr/bin/env bash
DAEMON_DIR="$HOME/.cloud-agent/runtime/apps/daemon"
export NODE_ENV="${NODE_ENV:-production}"

if [ -f "$DAEMON_DIR/dist/index.js" ]; then
  exec node "$DAEMON_DIR/dist/index.js" "$@"
else
  exec node --loader tsx "$DAEMON_DIR/src/index.ts" "$@"
fi
EOF

chmod +x "$WRAPPER_FILE"
cp "$WRAPPER_FILE" "$BIN_DIR/cloud-agent-daemon"

# Try symlinking to /usr/local/bin or ~/.local/bin
TARGET_BIN="/usr/local/bin"
if [ -w "$TARGET_BIN" ]; then
  ln -sf "$WRAPPER_FILE" "$TARGET_BIN/ca"
  ln -sf "$BIN_DIR/cloud-agent-daemon" "$TARGET_BIN/cloud-agent-daemon"
elif [ -d "$HOME/.local/bin" ]; then
  mkdir -p "$HOME/.local/bin"
  ln -sf "$WRAPPER_FILE" "$HOME/.local/bin/ca"
  ln -sf "$BIN_DIR/cloud-agent-daemon" "$HOME/.local/bin/cloud-agent-daemon"
fi

# Ensure BIN_DIR is in PATH
SHELL_RC=""
if [ -n "$BASH_VERSION" ]; then
  SHELL_RC="$HOME/.bashrc"
elif [ -n "$ZSH_VERSION" ]; then
  SHELL_RC="$HOME/.zshrc"
elif [ -f "$HOME/.profile" ]; then
  SHELL_RC="$HOME/.profile"
fi

if [ -n "$SHELL_RC" ] && [ -f "$SHELL_RC" ]; then
  if ! grep -q '\.cloud-agent/bin' "$SHELL_RC"; then
    echo 'export PATH="$HOME/.cloud-agent/bin:$PATH"' >> "$SHELL_RC"
  fi
fi

export PATH="$BIN_DIR:$PATH"

echo -e ""
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"
echo -e "${GREEN}${BOLD}✔ Cloud Agent Daemon successfully installed!${RESET}"
echo -e "  Binary path : ${BOLD}$BIN_DIR/ca${RESET}"
echo -e "  Config path : ${GRAY}$INSTALL_DIR/daemon.json${RESET}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════════════════════════════${RESET}"
echo -e ""
echo -e "To link this machine with your ${CYAN}Cloud Agent Mobile app${RESET}, run:"
echo -e ""
echo -e "  ${CYAN}${BOLD}ca pair${RESET}"
echo -e ""
echo -e "Or to run it 24/7 as a background service:"
echo -e "  ${BOLD}ca service install && ca service start${RESET}"
echo -e ""
