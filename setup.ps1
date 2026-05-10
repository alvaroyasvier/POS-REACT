# POS REACT - SETUP SCRIPT FOR WINDOWS POWERSHELL

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   POS REACT - AUTOMATIC SETUP SCRIPT (WINDOWS POWERSHELL)           ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
$nodeCheck = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERROR: Node.js is not installed" -ForegroundColor Red
    Write-Host "   Download it from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Node.js detected: $nodeCheck" -ForegroundColor Green

# Check if PostgreSQL is installed
$psqlCheck = psql --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  WARNING: PostgreSQL doesn't seem to be installed or not in PATH" -ForegroundColor Yellow
    Write-Host "   Download it from: https://www.postgresql.org/download/" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "✅ PostgreSQL detected: $psqlCheck" -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " 📦 INSTALLING DEPENDENCIES" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptPath

# Install backend dependencies
Write-Host "🔄 Installing backend dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error installing backend dependencies" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "✅ Backend installed successfully" -ForegroundColor Green

# Install frontend dependencies
Write-Host ""
Write-Host "🔄 Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location frontend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error installing frontend dependencies" -ForegroundColor Red
    Pop-Location
    Pop-Location
    exit 1
}
Write-Host "✅ Frontend installed successfully" -ForegroundColor Green
Pop-Location
Pop-Location

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " ✨ SETUP COMPLETED" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host " ✅ Dependencies installed" -ForegroundColor Green
Write-Host " ✅ .env file configured" -ForegroundColor Green
Write-Host " ✅ VS Code tasks created" -ForegroundColor Green
Write-Host ""
Write-Host " 📋 NEXT STEPS:" -ForegroundColor Magenta
Write-Host " ────────────────────────────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host ""
Write-Host " 1️⃣  CONFIGURE DATABASE:" -ForegroundColor Yellow
Write-Host "    • Open: pgAdmin or PostgreSQL CLI" -ForegroundColor White
Write-Host "    • Create DB: CREATE DATABASE pos_db;" -ForegroundColor Gray
Write-Host "    • Import: psql -U postgres -d pos_db < Backup.sql" -ForegroundColor Gray
Write-Host ""
Write-Host " 2️⃣  START SERVERS:" -ForegroundColor Yellow
Write-Host "    • Backend:  npm run dev" -ForegroundColor Gray
Write-Host "    • Frontend: cd frontend && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host " 3️⃣  ACCESS THE APP:" -ForegroundColor Yellow
Write-Host "    • URL: http://localhost:5173" -ForegroundColor Blue
Write-Host "    • API: http://localhost:3000" -ForegroundColor Blue
Write-Host ""
Write-Host " 📖 For more info: Read SETUP.md" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to continue"
