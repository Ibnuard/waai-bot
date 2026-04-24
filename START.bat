@echo off
TITLE WAAI Bot Dashboard
echo Starting WAAI Bot in Production Mode...
IF NOT DEFINED APP_MODE (
    SET APP_MODE=release
)
echo Mode: %APP_MODE%
npm run prod
pause
