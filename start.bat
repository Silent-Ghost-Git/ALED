@echo off
REM ============================================
REM My Study Dashboard - Starter
REM ============================================
REM Double-click this file to start!
REM ============================================

cd /d "%~dp0"

echo ==========================================
echo   My Study Dashboard
echo ==========================================
echo.
echo Starting server...
echo.

REM Kill any existing server on port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Start custom API server in new window
start "My Study Dashboard Server" cmd /c "python server.py && echo Server stopped && pause"

REM Wait for server
timeout /t 2 /nobreak >nul

REM Open browser
start http://localhost:8000

echo.
echo Dashboard should be open now!
echo.
echo When done, close this window or press any key to stop...
echo.
pause >nul

REM Clean up
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Server stopped. Bye!
timeout /t 2 /nobreak >nul
