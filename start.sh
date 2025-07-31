#!/bin/bash

echo "Starting ScaenaHub v2..."

echo ""
echo "Starting Backend Server..."
cd backend
gnome-terminal --title="Backend" -- bash -c "npm run dev; exec bash" &

echo ""
echo "Starting Frontend Server..."
cd ../frontend
gnome-terminal --title="Frontend" -- bash -c "npm run dev; exec bash" &

echo ""
echo "Both servers are starting..."
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to exit..."

# Keep the script running
while true; do
    sleep 1
done