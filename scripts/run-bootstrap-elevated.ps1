$ErrorActionPreference = 'Continue'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
# Script lives in repo/scripts — repo root is parent of scripts
$repo = Split-Path $PSScriptRoot -Parent
$boot = Join-Path $PSScriptRoot 'bootstrap-medusa-db.ps1'
$out = Join-Path $PSScriptRoot 'bootstrap-medusa-db.out.txt'
$marker = Join-Path $PSScriptRoot 'bootstrap-medusa-db.done'

Remove-Item $out, $marker -ErrorAction SilentlyContinue

$inner = @"
`$ErrorActionPreference = 'Continue'
try {
  & '$boot' *>&1 | Tee-Object -FilePath '$out'
  if (`$LASTEXITCODE -ne `$null -and `$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }
  'DONE' | Set-Content -Path '$marker'
  exit 0
} catch {
  `$_ | Out-String | Tee-Object -FilePath '$out'
  exit 1
}
"@

$innerFile = Join-Path $PSScriptRoot 'bootstrap-medusa-db-elevated.ps1'
Set-Content -Path $innerFile -Value $inner -Encoding UTF8

$p = Start-Process -FilePath powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $innerFile
)
"launcher_exit=$($p.ExitCode)" | Tee-Object -FilePath $out -Append
exit $p.ExitCode
