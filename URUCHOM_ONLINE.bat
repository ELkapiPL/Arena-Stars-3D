@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "Arena Stars 3D - serwer" cmd /k py -3 server.py
) else (
  start "Arena Stars 3D - serwer" cmd /k python server.py
)
timeout /t 2 /nobreak >nul
start "" http://localhost:8000
