@echo off
echo Building ScaenaHub v2 for production...

echo.
echo Building Backend...
cd backend
call npm run build
if %errorlevel% neq 0 (
    echo Backend build failed!
    pause
    exit /b 1
)

echo.
echo Building Frontend...
cd ../frontend
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed!
    pause
    exit /b 1
)

echo.
echo Build completed successfully!
echo Backend build: backend/dist/
echo Frontend build: frontend/dist/
echo.
pause