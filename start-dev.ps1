# PowerShell script to start development servers
# Run with: .\start-dev.ps1

Write-Host "Starting Quantum Pay Development Servers..." -ForegroundColor Green

# Check if node_modules exist
if (-not (Test-Path "backend\node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location backend
    npm install
    Set-Location ..
}

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location frontend
    npm install
    Set-Location ..
}

# Check if concurrently is installed
if (-not (Test-Path "node_modules\concurrently")) {
    Write-Host "Installing concurrently..." -ForegroundColor Yellow
    npm install concurrently --save-dev
}

# Check if .env exists
if (-not (Test-Path "backend\.env")) {
    Write-Host "Warning: backend\.env file not found!" -ForegroundColor Red
    Write-Host "Creating backend\.env from .env.example..." -ForegroundColor Yellow
    if (Test-Path "backend\.env.example") {
        Copy-Item "backend\.env.example" "backend\.env"
        Write-Host "Please edit backend\.env and add your PI_API_KEY" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Starting servers..." -ForegroundColor Green
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Magenta
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host ""

# Start both servers
npm run dev

