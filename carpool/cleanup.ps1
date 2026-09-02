<#
  Cleanup helper - run locally to remove development artifacts.
  It will prompt before deleting.
  Usage: .\cleanup.ps1
#>

Write-Host "Cleanup helper for CarPool project" -ForegroundColor Cyan

$toRemove = @(
  "**\*.log",
  "**\*.tmp",
  "uploads\*",
  "node_modules\npm-debug.log"
)

foreach ($pattern in $toRemove) {
  Write-Host "Pattern: $pattern"
}

$confirm = Read-Host "Proceed to delete these patterns from the repository working tree? (y/N)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
  Write-Host "Aborted cleanup"
  exit 0
}

foreach ($pattern in $toRemove) {
  Write-Host "Removing matches for: $pattern"
  Get-ChildItem -Path . -Recurse -Include $pattern -File -ErrorAction SilentlyContinue | ForEach-Object {
    try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop; Write-Host "Deleted: $($_.FullName)" } catch { Write-Host "Failed: $($_.FullName)" }
  }
}

Write-Host "Cleanup completed"
