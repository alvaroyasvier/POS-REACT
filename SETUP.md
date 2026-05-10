# 📋 INSTRUCCIONES DE CONFIGURACIÓN - POS REACT

## ✅ Lo que se ha completado:

1. ✓ **Dependencias Backend instaladas** - Todas las librerías de Node.js
2. ✓ **Dependencias Frontend instaladas** - React, Vite, Tailwind, etc.
3. ✓ **Archivo .env creado** - Variables de entorno configuradas
4. ✓ **Tareas VS Code creadas** - Para ejecutar servidores

---

## 🔧 Configuración de Base de Datos

### Requisitos:
- **PostgreSQL 12+** instalado y ejecutándose

### Pasos:
1. **Crear la base de datos:**
   ```bash
   psql -U postgres
   CREATE DATABASE pos_db;
   ```

2. **Restaurar desde Backup (Opcional):**
   ```bash
   psql -U postgres -d pos_db < Backup.sql
   ```

3. **Verificar conexión:**
   ```bash
   psql -U postgres -d pos_db -c "SELECT version();"
   ```

---

## 🚀 Ejecución del Proyecto

### Opción 1: Usando VS Code Tasks (RECOMENDADO)
1. Presiona `Ctrl + Shift + D` (o `Cmd + Shift + D` en Mac)
2. Ejecuta: **"Backend - Start Dev Server"**
3. En otra terminal: **"Frontend - Start Dev Server"**

### Opción 2: Mediante Terminal Manual

**Terminal 1 - Backend:**
```bash
cd "d:\2Alvaro Yasvier Velazquez Alba\Project\ALMACEN\POS-REACT"
npm run dev
```
Servidor disponible en: `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd "d:\2Alvaro Yasvier Velazquez Alba\Project\ALMACEN\POS-REACT\frontend"
npm run dev
```
Servidor disponible en: `http://localhost:5173`

---

## 📱 Acceso a la Aplicación

- **Frontend (Vite Dev):** http://localhost:5173
- **API Backend:** http://localhost:3000
- **Base de Datos:** PostgreSQL en localhost:5432

---

## 🔑 Variables de Entorno Críticas

El archivo `.env` incluye:
- `DATABASE_URL` - Conexión a PostgreSQL
- `JWT_SECRET` - Clave para autenticación JWT
- `LICENSE_SECRET` - Clave de licencia
- `CORS_ORIGIN` - Dominios permitidos

---

## 🛠️ Comandos Útiles

### Backend
```bash
npm run dev          # Desarrollo con nodemon
npm start            # Producción
npm audit fix        # Corregir vulnerabilidades
```

### Frontend
```bash
npm run dev          # Desarrollo
npm run build        # Build para producción
npm run lint         # Linter
npm run preview      # Preview de build
```

### Full Stack
```bash
npm run build:frontend  # Build del frontend
npm run dist            # Build de Electron
```

---

## 📁 Estructura del Proyecto

```
POS-REACT/
├── src/                    # Backend
│   ├── config/            # Configuración DB, env
│   ├── controllers/       # Lógica de negocio
│   ├── routes/           # Rutas API
│   ├── middlewares/      # Autenticación, licencia
│   └── services/         # Servicios (backup, auditoría)
├── frontend/              # Frontend React
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── pages/        # Páginas principales
│   │   ├── store/        # Zustand stores
│   │   ├── hooks/        # Custom hooks
│   │   └── context/      # Context API
│   └── public/           # Assets estáticos
├── public/               # Uploads y archivos estáticos
└── package.json          # Dependencias

```

---

## 🔐 Seguridad

El proyecto incluye:
- ✓ JWT Authentication
- ✓ Password hashing (bcryptjs)
- ✓ Helmet (headers de seguridad)
- ✓ Rate limiting
- ✓ CORS configurado
- ✓ Two-Factor Authentication
- ✓ License validation

---

## 📞 Troubleshooting

### Error: "DATABASE_URL no definida"
- Verifica que el archivo `.env` existe en la raíz
- Revisa que `DATABASE_URL=postgresql://...` está configurada

### Error: "Cannot connect to database"
- Asegúrate que PostgreSQL está ejecutándose
- Verifica las credenciales en `.env`
- Intenta crear la DB manualmente

### El frontend no carga estilos
- Limpia cache: `rm -rf frontend/node_modules/.vite`
- Reconstruye: `cd frontend && npm run build`

### Puerto ya en uso
- Cambiar puerto backend en `.env`: `PORT=3001`
- Cambiar puerto frontend en `frontend/vite.config.js`

---

## ✨ Próximos Pasos

1. Iniciar ambos servidores (Backend + Frontend)
2. Navegar a `http://localhost:5173`
3. Verificar que la API responde correctamente
4. Ejecutar migrations de BD si es necesario
5. Realizar primeros tests de funcionalidad

¡El proyecto está listo para desarrollo! 🎉
