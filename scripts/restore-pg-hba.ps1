$ErrorActionPreference = 'Stop'
$hba = 'C:\Program Files\PostgreSQL\18\data\pg_hba.conf'
$backup = 'C:\Program Files\PostgreSQL\18\data\pg_hba.conf.bak-medusa-20260913215154'
$pgCtl = 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'
$dataDir = 'C:\Program Files\PostgreSQL\18\data'
Copy-Item $backup $hba -Force
& $pgCtl reload -D $dataDir
Write-Output 'RESTORED'
