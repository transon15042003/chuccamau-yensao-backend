$ErrorActionPreference = 'Continue'
try {
  & 'C:\Users\trans\OneDrive\Desktop\GitHub\chuccamau-yensao-backend\scripts\bootstrap-medusa-db.ps1' *>&1 | Tee-Object -FilePath 'C:\Users\trans\OneDrive\Desktop\GitHub\chuccamau-yensao-backend\scripts\bootstrap-medusa-db.out.txt'
  if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  'DONE' | Set-Content -Path 'C:\Users\trans\OneDrive\Desktop\GitHub\chuccamau-yensao-backend\scripts\bootstrap-medusa-db.done'
  exit 0
} catch {
  $_ | Out-String | Tee-Object -FilePath 'C:\Users\trans\OneDrive\Desktop\GitHub\chuccamau-yensao-backend\scripts\bootstrap-medusa-db.out.txt'
  exit 1
}
