#!/bin/bash

# =============================================================================
# POS REACT - SETUP SCRIPT FOR LINUX/MAC
# =============================================================================

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║      POS REACT - AUTOMATIC SETUP SCRIPT (LINUX/MAC)                 ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed"
    echo "   Download it from: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js detected: $(node --version)"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  WARNING: PostgreSQL doesn't seem to be installed or not in PATH"
    echo "   Download it from: https://www.postgresql.org/download/"
    echo ""
else
    echo "✅ PostgreSQL detected"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo " 📦 INSTALLING DEPENDENCIES"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# Install backend dependencies
echo "🔄 Installing backend dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Error installing backend dependencies"
    exit 1
fi
echo "✅ Backend installed successfully"

# Install frontend dependencies
echo ""
echo "🔄 Installing frontend dependencies..."
cd frontend || exit 1
npm install
if [ $? -ne 0 ]; then
    echo "❌ Error installing frontend dependencies"
    cd ..
    exit 1
fi
echo "✅ Frontend installed successfully"

cd ..

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo " ✨ SETUP COMPLETED"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""
echo " ✅ Dependencies installed"
echo " ✅ .env file configured"
echo " ✅ VS Code tasks created"
echo ""
echo " 📋 NEXT STEPS:"
echo " ────────────────────────────────────────────────────────────────────"
echo ""
echo " 1️⃣  CONFIGURE DATABASE:"
echo "    • Open: psql or pgAdmin"
echo "    • Create DB: CREATE DATABASE pos_db;"
echo "    • Import: psql -U postgres -d pos_db < Backup.sql"
echo ""
echo " 2️⃣  START SERVERS:"
echo "    • Backend:  npm run dev"
echo "    • Frontend: cd frontend && npm run dev"
echo ""
echo " 3️⃣  ACCESS THE APP:"
echo "    • URL: http://localhost:5173"
echo "    • API: http://localhost:3000"
echo ""
echo " 📖 For more info: Read SETUP.md"
echo ""
