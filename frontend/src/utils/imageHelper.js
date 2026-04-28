// frontend/src/utils/imageHelper.js
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // Si ya es URL absoluta, retornar tal cual
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  
  // Normalizar: asegurar que empiece con '/'
  let normalizedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  
  // 🔥 CLAVE: Si no empieza con /uploads/, agregarlo automáticamente
  if (!normalizedPath.startsWith("/uploads/")) {
    normalizedPath = `/uploads${normalizedPath}`;
  }
  
  // En desarrollo con Vite (puerto 5173): apuntar al backend en 3000
  if (import.meta.env?.DEV || window.location.port === "5173") {
    return `http://localhost:3000${normalizedPath}`;
  }
  
  // En producción/Electron: usar el mismo origen que la app
  return `${window.location.origin}${normalizedPath}`;
};

export const getLocalImagePreview = (file) => {
  if (!file) return null;
  return URL.createObjectURL(file);
};