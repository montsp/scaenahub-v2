@echo off
echo Starting ScaenaHub v2...

echo.
echo Starting Backend Server...
cd backend
start "Backend" cmd /k "npm run dev"

echo.
echo Starting Frontend Server...
cd ../frontend
start "Frontend" cmd /k "npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit...
pause > nul