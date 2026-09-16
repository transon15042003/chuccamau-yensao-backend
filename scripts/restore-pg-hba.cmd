@echo off
copy /Y "C:\Program Files\PostgreSQL\18\data\pg_hba.conf.bak-medusa-20260913215154" "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" reload -D "C:\Program Files\PostgreSQL\18\data"
echo RESTORED > "%~dp0restore-pg-hba.done"
