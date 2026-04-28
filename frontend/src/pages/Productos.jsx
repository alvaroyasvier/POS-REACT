// frontend/src/pages/Productos.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import api from "../api";
import Swal from "sweetalert2";
import Barcode from "react-barcode";
import LoaderPOS from "../components/LoaderPOS";
import { useConfig } from "../context/ConfigContext";
import { useTranslation } from "../context/LanguageContext";
import MoneyDisplay from "../components/MoneyDisplay";
import { escapeHtml } from "../utils/sanitize"; // ✅ Seguridad XSS
import {
  Plus,
  Edit,
  Trash2,
  X,
  Upload,
  Search,
  Package,
  Image as ImageIcon,
  Download,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Filter,
  RefreshCw,
} from "lucide-react";

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;
  if (import.meta.env?.DEV || window.location.port === "5173") {
    return `http://localhost:3000${normalizedPath}`;
  }
  return `${window.location.origin}${normalizedPath}`;
};

export default function Productos() {
  const { t } = useTranslation();
  const { config, loading: configLoading } = useConfig();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [stockStatus, setStockStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const itemsPerPage = config?.appearance?.itemsPerPage || 10;

  const [form, setForm] = useState({
    sku: "",
    name: "",
    cost_price: "",
    sale_price: "",
    stock: "",
    category_id: "",
    image: null,
  });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get("/products");
      if (res.data?.success && Array.isArray(res.data.data)) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.error("❌ Error fetching products:", err);
      if (err.response?.status === 401) {
        Swal.fire({
          title: t("productos.session_expired"),
          text: t("productos.session_expired_text"),
          icon: "warning",
          confirmButtonText: t("productos.go_to_login"),
          customClass: { popup: "rounded-2xl shadow-2xl" },
        }).then(() => (window.location.href = "/login"));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/categories");
      if (res.data?.success && Array.isArray(res.data.data)) {
        setCategories(res.data.data);
      }
    } catch (err) {
      console.error("❌ Error fetching categories:", err);
    }
  };

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
    if (selectedCategory) {
      filtered = filtered.filter((p) => p.category_id === selectedCategory);
    }
    const min = parseFloat(minPrice),
      max = parseFloat(maxPrice);
    if (!isNaN(min)) filtered = filtered.filter((p) => p.sale_price >= min);
    if (!isNaN(max)) filtered = filtered.filter((p) => p.sale_price <= max);
    const lowThreshold = config?.notifications?.lowStockThreshold ?? 5;
    if (stockStatus === "low")
      filtered = filtered.filter(
        (p) => (p.stock || 0) <= lowThreshold && p.stock > 0,
      );
    else if (stockStatus === "out")
      filtered = filtered.filter((p) => (p.stock || 0) === 0);
    return filtered;
  }, [
    products,
    search,
    selectedCategory,
    minPrice,
    maxPrice,
    stockStatus,
    config,
  ]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory, minPrice, maxPrice, stockStatus]);

  const hasActiveFilters =
    selectedCategory || minPrice || maxPrice || stockStatus !== "all" || search;

  const clearFilters = () => {
    setSearch("");
    setSelectedCategory("");
    setMinPrice("");
    setMaxPrice("");
    setStockStatus("all");
    setCurrentPage(1);
  };

  const openModal = useCallback(
    (product = null) => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      if (product) {
        setEditing(product);
        setForm({
          sku: product.sku,
          name: product.name,
          cost_price: product.cost_price,
          sale_price: product.sale_price,
          stock: product.stock,
          category_id: product.category_id || "",
          image: null,
        });
        setPreview(product.image_url ? getImageUrl(product.image_url) : null);
      } else {
        setEditing(null);
        setForm({
          sku: "",
          name: "",
          cost_price: "",
          sale_price: "",
          stock: "",
          category_id: "",
          image: null,
        });
        setPreview(null);
      }
      setModal(true);
    },
    [previewUrl],
  );

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, image: file });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);
      setPreviewUrl(localPreview);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !form.sku ||
      !form.name ||
      !form.cost_price ||
      !form.sale_price ||
      !form.stock
    ) {
      return Swal.fire(
        t("productos.required_fields"),
        t("productos.complete_all"),
        "warning",
      );
    }
    setLoading(true);
    const fd = new FormData();
    fd.append("sku", form.sku);
    fd.append("name", form.name);
    fd.append("cost_price", form.cost_price);
    fd.append("sale_price", form.sale_price);
    fd.append("stock", form.stock);
    if (form.category_id) fd.append("category_id", form.category_id);
    if (form.image) fd.append("image", form.image);
    try {
      if (editing) {
        await api.put(`/products/${editing.id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        Swal.fire(
          t("productos.updated"),
          t("productos.updated_text"),
          "success",
        );
      } else {
        await api.post("/products", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        Swal.fire(
          t("productos.created"),
          t("productos.created_text"),
          "success",
        );
      }
      setModal(false);
      fetchProducts();
    } catch (err) {
      Swal.fire(
        t("productos.error"),
        err.response?.data?.message || t("productos.error_saving"),
        "error",
      );
    } finally {
      setLoading(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  };

  const downloadBarcode = async (value, productName) => {
    try {
      const url = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(value)}&scale=3&width=2&height=50&includetext=true&textxalign=center`;
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `barcode-${value}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      Swal.fire({
        title: t("productos.downloaded"),
        text: `${t("productos.barcode_of")} "${escapeHtml(productName)}" ${t("productos.saved")}`,
        icon: "success",
        timer: 1500,
        timerProgressBar: true,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error("❌ Error descargando barcode:", err);
      Swal.fire(t("productos.error"), t("productos.barcode_error"), "error");
    }
  };

  const handleDelete = async (id, productName) => {
    const result = await Swal.fire({
      title: t("productos.deactivate"),
      // ✅ HTML escapado para prevenir XSS
      html: `${t("productos.deactivate_confirm")} <strong>"${escapeHtml(productName)}"</strong>?<br><br><span style="color:#6b7280;font-size:14px">${t("productos.irreversible")}</span>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: t("productos.deactivate_yes"),
      cancelButtonText: t("productos.cancel"),
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#f3f4f6",
      cancelButtonTextColor: "#374151",
      reverseButtons: true,
      focusCancel: true,
      customClass: {
        popup: "rounded-2xl shadow-2xl border border-gray-200 p-6",
        title: "text-xl font-bold text-gray-900 mb-2",
        htmlContainer: "text-gray-600",
        confirmButton:
          "px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-90",
        cancelButton:
          "px-6 py-3 rounded-xl font-semibold transition-all hover:bg-gray-200",
      },
      didOpen: () => {
        const confirmBtn = Swal.getConfirmButton();
        const cancelBtn = Swal.getCancelButton();
        if (confirmBtn)
          confirmBtn.style.cssText =
            "background: #dc2626; color: white; padding: 12px 24px; border-radius: 12px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);";
        if (cancelBtn)
          cancelBtn.style.cssText =
            "background: #f3f4f6; color: #374151; padding: 12px 24px; border-radius: 12px; font-weight: 600; border: 1px solid #d1d5db; box-shadow: 0 1px 3px rgba(0,0,0,0.05);";
      },
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/products/${id}`);
      Swal.fire(
        t("productos.deactivated"),
        t("productos.deactivated_text"),
        "success",
      );
      fetchProducts();
    } catch (err) {
      Swal.fire(
        t("productos.error"),
        err.response?.data?.message || t("productos.error_deactivating"),
        "error",
      );
    }
  };

  const PLACEHOLDER_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='M21 15l-5-5L5 21'/%3E%3C/svg%3E`;

  if (loading && products.length === 0)
    return <LoaderPOS message={t("productos.loading")} />;

  const ModalContent = (
    <>
      <div
        className="fixed inset-0 z-[9999] bg-black/40 animate-fadeIn"
        onClick={() => {
          setModal(false);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
      />
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="relative bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col animate-scaleIn overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-5 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">
              {editing ? t("productos.edit") : t("productos.new")}
            </h2>
            <button
              onClick={() => {
                setModal(false);
                if (previewUrl) {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }
              }}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
          <div className="overflow-y-auto p-5 flex-1">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="input-group">
                  <label className="label">{t("productos.sku")} *</label>
                  <input
                    required
                    className="input"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="SKU-001"
                  />
                </div>
                <div className="input-group">
                  <label className="label">{t("productos.name")} *</label>
                  <input
                    required
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t("productos.name_placeholder")}
                  />
                </div>
                <div className="input-group">
                  <label className="label">{t("productos.cost")} *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input"
                    value={form.cost_price}
                    onChange={(e) =>
                      setForm({ ...form, cost_price: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="input-group">
                  <label className="label">{t("productos.sale_price")} *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input"
                    value={form.sale_price}
                    onChange={(e) =>
                      setForm({ ...form, sale_price: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="input-group">
                  <label className="label">{t("productos.stock")} *</label>
                  <input
                    type="number"
                    required
                    className="input"
                    value={form.stock}
                    onChange={(e) =>
                      setForm({ ...form, stock: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="input-group">
                  <label className="label">{t("productos.category")}</label>
                  <select
                    className="input"
                    value={form.category_id}
                    onChange={(e) =>
                      setForm({ ...form, category_id: e.target.value })
                    }
                  >
                    <option value="">{t("productos.no_category")}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 input-group">
                  <label className="label">{t("productos.image")}</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all flex-1">
                      <Upload className="text-gray-400" size={20} />
                      <span className="text-sm text-gray-600">
                        {form.image
                          ? form.image.name
                          : t("productos.select_image")}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    {preview && (
                      <div className="w-20 h-20 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0 shadow-sm">
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = PLACEHOLDER_SVG;
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? t("productos.saving")
                    : editing
                      ? t("productos.update")
                      : t("productos.save")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModal(false);
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                    }
                  }}
                  className="btn-secondary px-6"
                >
                  {t("productos.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("productos.title")}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t("productos.subtitle")}
          </p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">
          <Plus size={18} /> {t("productos.new")}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <SlidersHorizontal size={16} /> {t("productos.advanced_filters")}{" "}
            {hasActiveFilters && (
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
              placeholder={t("productos.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            />
          </div>
          <button
            onClick={fetchProducts}
            className="p-2 text-gray-500 hover:text-gray-700"
            title={t("productos.refresh")}
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="pt-3 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500">
                {t("productos.category")}
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="">{t("productos.all_categories")}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">
                {t("productos.price_min")}
              </label>
              <input
                type="number"
                placeholder="$"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">
                {t("productos.price_max")}
              </label>
              <input
                type="number"
                placeholder="$"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">
                {t("productos.stock")}
              </label>
              <select
                value={stockStatus}
                onChange={(e) => setStockStatus(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="all">{t("productos.all")}</option>
                <option value="low">{t("productos.low_stock")}</option>
                <option value="out">{t("productos.out_of_stock")}</option>
              </select>
            </div>
            {hasActiveFilters && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {t("productos.clear_filters")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t("productos.product")}</th>
                <th>{t("productos.sku")}</th>
                <th>{t("productos.category")}</th>
                <th>{t("productos.price")}</th>
                <th>{t("productos.stock")}</th>
                <th>{t("productos.barcode")}</th>
                <th>{t("productos.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.length ? (
                paginatedProducts.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-blue-50/40 transition-colors"
                  >
                    <td className="font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                          {p.image_url ? (
                            <img
                              src={getImageUrl(p.image_url)}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = PLACEHOLDER_SVG;
                              }}
                            />
                          ) : (
                            <ImageIcon className="text-gray-400" size={18} />
                          )}
                        </div>
                        <span className="truncate max-w-[150px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-gray-500">{p.sku}</td>
                    <td>
                      <span className="badge badge-info">
                        {p.category_name || t("productos.no_category")}
                      </span>
                    </td>
                    <td className="text-green-700 font-semibold">
                      <MoneyDisplay amount={parseFloat(p.sale_price)} />
                    </td>
                    <td>
                      <span
                        className={`badge ${p.stock > 10 ? "badge-success" : p.stock > 0 ? "badge-warning" : "badge-danger"}`}
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col items-center gap-2">
                        <div className="bg-white p-1.5 rounded border border-gray-200 shadow-sm">
                          <Barcode
                            value={p.barcode || p.sku}
                            format="CODE128"
                            width={1.5}
                            height={35}
                            displayValue={true}
                            fontSize={10}
                            background="transparent"
                            margin={0}
                          />
                        </div>
                        <button
                          onClick={() =>
                            downloadBarcode(p.barcode || p.sku, p.name)
                          }
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-[10px] font-medium hover:bg-green-100 transition-colors"
                          title={t("productos.download_barcode")}
                        >
                          <Download size={12} /> {t("productos.download")}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal(p)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105 transition-all duration-200 shadow-sm"
                          title={t("productos.edit")}
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:scale-105 transition-all duration-200 shadow-sm"
                          title={t("productos.deactivate")}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-gray-500">
                    <Package className="mx-auto mb-3 opacity-40" size={40} />
                    <p>
                      {search
                        ? t("productos.no_results")
                        : t("productos.no_products")}
                    </p>
                    {!search && !hasActiveFilters && (
                      <button
                        onClick={() => openModal()}
                        className="btn-primary mt-4 btn-sm"
                      >
                        <Plus size={14} /> {t("productos.add_first")}
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border-t border-gray-200">
            <div className="text-sm text-gray-600">
              {t("productos.showing")} {(currentPage - 1) * itemsPerPage + 1} -{" "}
              {Math.min(currentPage * itemsPerPage, filteredProducts.length)}{" "}
              {t("productos.of")} {filteredProducts.length}{" "}
              {t("productos.products")}
            </div>
            <div className="flex items-center gap-4">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={18} /> {t("productos.previous")}
              </button>
              <div className="flex gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
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
                      className={`px-3 py-1 rounded-lg transition-colors ${currentPage === pageNum ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
              >
                {t("productos.next")} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && createPortal(ModalContent, document.body)}
    </div>
  );
}
