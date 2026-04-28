// frontend/src/pages/Stock.jsx
import { useState, useEffect } from "react";
import api from "../api";
import Swal from "sweetalert2";
import {
  Package,
  Plus,
  Search,
  X,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
  ImageOff,
  Loader2,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const cleanPath = path.replace("/api", "");
  return `${API_BASE_URL.replace("/api", "")}${cleanPath}`;
};

export default function Stock() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState({ quantity: "", reason: "Reposición" });
  const [submitting, setSubmitting] = useState(false);
  const [imageErrors, setImageErrors] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/products");
      setProducts(res.data.data || []);
      setImageErrors({});
    } catch (err) {
      console.error("❌ Error cargando productos:", err);
      Swal.fire({
        title: "Error",
        text: "No se pudieron cargar los productos",
        icon: "error",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setLoading(false);
    }
  };

  const openModal = (product) => {
    setSelectedProduct(product);
    setForm({ quantity: "", reason: "Reposición" });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(form.quantity);
    if (!qty || qty <= 0) {
      return Swal.fire({
        title: "Atención",
        text: "Ingresa una cantidad válida mayor a 0",
        icon: "warning",
        confirmButtonColor: "#f59e0b",
      });
    }

    setSubmitting(true);
    try {
      await api.put(`/products/${selectedProduct.id}/stock`, {
        quantity: qty,
        reason: form.reason,
      });
      setModal(false);
      await loadData();
      Swal.fire({
        title: "✅ Stock Actualizado",
        text: `Se agregaron ${qty} unidades a "${selectedProduct.name}"`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: "top-end",
      });
    } catch (err) {
      console.error("❌ Error al actualizar stock:", err.response?.data);
      Swal.fire({
        title: "Error",
        text: err.response?.data?.message || "Error al actualizar stock",
        icon: "error",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageError = (productId) =>
    setImageErrors((prev) => ({ ...prev, [productId]: true }));

  const filtered = products.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()),
  );

  const lowStockCount = products.filter((p) => (p.stock || 0) <= 5).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <span className="text-gray-500 font-medium">
          Cargando inventario...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-blue-600" size={28} /> Gestión de Stock
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Reposición de inventario • Rol: Almacenero
          </p>
        </div>
        <button
          onClick={loadData}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {/* Buscador + Alerta */}
      <div className="card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-md">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-icon"
          />
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">
              {lowStockCount} productos con stock bajo
            </span>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th>Categoría</th>
                <th>P. Venta</th>
                <th>Stock</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((p) => {
                  const isLow = (p.stock || 0) <= 5;
                  const hasImage = p.image_url && !imageErrors[p.id];
                  return (
                    <tr
                      key={p.id}
                      className={
                        isLow
                          ? "bg-red-50/30 hover:bg-red-50/60"
                          : "hover:bg-gray-50"
                      }
                    >
                      <td className="font-medium text-gray-900">
                        <div className="flex items-center gap-3">
                          {hasImage ? (
                            <img
                              src={getImageUrl(p.image_url)}
                              alt={p.name}
                              className="w-10 h-10 rounded-lg object-cover border"
                              onError={() => handleImageError(p.id)}
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 border">
                              {p.image_url ? (
                                <ImageOff size={18} />
                              ) : (
                                <Package size={18} />
                              )}
                            </div>
                          )}
                          <span className="truncate max-w-[150px]">
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {p.sku || "N/A"}
                        </code>
                      </td>
                      <td>{p.category_name || "Sin categoría"}</td>
                      <td className="font-semibold">
                        ${parseFloat(p.sale_price || 0).toFixed(2)}
                      </td>
                      <td className="font-bold text-lg">
                        <span
                          className={isLow ? "text-red-600" : "text-green-700"}
                        >
                          {p.stock || 0}
                        </span>
                        <span className="text-gray-500 text-sm font-normal ml-1">
                          uds
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${isLow ? "badge-danger" : "badge-success"}`}
                        >
                          {isLow ? "Bajo" : "OK"}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => openModal(p)}
                          className="btn-primary text-sm flex items-center gap-1"
                        >
                          <Plus size={14} /> Agregar
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-gray-500">
                    No se encontraron productos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => !submitting && setModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ArrowUpRight className="text-green-600" size={20} /> Aumentar
                Stock
              </h2>
              <button
                onClick={() => !submitting && setModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
                disabled={submitting}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800 font-medium">Producto:</p>
                <p className="text-gray-900 font-bold">
                  {selectedProduct.name}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Stock actual:{" "}
                  <span className="font-semibold">
                    {selectedProduct.stock || 0}
                  </span>{" "}
                  uds
                </p>
              </div>
              <div className="input-group">
                <label className="label">Cantidad a Agregar *</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="input"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                  placeholder="Ej: 50"
                  disabled={submitting}
                />
              </div>
              <div className="input-group">
                <label className="label">Motivo</label>
                <select
                  className="input"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  disabled={submitting}
                >
                  <option value="Reposición">📦 Reposición</option>
                  <option value="Compra">🛒 Nueva Compra</option>
                  <option value="Ajuste">📊 Ajuste de Inventario</option>
                  <option value="Devolución">↩️ Devolución</option>
                  <option value="Otro">📝 Otro</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Confirmar"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="btn-secondary px-6"
                  disabled={submitting}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
