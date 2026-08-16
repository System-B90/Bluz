<#
.SYNOPSIS
    Bluz Windows backup — the PowerShell counterpart to bluz-backup.sh.

.DESCRIPTION
    Dumps both Bluz stateful engines (Postgres via pg_dump, MongoDB via
    mongodump) through `docker compose exec` and prunes old dumps into a
    daily/weekly tiered retention scheme, mirroring bluz-backup.sh (#439).

.EXAMPLE
    .\bluz-backup.ps1

.EXAMPLE
    .\bluz-backup.ps1 -Destination D:\bluz-backups

.NOTES
    Env:  BLUZ_BACKUP_DIR   destination root (default $env:ProgramData\bluz\backups)
          BLUZ_KEEP_DAILY   daily dumps to retain (default 14)
          BLUZ_KEEP_WEEKLY  weekly dumps to retain (default 8)
          BLUZ_COMPOSE_FILE compose file (default alongside this script)
          BLUZ_ENV_FILE     env file (default: the .env beside the compose file)

    Task Scheduler registration (daily at 02:30, equivalent to bluz-backup.timer):

        $action    = New-ScheduledTaskAction -Execute "pwsh.exe" `
            -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\bluz\deploy\backup\bluz-backup.ps1`""
        $trigger   = New-ScheduledTaskTrigger -Daily -At 2:30AM
        $settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        Register-ScheduledTask -TaskName "Bluz Nightly Backup" -Action $action -Trigger $trigger `
            -Settings $settings -Principal $principal -Description "Bluz database backup (Postgres + MongoDB)"
#>

#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Destination
)

$ErrorActionPreference = "Stop"

function Write-Log($msg) { Write-Host "[bluz-backup] $msg" }

function Stop-WithError {
    param([string]$Message)
    Write-Host "[bluz-backup] FATAL: $Message" -ForegroundColor Red
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = if ($env:BLUZ_COMPOSE_FILE) { $env:BLUZ_COMPOSE_FILE } else { Join-Path $ScriptDir "..\docker-compose.yml" }

# Find the .env holding the database credentials. Mirrors resolve_env_file()
# in bluz-backup.sh: two layouts (repo checkout vs. release bundle), .env
# beside the compose file is authoritative because Compose itself requires it
# there. (Duplicated verbatim in bluz-restore.ps1 — see #226.)
function Resolve-EnvFile {
    $candidates = @(
        $env:BLUZ_ENV_FILE,
        (Join-Path (Split-Path -Parent $ComposeFile) ".env"),
        (Join-Path $ScriptDir "..\.env"),
        (Join-Path $ScriptDir "..\..\.env")
    )
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) { return (Resolve-Path $candidate).Path }
    }
    Stop-WithError "no .env found (looked beside $ComposeFile, and above $ScriptDir). Point at it explicitly: `$env:BLUZ_ENV_FILE = 'C:\path\to\.env'"
}

function Import-DotEnv([string]$Path) {
    $map = @{}
    foreach ($line in Get-Content $Path) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $key, $value = $line -split '=', 2
        $map[$key.Trim()] = $value.Trim().Trim('"')
    }
    return $map
}

function Assert-EnvKeys([hashtable]$EnvMap, [string[]]$Names) {
    $missing = $Names | Where-Object { -not $EnvMap.ContainsKey($_) -or -not $EnvMap[$_] }
    if ($missing) {
        Stop-WithError "$($missing -join ', ') not set in $EnvFile."
    }
}

$DestRoot   = if ($Destination) { $Destination } elseif ($env:BLUZ_BACKUP_DIR) { $env:BLUZ_BACKUP_DIR } else { Join-Path $env:ProgramData "bluz\backups" }
$KeepDaily  = if ($env:BLUZ_KEEP_DAILY)  { [int]$env:BLUZ_KEEP_DAILY }  else { 14 }
$KeepWeekly = if ($env:BLUZ_KEEP_WEEKLY) { [int]$env:BLUZ_KEEP_WEEKLY } else { 8 }

$EnvFile = Resolve-EnvFile
$EnvMap = Import-DotEnv $EnvFile
Assert-EnvKeys $EnvMap @("POSTGRES_USER", "POSTGRES_DB", "MONGO_ROOT_USER", "MONGO_ROOT_PASSWORD")

$Stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")
# Sunday dumps go to the weekly tier, everything else to the daily tier —
# same split as bluz-backup.sh, so the two scripts' retention stays compatible.
$Tier = if ((Get-Date).ToUniversalTime().DayOfWeek -eq [DayOfWeek]::Sunday) { "weekly" } else { "daily" }

$OutDir = Join-Path (Join-Path $DestRoot $Tier) $Stamp
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$PgDumpPath = Join-Path $OutDir "postgres.dump"
$MongoDumpPath = Join-Path $OutDir "mongodb.archive.gz"

# PowerShell's own pipeline/`>` redirection decodes external-command output as
# text, which corrupts binary dumps. Shell out to cmd.exe for byte-safe `>`
# redirection instead (same trick bluz-restore.ps1 needs in reverse).
function Invoke-ComposeToFile([string[]]$ComposeArgs, [string]$OutFile) {
    $argLine = ($ComposeArgs | ForEach-Object { '"' + $_ + '"' }) -join ' '
    $cmdLine = "docker compose -f `"$ComposeFile`" $argLine > `"$OutFile`""
    cmd.exe /c $cmdLine
    if ($LASTEXITCODE -ne 0) { Stop-WithError "$($ComposeArgs -join ' ') failed (exit $LASTEXITCODE)." }
}

Write-Log "dumping postgres -> $PgDumpPath"
# Custom format (-Fc): compressed, and restorable selectively with pg_restore.
Invoke-ComposeToFile @(
    "exec", "-T", "curriculum-db",
    "pg_dump", "-U", $EnvMap["POSTGRES_USER"], "-d", $EnvMap["POSTGRES_DB"], "-Fc"
) $PgDumpPath

Write-Log "dumping mongodb -> $MongoDumpPath"
Invoke-ComposeToFile @(
    "exec", "-T", "mongodb",
    "mongodump", "--username", $EnvMap["MONGO_ROOT_USER"], "--password", $EnvMap["MONGO_ROOT_PASSWORD"],
    "--authenticationDatabase", "admin", "--archive", "--gzip"
) $MongoDumpPath

# A zero-byte dump means the pipe failed while the exit status still looked
# clean; catch it here rather than at restore time.
foreach ($f in @($PgDumpPath, $MongoDumpPath)) {
    if ((Get-Item $f).Length -eq 0) { Stop-WithError "$f is empty" }
}

$hashLines = foreach ($f in @($PgDumpPath, $MongoDumpPath)) {
    $hash = (Get-FileHash -Path $f -Algorithm SHA256).Hash.ToLower()
    "$hash  $(Split-Path -Leaf $f)"
}
Set-Content -Path (Join-Path $OutDir "SHA256SUMS") -Value $hashLines -Encoding ASCII

$sizeMb = [math]::Round(((Get-ChildItem $OutDir | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
Write-Log "wrote ${sizeMb}MB to $OutDir"

function Remove-OldDumps([string]$Tier, [int]$Keep) {
    $dir = Join-Path $DestRoot $Tier
    if (-not (Test-Path $dir)) { return }
    # Timestamped directory names sort lexicographically, so "all but the
    # newest N" is just a tail of the descending sort.
    $dirs = Get-ChildItem -Path $dir -Directory | Sort-Object Name -Descending
    $stale = $dirs | Select-Object -Skip $Keep
    foreach ($old in $stale) {
        Write-Log "pruning $Tier $($old.FullName)"
        Remove-Item -Recurse -Force $old.FullName
    }
}

Remove-OldDumps -Tier "daily" -Keep $KeepDaily
Remove-OldDumps -Tier "weekly" -Keep $KeepWeekly

Write-Log "done"
