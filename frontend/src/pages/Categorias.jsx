// frontend/src/pages/Categorias.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";
import LoaderPOS from "../components/LoaderPOS";
import { useTranslation } from "../context/LanguageContext";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Package,
  AlertTriangle,
  Search,
  Tag,
  ChevronRight,
  Layers,
  Apple,
  GlassWater,
  SprayCan,
  HeartPulse,
  Hammer,
  Cog,
  Smartphone,
  PenLine,
  Blocks,
  Dog,
  ShoppingBag,
  Shirt,
  Snowflake,
  Croissant,
  Milk,
  Ham,
  Carrot,
  Wheat,
  Sparkles,
  Pill,
  Wrench,
  Lightbulb,
  Palette,
  Sprout,
  Coffee,
  Pizza,
  Utensils,
  Laptop,
  Home,
  Car,
  Book,
  Gamepad2,
  Music,
  Camera,
  Gift,
  Store,
  Grid,
} from "lucide-react";

const ICON_OPTIONS = {
  Apple,
  GlassWater,
  SprayCan,
  HeartPulse,
  Hammer,
  Cog,
  Smartphone,
  PenLine,
  Blocks,
  Dog,
  ShoppingBag,
  Shirt,
  Snowflake,
  Croissant,
  Milk,
  Ham,
  Carrot,
  Wheat,
  Sparkles,
  Pill,
  Wrench,
  Lightbulb,
  Palette,
  Sprout,
  Tag,
  Package,
  Coffee,
  Pizza,
  Utensils,
  Laptop,
  Home,
  Car,
  Book,
  Gamepad2,
  Music,
  Camera,
  Gift,
  Store,
  Grid,
};
const ICON_NAMES = Object.keys(ICON_OPTIONS);

export default function Categorias() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", icon: "Tag" });
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconPickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        iconPickerRef.current &&
        !iconPickerRef.current.contains(event.target)
      ) {
        setShowIconPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get("/categories"),
        api.get("/products"),
      ]);
      setCategories(catRes.data.data || []);
      setProducts(prodRes.data.data || []);
    } catch (err) {
      console.error("❌ Error cargando datos:", err);
      setError(t("categorias.error_loading"));
    } finally {
      setLoading(false);
    }
  };

  const productsByCategory = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      if (p.is_active !== false) {
        const catId = p.category_id || "uncategorized";
        counts[catId] = (counts[catId] || 0) + 1;
      }
    });
    return counts;
  }, [products]);

  const totalActiveProducts = useMemo(() => {
    return products.filter((p) => p.is_active !== false).length;
  }, [products]);

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(term) ||
        cat.description?.toLowerCase().includes(term),
    );
  }, [categories, searchTerm]);

  const getCategoryColor = (index) => {
    const colors = [
      "from-blue-500 to-blue-600",
      "from-emerald-500 to-emerald-600",
      "from-violet-500 to-violet-600",
      "from-amber-500 to-amber-600",
      "from-rose-500 to-rose-600",
      "from-cyan-500 to-cyan-600",
      "from-fuchsia-500 to-fuchsia-600",
      "from-lime-500 to-lime-600",
    ];
    return colors[index % colors.length];
  };

  const openModal = (cat = null) => {
    setEditing(cat);
    setForm(
      cat
        ? {
            name: cat.name,
            description: cat.description || "",
            icon: cat.icon || "Tag",
          }
        : { name: "", description: "", icon: "Tag" },
    );
    setModal(true);
    setShowIconPicker(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const payload = { ...form };
      if (editing) {
        await api.put(`/categories/${editing.id}`, payload);
        setModal(false);
        await loadData();
        Swal.fire({
          title: t("categorias.updated"),
          text: t("categorias.updated_text", { name: form.name }),
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        await api.post("/categories", payload);
        setModal(false);
        await loadData();
        Swal.fire({
          title: t("categorias.created"),
          text: t("categorias.created_text", { name: form.name }),
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || t("categorias.error_saving"));
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: t("categorias.deactivate_confirm"),
      text: t("categorias.deactivate_text", { name }),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: t("categorias.deactivate_yes"),
      cancelButtonText: t("categorias.cancel"),
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/categories/${id}`);
      await loadData();
      Swal.fire({
        title: t("categorias.deactivated"),
        text: t("categorias.deactivated_text", { name }),
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || t("categorias.error_deleting"),
        "error",
      );
    }
  };

  const CategoryCard = ({ cat, index }) => {
    const productCount = productsByCategory[cat.id] || 0;
    const colorClass = getCategoryColor(index);
    const IconComponent = ICON_OPTIONS[cat.icon] || Tag;

    return (
      <div className="group relative bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 overflow-hidden">
        <div className={`h-1.5 bg-gradient-to-r ${colorClass}`} />
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}
              >
                <IconComponent size={22} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">
                  {cat.name}
                </h3>
                {cat.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                    {cat.description}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <div className="p-2 bg-white dark:bg-gray-600 rounded-lg shadow-sm">
              <Package size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("categorias.active_products")}
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {productCount}{" "}
                <span className="text-xs font-normal text-gray-400">
                  {productCount === 1
                    ? t("categorias.product")
                    : t("categorias.products")}
                </span>
              </p>
            </div>
          </div>
          <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => openModal(cat)}
              className="flex-1 py-2.5 px-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
            >
              <Edit size={14} /> {t("categorias.edit")}
            </button>
            <button
              onClick={() => handleDelete(cat.id, cat.name)}
              className="flex-1 py-2.5 px-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-1.5 text-sm font-medium"
            >
              <Trash2 size={14} /> {t("categorias.delete")}
            </button>
          </div>
        </div>
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight
            size={16}
            className="text-gray-400 dark:text-gray-500 group-hover:text-blue-500 dark:group-hover:text-blue-400"
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoaderPOS message={t("categorias.error_loading")} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag className="text-blue-600 dark:text-blue-400" size={28} />
            {t("categorias.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t("categorias.subtitle")} •{" "}
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {t("categorias.categories_count", { count: categories.length })}
            </span>
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
        >
          <Plus size={18} /> {t("categorias.new_category")}
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            size={18}
          />
          <input
            type="text"
            placeholder={t("categorias.search_placeholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Error global */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3 text-red-700 dark:text-red-400">
          <AlertTriangle size={20} />
          <span className="text-sm font-medium">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-300"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Stats resumen */}
      {categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 shadow-sm">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                <Layers
                  size={36}
                  className="text-blue-600 dark:text-blue-400"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  {t("categorias.total_categories")}
                </p>
                <p className="text-5xl font-extrabold text-gray-900 dark:text-white mt-1">
                  {categories.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800 shadow-sm">
            <div className="flex items-center gap-5">
              <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                <Package
                  size={36}
                  className="text-purple-600 dark:text-purple-400"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                  {t("categorias.total_products_card")}
                </p>
                <p className="text-5xl font-extrabold text-gray-900 dark:text-white mt-1">
                  {totalActiveProducts}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Categorías */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="text-gray-400 dark:text-gray-500" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {searchTerm
              ? t("categorias.no_results")
              : t("categorias.no_categories")}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1 mb-6">
            {searchTerm
              ? t("categorias.try_other_search")
              : t("categorias.create_first")}
          </p>
          {!searchTerm && (
            <button
              onClick={() => openModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 mx-auto"
            >
              <Plus size={18} /> {t("categorias.new_category")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat, index) => (
            <CategoryCard key={cat.id} cat={cat} index={index} />
          ))}
        </div>
      )}

      {/* Modal (sin cambios en estructura, solo traducciones) */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 text-white">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Tag size={20} />
                  {editing
                    ? t("categorias.edit_category")
                    : t("categorias.new_category")}
                </h2>
                <button
                  onClick={() => setModal(false)}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}
              {/* Selector de Icono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("categorias.icon_label")}
                </label>
                <div className="relative" ref={iconPickerRef}>
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex items-center justify-between hover:border-blue-400 transition-all"
                  >
                    <span className="flex items-center gap-2">
                      {(() => {
                        const IconComponent = ICON_OPTIONS[form.icon] || Tag;
                        return <IconComponent size={18} />;
                      })()}
                      <span>{form.icon}</span>
                    </span>
                    <ChevronRight
                      size={16}
                      className={`transform transition-transform ${showIconPicker ? "rotate-90" : ""}`}
                    />
                  </button>
                  {showIconPicker && (
                    <div className="absolute z-10 mt-1 w-80 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-64 overflow-y-auto p-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                        {t("categorias.icon_label")}
                      </p>
                      <div className="grid grid-cols-5 gap-1">
                        {ICON_NAMES.map((iconName) => {
                          const IconComponent = ICON_OPTIONS[iconName];
                          return (
                            <button
                              key={iconName}
                              type="button"
                              onClick={() => {
                                setForm({ ...form, icon: iconName });
                                setShowIconPicker(false);
                              }}
                              className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 flex flex-col items-center transition-colors ${form.icon === iconName ? "bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500" : ""}`}
                              title={iconName}
                            >
                              <IconComponent size={22} />
                              <span className="text-[10px] mt-0.5 text-gray-600 dark:text-gray-300 truncate w-full text-center">
                                {iconName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("categorias.name_label")}
                </label>
                <input
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("categorias.name_placeholder")}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("categorias.description_label")}
                </label>
                <textarea
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all resize-none"
                  rows="3"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder={t("categorias.description_placeholder")}
                />
              </div>
              {form.name && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {t("categorias.preview_label")}:
                  </p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
                    {(() => {
                      const IconComponent = ICON_OPTIONS[form.icon] || Tag;
                      return <IconComponent size={14} />;
                    })()}
                    {form.name}
                  </span>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-colors shadow-lg hover:shadow-xl"
                >
                  {editing ? t("categorias.update") : t("categorias.save")}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  {t("categorias.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
