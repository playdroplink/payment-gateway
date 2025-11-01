#!/bin/bash
# Bash script to start development servers
# Run with: ./start-dev.sh

echo "Starting Quantum Pay Development Servers..."

# Check if node_modules exist
if [ ! -d "backend/node_modules" ]; then
    echo "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
fi

# Check if concurrently is installed
if [ ! -d "node_modules/concurrently" ]; then
    echo "Installing concurrently..."
    npm install concurrently --save-dev
fi

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "Warning: backend/.env file not found!"
    if [ -f "backend/.env.example" ]; then
        echo "Creating backend/.env from .env.example..."
        cp backend/.env.example backend/.env
        echo "Please edit backend/.env and add your PI_API_KEY"
    fi
fi

echo ""
echo "Starting servers..."
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start both servers
npm run dev

