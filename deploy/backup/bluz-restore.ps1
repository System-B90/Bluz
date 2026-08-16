<#
.SYNOPSIS
    Bluz Windows restore — the PowerShell counterpart to bluz-restore.sh.

.DESCRIPTION
    Restores a dump directory produced by bluz-backup.ps1 (or bluz-backup.sh)
    into the running stack. Destructive: it drops and recreates the target
    databases (#439).

.EXAMPLE
    .\bluz-restore.ps1 C:\ProgramData\bluz\backups\daily\2026-08-16T02-30-00Z

.EXAMPLE
    .\bluz-restore.ps1 .\daily\2026-08-16T02-30-00Z -Yes -PostgresOnly

.NOTES
    Env:  BLUZ_COMPOSE_FILE  compose file (default alongside this script)
          BLUZ_ENV_FILE      env file (default: the .env beside the compose file)
#>

#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$DumpDir,

    [switch]$Yes,
    [switch]$PostgresOnly,
    [switch]$MongoOnly
)

$ErrorActionPreference = "Stop"

function Write-Log($msg) { Write-Host "[bluz-restore] $msg" }

function Stop-WithError {
    param([string]$Message)
    Write-Host "[bluz-restore] FATAL: $Message" -ForegroundColor Red
    exit 1
}

if ($PostgresOnly -and $MongoOnly) {
    Stop-WithError "-PostgresOnly and -MongoOnly are mutually exclusive."
}
$DoPg = -not $MongoOnly
$DoMongo = -not $PostgresOnly

if (-not (Test-Path $DumpDir -PathType Container)) {
    Stop-WithError "dump directory not found: $DumpDir`nUsage: .\bluz-restore.ps1 <dump-dir> [-Yes] [-PostgresOnly | -MongoOnly]"
}
$DumpDir = (Resolve-Path $DumpDir).Path

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = if ($env:BLUZ_COMPOSE_FILE) { $env:BLUZ_COMPOSE_FILE } else { Join-Path $ScriptDir "..\docker-compose.yml" }

# Find the .env holding the database credentials. Mirrors resolve_env_file()
# in bluz-restore.sh. (Duplicated verbatim in bluz-backup.ps1 — see #226.)
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

$EnvFile = Resolve-EnvFile
$EnvMap = Import-DotEnv $EnvFile
Assert-EnvKeys $EnvMap @("POSTGRES_USER", "POSTGRES_DB", "MONGO_ROOT_USER", "MONGO_ROOT_PASSWORD")

$ChecksumFile = Join-Path $DumpDir "SHA256SUMS"
if (Test-Path $ChecksumFile) {
    Write-Log "verifying checksums"
    foreach ($line in Get-Content $ChecksumFile) {
        if ($line -match '^SHA256SUMS\b' -or -not $line.Trim()) { continue }
        $expected, $name = $line -split '\s+', 2
        $name = $name.Trim()
        $target = Join-Path $DumpDir $name
        if (-not (Test-Path $target)) { Stop-WithError "checksum listed for missing file: $name" }
        $actual = (Get-FileHash -Path $target -Algorithm SHA256).Hash.ToLower()
        if ($actual -ne $expected.ToLower()) {
            Stop-WithError "checksum mismatch for $name (expected $expected, got $actual)"
        }
    }
}

if (-not $Yes) {
    Write-Host "This DESTROYS the current contents of the target databases."
    $confirm = Read-Host "Type RESTORE to continue"
    if ($confirm -ne "RESTORE") { Write-Log "aborted"; exit 1 }
}

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ComposeArgs)
    & docker compose -f $ComposeFile @ComposeArgs
    if ($LASTEXITCODE -ne 0) { Stop-WithError "docker compose $($ComposeArgs -join ' ') failed (exit $LASTEXITCODE)." }
}

# PowerShell's own pipeline/`<` input redirection decodes files as text, which
# corrupts binary dumps on the way in. Shell out to cmd.exe for byte-safe `<`
# redirection instead (mirrors bluz-backup.ps1's `>` trick).
function Invoke-ComposeFromFile([string[]]$ComposeArgs, [string]$InFile) {
    $argLine = ($ComposeArgs | ForEach-Object { '"' + $_ + '"' }) -join ' '
    $cmdLine = "docker compose -f `"$ComposeFile`" $argLine < `"$InFile`""
    cmd.exe /c $cmdLine
    if ($LASTEXITCODE -ne 0) { Stop-WithError "$($ComposeArgs -join ' ') failed (exit $LASTEXITCODE)." }
}

# The app holds open connections and would both block the DROP and write to a
# half-restored database.
Write-Log "stopping app containers"
try { Invoke-Compose "stop" "ui" "sessions" } catch { }

if ($DoPg) {
    Write-Log "restoring postgres"
    Invoke-Compose "exec" "-T" "curriculum-db" `
        "psql" "-U" $EnvMap["POSTGRES_USER"] "-d" "postgres" `
        "-c" "DROP DATABASE IF EXISTS `"$($EnvMap['POSTGRES_DB'])`" WITH (FORCE);" `
        "-c" "CREATE DATABASE `"$($EnvMap['POSTGRES_DB'])`" OWNER `"$($EnvMap['POSTGRES_USER'])`";"

    Invoke-ComposeFromFile @(
        "exec", "-T", "curriculum-db",
        "pg_restore", "-U", $EnvMap["POSTGRES_USER"], "-d", $EnvMap["POSTGRES_DB"], "--no-owner"
    ) (Join-Path $DumpDir "postgres.dump")
}

if ($DoMongo) {
    Write-Log "restoring mongodb"
    Invoke-ComposeFromFile @(
        "exec", "-T", "mongodb",
        "mongorestore", "--username", $EnvMap["MONGO_ROOT_USER"], "--password", $EnvMap["MONGO_ROOT_PASSWORD"],
        "--authenticationDatabase", "admin", "--archive", "--gzip", "--drop"
    ) (Join-Path $DumpDir "mongodb.archive.gz")
}

Write-Log "starting app containers"
try { Invoke-Compose "start" "sessions" "ui" } catch { }

Write-Log "done"
