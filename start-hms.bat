@echo off
title Grand Aurelia HMS
color 0E

echo ============================================
echo   Grand Aurelia Hotel Management System
echo ============================================
echo.
echo   1) Start everything  (API + Management Suite)
echo   2) Start API server only (port 4010)
echo   3) Reset demo data   (node seed.js --reset)
echo   4) Exit
echo.
choice /c 1234 /n /m "Choose an option: "

if errorlevel 4 exit /b 0
if errorlevel 3 (
  cd /d "%~dp0server"
  node seed.js --reset
  echo Demo data re-seeded. Dates are relative to today.
  pause
  exit /b 0
)
if errorlevel 2 (
  cd /d "%~dp0server"
  echo API on http://localhost:4010  (Ctrl+C to stop)
  node index.js
  exit /b 0
)

REM --- option 1: start both ---
cd /d "%~dp0server"
start "GA HMS API (4010)" cmd /k node index.js
cd /d "%~dp0client"
echo Management suite: http://localhost:5173  (Ctrl+C in this window to stop)
npx --yes npm@10 run dev
