@echo off
SETLOCAL EnableDelayedExpansion
TITLE WAAI Bot Dashboard
echo ========================================
echo   Starting WAAI Bot in Production Mode
echo ========================================

IF NOT DEFINED APP_MODE (
    SET APP_MODE=release
)
SET NODE_ENV=production

echo Mode: %APP_MODE%
echo.

npm run prod
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Application failed to start.
    echo Please check the error messages above.
)
echo.
pause
