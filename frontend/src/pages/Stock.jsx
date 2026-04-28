// frontend/src/pages/Stock.jsx
import { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { useConfig } from "../context/ConfigContext";
import { useTranslation } from "../context/LanguageContext";
import LoaderPOS from "../components/LoaderPOS";
import MoneyDisplay from "../components/MoneyDisplay";
import {
  Package,
  Plus,
  Search,
  X,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
  ImageOff,
  Archive,
  Layers,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Minus,
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
  const { t } = useTranslation();
  const { config, loading: configLoading } = useConfig();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState({
    quantity: "",
    reason: "Reposición",
    action: "increase",
  });
  const [submitting, setSubmitting] = useState(false);
  const [imageErrors, setImageErrors] = useState({});

  // Filtros y paginación
  const [stockFilter, setStockFilter] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    categoryId: "",
    minPrice: "",
    maxPrice: "",
    minStock: "",
    maxStock: "",
  });
  const [currentPage, setCurrentPage] = useState(1);

  const lowStockThreshold = config?.notifications?.lowStockThreshold ?? 5;
  const itemsPerPage = config?.appearance?.itemsPerPage ?? 10;

  useEffect(() => {
    if (!configLoading) {
      loadData();
      loadCategories();
    }
  }, [configLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/products");
      setProducts(res.data.data || []);
      setImageErrors({});
    } catch (err) {
      console.error("❌ Error cargando productos:", err);
      Swal.fire({
        title: t("stock.alerts.error_loading"),
        text: t("stock.alerts.error_loading"),
        icon: "error",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data.data || []);
    } catch (err) {
      console.warn("⚠️ No se pudieron cargar las categorías:", err);
    }
  };

  const totalProducts = useMemo(
    () => products.filter((p) => p.is_active !== false).length,
    [products],
  );
  const totalStock = useMemo(
    () =>
      products
        .filter((p) => p.is_active !== false)
        .reduce((sum, p) => sum + (p.stock || 0), 0),
    [products],
  );
  const lowStockCount = useMemo(
    () =>
      products.filter((p) => (p.stock || 0) <= lowStockThreshold && p.stock > 0)
        .length,
    [products, lowStockThreshold],
  );
  const outOfStockCount = useMemo(
    () => products.filter((p) => (p.stock || 0) === 0).length,
    [products],
  );

  const filteredProducts = useMemo(() => {
    let filtered = products.filter((p) => p.is_active !== false);
    if (search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term),
      );
    }
    if (stockFilter === "low")
      filtered = filtered.filter(
        (p) => (p.stock || 0) <= lowStockThreshold && p.stock > 0,
      );
    else if (stockFilter === "out")
      filtered = filtered.filter((p) => (p.stock || 0) === 0);
    else if (stockFilter === "ok")
      filtered = filtered.filter((p) => (p.stock || 0) > lowStockThreshold);

    const adv = advancedFilters;
    if (adv.categoryId)
      filtered = filtered.filter((p) => p.category_id === adv.categoryId);
    const minPrice = parseFloat(adv.minPrice),
      maxPrice = parseFloat(adv.maxPrice);
    if (!isNaN(minPrice))
      filtered = filtered.filter((p) => p.sale_price >= minPrice);
    if (!isNaN(maxPrice))
      filtered = filtered.filter((p) => p.sale_price <= maxPrice);
    const minStock = parseInt(adv.minStock),
      maxStock = parseInt(adv.maxStock);
    if (!isNaN(minStock))
      filtered = filtered.filter((p) => (p.stock || 0) >= minStock);
    if (!isNaN(maxStock))
      filtered = filtered.filter((p) => (p.stock || 0) <= maxStock);
    return filtered;
  }, [products, search, stockFilter, advancedFilters, lowStockThreshold]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, stockFilter, advancedFilters, itemsPerPage]);

  const openModal = (product, action = "increase") => {
    setSelectedProduct(product);
    setForm({
      quantity: "",
      reason: action === "increase" ? "Reposición" : "Venta",
      action,
    });
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = Math.abs(parseInt(form.quantity));
    if (!qty || qty <= 0)
      return Swal.fire({
        title: t("stock.alerts.invalid_quantity"),
        text: t("stock.alerts.invalid_quantity"),
        icon: "warning",
        confirmButtonColor: "#f59e0b",
      });
    if (form.action === "decrease" && qty > (selectedProduct.stock || 0))
      return Swal.fire({
        title: t("stock.alerts.insufficient_stock", {
          stock: selectedProduct.stock,
        }),
        text: t("stock.alerts.insufficient_stock", {
          stock: selectedProduct.stock,
        }),
        icon: "warning",
      });
    setSubmitting(true);
    try {
      await api.put(`/products/${selectedProduct.id}/stock`, {
        quantity: qty,
        action: form.action,
        reason: form.reason,
      });
      setModal(false);
      await loadData();
      const actionText =
        form.action === "increase"
          ? t("stock.alerts.added")
          : t("stock.alerts.removed");
      Swal.fire({
        title: t("stock.alerts.stock_updated"),
        text: t("stock.alerts.stock_updated_text", {
          action: actionText,
          qty,
          name: selectedProduct.name,
        }),
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: "top-end",
      });
    } catch (err) {
      console.error("❌ Error al actualizar stock:", err.response?.data);
      Swal.fire({
        title: t("stock.alerts.error_loading"),
        text: err.response?.data?.message || t("stock.alerts.error_loading"),
        icon: "error",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageError = (productId) =>
    setImageErrors((prev) => ({ ...prev, [productId]: true }));

  const clearAdvancedFilters = () =>
    setAdvancedFilters({
      categoryId: "",
      minPrice: "",
      maxPrice: "",
      minStock: "",
      maxStock: "",
    });
  const hasActiveAdvancedFilters =
    advancedFilters.categoryId ||
    advancedFilters.minPrice ||
    advancedFilters.maxPrice ||
    advancedFilters.minStock ||
    advancedFilters.maxStock;

  if (configLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <LoaderPOS message={t("stock.alerts.loading")} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Package className="text-blue-600 dark:text-blue-400" size={28} />{" "}
            {t("stock.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t("stock.subtitle", { threshold: lowStockThreshold })}
          </p>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl p-5 border border-purple-200 dark:border-purple-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <Layers
                size={28}
                className="text-purple-600 dark:text-purple-400"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                {t("stock.total_products")}
              </p>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
                {totalProducts}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-2xl p-5 border border-amber-200 dark:border-amber-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <Archive
                size={28}
                className="text-amber-600 dark:text-amber-400"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {t("stock.total_stock")}
              </p>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
                {totalStock}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-2xl p-5 border border-orange-200 dark:border-orange-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <AlertTriangle
                size={28}
                className="text-orange-600 dark:text-orange-400"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                {t("stock.low_stock")}
              </p>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
                {lowStockCount}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-2xl p-5 border border-red-200 dark:border-red-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <X size={28} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                {t("stock.out_of_stock")}
              </p>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
                {outOfStockCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <SlidersHorizontal size={16} /> {t("stock.advanced_filters")}{" "}
            {hasActiveAdvancedFilters && (
              <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder={t("stock.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            title="Actualizar"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStockFilter("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${stockFilter === "all" ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
          >
            {t("stock.all")}
          </button>
          <button
            onClick={() => setStockFilter("low")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${stockFilter === "low" ? "bg-orange-500 text-white" : "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800/50"}`}
          >
            {t("stock.low_stock_filter")}
          </button>
          <button
            onClick={() => setStockFilter("out")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${stockFilter === "out" ? "bg-red-500 text-white" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50"}`}
          >
            {t("stock.out_of_stock_filter")}
          </button>
          <button
            onClick={() => setStockFilter("ok")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${stockFilter === "ok" ? "bg-green-500 text-white" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50"}`}
          >
            {t("stock.ok_stock_filter")}
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("stock.category")}
              </label>
              <select
                value={advancedFilters.categoryId}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    categoryId: e.target.value,
                  }))
                }
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="">{t("stock.all")}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("stock.price_min")}
              </label>
              <input
                type="number"
                placeholder="$"
                value={advancedFilters.minPrice}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    minPrice: e.target.value,
                  }))
                }
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("stock.price_max")}
              </label>
              <input
                type="number"
                placeholder="$"
                value={advancedFilters.maxPrice}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    maxPrice: e.target.value,
                  }))
                }
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("stock.stock_min")}
              </label>
              <input
                type="number"
                placeholder="0"
                value={advancedFilters.minStock}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    minStock: e.target.value,
                  }))
                }
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("stock.stock_max")}
              </label>
              <input
                type="number"
                placeholder="0"
                value={advancedFilters.maxStock}
                onChange={(e) =>
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    maxStock: e.target.value,
                  }))
                }
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            {hasActiveAdvancedFilters && (
              <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
                <button
                  onClick={clearAdvancedFilters}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {t("stock.clear_advanced")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla de productos */}
      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t("stock.product")}</th>
                <th>{t("stock.sku")}</th>
                <th>{t("stock.category")}</th>
                <th>{t("stock.sale_price")}</th>
                <th>{t("stock.total_stock")}</th>
                <th>{t("stock.state")}</th>
                <th>
                  {t("stock.actions.entry")}/{t("stock.actions.exit")}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.length > 0 ? (
                paginatedProducts.map((p) => {
                  const isLow =
                    (p.stock || 0) <= lowStockThreshold && p.stock > 0;
                  const isOut = (p.stock || 0) === 0;
                  const hasImage = p.image_url && !imageErrors[p.id];
                  return (
                    <tr
                      key={p.id}
                      className={
                        isOut
                          ? "bg-red-50/30 hover:bg-red-50/60 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                          : isLow
                            ? "bg-orange-50/30 hover:bg-orange-50/60 dark:bg-orange-900/20 dark:hover:bg-orange-900/30"
                            : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }
                    >
                      <td className="font-medium text-gray-900 dark:text-white">
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
                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 border">
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
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                          {p.sku || "N/A"}
                        </code>
                      </td>
                      <td className="dark:text-gray-300">
                        {p.category_name || t("stock.all")}
                      </td>
                      <td className="font-semibold dark:text-gray-300">
                        <MoneyDisplay amount={parseFloat(p.sale_price || 0)} />
                      </td>
                      <td className="font-bold text-lg">
                        <span
                          className={
                            isOut
                              ? "text-red-600"
                              : isLow
                                ? "text-orange-600"
                                : "text-green-700"
                          }
                        >
                          {p.stock || 0}
                        </span>
                        <span className="text-gray-500 text-sm font-normal ml-1">
                          uds
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${isOut ? "badge-danger" : isLow ? "badge-warning" : "badge-success"}`}
                        >
                          {isOut
                            ? t("stock.status.out")
                            : isLow
                              ? t("stock.status.low")
                              : t("stock.status.ok")}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openModal(p, "increase")}
                            className="btn-primary text-sm flex items-center gap-1"
                            title={t("stock.actions.entry")}
                          >
                            <Plus size={14} /> {t("stock.actions.entry")}
                          </button>
                          <button
                            onClick={() => openModal(p, "decrease")}
                            className="btn-danger text-sm flex items-center gap-1"
                            title={t("stock.actions.exit")}
                            disabled={!p.stock || p.stock <= 0}
                          >
                            <Minus size={14} /> {t("stock.actions.exit")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-gray-500">
                    {t("stock.alerts.no_results")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} -{" "}
              {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de{" "}
              {filteredProducts.length} productos
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2)
                  pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium ${currentPage === pageNum ? "bg-blue-500 text-white" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="px-1 text-gray-400">...</span>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium"
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de entrada/salida */}
      {modal && selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => !submitting && setModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {form.action === "increase" ? (
                  <>
                    <ArrowUpRight className="text-green-600" size={20} />{" "}
                    {t("stock.modal.increase_title")}
                  </>
                ) : (
                  <>
                    <Minus className="text-red-600" size={20} />{" "}
                    {t("stock.modal.decrease_title")}
                  </>
                )}
              </h2>
              <button
                onClick={() => !submitting && setModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={submitting}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                  {t("stock.modal.product_label")}
                </p>
                <p className="text-gray-900 dark:text-white font-bold">
                  {selectedProduct.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {t("stock.modal.current_stock")}{" "}
                  <span className="font-semibold">
                    {selectedProduct.stock || 0}
                  </span>{" "}
                  uds • {t("stock.modal.price")}{" "}
                  <MoneyDisplay amount={selectedProduct.sale_price} />
                </p>
              </div>
              <div className="input-group">
                <label className="label">
                  {t("stock.modal.movement_type")}
                </label>
                <select
                  className="input"
                  value={form.action}
                  onChange={(e) => setForm({ ...form, action: e.target.value })}
                  disabled={submitting}
                >
                  <option value="increase">
                    {t("stock.modal.entry_option")}
                  </option>
                  <option value="decrease">
                    {t("stock.modal.exit_option")}
                  </option>
                </select>
              </div>
              <div className="input-group">
                <label className="label">{t("stock.modal.quantity")}</label>
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
                <label className="label">{t("stock.modal.reason")}</label>
                <select
                  className="input"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  disabled={submitting}
                >
                  <option value="Reposición">
                    {t("stock.modal.reasons.reposition")}
                  </option>
                  <option value="Compra">
                    {t("stock.modal.reasons.purchase")}
                  </option>
                  <option value="Venta">{t("stock.modal.reasons.sale")}</option>
                  <option value="Ajuste">
                    {t("stock.modal.reasons.adjustment")}
                  </option>
                  <option value="Devolución">
                    {t("stock.modal.reasons.return")}
                  </option>
                  <option value="Otro">{t("stock.modal.reasons.other")}</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`flex-1 flex items-center justify-center gap-2 text-white py-2.5 rounded-xl font-medium transition-colors shadow-lg ${form.action === "increase" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                >
                  {submitting
                    ? t("stock.modal.processing")
                    : form.action === "increase"
                      ? t("stock.modal.confirm_entry")
                      : t("stock.modal.confirm_exit")}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="btn-secondary px-6"
                  disabled={submitting}
                >
                  {t("stock.modal.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
