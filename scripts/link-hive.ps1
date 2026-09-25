<#
.SYNOPSIS
    Brings Bluz up against a Hive stack running on the SAME Docker daemon.

.DESCRIPTION
    Only needed for co-located installs. If Hive runs on another machine, plain
    .\install.ps1 is enough — set NEXT_PUBLIC_HIVE_URL to Hive's real hostname
    and ordinary DNS handles it.

    See docker-compose.hive-local.yml for why the hostname alias has to live on
    Hive's nginx container rather than on ours.

.EXAMPLE
    .\link-hive.ps1

.EXAMPLE
    $env:HIVE_NETWORK_NAME = "hive_hive-net"; .\link-hive.ps1
#>

#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$hiveHostname = if ($env:HIVE_HOSTNAME) { $env:HIVE_HOSTNAME } else { "hive.org" }

function Stop-WithError {
    param([string]$Message, [string[]]$Hints = @())
    Write-Host "`n[ERROR] $Message" -ForegroundColor Red
    foreach ($h in $Hints) { Write-Host "        $h" }
    exit 1
}

if (-not (Test-Path ".env")) {
    Stop-WithError "No .env found. Run .\install.ps1 first."
}

# Locate Hive's network. Compose names it after the directory Hive was brought
# up in, so it is not a fixed string.
$hiveNetwork = $env:HIVE_NETWORK_NAME
if (-not $hiveNetwork) {
    Write-Host "[WAIT] Locating Hive's Docker network..." -ForegroundColor Yellow
    $matches = @(docker network ls --format "{{.Name}}" | Where-Object { $_ -match "hive" -and $_ -match "net" })

    if ($matches.Count -eq 0) {
        Stop-WithError "No Hive network found on this Docker daemon." @(
            "Is the Hive stack running? Check with: docker compose ls",
            "If Hive runs on a DIFFERENT machine, you do not need this script —",
            "run .\install.ps1 and point NEXT_PUBLIC_HIVE_URL at Hive's hostname."
        )
    }
    if ($matches.Count -gt 1) {
        Write-Host "[ERROR] Multiple candidate Hive networks found:" -ForegroundColor Red
        $matches | ForEach-Object { Write-Host "    $_" }
        Write-Host "  Re-run with the right one, e.g.:"
        Write-Host "    `$env:HIVE_NETWORK_NAME = `"$($matches[0])`"; .\link-hive.ps1"
        exit 1
    }
    $hiveNetwork = $matches[0]
}
Write-Host "[OK] Using Hive network: $hiveNetwork" -ForegroundColor Green

# Locate Hive's nginx container — the one that must answer to $hiveHostname.
$hiveNginx = $env:HIVE_NGINX_CONTAINER
if (-not $hiveNginx) {
    $hiveNginx = @(docker ps --format "{{.Names}}" --filter "network=$hiveNetwork" |
        Where-Object { $_ -match "nginx|proxy" }) | Select-Object -First 1
}

if (-not $hiveNginx) {
    Write-Host "[ERROR] Could not find Hive's nginx container on $hiveNetwork." -ForegroundColor Red
    Write-Host "        Containers currently on that network:"
    docker ps --format "{{.Names}}" --filter "network=$hiveNetwork" | ForEach-Object { Write-Host "    $_" }
    Write-Host "        Re-run naming it explicitly, e.g.:"
    Write-Host "          `$env:HIVE_NGINX_CONTAINER = `"hive-nginx`"; .\link-hive.ps1"
    exit 1
}
Write-Host "[OK] Using Hive nginx container: $hiveNginx" -ForegroundColor Green

# Add the alias. Already-connected is the normal case on re-runs.
Write-Host "`n[WAIT] Aliasing $hiveHostname onto $hiveNginx..." -ForegroundColor Yellow
$existingAliases = docker inspect $hiveNginx `
    --format "{{range .NetworkSettings.Networks}}{{range .Aliases}}{{println .}}{{end}}{{end}}" 2>$null

if ($existingAliases -contains $hiveHostname) {
    Write-Host "[OK] Alias already present — nothing to do." -ForegroundColor Green
} else {
    # The container is already ON this network, so it must be disconnected
    # before it can be reconnected with the extra alias.
    docker network disconnect $hiveNetwork $hiveNginx 2>$null | Out-Null
    docker network connect --alias $hiveHostname $hiveNetwork $hiveNginx
    if ($LASTEXITCODE -ne 0) { Stop-WithError "Failed to add the network alias." }
    Write-Host "[OK] Alias added." -ForegroundColor Green
}

Write-Host "`n>> Bringing Bluz up with the co-located Hive overlay..." -ForegroundColor Blue
$env:HIVE_NETWORK_NAME = $hiveNetwork
$deployDir = Join-Path $PSScriptRoot "..\deploy"
$hiveOverlay = Join-Path $deployDir "docker-compose.hive-local.yml"
# Keep whatever overlays the running stack was started with (e.g. docker:dev's
# dev overlay); dropping them recreates ui in the wrong mode.
$runningFiles = docker inspect bluz-ui --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' 2>$null
$composeFiles = if ($LASTEXITCODE -eq 0 -and $runningFiles) { $runningFiles -split "," } else { @(Join-Path $deployDir "docker-compose.yml") }
if (-not ($composeFiles | Where-Object { $_ -like "*docker-compose.hive-local.yml" })) { $composeFiles += $hiveOverlay }
$composeArgs = $composeFiles | ForEach-Object { "-f"; $_ }
docker compose --env-file (Join-Path $PSScriptRoot "..\.env") @composeArgs up -d
if ($LASTEXITCODE -ne 0) { Stop-WithError "docker compose up failed." }

Write-Host "`n=========================================" -ForegroundColor Green
Write-Host " Bluz is linked to the local Hive stack. " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host "Verify name resolution from inside the ui container:"
Write-Host "    docker exec bluz-ui node -e `"require('dns').lookup('$hiveHostname',console.log)`""
