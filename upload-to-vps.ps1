# Uploads a data file to the VPS's data folder.
# Usage:
#   .\upload-to-vps.ps1 -LocalFile "C:\path\to\weekly-sales.xlsx"
#   .\upload-to-vps.ps1 -LocalFile "C:\path\to\weekly-sales.xlsx" -Import weekly
#
# -Import is optional: "weekly" or "monthly" -- if given, runs the matching
# import command on the VPS right after the file lands, so it's a single
# command instead of upload-then-ssh-then-import.

param(
    [Parameter(Mandatory=$true)]
    [string]$LocalFile,

    [Parameter(Mandatory=$false)]
    [ValidateSet("weekly", "monthly", "none")]
    [string]$Import = "none"
)

$VpsHost = "root@srv808469.hstgr.cloud"
$RemoteDir = "~/tools/gingin-forcasting/data"
$RemoteProjectDir = "~/tools/gingin-forcasting"

if (-not (Test-Path $LocalFile)) {
    Write-Host "File not found: $LocalFile" -ForegroundColor Red
    exit 1
}

$FileName = Split-Path $LocalFile -Leaf
Write-Host "Uploading $FileName to the VPS..." -ForegroundColor Cyan

scp "$LocalFile" "${VpsHost}:${RemoteDir}/${FileName}"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Upload failed -- check the connection/path above before retrying." -ForegroundColor Red
    exit 1
}

Write-Host "Upload succeeded: $FileName" -ForegroundColor Green

if ($Import -ne "none") {
    Write-Host "Running import:$Import on the VPS..." -ForegroundColor Cyan
    ssh $VpsHost "cd $RemoteProjectDir && docker compose -f docker-compose.prod.yml run --rm migrate npm run import:$Import"

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Import finished." -ForegroundColor Green
    } else {
        Write-Host "Import command failed -- check the output above." -ForegroundColor Red
        exit 1
    }
}
