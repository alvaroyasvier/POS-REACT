// frontend/src/pages/CashManagement.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../api";
import { useAuth } from "../store/authStore";
import { useConfig } from "../context/ConfigContext";
import { useTranslation } from "../context/LanguageContext";
import MoneyDisplay from "../components/MoneyDisplay";
import Swal from "sweetalert2";
import { escapeHtml } from "../utils/sanitize";
import {
  Banknote,
  Wallet,
  CreditCard,
  Landmark,
  Coins,
  Store,
  TrendingUp,
  History,
  XCircle,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  User,
  Calculator,
  ArrowUpRight,
  LogOut,
  X,
  ChevronDown,
  ChevronUp,
  Lock,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const getBillColor = (value) => {
  if (value >= 1000) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (value >= 100) return "bg-green-50 text-green-700 border-green-200";
  if (value >= 50) return "bg-teal-50 text-teal-700 border-teal-200";
  return "bg-cyan-50 text-cyan-700 border-cyan-200";
};
const getCoinColor = (value) => {
  if (value >= 10) return "bg-amber-50 text-amber-700 border-amber-200";
  if (value >= 1) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (value >= 0.25) return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
};

function CashCountModal({ isOpen, onClose, bills, coins, onSubmit, config }) {
  const { t } = useTranslation();
  const [counts, setCounts] = useState({});
  const [cardAmount, setCardAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initial = {};
      [...bills, ...coins].forEach((d) => (initial[d.id] = 0));
      setCounts(initial);
      setCardAmount("");
      setTransferAmount("");
    }
  }, [isOpen, bills, coins]);

  const cashTotal = useMemo(() => {
    return [...bills, ...coins].reduce(
      (sum, d) => sum + (counts[d.id] || 0) * d.value,
      0,
    );
  }, [counts, bills, coins]);

  const cardTotal = parseFloat(cardAmount) || 0;
  const transferTotal = parseFloat(transferAmount) || 0;
  const grandTotal = cashTotal + cardTotal + transferTotal;

  const handleInputChange = (id, val) => {
    const num = Math.max(0, parseInt(val) || 0);
    setCounts((prev) => ({ ...prev, [id]: num }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const countsArray = [...bills, ...coins].map((d) => ({
        denomination_id: d.id,
        quantity: counts[d.id] || 0,
      }));
      await onSubmit({
        counts: countsArray,
        card_amount: cardTotal,
        transfer_amount: transferTotal,
      });
      onClose();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: t("cashmanagement.error_close"),
        text: err.response?.data?.message || t("cashmanagement.error_close"),
        confirmButtonColor: "#3b82f6",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const localFormatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    const system = config?.system || {};
    const {
      currencySymbol = "$",
      thousandsSeparator = ",",
      decimalPlaces = 2,
    } = system;
    const fixed = num.toFixed(decimalPlaces);
    const parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
    return `${currencySymbol} ${parts.join(".")}`.trim();
  };

  const DenomItem = ({ d }) => {
    const isBill = d.type === "bill";
    const Icon = isBill ? Banknote : Coins;
    const colorClass = isBill ? getBillColor(d.value) : getCoinColor(d.value);
    const subtotal = (counts[d.id] || 0) * d.value;

    return (
      <div
        className={`flex items-center justify-between p-3 rounded-xl border ${colorClass} transition-all hover:shadow-md`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm border border-gray-100">
            <Icon size={20} />
          </div>
          <div>
            <p className="font-bold text-gray-800">
              {localFormatCurrency(d.value)}
            </p>
            <p className="text-xs uppercase tracking-wider opacity-70">
              {isBill ? t("cashmanagement.bill") : t("cashmanagement.coin")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right mr-2">
            <p className="text-xs text-gray-500">
              {t("cashmanagement.subtotal")}
            </p>
            <p className="font-semibold text-gray-700">
              {localFormatCurrency(subtotal)}
            </p>
          </div>
          <input
            type="number"
            min="0"
            value={counts[d.id] || 0}
            onChange={(e) => handleInputChange(d.id, e.target.value)}
            className="w-16 text-center font-bold border-2 border-gray-200 rounded-lg py-1.5 focus:border-blue-500 outline-none bg-white"
            onFocus={(e) => e.target.select()}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calculator size={24} />
            <div>
              <h2 className="text-xl font-bold">
                {t("cashmanagement.closing_title")}
              </h2>
              <p className="text-blue-100 text-sm">
                {t("cashmanagement.closing_subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-gray-50">
          {bills.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Banknote size={20} className="text-emerald-600" />{" "}
                {t("cashmanagement.bills")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bills.map((d) => (
                  <DenomItem key={d.id} d={d} />
                ))}
              </div>
            </section>
          )}
          {coins.length > 0 && (
            <section>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Coins size={20} className="text-amber-600" />{" "}
                {t("cashmanagement.coins")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {coins.map((d) => (
                  <DenomItem key={d.id} d={d} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <CreditCard size={20} className="text-blue-600" />{" "}
              {t("cashmanagement.other_methods")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  {t("cashmanagement.card_total")}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-blue-500 font-bold">
                    {config?.system?.currencySymbol || "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                    className="pl-8 w-full py-2.5 px-4 rounded-xl border border-blue-300 focus:ring-2 focus:ring-blue-500 bg-white font-semibold"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <label className="block text-sm font-medium text-purple-700 mb-2">
                  {t("cashmanagement.transfer_total")}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-purple-500 font-bold">
                    {config?.system?.currencySymbol || "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="pl-8 w-full py-2.5 px-4 rounded-xl border border-purple-300 focus:ring-2 focus:ring-purple-500 bg-white font-semibold"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="border-t border-gray-200 p-5 bg-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="bg-gray-100 rounded-xl p-4 text-center flex-1 w-full">
              <p className="text-sm text-gray-500 mb-1">
                {t("cashmanagement.total_cash")}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {localFormatCurrency(grandTotal)}
              </p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 md:flex-none px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                {t("cashmanagement.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />{" "}
                    {t("cashmanagement.processing")}
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} /> {t("cashmanagement.close_button")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const StatCard = ({ label, value, icon: Icon, color = "gray" }) => {
  const colors = {
    gray: "bg-gray-50 text-gray-700 border-gray-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
  };
  return (
    <div
      className={`rounded-xl p-4 border ${colors[color]} transition-all hover:shadow-md`}
    >
      <div className="flex justify-between items-start">
        <span className="text-sm font-medium opacity-70">{label}</span>
        {Icon && <Icon size={18} className="opacity-70" />}
      </div>
      <div className="mt-1 text-2xl font-bold text-gray-900">
        <MoneyDisplay amount={value} />
      </div>
    </div>
  );
};

const PaymentBadge = ({ method }) => {
  const { t } = useTranslation();
  const configMap = {
    cash: {
      icon: Banknote,
      label: t("cashmanagement.cash"),
      color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    card: {
      icon: CreditCard,
      label: t("cashmanagement.card"),
      color: "bg-blue-100 text-blue-700 border-blue-200",
    },
    transfer: {
      icon: Landmark,
      label: t("cashmanagement.transfer"),
      color: "bg-purple-100 text-purple-700 border-purple-200",
    },
  };
  const { icon: Icon, label, color } = configMap[method] || configMap.cash;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${color}`}
    >
      <Icon size={12} /> {label}
    </span>
  );
};

export default function CashManagement() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { config } = useConfig();
  const isAdmin = user?.role === "admin";

  const [cashiers, setCashiers] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [closedSessions, setClosedSessions] = useState([]);
  const [denominations, setDenominations] = useState([]);
  const [activeSessionDetail, setActiveSessionDetail] = useState(null);
  const [sessionSales, setSessionSales] = useState([]);
  const [sessionTotals, setSessionTotals] = useState({
    efectivo: 0,
    tarjeta: 0,
    transferencia: 0,
    total: 0,
  });
  const [activeSessionTotals, setActiveSessionTotals] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState("");
  const [initialAmount, setInitialAmount] = useState("");
  const [showCountModal, setShowCountModal] = useState(false);
  const [closeSessionData, setCloseSessionData] = useState(null);
  const [showHistory, setShowHistory] = useState(true);

  // Paginación historial de cierres
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyFilters, setHistoryFilters] = useState({
    start: "",
    end: "",
    cashier: "",
  });
  const itemsPerPageHistory = config?.appearance?.itemsPerPage || 20;

  // Paginación ventas de la sesión (cajero)
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotalPages, setSalesTotalPages] = useState(1);
  const [salesTotal, setSalesTotal] = useState(0);
  const itemsPerPageSales = config?.appearance?.itemsPerPage || 20;

  useEffect(() => {
    loadDenominations();
    if (isAdmin) {
      loadCashiers();
      loadActiveSessions();
      loadClosedSessions();
    } else {
      loadMyActiveSession();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin && activeSessionDetail?.id) {
      loadSessionSales(activeSessionDetail.id);
    }
  }, [activeSessionDetail, isAdmin, salesPage]);

  const loadDenominations = async () => {
    try {
      const res = await api.get("/cash/denominations");
      setDenominations(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };
  const loadCashiers = async () => {
    try {
      const res = await api.get("/users/cashiers");
      setCashiers(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };
  const loadActiveSessions = async () => {
    try {
      const sessions =
        (await api.get("/cash/sessions/all-active")).data.data || [];
      setActiveSessions(sessions);
      const map = {};
      await Promise.all(
        sessions.map(async (s) => {
          try {
            // ✅ SOLO VENTAS COMPLETADAS para los totales de sesión
            const sales =
              (
                await api.get(
                  `/sales?cash_session_id=${s.id}&limit=1000&status=completed`,
                )
              ).data.data || [];
            let e = 0,
              t = 0,
              tr = 0;
            sales.forEach((sl) => {
              const tot = parseFloat(sl.total) || 0;
              if (sl.payment_method === "cash") e += tot;
              else if (sl.payment_method === "card") t += tot;
              else if (sl.payment_method === "transfer") tr += tot;
            });
            map[s.id] = {
              efectivo: e,
              tarjeta: t,
              transferencia: tr,
              total: e + t + tr,
            };
          } catch {
            map[s.id] = { efectivo: 0, tarjeta: 0, transferencia: 0, total: 0 };
          }
        }),
      );
      setActiveSessionTotals(map);
    } catch (err) {
      console.error(err);
    }
  };

  const loadClosedSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append("page", historyPage);
      params.append("limit", itemsPerPageHistory);
      if (historyFilters.start) params.append("start", historyFilters.start);
      if (historyFilters.end) params.append("end", historyFilters.end);
      if (historyFilters.cashier)
        params.append("cashier", historyFilters.cashier);
      const res = await api.get(`/cash/sessions/closed?${params.toString()}`);
      setClosedSessions(res.data.data || []);
      setHistoryTotalPages(res.data.pagination?.totalPages || 1);
      setHistoryTotal(res.data.pagination?.total || 0);
    } catch {
      setClosedSessions([]);
    }
  }, [historyPage, historyFilters, itemsPerPageHistory]);

  useEffect(() => {
    if (isAdmin) loadClosedSessions();
  }, [loadClosedSessions, isAdmin]);

  const loadMyActiveSession = async () => {
    try {
      const res = await api.get("/cash/sessions/active");
      if (res.data.data) setActiveSessionDetail(res.data.data);
      else {
        setActiveSessionDetail(null);
        setSessionSales([]);
        setSessionTotals({
          efectivo: 0,
          tarjeta: 0,
          transferencia: 0,
          total: 0,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadSessionSales = async (sid) => {
    try {
      const params = new URLSearchParams();
      params.append("page", salesPage);
      params.append("limit", itemsPerPageSales);
      // ✅ SOLO VENTAS COMPLETADAS en la lista y totales del cajero
      params.append("status", "completed");
      const res = await api.get(
        `/sales?cash_session_id=${sid}&${params.toString()}`,
      );
      const sales = res.data.data || [];
      setSessionSales(sales);
      setSalesTotalPages(res.data.pagination?.totalPages || 1);
      setSalesTotal(res.data.pagination?.total || 0);
      let e = 0,
        t = 0,
        tr = 0;
      sales.forEach((sl) => {
        const tot = parseFloat(sl.total) || 0;
        if (sl.payment_method === "cash") e += tot;
        else if (sl.payment_method === "card") t += tot;
        else if (sl.payment_method === "transfer") tr += tot;
      });
      setSessionTotals({
        efectivo: e,
        tarjeta: t,
        transferencia: tr,
        total: e + t + tr,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const openSessionForCashier = async () => {
    if (!selectedCashier)
      return Swal.fire({
        icon: "warning",
        title: t("cashmanagement.select_cashier"),
        confirmButtonColor: "#3b82f6",
      });
    if (!initialAmount || parseFloat(initialAmount) <= 0)
      return Swal.fire({
        icon: "warning",
        title: t("cashmanagement.invalid_amount"),
        confirmButtonColor: "#3b82f6",
      });

    setLoading(true);
    try {
      await api.post("/cash/sessions/admin/open", {
        user_id: selectedCashier,
        initial_amount: parseFloat(initialAmount),
      });
      Swal.fire({
        icon: "success",
        title: t("cashmanagement.session_opened"),
        text: t("cashmanagement.session_opened_text"),
        confirmButtonColor: "#3b82f6",
      });
      setSelectedCashier("");
      setInitialAmount("");
      loadActiveSessions();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: t("cashmanagement.error_open"),
        text: err.response?.data?.message || t("cashmanagement.error_open"),
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setLoading(false);
    }
  };

  const requestCloseSession = (sid, isAdm) => {
    setCloseSessionData({ sessionId: sid, isAdminClose: isAdm });
    setShowCountModal(true);
  };

  const handleModalSubmit = async ({
    counts,
    card_amount = 0,
    transfer_amount = 0,
  }) => {
    if (!closeSessionData) return;
    const { sessionId, isAdminClose } = closeSessionData;
    try {
      const res = await api.post(
        isAdminClose
          ? `/cash/sessions/${sessionId}/admin-close`
          : `/cash/sessions/${sessionId}/close`,
        { counts, card_amount, transfer_amount },
      );
      const { closing_amount, expected_amount, difference } = res.data.data;
      const balanced = Math.abs(difference) < 0.01;
      Swal.fire({
        icon: balanced ? "success" : "warning",
        title: balanced
          ? t("cashmanagement.closed_title")
          : t("cashmanagement.diff_title"),
        html: `<div style="text-align:left;display:grid;gap:10px">
          <div style="display:flex;justify-content:space-between;padding:10px;background:#f1f5f9;border-radius:8px"><span>${escapeHtml(t("cashmanagement.counted"))}</span><b>${escapeHtml(formatCurrency(closing_amount))}</b></div>
          <div style="display:flex;justify-content:space-between;padding:10px;background:#f1f5f9;border-radius:8px"><span>${escapeHtml(t("cashmanagement.expected"))}</span><b>${escapeHtml(formatCurrency(expected_amount))}</b></div>
          <div style="display:flex;justify-content:space-between;padding:10px;background:${balanced ? "#dcfce7" : "#fee2e2"};border-radius:8px;border-left:4px solid ${balanced ? "#22c55e" : "#ef4444"}"><span>${balanced ? "✅" : "📉"} ${escapeHtml(t("cashmanagement.difference"))}</span><b>${escapeHtml(formatCurrency(difference))}</b></div>
        </div>`,
        confirmButtonColor: "#3b82f6",
      });
      setCloseSessionData(null);
      if (isAdmin) {
        loadActiveSessions();
        setHistoryPage(1);
        loadClosedSessions();
      } else {
        loadMyActiveSession();
      }
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: t("cashmanagement.error_close"),
        text: err.response?.data?.message || t("cashmanagement.error_close"),
        confirmButtonColor: "#ef4444",
      });
    }
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    const system = config?.system || {};
    const {
      currencySymbol = "$",
      thousandsSeparator = ",",
      decimalPlaces = 2,
    } = system;
    const fixed = num.toFixed(decimalPlaces);
    const parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
    return `${currencySymbol} ${parts.join(".")}`.trim();
  };

  // VISTA ADMINISTRADOR
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="text-blue-400" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {t("cashmanagement.title_admin")}
              </h1>
              <p className="text-gray-500">
                {t("cashmanagement.subtitle_admin")}
              </p>
            </div>
          </div>
        </div>

        {/* Abrir sesión */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-600" />{" "}
              {t("cashmanagement.open_new_session")}
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  <User size={14} className="text-gray-400" />{" "}
                  {t("cashmanagement.select_cashier")}
                </label>
                <select
                  value={selectedCashier}
                  onChange={(e) => setSelectedCashier(e.target.value)}
                  className="w-full rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 py-2.5 px-4 bg-gray-50 hover:bg-white"
                >
                  <option value="">{t("cashmanagement.select_cashier")}</option>
                  {cashiers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Wallet size={14} className="text-gray-400" />{" "}
                  {t("cashmanagement.initial_amount")}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400 font-medium">
                    {config?.system?.currencySymbol || "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(e.target.value)}
                    className="pl-8 w-full rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500 py-2.5 px-4 bg-gray-50 hover:bg-white transition-colors font-semibold"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={openSessionForCashier}
                disabled={
                  loading ||
                  !selectedCashier ||
                  !initialAmount ||
                  parseFloat(initialAmount) <= 0
                }
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50 shadow-md"
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />{" "}
                    {t("cashmanagement.processing")}
                  </>
                ) : (
                  <>
                    <CheckCircle size={18} />{" "}
                    {t("cashmanagement.open_register")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sesiones Activas */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <CheckCircle size={20} className="text-emerald-600" />{" "}
              {t("cashmanagement.active_sessions")}{" "}
              {activeSessions.length > 0 && (
                <span className="ml-2 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                  {activeSessions.length}
                </span>
              )}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t("cashmanagement.columns.cashier")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t("cashmanagement.columns.register")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t("cashmanagement.columns.initial")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t("cashmanagement.cash")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t("cashmanagement.card")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t("cashmanagement.transfer")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t("cashmanagement.columns.total")}
                  </th>
                  <th className="px-6 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeSessions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <AlertCircle size={40} className="opacity-50" />
                        <p>{t("cashmanagement.no_active_sessions")}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  activeSessions.map((s) => {
                    const tot = activeSessionTotals[s.id] || {
                      efectivo: 0,
                      tarjeta: 0,
                      transferencia: 0,
                      total: 0,
                    };
                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-blue-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                              {s.cashier_name?.charAt(0)?.toUpperCase()}
                            </div>
                            <span className="font-medium">
                              {s.cashier_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-lg text-sm font-medium">
                            <Store size={14} /> {s.register_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-600">
                          <MoneyDisplay amount={s.initial_amount} />
                        </td>
                        <td className="px-6 py-4">
                          <MoneyDisplay amount={tot.efectivo} />
                        </td>
                        <td className="px-6 py-4">
                          <MoneyDisplay amount={tot.tarjeta} />
                        </td>
                        <td className="px-6 py-4">
                          <MoneyDisplay amount={tot.transferencia} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                            <MoneyDisplay amount={tot.total} />
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => requestCloseSession(s.id, true)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            title={t("cashmanagement.close_register")}
                          >
                            <Lock size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historial de Cierres con paginación y filtros */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div
            className="px-6 py-4 bg-gradient-to-r from-gray-50 to-slate-50 border-b flex items-center justify-between cursor-pointer"
            onClick={() => setShowHistory(!showHistory)}
          >
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <History size={20} className="text-gray-600" />{" "}
              {t("cashmanagement.history_title")}{" "}
              {historyTotal > 0 && (
                <span className="ml-2 px-2.5 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                  {historyTotal}
                </span>
              )}
            </h2>
            <button className="p-1 rounded-lg hover:bg-gray-200">
              {showHistory ? (
                <ChevronUp size={20} />
              ) : (
                <ChevronDown size={20} />
              )}
            </button>
          </div>
          {showHistory && (
            <>
              {/* Filtros del historial */}
              <div className="px-6 py-3 bg-gray-50 border-b flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <input
                    type="date"
                    className="text-sm border rounded-lg px-2 py-1"
                    value={historyFilters.start}
                    onChange={(e) => {
                      setHistoryFilters((f) => ({
                        ...f,
                        start: e.target.value,
                      }));
                      setHistoryPage(1);
                    }}
                  />
                  <span className="text-xs text-gray-500">-</span>
                  <input
                    type="date"
                    className="text-sm border rounded-lg px-2 py-1"
                    value={historyFilters.end}
                    onChange={(e) => {
                      setHistoryFilters((f) => ({ ...f, end: e.target.value }));
                      setHistoryPage(1);
                    }}
                  />
                </div>
                <select
                  className="text-sm border rounded-lg px-2 py-1"
                  value={historyFilters.cashier}
                  onChange={(e) => {
                    setHistoryFilters((f) => ({
                      ...f,
                      cashier: e.target.value,
                    }));
                    setHistoryPage(1);
                  }}
                >
                  <option value="">{t("cashmanagement.all") || "Todos"}</option>
                  {cashiers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        {t("cashmanagement.columns.date")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        {t("cashmanagement.columns.cashier")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        {t("cashmanagement.columns.register")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        {t("cashmanagement.columns.initial")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        {t("cashmanagement.columns.total")}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        {t("cashmanagement.columns.difference")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {closedSessions.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3 text-gray-400">
                            <History size={32} className="opacity-50" />
                            <p>{t("cashmanagement.no_history")}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      closedSessions.map((sess) => {
                        const tot =
                          parseFloat(sess.closing_amount || 0) -
                          parseFloat(sess.initial_amount || 0);
                        return (
                          <tr key={sess.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm">
                              {new Date(sess.closing_date).toLocaleString(
                                "es-UY",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </td>
                            <td className="px-6 py-4 font-medium">
                              {sess.cashier_name}
                            </td>
                            <td className="px-6 py-4 text-gray-600">
                              {sess.register_name}
                            </td>
                            <td className="px-6 py-4">
                              <MoneyDisplay amount={sess.initial_amount} />
                            </td>
                            <td className="px-6 py-4 font-bold text-blue-700">
                              <MoneyDisplay amount={tot} />
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={
                                  Math.abs(sess.difference) < 0.01
                                    ? "text-emerald-600 font-medium"
                                    : sess.difference > 0
                                      ? "text-green-600 font-medium"
                                      : "text-red-600 font-medium"
                                }
                              >
                                <MoneyDisplay amount={sess.difference} />
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {historyTotalPages > 1 && (
                <div className="flex justify-between items-center gap-4 bg-white p-4 border-t">
                  <div className="text-sm text-gray-600">
                    {t("cashmanagement.showing") || "Mostrando"}{" "}
                    {closedSessions.length} {t("cashmanagement.of") || "de"}{" "}
                    {historyTotal} {t("cashmanagement.records") || "registros"}
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      disabled={historyPage === 1}
                      onClick={() => setHistoryPage((p) => p - 1)}
                      className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                    >
                      <ChevronLeft size={18} />{" "}
                      {t("cashmanagement.previous") || "Anterior"}
                    </button>
                    <div className="flex gap-1">
                      {Array.from(
                        { length: Math.min(5, historyTotalPages) },
                        (_, i) => {
                          let p;
                          if (historyTotalPages <= 5) p = i + 1;
                          else if (historyPage <= 3) p = i + 1;
                          else if (historyPage >= historyTotalPages - 2)
                            p = historyTotalPages - 4 + i;
                          else p = historyPage - 2 + i;
                          return (
                            <button
                              key={p}
                              onClick={() => setHistoryPage(p)}
                              className={`px-3 py-1 rounded-lg ${historyPage === p ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                            >
                              {p}
                            </button>
                          );
                        },
                      )}
                    </div>
                    <button
                      disabled={historyPage === historyTotalPages}
                      onClick={() => setHistoryPage((p) => p + 1)}
                      className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                    >
                      {t("cashmanagement.next") || "Siguiente"}{" "}
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <CashCountModal
          isOpen={showCountModal}
          onClose={() => setShowCountModal(false)}
          bills={denominations.filter((d) => d.type === "bill")}
          coins={denominations.filter((d) => d.type === "coin")}
          onSubmit={handleModalSubmit}
          config={config}
        />
      </div>
    );
  }

  // VISTA CAJERO CON SESIÓN
  if (activeSessionDetail) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Banknote className="text-blue-600" size={28} />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {t("cashmanagement.title_cashier")}
              </h1>
              <p className="text-gray-500">
                {t("cashmanagement.subtitle_cashier_active")}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-full flex items-center gap-1">
            <CheckCircle size={14} /> {t("cashmanagement.status_active")}
          </span>
        </div>

        <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-2xl shadow-xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 flex justify-between items-start gap-4">
            <div className="flex-1">
              <p className="text-blue-100 text-sm flex items-center gap-2">
                <Store size={14} /> {t("cashmanagement.cash_register")}
              </p>
              <h2 className="text-2xl font-bold mt-1">
                {activeSessionDetail.register_name}
              </h2>
              <div className="mt-3 flex items-center gap-4 text-blue-100 text-sm">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} />{" "}
                  {new Date(activeSessionDetail.opening_date).toLocaleString(
                    "es-UY",
                  )}
                </span>
              </div>
            </div>
            <button
              onClick={() => requestCloseSession(activeSessionDetail.id, false)}
              className="bg-red-500/90 hover:bg-red-600 text-white p-3 rounded-xl transition-all shadow-lg"
              title={t("cashmanagement.close_register")}
            >
              <Lock size={22} />
            </button>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center">
              <p className="text-xs text-blue-100 uppercase">
                {t("cashmanagement.initial_mount")}
              </p>
              <p className="text-xl font-bold mt-1">
                <MoneyDisplay amount={activeSessionDetail.initial_amount} />
              </p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center">
              <p className="text-xs text-blue-100 uppercase">
                {t("cashmanagement.sales_count")}
              </p>
              <p className="text-xl font-bold mt-1 flex items-center justify-center gap-1">
                <ArrowUpRight size={16} /> {sessionSales.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border p-6">
          <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
            <Calculator size={20} className="text-indigo-600" />{" "}
            {t("cashmanagement.financial_status")}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label={t("cashmanagement.initial")}
              value={activeSessionDetail.initial_amount}
              icon={Wallet}
              color="gray"
            />
            <StatCard
              label={t("cashmanagement.cash")}
              value={sessionTotals.efectivo}
              icon={Banknote}
              color="emerald"
            />
            <StatCard
              label={t("cashmanagement.card")}
              value={sessionTotals.tarjeta}
              icon={CreditCard}
              color="blue"
            />
            <StatCard
              label={t("cashmanagement.transfer")}
              value={sessionTotals.transferencia}
              icon={Landmark}
              color="purple"
            />
          </div>
          <div className="mt-5 pt-5 border-t flex justify-between items-center">
            <span className="text-gray-500 font-medium">
              {t("cashmanagement.total_collected")}
            </span>
            <span className="text-2xl font-bold text-gray-900">
              <MoneyDisplay amount={sessionTotals.total} />
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <History size={20} className="text-gray-500" />{" "}
              {t("cashmanagement.sales_session")}
            </h3>
            {salesTotal > 0 && (
              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                {salesTotal} {t("cashmanagement.sales")}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t("cashmanagement.id")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t("cashmanagement.date")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t("cashmanagement.total")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {t("cashmanagement.method")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessionSales.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <History size={32} className="opacity-50" />
                        <p>{t("cashmanagement.no_sales_yet")}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sessionSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          #{sale.id.slice(-6)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(sale.created_at).toLocaleString("es-UY", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        <MoneyDisplay amount={sale.total} />
                      </td>
                      <td className="px-6 py-4">
                        <PaymentBadge method={sale.payment_method} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {salesTotalPages > 1 && (
            <div className="flex justify-between items-center gap-4 bg-white p-4 border-t">
              <div className="text-sm text-gray-600">
                {t("cashmanagement.showing") || "Mostrando"}{" "}
                {sessionSales.length} {t("cashmanagement.of") || "de"}{" "}
                {salesTotal} {t("cashmanagement.records") || "registros"}
              </div>
              <div className="flex items-center gap-4">
                <button
                  disabled={salesPage === 1}
                  onClick={() => setSalesPage((p) => p - 1)}
                  className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                >
                  <ChevronLeft size={18} />{" "}
                  {t("cashmanagement.previous") || "Anterior"}
                </button>
                <div className="flex gap-1">
                  {Array.from(
                    { length: Math.min(5, salesTotalPages) },
                    (_, i) => {
                      let p;
                      if (salesTotalPages <= 5) p = i + 1;
                      else if (salesPage <= 3) p = i + 1;
                      else if (salesPage >= salesTotalPages - 2)
                        p = salesTotalPages - 4 + i;
                      else p = salesPage - 2 + i;
                      return (
                        <button
                          key={p}
                          onClick={() => setSalesPage(p)}
                          className={`px-3 py-1 rounded-lg ${salesPage === p ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                        >
                          {p}
                        </button>
                      );
                    },
                  )}
                </div>
                <button
                  disabled={salesPage === salesTotalPages}
                  onClick={() => setSalesPage((p) => p + 1)}
                  className="px-4 py-2 text-gray-600 disabled:opacity-50 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                >
                  {t("cashmanagement.next") || "Siguiente"}{" "}
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        <CashCountModal
          isOpen={showCountModal}
          onClose={() => setShowCountModal(false)}
          bills={denominations.filter((d) => d.type === "bill")}
          coins={denominations.filter((d) => d.type === "coin")}
          onSubmit={handleModalSubmit}
          config={config}
        />
      </div>
    );
  }

  // CAJERO SIN SESIÓN
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border">
        <AlertCircle size={32} className="text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          {t("cashmanagement.waiting_title")}
        </h2>
        <p className="text-gray-500 mb-6">{t("cashmanagement.waiting_text")}</p>
        <button
          onClick={loadMyActiveSession}
          className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
        >
          <RefreshCw size={18} /> {t("cashmanagement.check_status")}
        </button>
        <button
          onClick={() => (window.location.href = "/caja")}
          className="mt-3 w-full px-5 py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl font-medium"
        >
          {t("cashmanagement.back_to_pos")}
        </button>
        <p className="text-xs text-gray-400 mt-4">
          {t("cashmanagement.problems")}
        </p>
      </div>
    </div>
  );
}
