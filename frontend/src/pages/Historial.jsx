// frontend/src/pages/Historial.jsx
import { useState, useEffect, Fragment, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { useAuth } from "../store/authStore";
import api from "../api";
import Swal from "sweetalert2";
import { useConfig } from "../context/ConfigContext";
import { useTranslation } from "../context/LanguageContext";
import LoaderPOS from "../components/LoaderPOS";
import MoneyDisplay from "../components/MoneyDisplay";
import TicketToPrint from "../components/TicketToPrint";
import { escapeHtml } from "../utils/sanitize";
import {
  History,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertCircle,
  Package,
  ChevronDown,
  ChevronUp,
  Download,
  Printer,
  TrendingUp,
  CreditCard,
  DollarSign,
  Landmark,
  Filter,
  X,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  RefreshCw,
  User,
  SlidersHorizontal,
} from "lucide-react";

const DEFAULT_ITEMS_PER_PAGE = 20;
const MAX_REPORT_RECORDS = 500;
const UPLOADS_URL = import.meta.env.VITE_UPLOADS_URL || "http://localhost:3000";

export default function Historial() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { config, loading: configLoading } = useConfig();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [saleDetails, setSaleDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const [globalStats, setGlobalStats] = useState({
    totalVentas: 0,
    totalTransacciones: 0,
    porMetodo: { efectivo: 0, tarjeta: 0, transferencia: 0 },
  });

  const [generatingReport, setGeneratingReport] = useState(false);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    paymentMethod: "",
    status: "",
  });
  const [activeDateFilter, setActiveDateFilter] = useState("today");

  // ✅ Estados para devolución
  const [refundModal, setRefundModal] = useState(false);
  const [refundSale, setRefundSale] = useState(null);
  const [refundItems, setRefundItems] = useState({});
  const [refundReason, setRefundReason] = useState("");
  const [processingRefund, setProcessingRefund] = useState(false);

  // Estados para impresión de ticket desde historial
  const [showTicket, setShowTicket] = useState(false);
  const [lastSale, setLastSale] = useState(null);
  const ticketRef = useRef(null);

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

  const applyTypeFilter = (type, value) => {
    setAdvancedFilters((prev) => {
      const newFilters = { ...prev };
      if (type === "payment") {
        newFilters.paymentMethod = value;
        newFilters.status = "";
      } else if (type === "status") {
        newFilters.status = value;
        newFilters.paymentMethod = "";
      }
      return newFilters;
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearAdvancedFilters = () => {
    const today = getTodayDate();
    setAdvancedFilters({
      startDate: today,
      endDate: today,
      paymentMethod: "",
      status: "",
    });
    setActiveDateFilter("today");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveAdvancedFilters =
    advancedFilters.startDate !== getTodayDate() ||
    advancedFilters.endDate !== getTodayDate() ||
    advancedFilters.paymentMethod ||
    advancedFilters.status;

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
      if (advancedFilters.paymentMethod)
        baseParams.append("paymentMethod", advancedFilters.paymentMethod);
      if (advancedFilters.status)
        baseParams.append("status", advancedFilters.status);

      const pageParams = new URLSearchParams(baseParams);
      pageParams.append("page", pagination.page);
      pageParams.append(
        "limit",
        config?.appearance?.itemsPerPage || DEFAULT_ITEMS_PER_PAGE,
      );
      const res = await api.get(`/sales?${pageParams.toString()}`);
      setSales(res.data.data || []);
      setPagination(
        res.data.pagination || { page: 1, totalPages: 1, total: 0 },
      );

      // ✅ Estadísticas: solo ventas completadas (excluye refunded)
      const statsParams = new URLSearchParams(baseParams);
      statsParams.append("limit", "9999");
      statsParams.append("status", "completed");
      const statsRes = await api.get(`/sales?${statsParams.toString()}`);
      const allSales = statsRes.data.data || [];
      const totalTransacciones = allSales.length;
      const totalVentas = allSales.reduce(
        (sum, s) => sum + parseFloat(s.total || 0),
        0,
      );
      const porMetodo = {
        efectivo: allSales
          .filter((s) => s.payment_method === "cash")
          .reduce((sum, s) => sum + parseFloat(s.total || 0), 0),
        tarjeta: allSales
          .filter((s) => s.payment_method === "card")
          .reduce((sum, s) => sum + parseFloat(s.total || 0), 0),
        transferencia: allSales
          .filter((s) => s.payment_method === "transfer")
          .reduce((sum, s) => sum + parseFloat(s.total || 0), 0),
      };
      setGlobalStats({ totalVentas, totalTransacciones, porMetodo });
      setSaleDetails({});
      setExpandedRow(null);
    } catch (err) {
      console.error("Error cargando historial:", err);
      setError(err.response?.data?.message || t("historial.error_loading"));
    } finally {
      setLoading(false);
    }
  };

  const loadSaleDetails = async (saleId) => {
    if (saleDetails[saleId]) return;
    setLoadingDetails((prev) => ({ ...prev, [saleId]: true }));
    try {
      const res = await api.get(`/sales/${saleId}`);
      if (res.data.success && res.data.data) {
        setSaleDetails((prev) => ({ ...prev, [saleId]: res.data.data }));
      }
    } finally {
      setLoadingDetails((prev) => ({ ...prev, [saleId]: false }));
    }
  };

  const toggleExpand = async (saleId) => {
    if (expandedRow === saleId) {
      setExpandedRow(null);
    } else {
      setExpandedRow(saleId);
      await loadSaleDetails(saleId);
    }
  };

  useEffect(() => {
    if (user && !configLoading) loadData();
  }, [pagination.page, advancedFilters, configLoading]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [advancedFilters]);

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getProductColor = (name) => {
    const colors = [
      "from-blue-500 to-blue-600",
      "from-green-500 to-green-600",
      "from-purple-500 to-purple-600",
      "from-pink-500 to-pink-600",
    ];
    return colors[(name?.length || 0) % colors.length];
  };

  const ProductImage = ({ imageUrl, productName }) => {
    const [imgError, setImgError] = useState(false);
    const colorClass = getProductColor(productName);
    const firstLetter = productName?.charAt(0).toUpperCase() || "?";
    if (!imageUrl || imgError) {
      return (
        <div
          className={`w-14 h-14 bg-gradient-to-br ${colorClass} rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md`}
        >
          {firstLetter}
        </div>
      );
    }
    return (
      <img
        src={getProductImageUrl(imageUrl)}
        alt={productName}
        className="w-14 h-14 object-cover rounded-xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
        onError={() => setImgError(true)}
      />
    );
  };

  // ✅ Impresión de ticket desde el historial
  const handlePrint = useReactToPrint({
    contentRef: ticketRef,
    onAfterPrint: () => {
      setShowTicket(false);
      setLastSale(null);
    },
    onPrintError: (err) => {
      console.error("❌ Error imprimiendo:", err);
      Swal.fire("Error", "No se pudo imprimir el ticket", "error");
    },
  });

  const printTicket = async (saleId) => {
    try {
      const res = await api.get(`/sales/${saleId}`);
      if (res.data?.success && res.data?.data) {
        const saleDetail = res.data.data;
        setLastSale({
          saleId: saleDetail.id,
          total: saleDetail.total,
          createdAt: saleDetail.createdAt,
          paymentMethod: saleDetail.paymentMethod,
          items: saleDetail.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
        });
        setShowTicket(true);
        setTimeout(() => handlePrint(), 300);
      }
    } catch (err) {
      console.error("Error al cargar ticket:", err);
      Swal.fire("Error", "No se pudo cargar el ticket", "error");
    }
  };

  // ✅ Funciones de devolución
  const openRefundModal = async (sale) => {
    setRefundSale(sale);
    try {
      const res = await api.get(`/sales/${sale.id}`);
      if (res.data?.success && res.data.data) {
        const details = res.data.data;
        if (details.items) {
          const initial = {};
          details.items.forEach((item) => {
            initial[item.productId] = 0;
          });
          setRefundItems(initial);
          setSaleDetails((prev) => ({ ...prev, [sale.id]: details }));
        }
      }
    } catch (err) {
      Swal.fire(
        "Error",
        "No se pudieron cargar los detalles de la venta",
        "error",
      );
      setRefundModal(false);
      return;
    }
    setRefundReason("");
    setRefundModal(true);
  };

  const handleRefundSubmit = async () => {
    if (!refundSale) return;

    const itemsToRefund = Object.entries(refundItems)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        product_id: productId,
        quantity: parseInt(quantity),
      }));

    if (itemsToRefund.length === 0) {
      return Swal.fire(
        "Error",
        "Selecciona al menos un producto para devolver",
        "warning",
      );
    }

    setProcessingRefund(true);
    try {
      const res = await api.post("/refunds", {
        sale_id: refundSale.id,
        items: itemsToRefund,
        reason: refundReason || "Devolución del cliente",
      });

      if (res.data.success) {
        Swal.fire({
          icon: "success",
          title: "Devolución registrada",
          text: `Se devolvieron ${itemsToRefund.length} producto(s). Total reembolsado: $${res.data.data.totalRefunded.toFixed(2)}`,
          timer: 3000,
          showConfirmButton: true,
        });
        setRefundModal(false);
        loadData(); // Recargar historial y estadísticas
      }
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "Error al procesar la devolución",
        "error",
      );
    } finally {
      setProcessingRefund(false);
    }
  };

  // ✅ Generar PDF
  const generatePDFReport = async () => {
    setGeneratingReport(true);
    try {
      Swal.fire({
        title: t("historial.generating"),
        html: "Cargando datos del período filtrado",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const baseParams = new URLSearchParams();
      if (advancedFilters.startDate)
        baseParams.append("start", advancedFilters.startDate);
      if (advancedFilters.endDate)
        baseParams.append("end", advancedFilters.endDate);
      if (advancedFilters.paymentMethod)
        baseParams.append("paymentMethod", advancedFilters.paymentMethod);
      if (advancedFilters.status)
        baseParams.append("status", advancedFilters.status);
      baseParams.append("limit", MAX_REPORT_RECORDS);

      const res = await api.get(`/sales?${baseParams.toString()}`);
      const allSales = res.data.data || [];
      if (allSales.length === 0) {
        Swal.fire(
          "Sin datos",
          "No hay ventas en el período seleccionado",
          "info",
        );
        return;
      }

      Swal.update({
        html: `Cargando detalles de ${allSales.length} ventas...`,
      });
      const saleIds = allSales.map((s) => s.id);
      const detailsPromises = saleIds.map((id) =>
        api.get(`/sales/${id}`).catch(() => ({ data: { data: null } })),
      );
      const detailsResponses = await Promise.all(detailsPromises);
      const allDetails = {};
      detailsResponses.forEach((res, idx) => {
        if (res.data?.data) allDetails[saleIds[idx]] = res.data.data;
      });

      const imageToBase64 = (url) =>
        new Promise((resolve) => {
          if (!url) return resolve(null);
          const img = new Image();
          img.crossOrigin = "Anonymous";
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = () => resolve(null);
          img.src = getProductImageUrl(url);
        });

      const salesWithImages = await Promise.all(
        allSales.map(async (sale) => {
          const details = allDetails[sale.id];
          if (!details?.items) return { ...sale, details: { items: [] } };
          const itemsWithImages = await Promise.all(
            details.items.map(async (item) => {
              let imageBase64 = null;
              if (item.image) imageBase64 = await imageToBase64(item.image);
              return { ...item, imageBase64 };
            }),
          );
          return { ...sale, details: { ...details, items: itemsWithImages } };
        }),
      );

      const reportHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <title>${escapeHtml(t("historial.generate_pdf"))}</title>
          <style>
            body{font-family:Arial,sans-serif;margin:20px;color:#111;background:#fff;line-height:1.4}
            .page-break{page-break-after:always}
            .header{background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#fff;padding:15px 20px;border-radius:8px;margin-bottom:15px}
            .header h1{margin:0 0 5px;font-size:18px;font-weight:700}
            .header p{margin:2px 0;opacity:0.95;font-size:11px}
            .sale-card{border:1px solid #e2e8f0;border-radius:8px;margin:15px 0;overflow:hidden}
            .sale-header{background:#f8fafc;padding:10px 15px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
            .sale-header .left{display:flex;flex-direction:column;gap:2px}
            .sale-header .right{text-align:right}
            .sale-header .badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:600}
            .badge-method{background:#e0e7ff;color:#3730a3}
            .badge-status{background:#dcfce7;color:#166534}
            .badge-status.pending{background:#fef3c7;color:#92400e}
            .badge-status.cancelled{background:#fee2e2;color:#991b1b}
            .badge-status.refunded{background:#f3e8ff;color:#6b21a8}
            .operator{display:flex;align-items:center;gap:4px;font-size:11px;color:#64748b}
            table{width:100%;border-collapse:collapse;font-size:11px}
            th{background:#f1f5f9;padding:8px 10px;text-align:left;font-weight:600;color:#475569}
            td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
            tr:last-child td{border-bottom:none}
            .product-img{width:40px;height:40px;object-fit:cover;border-radius:5px;border:1px solid #e2e8f0}
            .product-placeholder{width:40px;height:40px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:5px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:16px}
            .sale-total{background:#f8fafc;padding:10px 15px;text-align:right;font-weight:700;color:#16a34a;font-size:13px;border-top:1px solid #e2e8f0}
            .summary{margin-top:25px;padding-top:20px;border-top:2px solid #e2e8f0}
            .summary-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:10px}
            .summary-card{background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px;text-align:center}
            .summary-card h4{margin:0 0 4px;color:#475569;font-size:11px;text-transform:uppercase}
            .summary-card .value{font-size:20px;font-weight:800;color:#0f172a}
            .footer{margin-top:25px;padding-top:15px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:10px}
            @media print{body{margin:10px}.page-break{page-break-after:always}.sale-card{break-inside:avoid}}
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 ${escapeHtml(t("historial.generate_pdf"))}</h1>
            <p><strong>${escapeHtml(t("historial.date_from"))}:</strong> ${escapeHtml(advancedFilters.startDate || "Inicio")} → ${escapeHtml(advancedFilters.endDate || "Actual")}</p>
            <p><strong>${escapeHtml(t("historial.status"))}:</strong> ${escapeHtml(advancedFilters.status ? (advancedFilters.status === "completed" ? t("historial.completed") : advancedFilters.status === "pending" ? t("historial.pending") : t("historial.cancelled")) : t("historial.all"))}</p>
            <p><strong>${escapeHtml(t("historial.generating"))}:</strong> ${new Date().toLocaleString("es-ES")} | ${escapeHtml(t("layout.user"))}: ${escapeHtml(user?.name || user?.email || "Sistema")}</p>
          </div>
          ${salesWithImages
            .map((sale) => {
              const details = sale.details;
              if (!details?.items?.length) return "";
              const methodText =
                sale.payment_method === "cash"
                  ? t("historial.cash")
                  : sale.payment_method === "card"
                    ? t("historial.card")
                    : t("historial.transfer");
              const statusText =
                sale.status === "completed"
                  ? t("historial.completed")
                  : sale.status === "pending"
                    ? t("historial.pending")
                    : sale.status === "cancelled"
                      ? t("historial.cancelled")
                      : "Reembolsado";
              const statusClass =
                sale.status === "completed"
                  ? ""
                  : sale.status === "pending"
                    ? " pending"
                    : sale.status === "cancelled"
                      ? " cancelled"
                      : " refunded";
              return `
                <div class="sale-card">
                  <div class="sale-header">
                    <div class="left">
                      <strong style="font-size:13px">🧾 ${escapeHtml(t("historial.detail.title"))} #${escapeHtml(sale.id.slice(0, 8))}</strong>
                      <span style="font-size:11px;color:#64748b">${formatDate(sale.created_at)}</span>
                      <div class="operator"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ${escapeHtml(sale.cashier_name || "Sistema")}</div>
                    </div>
                    <div class="right">
                      <span class="badge badge-method">${escapeHtml(methodText)}</span>
                      <span class="badge badge-status${statusClass}">${escapeHtml(statusText)}</span>
                    </div>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style="width:45px">${escapeHtml(t("historial.detail.image"))}</th>
                        <th>${escapeHtml(t("historial.detail.product"))}</th>
                        <th style="width:50px;text-align:center">${escapeHtml(t("historial.detail.quantity"))}</th>
                        <th style="width:70px;text-align:right">${escapeHtml(t("historial.detail.unit_price"))}</th>
                        <th style="width:70px;text-align:right">${escapeHtml(t("historial.detail.subtotal"))}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${details.items
                        .map((item) => {
                          const firstLetter =
                            item.name?.charAt(0).toUpperCase() || "?";
                          return `
                            <tr>
                              <td style="text-align:center">${item.imageBase64 ? `<img src="${item.imageBase64}" class="product-img" alt="${escapeHtml(item.name)}"/>` : `<div class="product-placeholder">${escapeHtml(firstLetter)}</div>`}</td>
                              <td><div style="font-weight:600">${escapeHtml(item.name)}</div>${item.sku ? `<div style="font-size:9px;color:#64748b;margin-top:1px">SKU: ${escapeHtml(item.sku)}</div>` : ""}</td>
                              <td style="text-align:center;font-weight:600;color:#2563eb">${item.quantity}</td>
                              <td style="text-align:right">${item.unitPrice.toFixed(2)}</td>
                              <td style="text-align:right;font-weight:600">${item.subtotal.toFixed(2)}</td>
                            </tr>
                          `;
                        })
                        .join("")}
                    </tbody>
                  </table>
                  <div class="sale-total">${escapeHtml(t("historial.detail.total"))}: ${parseFloat(sale.total).toFixed(2)}</div>
                </div>
              `;
            })
            .join("")}
          <div class="summary">
            <h3 style="margin:0 0 10px;font-size:14px;color:#1e293b">📈 ${escapeHtml(t("historial.ingresos_totales"))}</h3>
            <div class="summary-grid">
              <div class="summary-card"><h4>${escapeHtml(t("historial.ventas_realizadas"))}</h4><div class="value">${globalStats.totalTransacciones || allSales.length}</div></div>
              <div class="summary-card"><h4>${escapeHtml(t("historial.ingresos_totales"))}</h4><div class="value">${globalStats.totalVentas.toFixed(2)}</div></div>
              <div class="summary-card"><h4>${escapeHtml(t("historial.efectivo"))}</h4><div class="value">${(globalStats.porMetodo?.efectivo || 0).toFixed(2)}</div></div>
              <div class="summary-card"><h4>${escapeHtml(t("historial.tarjeta"))}</h4><div class="value">${(globalStats.porMetodo?.tarjeta || 0).toFixed(2)}</div></div>
            </div>
          </div>
          <div class="footer">
            <p>Sistema POS © ${new Date().getFullYear()} - ${escapeHtml(t("historial.generate_pdf"))}</p>
            <p style="margin-top:5px;font-style:italic">"${escapeHtml(t("config.invoice.footer_message"))}"</p>
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
          Swal.fire({
            icon: "success",
            title: "✅ Reporte generado",
            text: `Incluye ${allSales.length} ventas con productos e imágenes`,
            timer: 2000,
            showConfirmButton: false,
          });
        }, 500);
      }
    } catch (err) {
      console.error("❌ Error generando reporte:", err);
      Swal.fire("Error", "No se pudo generar el reporte", "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  // ✅ Exportar a CSV
  const exportToCSV = () => {
    if (!sales.length) return;
    const headers = [
      "ID",
      "Fecha",
      "Operador",
      "Productos",
      "Cantidad Total",
      "Total",
      "Método Pago",
      "Estado",
    ];
    const rows = sales.map((s) => {
      const details = saleDetails[s.id];
      const productos =
        details?.items
          ?.map((item) => `${item.name} x${item.quantity}`)
          .join("; ") || "";
      const totalCantidad =
        details?.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) ||
        s.items_count ||
        0;
      return [
        s.id.slice(0, 8),
        formatDate(s.created_at),
        s.cashier_name || "N/A",
        productos,
        totalCantidad,
        parseFloat(s.total || 0).toFixed(2),
        s.payment_method === "cash"
          ? t("historial.cash")
          : s.payment_method === "card"
            ? t("historial.card")
            : t("historial.transfer"),
        s.status === "completed"
          ? t("historial.completed")
          : s.status === "cancelled"
            ? t("historial.cancelled")
            : s.status === "refunded"
              ? "Reembolsado"
              : t("historial.pending"),
      ];
    });
    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `historial_ventas_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && sales.length === 0)
    return <LoaderPOS message={t("historial.loading")} />;

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-4">
        <AlertCircle className="text-amber-500 mb-4" size={48} />
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {t("historial.error_loading")}
        </h3>
        <p className="text-gray-600 mb-4 max-w-md">{error}</p>
        <button
          onClick={loadData}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {t("historial.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <History className="text-blue-600" size={28} />{" "}
            {t("historial.title")}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {user?.role === "admin"
              ? t("historial.subtitle_admin")
              : t("historial.subtitle_cashier")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            disabled={sales.length === 0}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} /> {t("historial.export_csv")}
          </button>
          <button
            onClick={generatePDFReport}
            disabled={generatingReport || sales.length === 0}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
          >
            {generatingReport ? (
              t("historial.generating")
            ) : (
              <FileText size={16} />
            )}{" "}
            {t("historial.generate_pdf")}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-sm font-medium">
                {t("historial.ventas_realizadas")}
              </p>
              <p className="text-4xl font-bold mt-2">
                {globalStats.totalTransacciones}
              </p>
              <div className="flex items-center gap-1 mt-3 text-blue-100">
                <ArrowUpRight size={16} />
                <span className="text-sm">
                  {t("historial.total_transacciones")}
                </span>
              </div>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <TrendingUp size={28} />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-100 text-sm font-medium">
                {t("historial.ingresos_totales")}
              </p>
              <p className="text-4xl font-bold mt-2">
                <MoneyDisplay amount={globalStats.totalVentas} />
              </p>
              <div className="flex items-center gap-1 mt-3 text-green-100">
                <ArrowUpRight size={16} />
                <span className="text-sm">
                  {t("historial.total_recaudado")}
                </span>
              </div>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <DollarSign size={28} />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20">
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <CreditCard size={12} />
                <span>{t("historial.tarjeta")}</span>
                <span className="font-semibold">
                  <MoneyDisplay amount={globalStats.porMetodo?.tarjeta} />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Landmark size={12} />
                <span>{t("historial.efectivo")}</span>
                <span className="font-semibold">
                  <MoneyDisplay amount={globalStats.porMetodo?.efectivo} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <SlidersHorizontal size={16} /> {t("historial.filters_advanced")}{" "}
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
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              activeDateFilter === "today"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Calendar size={16} /> {t("historial.today")}
          </button>
          <button
            onClick={() => applyDateFilter("week")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              activeDateFilter === "week"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Calendar size={16} /> {t("historial.this_week")}
          </button>
          <button
            onClick={() => applyDateFilter("month")}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              activeDateFilter === "month"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <Calendar size={16} /> {t("historial.this_month")}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyTypeFilter("payment", "")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              !advancedFilters.paymentMethod && !advancedFilters.status
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {t("historial.all")}
          </button>
          <button
            onClick={() => applyTypeFilter("payment", "cash")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              advancedFilters.paymentMethod === "cash"
                ? "bg-green-500 text-white"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {t("historial.cash")}
          </button>
          <button
            onClick={() => applyTypeFilter("payment", "card")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              advancedFilters.paymentMethod === "card"
                ? "bg-blue-500 text-white"
                : "bg-blue-100 text-blue-700 hover:bg-blue-200"
            }`}
          >
            {t("historial.card")}
          </button>
          <button
            onClick={() => applyTypeFilter("payment", "transfer")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              advancedFilters.paymentMethod === "transfer"
                ? "bg-purple-500 text-white"
                : "bg-purple-100 text-purple-700 hover:bg-purple-200"
            }`}
          >
            {t("historial.transfer")}
          </button>
          <button
            onClick={() => applyTypeFilter("status", "completed")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              advancedFilters.status === "completed"
                ? "bg-emerald-500 text-white"
                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            }`}
          >
            {t("historial.completed")}
          </button>
          <button
            onClick={() => applyTypeFilter("status", "pending")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              advancedFilters.status === "pending"
                ? "bg-yellow-500 text-white"
                : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            }`}
          >
            {t("historial.pending")}
          </button>
          <button
            onClick={() => applyTypeFilter("status", "cancelled")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              advancedFilters.status === "cancelled"
                ? "bg-red-500 text-white"
                : "bg-red-100 text-red-700 hover:bg-red-200"
            }`}
          >
            {t("historial.cancelled")}
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="pt-3 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <Calendar size={12} /> {t("historial.date_from")}
              </label>
              <input
                type="date"
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                value={advancedFilters.startDate}
                onChange={(e) => {
                  setAdvancedFilters({
                    ...advancedFilters,
                    startDate: e.target.value,
                  });
                  setActiveDateFilter(null);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <Calendar size={12} /> {t("historial.date_to")}
              </label>
              <input
                type="date"
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                value={advancedFilters.endDate}
                onChange={(e) => {
                  setAdvancedFilters({
                    ...advancedFilters,
                    endDate: e.target.value,
                  });
                  setActiveDateFilter(null);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">
                {t("historial.payment_method")}
              </label>
              <select
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                value={advancedFilters.paymentMethod}
                onChange={(e) => {
                  setAdvancedFilters({
                    ...advancedFilters,
                    paymentMethod: e.target.value,
                    status: "",
                  });
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <option value="">{t("historial.all")}</option>
                <option value="cash">{t("historial.cash")}</option>
                <option value="card">{t("historial.card")}</option>
                <option value="transfer">{t("historial.transfer")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">
                {t("historial.status")}
              </label>
              <select
                className="w-full mt-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
                value={advancedFilters.status}
                onChange={(e) => {
                  setAdvancedFilters({
                    ...advancedFilters,
                    status: e.target.value,
                    paymentMethod: "",
                  });
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              >
                <option value="">{t("historial.all")}</option>
                <option value="completed">{t("historial.completed")}</option>
                <option value="pending">{t("historial.pending")}</option>
                <option value="cancelled">{t("historial.cancelled")}</option>
              </select>
            </div>
            {hasActiveAdvancedFilters && (
              <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
                <button
                  onClick={clearAdvancedFilters}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {t("historial.clear_filters")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabla de ventas */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {sales.length === 0 ? (
          <div className="text-center py-12">
            <History className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-gray-500 font-medium">
              {hasActiveAdvancedFilters
                ? t("historial.no_sales")
                : t("historial.no_sales_registered")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="w-10 px-6 py-3"></th>
                  <th className="px-6 py-3">{t("historial.columns.id")}</th>
                  <th className="px-6 py-3">
                    {t("historial.columns.operator")}
                  </th>
                  <th className="px-6 py-3">{t("historial.columns.total")}</th>
                  <th className="px-6 py-3">{t("historial.columns.method")}</th>
                  <th className="px-6 py-3">{t("historial.columns.status")}</th>
                  <th className="px-6 py-3 text-center">
                    {t("historial.columns.quantity")}
                  </th>
                  <th className="px-6 py-3">{t("historial.columns.date")}</th>
                  <th className="px-6 py-3 text-center">
                    {t("historial.columns.action")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((s) => {
                  const saleDetail = saleDetails[s.id];
                  const isLoadingDetails = loadingDetails[s.id];
                  const totalCantidad =
                    saleDetail?.items?.reduce(
                      (sum, item) => sum + (item.quantity || 0),
                      0,
                    ) ||
                    s.items_count ||
                    0;
                  return (
                    <Fragment key={s.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleExpand(s.id)}
                            className="hover:bg-gray-200 p-1 rounded transition-colors"
                          >
                            {expandedRow === s.id ? (
                              <ChevronUp size={16} className="text-gray-600" />
                            ) : (
                              <ChevronDown
                                size={16}
                                className="text-gray-600"
                              />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">
                          {s.id.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-gray-400" />
                            <span className="text-sm font-medium text-gray-800">
                              {s.cashier_name || "Sistema"}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-green-700">
                          <MoneyDisplay amount={s.total} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1 text-sm">
                            {s.payment_method === "cash" && (
                              <DollarSign
                                size={14}
                                className="text-green-600"
                              />
                            )}
                            {s.payment_method === "card" && (
                              <CreditCard size={14} className="text-blue-600" />
                            )}
                            {s.payment_method === "transfer" && (
                              <Landmark size={14} className="text-purple-600" />
                            )}
                            {s.payment_method === "cash"
                              ? t("historial.cash")
                              : s.payment_method === "card"
                                ? t("historial.card")
                                : t("historial.transfer")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              s.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : s.status === "cancelled"
                                  ? "bg-red-100 text-red-800"
                                  : s.status === "refunded"
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {s.status === "completed"
                              ? t("historial.completed")
                              : s.status === "cancelled"
                                ? t("historial.cancelled")
                                : s.status === "refunded"
                                  ? "Reembolsado"
                                  : t("historial.pending")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-center font-bold text-blue-600">
                          {totalCantidad}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(s.created_at)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => printTicket(s.id)}
                              className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1 transition-colors text-sm"
                              title={t("historial.print_ticket")}
                            >
                              <Printer size={14} />{" "}
                              {t("historial.print_ticket")}
                            </button>
                            {s.status === "completed" && (
                              <button
                                onClick={() => openRefundModal(s)}
                                className="bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 flex items-center gap-1 transition-colors text-sm"
                                title="Devolver productos"
                              >
                                <ArrowDownRight size={14} /> Devolver
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedRow === s.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="ml-8">
                              <div className="flex items-center gap-2 mb-4">
                                <Package size={18} className="text-blue-500" />
                                <h4 className="font-semibold text-gray-700 text-lg">
                                  {t("historial.detail.title")}
                                </h4>
                                <span className="text-sm text-gray-500">
                                  ({t("historial.detail.total_units")}{" "}
                                  {totalCantidad})
                                </span>
                              </div>
                              {isLoadingDetails ? (
                                <div className="flex justify-center py-8">
                                  <span className="text-gray-600">
                                    {t("historial.detail.loading_details")}
                                  </span>
                                </div>
                              ) : saleDetail?.items ? (
                                <div className="overflow-x-auto">
                                  <table className="min-w-full text-sm">
                                    <thead>
                                      <tr className="border-b-2 border-gray-200 bg-gray-100">
                                        <th className="text-left py-3 px-4 text-gray-600 font-semibold">
                                          {t("historial.detail.image")}
                                        </th>
                                        <th className="text-left py-3 px-4 text-gray-600 font-semibold">
                                          {t("historial.detail.product")}
                                        </th>
                                        <th className="text-center py-3 px-4 text-gray-600 font-semibold">
                                          {t("historial.detail.quantity")}
                                        </th>
                                        <th className="text-right py-3 px-4 text-gray-600 font-semibold">
                                          {t("historial.detail.unit_price")}
                                        </th>
                                        <th className="text-right py-3 px-4 text-gray-600 font-semibold">
                                          {t("historial.detail.subtotal")}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {saleDetail.items.map((item, idx) => (
                                        <tr
                                          key={idx}
                                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                        >
                                          <td className="py-3 px-4">
                                            <ProductImage
                                              imageUrl={item.image}
                                              productName={item.name}
                                            />
                                          </td>
                                          <td className="py-3 px-4">
                                            <div className="flex flex-col">
                                              <span className="font-medium text-gray-800">
                                                {item.name}
                                              </span>
                                              {item.sku && (
                                                <span className="text-xs text-gray-400 mt-1">
                                                  SKU: {item.sku}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="text-center py-3 px-4">
                                            <span className="font-bold text-blue-600 text-lg">
                                              {item.quantity}
                                            </span>
                                          </td>
                                          <td className="text-right py-3 px-4 text-gray-700">
                                            <MoneyDisplay
                                              amount={item.unitPrice}
                                            />
                                          </td>
                                          <td className="text-right py-3 px-4">
                                            <span className="font-semibold text-gray-800">
                                              <MoneyDisplay
                                                amount={item.subtotal}
                                              />
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 border-gray-200 bg-gray-100">
                                        <td
                                          colSpan="2"
                                          className="py-3 px-4 text-right font-bold text-gray-700"
                                        >
                                          {t(
                                            "historial.detail.total_units_footer",
                                          )}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          <span className="font-bold text-blue-600 text-lg">
                                            {totalCantidad}
                                          </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-gray-700">
                                          {t("historial.detail.total")}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                          <span className="font-bold text-green-700 text-xl">
                                            <MoneyDisplay
                                              amount={saleDetail.total}
                                            />
                                          </span>
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-center py-8 text-gray-500">
                                  <AlertCircle
                                    className="mx-auto mb-2"
                                    size={32}
                                  />
                                  {t("historial.detail.error_details")}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
            <div className="text-sm text-gray-600">
              {t("historial.pagination.showing")} {sales.length}{" "}
              {t("historial.pagination.of")} {pagination.total}{" "}
              {t("historial.pagination.records")}
            </div>
            <div className="flex items-center gap-4">
              <button
                disabled={pagination.page === 1}
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
                className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg flex items-center gap-1"
              >
                <ChevronLeft size={18} /> {t("historial.pagination.previous")}
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
                      className={`px-3 py-1 rounded-lg ${
                        pagination.page === pageNum
                          ? "bg-blue-600 text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
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
                {t("historial.pagination.next")} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Devolución */}
      {refundModal && refundSale && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !processingRefund && setRefundModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ArrowDownRight size={24} /> Devolución de Venta
                </h2>
                <p className="text-orange-100 text-sm">
                  Venta #{refundSale.id.slice(0, 8)} - Total original: $
                  {parseFloat(refundSale.total).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => !processingRefund && setRefundModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50">
              <div className="bg-white rounded-xl p-4 border">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Productos a devolver
                </h3>
                {saleDetails[refundSale.id]?.items?.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between py-3 border-b last:border-b-0"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        Precio unitario: ${item.unitPrice.toFixed(2)} |
                        Vendidos: {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <input
                        type="number"
                        min="0"
                        max={item.quantity}
                        value={refundItems[item.productId] || 0}
                        onChange={(e) => {
                          const val = Math.min(
                            Math.max(0, parseInt(e.target.value) || 0),
                            item.quantity,
                          );
                          setRefundItems((prev) => ({
                            ...prev,
                            [item.productId]: val,
                          }));
                        }}
                        className="w-16 text-center border rounded-lg py-1.5 text-sm"
                        disabled={processingRefund}
                      />
                      <span className="text-sm text-gray-500">
                        / {item.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo de devolución
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="Ej: Producto dañado, error en el pedido..."
                  disabled={processingRefund}
                />
              </div>
            </div>

            <div className="border-t border-gray-200 p-4 bg-white flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Total a reembolsar:{" "}
                <strong className="text-lg text-green-600">
                  $
                  {Object.entries(refundItems)
                    .reduce((total, [productId, qty]) => {
                      const item = saleDetails[refundSale.id]?.items?.find(
                        (i) => i.productId === productId,
                      );
                      return total + qty * (item?.unitPrice || 0);
                    }, 0)
                    .toFixed(2)}
                </strong>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setRefundModal(false)}
                  disabled={processingRefund}
                  className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRefundSubmit}
                  disabled={
                    processingRefund ||
                    Object.values(refundItems).every((qty) => qty === 0)
                  }
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {processingRefund ? (
                    <>Procesando...</>
                  ) : (
                    <>
                      <ArrowDownRight size={18} /> Procesar Devolución
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticket oculto para impresión */}
      <div
        style={{
          display: showTicket && lastSale ? "block" : "none",
          position: "absolute",
          left: "-9999px",
        }}
      >
        {lastSale && (
          <TicketToPrint
            ref={ticketRef}
            saleData={lastSale}
            items={lastSale.items}
            storeInfo={{ cashier: user?.name || "Admin" }}
            config={config}
          />
        )}
      </div>
    </div>
  );
}
