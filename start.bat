@echo off
title NBFC RiskOS - Launching...
color 0A

echo.
echo  ==========================================
echo   NBFC RiskOS - AI Loan Default Platform
echo  ==========================================
echo.
echo  Starting backend and frontend servers...
echo  Please wait - this may take 15-30 seconds.
echo.

:: Navigate to project root (works whether launched by double-click or shortcut)
cd /d "%~dp0"

:: ---- Start Backend ----
echo  [1/3] Starting FastAPI backend on port 8000...
start "NBFC Backend (port 8000)" cmd /k "cd /d "%~dp0backend" && call .venv\Scripts\activate.bat && python -m uvicorn app.main:app --reload --port 8000"

:: Wait for backend to initialise
timeout /t 6 /nobreak >nul

:: ---- Start Frontend ----
echo  [2/3] Starting Next.js frontend on port 3000...
start "NBFC Frontend (port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: Wait for frontend to compile
timeout /t 10 /nobreak >nul

:: ---- Open Browser ----
echo  [3/3] Opening portal in your default browser...
start http://localhost:3000

echo.
echo  ==========================================
echo   Platform is running!
echo.
echo   Portal  ->  http://localhost:3000
echo   API     ->  http://localhost:8000/docs
echo.
echo   Login credentials (all use password123):
echo     Lender  ->  analyst@demo.local
echo     Auditor ->  compliance@demo.local
echo     Admin   ->  admin@demo.local
echo  ==========================================
echo.
echo  Close this window at any time.
echo  To stop servers, close the two terminal windows.
pause
