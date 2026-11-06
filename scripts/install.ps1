# ==============================================================================
# Cloud Agent Daemon Installer (Windows PowerShell)
# Installs 'ca' and 'cloud-agent-daemon' on your Windows PC or Server.
# Usage:
#   irm https://gateway.cloud-agent.abhishekkkk.in/install.ps1 | iex
# ==============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "┌───────────────────────────────────────────────┐" -ForegroundColor Cyan
Write-Host "│         Cloud Agent Daemon Installer          │" -ForegroundColor Cyan
Write-Host "│       Zero-DB Pluggable Coding Agent          │" -ForegroundColor Cyan
Write-Host "└───────────────────────────────────────────────┘" -ForegroundColor Cyan
Write-Host ""

Write-Host "Detecting environment... Windows ($([System.Environment]::OSVersion.VersionString))" -ForegroundColor Gray

# 1. Check Node.js
Write-Host "Checking prerequisites..." -ForegroundColor Gray
$nodeInstalled = $false
try {
    $nodeVersion = node -v
    $major = [int]($nodeVersion -replace 'v','' -split '\.')[0]
    if ($major -ge 20) {
        $nodeInstalled = $true
        Write-Host "  ✔ Node.js Runtime     : $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "  ✖ Node.js version is $nodeVersion. Cloud Agent requires Node >= 20." -ForegroundColor Red
    }
} catch {
    Write-Host "  ✖ Node.js is not installed." -ForegroundColor Red
}

if (-not $nodeInstalled) {
    Write-Host "Please install Node.js 20+ from https://nodejs.org or run 'winget install OpenJS.NodeJS.LTS'" -ForegroundColor Yellow
    exit 1
}

# 2. Check Git
$gitInstalled = $false
try {
    $gitVer = git --version
    Write-Host "  ✔ Git Version         : $gitVer" -ForegroundColor Green
    $gitInstalled = $true
} catch {
    Write-Host "  ⚠️ Git is not detected in PATH. You can install it with: winget install Git.Git" -ForegroundColor Yellow
}

# 3. Check pnpm
try {
    $pnpmVer = pnpm -v
    Write-Host "  ✔ Package Manager     : pnpm $pnpmVer" -ForegroundColor Green
} catch {
    Write-Host "Installing pnpm globally via npm..." -ForegroundColor Gray
    npm install -g pnpm | Out-Null
}

# 4. Setup directories
$installDir = Join-Path $HOME ".cloud-agent"
$runtimeDir = Join-Path $installDir "runtime"
$binDir = Join-Path $installDir "bin"

if (-not (Test-Path $installDir)) { New-Item -ItemType Directory -Path $installDir | Out-Null }
if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir | Out-Null }

# 5. Clone or update repository
$repoUrl = "https://github.com/Abhishekkkk-15/cloud-agent.git"
if (Test-Path (Join-Path $runtimeDir ".git")) {
    Write-Host "Updating Cloud Agent Daemon runtime..." -ForegroundColor Cyan
    Push-Location $runtimeDir
    git fetch --depth=1 origin main | Out-Null
    git reset --hard origin/main | Out-Null
    Pop-Location
} else {
    Write-Host "Cloning Cloud Agent Daemon into $runtimeDir..." -ForegroundColor Cyan
    if (Test-Path $runtimeDir) { Remove-Item -Recurse -Force $runtimeDir }
    git clone --depth=1 $repoUrl $runtimeDir | Out-Null
}

# 6. Install dependencies and build daemon
Write-Host "Building Cloud Agent Daemon dependencies..." -ForegroundColor Cyan
Push-Location $runtimeDir
pnpm install | Out-Null
pnpm --filter @cloud-agent/daemon build | Out-Null
Pop-Location

# 7. Create batch wrappers: ca.cmd and cloud-agent-daemon.cmd
$daemonEntry = Join-Path $runtimeDir "apps\daemon\dist\index.js"
if (-not (Test-Path $daemonEntry)) {
    $daemonEntry = Join-Path $runtimeDir "apps\daemon\src\index.ts"
}

$cmdContent = @"
@echo off
set NODE_ENV=production
node "$daemonEntry" %*
"@

$caCmd = Join-Path $binDir "ca.cmd"
$cadCmd = Join-Path $binDir "cloud-agent-daemon.cmd"
Set-Content -Path $caCmd -Value $cmdContent -Encoding ASCII
Set-Content -Path $cadCmd -Value $cmdContent -Encoding ASCII

# 8. Add bin directory to user PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$binDir*") {
    Write-Host "Adding $binDir to User PATH..." -ForegroundColor Cyan
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$binDir", "User")
    $env:Path = "$env:Path;$binDir"
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "✔ Cloud Agent Daemon successfully installed on Windows!" -ForegroundColor Green
Write-Host "  Executable : $caCmd" -ForegroundColor White
Write-Host "  Config dir : $installDir" -ForegroundColor Gray
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "To link this machine with your Cloud Agent Mobile app, run:" -ForegroundColor White
Write-Host ""
Write-Host "  ca pair" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or check health diagnostics:" -ForegroundColor White
Write-Host "  ca doctor" -ForegroundColor Cyan
Write-Host ""
