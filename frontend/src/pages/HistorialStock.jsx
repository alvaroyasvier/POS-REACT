// frontend/src/pages/HistorialStock.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../store/authStore";
import api from "../api";
import Swal from "sweetalert2";
import { useConfig } from "../context/ConfigContext";
import { useTranslation } from "../context/LanguageContext";
import LoaderPOS from "../components/LoaderPOS";
import MoneyDisplay from "../components/MoneyDisplay";
import {
  Package,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  User,
  X,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
  RefreshCw,
  Calendar,
} from "lucide-react";

const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || "http://localhost:3000";

export default function HistorialStock() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { config, loading: configLoading } = useConfig();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(false);

  const [activeDateFilter, setActiveDateFilter] = useState("today");
  const [quickFilter, setQuickFilter] = useState("all");

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    productId: "",
    movementType: "",
  });

  const [form, setForm] = useState({
    productId: "",
    quantity: "",
    reason: "",
    movementType: "increase",
  });

  const [globalStats, setGlobalStats] = useState({ entradas: 0, salidas: 0 });

  const itemsPerPage = config?.appearance?.itemsPerPage || 20;

  const getTodayDate = () => new Date().toISOString().split("T")[0];
  const getWeekAgoDate = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  };
  const getMonthAgoDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  };

  const applyDateFilter = (type) => {
    const today = getTodayDate();
    let start = today,
      end = today;
    if (type === "week") {
      start = getWeekAgoDate();
      end = today;
    } else if (type === "month") {
      start = getMonthAgoDate();
      end = today;
    }
    setActiveDateFilter(type);
    setAdvancedFilters((prev) => ({ ...prev, startDate: start, endDate: end }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const getProductImageUrl = (imageUrl) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith("http")) return imageUrl;
    return `${UPLOADS_URL}${imageUrl.startsWith("/") ? imageUrl : "/" + imageUrl}`;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const baseParams = new URLSearchParams();
      if (advancedFilters.startDate)
        baseParams.append("start", advancedFilters.startDate);
      if (advancedFilters.endDate)
        baseParams.append("end", advancedFilters.endDate);
      if (advancedFilters.productId)
        baseParams.append("productId", advancedFilters.productId);
      const movementType =
        advancedFilters.movementType ||
        (quickFilter !== "all" ? quickFilter : "");
      if (movementType) baseParams.append("movementType", movementType);

      const pageParams = new URLSearchParams(baseParams);
      pageParams.append("page", pagination.page);
      pageParams.append("limit", itemsPerPage);
      const res = await api.get(
        `/sales/stock-movements?${pageParams.toString()}`,
      );
      setMovements(res.data.data || []);
      setPagination(
        res.data.pagination || { page: 1, totalPages: 1, total: 0 },
      );

      const statsParams = new URLSearchParams(baseParams);
      statsParams.append("limit", "9999");
      const statsRes = await api.get(
        `/sales/stock-movements?${statsParams.toString()}`,
      );
      const allMovements = statsRes.data.data || [];
      const entradas = allMovements
        .filter(
          (m) =>
            m.movement_type === "increase" || m.movement_type === "purchase",
        )
        .reduce((sum, m) => sum + Math.abs(m.quantity || 0), 0);
      const salidas = allMovements
        .filter(
          (m) => m.movement_type === "decrease" || m.movement_type === "sale",
        )
        .reduce((sum, m) => sum + Math.abs(m.quantity || 0), 0);
      setGlobalStats({ entradas, salidas });
    } catch (err) {
      console.error("Error cargando historial:", err);
      setError(
        err.response?.data?.message || t("historialstock.error_loading"),
      );
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await api.get("/products");
      setProducts(res.data.data || []);
    } catch (err) {
      console.error("Error cargando productos:", err);
    }
  };

  useEffect(() => {
    if (user && !configLoading) {
      loadData();
      loadProducts();
    }
  }, [
    pagination.page,
    quickFilter,
    advancedFilters,
    itemsPerPage,
    configLoading,
  ]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [quickFilter, advancedFilters, itemsPerPage]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(form.quantity);
    if (!form.productId || !qty)
      return Swal.fire(
        "Error",
        t("historialstock.modal.select_product"),
        "warning",
      );
    try {
      await api.put(`/products/${form.productId}/stock`, {
        quantity: qty,
        action: form.movementType,
        reason: form.reason || "Ajuste manual",
      });
      setModal(false);
      setForm({
        productId: "",
        quantity: "",
        reason: "",
        movementType: "increase",
      });
      await loadData();
      Swal.fire({
        title: t("historialstock.success_message"),
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || t("historialstock.error_saving"),
        "error",
      );
    }
  };

  const clearAdvancedFilters = () => {
    const today = getTodayDate();
    setAdvancedFilters({
      startDate: today,
      endDate: today,
      productId: "",
      movementType: "",
    });
    setActiveDateFilter("today");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveAdvancedFilters =
    advancedFilters.startDate !== getTodayDate() ||
    advancedFilters.endDate !== getTodayDate() ||
    advancedFilters.productId ||
    advancedFilters.movementType;

  const ProductImage = ({ imageUrl, productName }) => {
    const [imgError, setImgError] = useState(false);
    const colors = [
      "from-blue-500 to-blue-600",
      "from-green-500 to-green-600",
      "from-purple-500 to-purple-600",
      "from-pink-500 to-pink-600",
    ];
    const colorClass = colors[(productName?.length || 0) % colors.length];
    const firstLetter = productName?.charAt(0).toUpperCase() || "?";
    if (!imageUrl || imgError) {
      return (
        <div
          className={`w-10 h-10 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center text-white font-bold shadow-sm`}
        >
          {firstLetter}
        </div>
      );
    }
    return (
      <img
        src={getProductImageUrl(imageUrl)}
        alt={productName}
        className="w-10 h-10 object-cover rounded-xl border border-gray-200"
        onError={() => setImgError(true)}
      />
    );
  };

  if (loading && movements.length === 0)
    return <LoaderPOS message={t("historialstock.loading")} />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Package className="text-red-400 mb-4" size={48} />
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t("historialstock.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-blue-600" size={28} />{" "}
            {t("historialstock.title")}
          </h1>
          <p className="text-gray-500 mt-1">
            {user?.role === "admin"
              ? t("historialstock.subtitle_admin")
              : t("historialstock.subtitle_cashier")}
          </p>
        </div>
        <button
          onClick={() => {
            setModal(true);
            loadProducts();
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={16} /> {t("historialstock.new_movement")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-100 text-sm font-medium">
                {t("historialstock.entries")}
              </p>
              <p className="text-4xl font-bold mt-2">{globalStats.entradas}</p>
              <div className="flex items-center gap-1 mt-3 text-green-100">
                <ArrowUpRight size={16} />
                <span className="text-sm">{t("historialstock.units_in")}</span>
              </div>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <TrendingUp size={28} />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-red-100 text-sm font-medium">
                {t("historialstock.exits")}
              </p>
              <p className="text-4xl font-bold mt-2">{globalStats.salidas}</p>
              <div className="flex items-center gap-1 mt-3 text-red-100">
                <ArrowDownRight size={16} />
                <span className="text-sm">{t("historialstock.units_out")}</span>
              </div>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <TrendingDown size={28} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <SlidersHorizontal size={16} />{" "}
            {t("historialstock.filters_advanced")}
            {hasActiveAdvancedFilters && (
              <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>
          <button
            onClick={loadData}
            className="p-2 text-gray-500 hover:text-gray-700"
            title="Actualizar"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyDateFilter("today")}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${activeDateFilter === "today" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            <Calendar size={16} /> {t("historialstock.today")}
          </button>
          <button
            onClick={() => applyDateFilter("week")}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${activeDateFilter === "week" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            <Calendar size={16} /> {t("historialstock.this_week")}
          </button>
          <button
            onClick={() => applyDateFilter("month")}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${activeDateFilter === "month" ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            <Calendar size={16} /> {t("historialstock.this_month")}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setQuickFilter("all")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${quickFilter === "all" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            {t("historialstock.all")}
          </button>
          <button
            onClick={() => setQuickFilter("increase")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${quickFilter === "increase" ? "bg-green-500 text-white" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
          >
            {t("historialstock.entries_filter")}
          </button>
          <button
            onClick={() => setQuickFilter("decrease")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${quickFilter === "decrease" ? "bg-red-500 text-white" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
          >
            {t("historialstock.exits_filter")}
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="pt-3 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <Calendar size={12} /> {t("historialstock.date_from")}
              </label>
              <input
                type="date"
                className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg"
                value={advancedFilters.startDate}
                onChange={(e) => {
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }));
                  setActiveDateFilter(null);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <Calendar size={12} /> {t("historialstock.date_to")}
              </label>
              <input
                type="date"
                className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg"
                value={advancedFilters.endDate}
                onChange={(e) => {
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }));
                  setActiveDateFilter(null);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">
                {t("historialstock.product")}
              </label>
              <select
                className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg"
                value={advancedFilters.productId}
                onChange={(e) => {
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    productId: e.target.value,
                  }));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <option value="">{t("historialstock.all")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">
                {t("historialstock.type")}
              </label>
              <select
                className="w-full mt-1 px-3 py-1.5 text-sm border rounded-lg"
                value={advancedFilters.movementType}
                onChange={(e) => {
                  setAdvancedFilters((prev) => ({
                    ...prev,
                    movementType: e.target.value,
                  }));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <option value="">{t("historialstock.all")}</option>
                <option value="increase">
                  {t("historialstock.entries_filter")}
                </option>
                <option value="decrease">
                  {t("historialstock.exits_filter")}
                </option>
              </select>
            </div>
            {hasActiveAdvancedFilters && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={clearAdvancedFilters}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {t("historialstock.clear_filters")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {movements.length === 0 ? (
          <div className="text-center py-12">
            <Package className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 font-medium">
              {quickFilter !== "all" || hasActiveAdvancedFilters
                ? t("historialstock.no_movements")
                : t("historialstock.no_movements_registered")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-6 py-3">
                    {t("historialstock.columns.product")}
                  </th>
                  <th className="px-6 py-3">
                    {t("historialstock.columns.quantity")}
                  </th>
                  <th className="px-6 py-3">
                    {t("historialstock.columns.type")}
                  </th>
                  <th className="px-6 py-3">
                    {t("historialstock.columns.reason")}
                  </th>
                  {user?.role === "admin" && (
                    <th className="px-6 py-3">
                      {t("historialstock.columns.user")}
                    </th>
                  )}
                  <th className="px-6 py-3">
                    {t("historialstock.columns.date")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {movements.map((m) => {
                  const product = products.find(
                    (p) => String(p.id) === String(m.product_id),
                  );
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <ProductImage
                            imageUrl={product?.image_url}
                            productName={m.product_name}
                          />
                          <span className="font-medium text-gray-900">
                            {m.product_name}
                          </span>
                        </div>
                      </td>
                      <td
                        className={`px-6 py-4 font-bold ${m.movement_type === "increase" || m.movement_type === "purchase" ? "text-green-700" : "text-red-700"}`}
                      >
                        {m.movement_type === "increase" ||
                        m.movement_type === "purchase"
                          ? "+"
                          : "-"}
                        {m.quantity}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${m.movement_type === "increase" || m.movement_type === "purchase" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                        >
                          {m.movement_type === "increase" ||
                          m.movement_type === "purchase"
                            ? t("historialstock.entries_filter")
                            : t("historialstock.exits_filter")}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 text-sm text-gray-600 truncate max-w-[200px]"
                        title={m.reason}
                      >
                        {m.reason || "-"}
                      </td>
                      {user?.role === "admin" && (
                        <td className="px-6 py-4 text-sm flex items-center gap-1 text-gray-700">
                          <User size={12} className="text-gray-400" />{" "}
                          {m.user_name || "Sistema"}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(m.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
            <div className="text-sm text-gray-600">
              {t("historialstock.pagination.showing")} {movements.length}{" "}
              {t("historialstock.pagination.of")} {pagination.total}{" "}
              {t("historialstock.pagination.records")}
            </div>
            <div className="flex items-center gap-4">
              <button
                disabled={pagination.page === 1}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
                className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg flex items-center gap-1"
              >
                <ChevronLeft size={18} />{" "}
                {t("historialstock.pagination.previous")}
              </button>
              <div className="flex gap-1">
                {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) pageNum = i + 1;
                  else if (pagination.page <= 3) pageNum = i + 1;
                  else if (pagination.page >= pagination.totalPages - 2)
                    pageNum = pagination.totalPages - 4 + i;
                  else pageNum = pagination.page - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, page: pageNum }))
                      }
                      className={`px-3 py-1 rounded-lg ${pagination.page === pageNum ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
                className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg flex items-center gap-1"
              >
                {t("historialstock.pagination.next")} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b">
              <h2 className="text-lg font-bold text-gray-900">
                {t("historialstock.modal.title")}
              </h2>
              <button
                onClick={() => setModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("historialstock.modal.product_label")}
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.productId}
                  onChange={(e) =>
                    setForm({ ...form, productId: e.target.value })
                  }
                >
                  <option value="">
                    {t("historialstock.modal.select_product")}
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("historialstock.modal.movement_type_label")}
                </label>
                <select
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.movementType}
                  onChange={(e) =>
                    setForm({ ...form, movementType: e.target.value })
                  }
                >
                  <option value="increase">
                    {t("historialstock.modal.entry_option")}
                  </option>
                  <option value="decrease">
                    {t("historialstock.modal.exit_option")}
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("historialstock.modal.quantity_label")}
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                  placeholder="Ej: 50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("historialstock.modal.reason_label")}
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Ej: Reposición semanal"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {t("historialstock.modal.submit")}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {t("historialstock.modal.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
