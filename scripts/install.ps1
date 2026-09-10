<#
.SYNOPSIS
    Bluz Windows bootstrapper — the PowerShell counterpart to install.sh.

.DESCRIPTION
    Windows + Docker Desktop is a first-class install target, but until now the
    release bundle shipped only install.sh, leaving Windows customers to
    reverse-engineer the steps from a bash script (#412). This does the same
    work, plus the two preflight checks that only matter on Windows:

      * whether a non-default BLUZ_BIND_IP is actually a bound loopback alias
        (127.0.0.2+ are NOT valid bind targets on Windows out of the box)
      * whether another service already holds :80/:443 on 0.0.0.0, which Docker
        Desktop's port forwarder treats as reserving the port for EVERY address,
        not just that one — unlike Linux's iptables NAT

.EXAMPLE
    .\install.ps1

.NOTES
    Run from the directory you extracted the release into.
#>

#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

function Write-Head($msg) { Write-Host $msg -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Wait($msg) { Write-Host "[WAIT] $msg" -ForegroundColor Yellow }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

function Stop-WithError {
    param([string]$Message, [string[]]$Hints = @())
    Write-Host "`n[ERROR] $Message" -ForegroundColor Red
    foreach ($h in $Hints) { Write-Host "        $h" }
    exit 1
}

Write-Head "========================================="
Write-Head "      Bluz Windows Bootstrapper          "
Write-Head "========================================="

# ---------------------------------------------------------------------------
# Preflight
# ---------------------------------------------------------------------------
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Stop-WithError "Docker is not installed or not in PATH." @(
        "Install Docker Desktop, then re-run this script."
    )
}

docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Stop-WithError "Docker is installed but the daemon is not responding." @(
        "Start Docker Desktop and wait for it to report 'Engine running', then re-run."
    )
}

docker compose version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Stop-WithError "'docker compose' (v2) is not available." @(
        "This bundle needs Compose v2, which ships with current Docker Desktop.",
        "The standalone docker-compose.exe (v1) is not supported."
    )
}

$python = $null
foreach ($candidate in @("py", "python", "python3")) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) { $python = $candidate; break }
}
if (-not $python) {
    Stop-WithError "Python is required to run the setup wizard but was not found." @(
        "Install Python 3.11+ from https://python.org (tick 'Add to PATH'),",
        "or from the Microsoft Store, then re-run."
    )
}

if (-not (Test-Path "docker-compose.yml")) {
    Stop-WithError "docker-compose.yml not found in $(Get-Location)." @(
        "Run this script from the directory you extracted the release into."
    )
}

# ---------------------------------------------------------------------------
# Environment configuration (setup.py)
# ---------------------------------------------------------------------------
if (-not (Test-Path ".env")) {
    Write-Host ""
    Write-Wait "Initializing environment configuration wizard..."
    & $python -m venv .venv
    # The offline bundle ships every wheel under wheels/; installing with
    # --no-index keeps an air-gapped box from reaching for PyPI and the org
    # index, neither of which it can see.
    if (Test-Path "wheels") {
        & ".venv\Scripts\python.exe" -m pip install --no-index --find-links=wheels -r requirements.txt --quiet
        if ($LASTEXITCODE -ne 0) {
            Stop-WithError "Could not install the wizard's Python packages from wheels\." @(
                "The bundle may be incomplete - re-download the offline release."
            )
        }
    } else {
        & ".venv\Scripts\python.exe" -m pip install -r requirements.txt --quiet
    }
    & ".venv\Scripts\python.exe" setup.py
    if (-not (Test-Path ".env")) {
        Stop-WithError "The setup wizard did not produce a .env file." @(
            "Re-run it directly to see the failure: .venv\Scripts\python.exe setup.py"
        )
    }
    Write-Ok "Environment configured."
} else {
    Write-Host ""
    Write-Ok "Existing .env found. Skipping configuration wizard."
}

function Get-EnvValue([string]$Key) {
    $line = Select-String -Path ".env" -Pattern "^$Key=" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($line) { return ($line.Line -split "=", 2)[1] }
    return $null
}

$bindIp    = Get-EnvValue "BLUZ_BIND_IP";    if (-not $bindIp)    { $bindIp = "0.0.0.0" }
$httpPort  = Get-EnvValue "BLUZ_HTTP_PORT";  if (-not $httpPort)  { $httpPort = "80" }
$httpsPort = Get-EnvValue "BLUZ_HTTPS_PORT"; if (-not $httpsPort) { $httpsPort = "443" }

# ---------------------------------------------------------------------------
# Windows loopback alias check
#
# 127.0.0.2 and up are not bindable on Windows until explicitly added to the
# loopback pseudo-interface. Docker's failure for this is indistinguishable from
# a genuine port conflict, so check it here where we can say which it is.
# ---------------------------------------------------------------------------
if ($bindIp -ne "0.0.0.0" -and $bindIp -ne "127.0.0.1") {
    $aliasExists = $false
    try {
        $aliasExists = [bool](Get-NetIPAddress -IPAddress $bindIp -ErrorAction SilentlyContinue)
    } catch {
        # Get-NetIPAddress is unavailable on some editions; fall back to netsh.
        $aliasExists = (netsh interface ipv4 show address 2>$null | Select-String -SimpleMatch $bindIp) -ne $null
    }

    if (-not $aliasExists) {
        Stop-WithError "BLUZ_BIND_IP is set to $bindIp, which is not a bound address on this machine." @(
            "Windows does not make 127.0.0.2+ bindable by default. Either:",
            "",
            "  1. Add the loopback alias (Administrator PowerShell, one time):",
            "       netsh interface ipv4 add address `"Loopback Pseudo-Interface 1`" $bindIp 255.0.0.0",
            "",
            "  2. Or drop BLUZ_BIND_IP from .env and give Bluz its own ports instead:",
            "       BLUZ_HTTP_PORT=8080",
            "       BLUZ_HTTPS_PORT=8443",
            "",
            "Option 2 needs no admin rights and is the recommended path."
        )
    }
    Write-Ok "Loopback alias $bindIp is present."
}

# ---------------------------------------------------------------------------
# Port availability
# ---------------------------------------------------------------------------
foreach ($port in @($httpPort, $httpsPort)) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if ($listener) {
        $onAnyAddress = $listener | Where-Object { $_.LocalAddress -in @("0.0.0.0", "::") }
        Write-Host ""
        Write-Warn "Something is already listening on port $port."
        if ($onAnyAddress) {
            Write-Host "        It is bound to 0.0.0.0 (all addresses). On Windows, Docker Desktop"
            Write-Host "        reserves a published port by NUMBER, not per-IP — so setting"
            Write-Host "        BLUZ_BIND_IP alone will NOT get you around this."
            Write-Host "        Fix it on the other side too: bind that service to a specific IP"
            Write-Host "        (e.g. 127.0.0.1:80:80 in its compose file), or give Bluz different"
            Write-Host "        ports via BLUZ_HTTP_PORT / BLUZ_HTTPS_PORT in .env."
        } else {
            Write-Host "        Set BLUZ_HTTP_PORT / BLUZ_HTTPS_PORT in .env to free ports."
        }
    }
}

# ---------------------------------------------------------------------------
# Image resolution & versioning
# ---------------------------------------------------------------------------
$detectedTag = ""
if (Test-Path "VERSION") { $detectedTag = (Get-Content "VERSION" -Raw).Trim() }
$isOffline = $false

Write-Host ""
Write-Wait "Resolving Docker images..."
$imageArchives = Get-ChildItem -Path "images\*.tar" -ErrorAction SilentlyContinue
if ($imageArchives) {
    $isOffline = $true
    Write-Host ">> Offline bundle detected. Loading local image archives..." -ForegroundColor Blue
    foreach ($img in $imageArchives) {
        Write-Host "   Loading $($img.Name)..."
        $loadOut = docker load -i $img.FullName
        if ($loadOut -match ':(v\d+\.\d+\.\d+\S*)\s*$') { $detectedTag = $Matches[1] }
    }
    Write-Ok "Successfully loaded offline images (Tag: $detectedTag)."
} else {
    Write-Host ">> No local images found. Assuming Online Mode." -ForegroundColor Blue
}

if (-not $detectedTag) {
    Stop-WithError "Could not determine which Bluz version to run." @(
        "The bundle should contain a VERSION file (online) or images\*.tar (offline).",
        "Neither was found, and there is no usable default: the 'latest' tag is never published.",
        "Set it by hand if you know the version:  'v1.0.0' | Set-Content VERSION"
    )
}

$envLines = Get-Content ".env"
if ($envLines -match "^BLUZ_VERSION=") {
    $envLines = $envLines -replace "^BLUZ_VERSION=.*", "BLUZ_VERSION=$detectedTag"
    Set-Content ".env" $envLines -Encoding UTF8
} else {
    Add-Content ".env" "BLUZ_VERSION=$detectedTag" -Encoding UTF8
}

# ---------------------------------------------------------------------------
# Boot
# ---------------------------------------------------------------------------
Write-Host ""
Write-Wait "Validating compose configuration..."
docker compose config --quiet
if ($LASTEXITCODE -ne 0) {
    Stop-WithError "docker-compose.yml did not validate against your .env." @(
        "The error above names the missing or malformed variable."
    )
}

if (-not $isOffline) {
    Write-Host ""
    Write-Wait "Pulling containers from GHCR ($detectedTag)..."
    docker compose pull
    if ($LASTEXITCODE -ne 0) {
        Stop-WithError "Failed to pull images for version $detectedTag." @(
            "If this is a private build, log in first: docker login ghcr.io"
        )
    }
}

Write-Host ""
Write-Wait "Starting Bluz services..."
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Stop-WithError "docker compose up failed." @(
        "If the proxy container reports 'port is already allocated', see the port",
        "warnings above — and TROUBLESHOOTING.md, 'Port is already allocated'."
    )
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host " Bluz Installation Complete!             " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

$nextauthUrl = Get-EnvValue "NEXTAUTH_URL"
if ($nextauthUrl) { Write-Host "Bluz should now be reachable at: $nextauthUrl" -ForegroundColor Cyan }

if (Select-String -Path ".env" -Pattern "MANUAL_ENTRY_REQUIRED" -Quiet) {
    Write-Host ""
    Write-Host "[ACTION REQUIRED] Hive SSO is NOT configured — sign-in will fail." -ForegroundColor Red
    Write-Host "  .env still contains MANUAL_ENTRY_REQUIRED placeholders."
    Write-Host "  Re-run the wizard to retry registration:  .venv\Scripts\python.exe setup.py"
    Write-Host "  See TROUBLESHOOTING.md ('SSO registration') for the manual path."
}

Write-Host ""
Write-Host "To stop the system, run: docker compose down"
Write-Host "Running Hive on this same machine? Use .\link-hive.ps1 instead of this script."
