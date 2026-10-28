@echo off
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  echo Starting Student Launchpad at http://localhost:5173 ...
  start "" http://localhost:5173
  node serve.js
) else (
  echo Node.js was not found, opening the app directly instead.
  start "" "%~dp0index.html"
  pause
)
