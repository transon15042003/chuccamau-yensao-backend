# Requires elevation. Creates medusa role/db then restores pg_hba.
$ErrorActionPreference = 'Stop'
$hba = 'C:\Program Files\PostgreSQL\18\data\pg_hba.conf'
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$pgCtl = 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'
$dataDir = 'C:\Program Files\PostgreSQL\18\data'
$backup = "$hba.bak-medusa-$(Get-Date -Format yyyyMMddHHmmss)"

Copy-Item $hba $backup -Force
$original = Get-Content $hba -Raw

# Prefer trust for local TCP during bootstrap
$boot = @"
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
local   replication     all                                     trust
host    replication     all             127.0.0.1/32            trust
host    replication     all             ::1/128                 trust
"@
Set-Content -Path $hba -Value $boot -Encoding ascii

& $pgCtl reload -D $dataDir | Out-Host

$sql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'medusa') THEN
    CREATE ROLE medusa LOGIN PASSWORD 'medusa' CREATEDB;
  ELSE
    ALTER ROLE medusa WITH LOGIN PASSWORD 'medusa' CREATEDB;
  END IF;
END
`$`$;
SELECT 'role_ok' AS status;
"@

& $psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -v ON_ERROR_STOP=1 -c $sql | Out-Host

$dbExists = & $psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='medusa'"
if (-not $dbExists.Trim()) {
  & $psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE medusa OWNER medusa;" | Out-Host
} else {
  & $psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -c "ALTER DATABASE medusa OWNER TO medusa;" | Out-Host
}

# Restore original hba
Set-Content -Path $hba -Value $original -Encoding ascii
& $pgCtl reload -D $dataDir | Out-Host

Write-Output "SUCCESS backup=$backup"
