import { ShoppingBag, Package, Coffee, Truck, Trash2 } from "lucide-react";
import Swal from "sweetalert2";

export default function LoaderPOS({ message = "Cargando tienda..." }) {
  const clearCacheAndReload = () => {
    Swal.fire({
      title: "¿Limpiar caché?",
      text: "Esto eliminará datos locales (sesión, preferencias) y recargará la aplicación.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, limpiar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.clear();
        sessionStorage.clear();
        // Opcional: limpiar IndexedDB si se usa (no es necesario por ahora)
        window.location.reload();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Contenedor de la animación (igual que antes) */}
      <div className="relative w-80 h-40 flex items-end justify-around">
        <div className="absolute left-0 bottom-0 flex flex-col items-center">
          <Package
            className="text-amber-600 dark:text-amber-400 animate-bounce"
            size={36}
            style={{ animationDuration: "1.2s" }}
          />
          <div className="w-20 h-2 bg-amber-800/30 dark:bg-amber-700/50 rounded-full mt-1" />
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex flex-col items-center">
          <Coffee
            className="text-blue-600 dark:text-blue-400 animate-pulse"
            size={40}
          />
          <ShoppingBag
            className="text-green-600 dark:text-green-400 animate-bounce mt-1"
            size={32}
            style={{ animationDuration: "0.9s" }}
          />
          <div className="w-24 h-3 bg-gray-400/30 dark:bg-gray-600/50 rounded-full mt-1" />
        </div>
        <div className="absolute right-0 bottom-0 flex flex-col items-center">
          <Truck
            className="text-purple-600 dark:text-purple-400 animate-pulse"
            size={38}
            style={{ animationDuration: "1.5s" }}
          />
          <div className="w-20 h-2 bg-purple-800/30 dark:bg-purple-700/50 rounded-full mt-1" />
        </div>
      </div>

      {/* Texto de carga */}
      <div className="mt-8 flex flex-col items-center">
        <div className="flex gap-1">
          <span className="text-2xl font-bold text-gray-700 dark:text-gray-200">
            {message}
          </span>
          <span className="flex gap-1">
            <span className="animate-pulse text-2xl font-bold text-blue-600 dark:text-blue-400">
              .
            </span>
            <span
              className="animate-pulse text-2xl font-bold text-blue-600 dark:text-blue-400"
              style={{ animationDelay: "300ms" }}
            >
              .
            </span>
            <span
              className="animate-pulse text-2xl font-bold text-blue-600 dark:text-blue-400"
              style={{ animationDelay: "600ms" }}
            >
              .
            </span>
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Preparando tu experiencia POS
        </p>

        {/* Botón para limpiar caché */}
        <button
          onClick={clearCacheAndReload}
          className="mt-8 flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors shadow-md"
        >
          <Trash2 size={18} />
          Limpiar caché y reiniciar
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Usa esto si la aplicación se queda "pegada"
        </p>
      </div>
    </div>
  );
}
