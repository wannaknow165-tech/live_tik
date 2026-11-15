@echo off
setlocal
cd /d "%~dp0.."
echo BOOSTERA V11 - unified private local studio
echo URL: http://127.0.0.1:4206/
powershell.exe -NoProfile -Command "if(Get-NetTCPConnection -State Listen -LocalPort 4206 -ErrorAction SilentlyContinue){exit 0}else{exit 1}"
if %errorlevel% neq 0 (
  start "BOOSTERA V11 SERVER" cmd.exe /k "set NODE_ENV=production&& set BOOSTERA_BIND_HOST=127.0.0.1&& set BOOSTERA_GEMINI_AUTORUN=0&& set BOOSTERA_GLOBAL_SCOUT_AUTORUN=0&& set PORT=4206&& node --import tsx server.ts"
  timeout /t 4 /nobreak >nul
)
start "" "http://127.0.0.1:4206/"
echo Done. Server listens only on the local computer.
