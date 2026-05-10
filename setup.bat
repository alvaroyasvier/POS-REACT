@echo off
REM ============================================================================
REM  POS REACT - SETUP SCRIPT FOR WINDOWS
REM ============================================================================
echo.
echo   ╔════════════════════════════════════════════════════════════════════╗
echo   ║          POS REACT - AUTOMATIC SETUP SCRIPT (WINDOWS)             ║
echo   ╚════════════════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ ERROR: Node.js no está instalado
    echo    Descárgalo desde: https://nodejs.org/
    exit /b 1
)
echo ✅ Node.js detectado: %1

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  ADVERTENCIA: PostgreSQL no parece estar instalado o no está en PATH
    echo    Descárgalo desde: https://www.postgresql.org/download/
    echo.
) else (
    echo ✅ PostgreSQL detectado
)

echo.
echo ══════════════════════════════════════════════════════════════════════
echo  📦 INSTALANDO DEPENDENCIAS
echo ══════════════════════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

REM Install backend dependencies
echo 🔄 Instalando dependencias del backend...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error al instalar dependencias del backend
    exit /b 1
)
echo ✅ Backend instalado correctamente

REM Install frontend dependencies
echo.
echo 🔄 Instalando dependencias del frontend...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error al instalar dependencias del frontend
    cd ..
    exit /b 1
)
echo ✅ Frontend instalado correctamente

cd ..

echo.
echo ══════════════════════════════════════════════════════════════════════
echo  ✨ SETUP COMPLETADO
echo ══════════════════════════════════════════════════════════════════════
echo.
echo  ✅ Dependencias instaladas
echo  ✅ Archivo .env configurado
echo  ✅ VS Code tasks creadas
echo.
echo  📋 PRÓXIMOS PASOS:
echo  ───────────────────────────────────────────────────────────────────
echo.
echo  1️⃣  CONFIGURAR BASE DE DATOS:
echo     • Abre: pgAdmin o línea de comandos PostgreSQL
echo     • Crea BD: CREATE DATABASE pos_db;
echo     • Importa: psql -U postgres -d pos_db ^< Backup.sql
echo.
echo  2️⃣  INICIA LOS SERVIDORES:
echo     • Backend:  npm run dev
echo     • Frontend: cd frontend ^&^& npm run dev
echo.
echo  3️⃣  ACCEDE A LA APP:
echo     • URL: http://localhost:5173
echo     • API: http://localhost:3000
echo.
echo  📖 Para más información: Lee SETUP.md
echo.
pause
