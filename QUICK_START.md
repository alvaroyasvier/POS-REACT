# ⚡ QUICK START REFERENCE CARD

## 🚀 Comienza en 30 segundos

```bash
# 1. Abre terminal en la raíz del proyecto
cd "d:\2Alvaro Yasvier Velazquez Alba\Project\ALMACEN\POS-REACT"

# 2. Ejecuta el script de setup (solo la primera vez)
.\setup.ps1      # Windows PowerShell
# O
setup.bat        # Windows Command Prompt

# 3. En Terminal 1: Inicia el backend
npm run dev

# 4. En Terminal 2: Inicia el frontend
cd frontend && npm run dev

# 5. Abre en navegador
http://localhost:5173
```

---

## 📋 Checklist Previo a Ejecutar

- [ ] Node.js v18+ instalado (`node --version`)
- [ ] PostgreSQL instalado (`psql --version`)
- [ ] Base de datos creada: `CREATE DATABASE pos_db;`
- [ ] Archivo `.env` presente en raíz
- [ ] Carpetas `node_modules` en raíz y frontend

---

## 🎯 URLs Principales

| Recurso | URL |
|---------|-----|
| **Aplicación** | http://localhost:5173 |
| **API Backend** | http://localhost:3000 |
| **Base de Datos** | localhost:5432 |
| **Documentación** | Ver SETUP.md |

---

## 📦 Dependencias Principales

### Backend
- `express` - Framework web
- `pg` - Driver PostgreSQL
- `jsonwebtoken` - Autenticación JWT
- `bcryptjs` - Hash de contraseñas
- `cors` - Manejo CORS
- `helmet` - Headers de seguridad

### Frontend
- `react` - Framework UI
- `vite` - Build tool
- `tailwindcss` - Estilos
- `zustand` - State management
- `axios` - HTTP client
- `react-router-dom` - Routing

---

## 🔧 Variables .env Importantes

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pos_db
JWT_SECRET=tu_clave_super_segura_aqui
LICENSE_SECRET=OTRA_CLAVE_SEGURA
PORT=3000
NODE_ENV=development
```

---

## 🛑 Si Algo Falla

```bash
# Opción 1: Limpiar todo y reintentar
rm -rf node_modules
rm -rf frontend/node_modules
npm install
cd frontend && npm install

# Opción 2: Verificar conexión a BD
psql -U postgres -d pos_db -c "SELECT 1"

# Opción 3: Ver logs detallados
npm run dev 2>&1 | tee log.txt

# Opción 4: Resetear puerto
netstat -ano | findstr :3000  # Windows
lsof -i :3000                  # Linux/Mac
```

---

## 📝 Scripts Útiles

```bash
# Backend
npm run dev              # Dev con hot reload
npm start                # Producción
npm audit fix            # Corregir vulnerabilidades

# Frontend
cd frontend
npm run dev              # Dev con Vite
npm run build            # Build para prod
npm run lint             # Validar código

# Fullstack
npm run build:frontend   # Build del frontend
```

---

## 🎓 Archivos Generados

| Archivo | Propósito |
|---------|-----------|
| `.env` | Variables de entorno |
| `.env.example` | Plantilla de .env |
| `.vscode/tasks.json` | Tasks para VS Code |
| `SETUP.md` | Documentación completa |
| `PROYECTO_SETUP.md` | Este resumen |
| `setup.bat` | Script Windows CMD |
| `setup.ps1` | Script Windows PowerShell |
| `setup.sh` | Script Linux/Mac |
| `QUICK_START.md` | Referencia rápida |

---

## ✅ Verificación Final

Después de ejecutar `setup.ps1` o `setup.sh`, deberías ver:

```
✅ Node.js detected
✅ PostgreSQL detected
✅ Backend installed successfully
✅ Frontend installed successfully
✅ Dependencies installed
✅ .env file configured
✅ VS Code tasks created
```

Si no ves algo, revisa la sección "Troubleshooting" en SETUP.md.

---

## 🎯 Siguientes Pasos

1. Ejecutar ambos servidores
2. Crear primera cuenta de usuario
3. Probar funcionalidades básicas
4. Hacer primer commit a git
5. Iniciar desarrollo de features

---

**¡El proyecto está listo! 🎉**

Para detalles: Ver SETUP.md o PROYECTO_SETUP.md
