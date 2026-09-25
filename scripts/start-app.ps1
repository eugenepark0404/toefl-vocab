# Starts the vocabulary app and opens it in the browser.
#
# Meant to be launched by double-clicking start-app.bat (or its desktop
# shortcut), not from a terminal. Closing the window it runs in stops the app.

# Deliberately NOT 'Stop'. npm and next write ordinary progress output to
# stderr, and Windows PowerShell turns that into a terminating error when
# ErrorActionPreference is 'Stop' - which killed this script mid-build, with
# the window closing before the message could be read. Exit codes are checked
# explicitly instead.
$ErrorActionPreference = 'Continue'

# The project root is one level up from this script.
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$port = 3000
$url = "http://localhost:$port"

function Test-AppResponding {
    try {
        Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Stop-WithMessage($message) {
    Write-Host ''
    Write-Host $message -ForegroundColor Red
    Write-Host ''
    Read-Host 'Press Enter to close'
    exit 1
}

# Already running - probably a second double-click. Just show it.
if (Test-AppResponding) {
    Write-Host 'The app is already running. Opening it.' -ForegroundColor Green
    Start-Process $url
    Start-Sleep -Seconds 2
    exit 0
}

if (-not (Test-Path 'node_modules')) {
    Write-Host 'Installing dependencies. This happens once and takes a few minutes.' -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'Could not install dependencies.' }
}

# BUILD_ID only exists after a successful production build.
if (-not (Test-Path '.next\BUILD_ID')) {
    Write-Host 'Preparing the app. This happens once and takes about a minute.' -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        # A stale .next directory is the usual cause, and OneDrive-synced
        # folders provoke it. Clearing it and retrying fixes that case.
        Write-Host 'Retrying with a clean cache...' -ForegroundColor Yellow
        Remove-Item -Recurse -Force '.next' -ErrorAction SilentlyContinue
        npm run build
        if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'Could not prepare the app.' }
    }
}

# Open the browser once the server answers, without blocking the server itself.
Start-Job -ScriptBlock {
    param($u)
    for ($i = 0; $i -lt 60; $i++) {
        try {
            Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2 | Out-Null
            Start-Process $u
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }
} -ArgumentList $url | Out-Null

Write-Host ''
Write-Host '  TOEFL vocabulary trainer' -ForegroundColor Cyan
Write-Host "  $url"
Write-Host ''
Write-Host '  The browser will open in a moment.'
Write-Host '  Close this window to stop the app.' -ForegroundColor DarkGray
Write-Host ''

# Run in the foreground so closing this window also stops the server.
& '.\node_modules\.bin\next.cmd' start -p $port

# Only reached if the server exits on its own, which means something is wrong.
if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "The server stopped unexpectedly (exit code $LASTEXITCODE)."
}
