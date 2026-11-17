<#
  Publishes dsh-purge-pro to npm and prints the resulting dist-tags.

  Example:
    .\publish.ps1
    .\publish.ps1 -Otp 123456
#>
param(
  [string]$Otp,
  [string]$Registry = 'https://registry.npmjs.org',
  [string]$UserConfig = 'C:\Users\songzhiwei\.npmrc'
)

$ErrorActionPreference = 'Stop'
$repo = Join-Path $PSScriptRoot '.'
Set-Location $repo

$version = (Get-Content -LiteralPath (Join-Path $repo 'package.json') -Raw | ConvertFrom-Json).version
Write-Host "publishing dsh-purge-pro@$version to $Registry"

$notesHead = (Get-Content -LiteralPath (Join-Path $repo 'release-notes.md') -TotalCount 1).Trim()
if ($notesHead -ne "# $version") {
  Write-Host "release-notes.md 第一行必须是 # $version，现在是: $notesHead" -ForegroundColor Red
  exit 1
}

$npmArgs = @('publish', "--registry=$Registry", "--userconfig=$UserConfig")
if ($Otp -ne '') { $npmArgs += "--otp=$Otp" }

& npm @npmArgs
if ($LASTEXITCODE -ne 0) {
  Write-Host "publish failed with exit code $LASTEXITCODE (PUT 404 + whoami 401 means the token expired)" -ForegroundColor Red
  exit $LASTEXITCODE
}

& npm view dsh-purge-pro dist-tags --registry=$Registry --userconfig=$UserConfig 2>&1 | Out-String | Write-Host
Write-Host "published $version" -ForegroundColor Green
