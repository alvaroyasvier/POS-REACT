// frontend/src/pages/Usuarios.jsx
import { useState, useEffect } from "react";
import api from "../api";
import Swal from "sweetalert2";
import LoaderPOS from "../components/LoaderPOS";
import { useTranslation } from "../context/LanguageContext";
import {
  Plus,
  UserCheck,
  UserX,
  X,
  Shield,
  Search,
  Edit,
  Key,
  Trash2,
  Lock,
  Unlock,
  Clock,
  AlertTriangle,
} from "lucide-react";

export default function Usuarios() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "cashier",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "cashier",
  });
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users");
      console.log("📦 Usuarios cargados:", res.data.data);
      setUsers(res.data.data || []);
    } catch (err) {
      console.error("❌ Error cargando usuarios:", err);
      Swal.fire(
        t("usuarios.error_loading"),
        t("usuarios.error_loading"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.role) {
      return Swal.fire(
        t("usuarios.error_create"),
        t("usuarios.modal.password_short"),
        "warning",
      );
    }
    if (form.password.length < 6) {
      return Swal.fire(
        t("usuarios.error_create"),
        t("usuarios.modal.password_short"),
        "warning",
      );
    }
    try {
      await api.post("/users", form);
      setModal(false);
      setForm({ name: "", email: "", password: "", role: "cashier" });
      await loadData();
      Swal.fire({
        title: t("usuarios.modal.created_message"),
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        t("usuarios.error_create"),
        err.response?.data?.message || t("usuarios.error_create"),
        "error",
      );
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role });
    setEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.email || !editForm.role) {
      return Swal.fire(
        t("usuarios.error_update"),
        t("usuarios.modal.password_short"),
        "warning",
      );
    }
    try {
      await api.put(`/users/${editingUser.id}`, editForm);
      setEditModal(false);
      await loadData();
      Swal.fire({
        title: t("usuarios.modal.updated_message"),
        text: t("usuarios.modal.updated_text"),
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        t("usuarios.error_update"),
        err.response?.data?.message || t("usuarios.error_update"),
        "error",
      );
    }
  };

  const openPasswordModal = (user) => {
    setEditingUser(user);
    setPasswordForm({ password: "", confirmPassword: "" });
    setPasswordModal(true);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirmPassword) {
      return Swal.fire(
        t("usuarios.modal.password_mismatch"),
        t("usuarios.modal.password_mismatch"),
        "error",
      );
    }
    if (passwordForm.password.length < 6) {
      return Swal.fire(
        t("usuarios.modal.password_short"),
        t("usuarios.modal.password_short"),
        "warning",
      );
    }
    try {
      await api.put(`/users/${editingUser.id}/password`, {
        password: passwordForm.password,
      });
      setPasswordModal(false);
      Swal.fire({
        title: t("usuarios.modal.password_updated"),
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        t("usuarios.error_password"),
        err.response?.data?.message || t("usuarios.error_password"),
        "error",
      );
    }
  };

  const toggleStatus = async (id, current, name) => {
    const actionKey = current ? "deactivate" : "activate";
    const actionText = t("usuarios.actions." + actionKey).toLowerCase();
    const result = await Swal.fire({
      title: t("usuarios.modal.toggle_status_confirm", { action: actionText }),
      text: t("usuarios.modal.toggle_status_text", {
        action: actionText,
        name,
      }),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: current ? "#dc3545" : "#28a745",
      confirmButtonText: current
        ? t("usuarios.modal.toggle_success", { action: "Desactivar" })
        : t("usuarios.modal.toggle_success", { action: "Activar" }),
      cancelButtonText: t("usuarios.modal.cancel"),
    });
    if (!result.isConfirmed) return;

    try {
      await api.put(`/users/${id}/status`, { is_active: !current });
      await loadData();
      Swal.fire({
        title: t("usuarios.modal.toggle_success", {
          action: current ? "Desactivado" : "Activado",
        }),
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire(
        t("usuarios.error_toggle", {
          action: current ? "desactivar" : "activar",
        }),
        err.response?.data?.message ||
          t("usuarios.error_toggle", { action: actionKey }),
        "error",
      );
    }
  };

  const handleUnlock = async (user) => {
    const result = await Swal.fire({
      title: t("usuarios.modal.unlock_confirm"),
      text: t("usuarios.modal.unlock_text", { name: user.name }),
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#28a745",
      cancelButtonColor: "#6c757d",
      confirmButtonText: t("usuarios.modal.unlock_yes"),
      cancelButtonText: t("usuarios.modal.cancel"),
    });

    if (!result.isConfirmed) return;

    try {
      await api.post(`/users/${user.id}/unlock`);
      await loadData();
      Swal.fire({
        title: t("usuarios.modal.unlock_success"),
        text: t("usuarios.modal.unlock_success_text", { name: user.name }),
        icon: "success",
        timer: 2500,
        showConfirmButton: true,
      });
    } catch (err) {
      console.error("❌ Error desbloqueando:", err);
      Swal.fire(
        t("usuarios.error_unlock"),
        err.response?.data?.message || t("usuarios.error_unlock"),
        "error",
      );
    }
  };

  const handleDelete = async (user) => {
    const result = await Swal.fire({
      title: t("usuarios.modal.delete_confirm"),
      text: t("usuarios.modal.delete_text", { name: user.name }),
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
      confirmButtonText: t("usuarios.modal.delete_yes"),
      cancelButtonText: t("usuarios.modal.delete_cancel"),
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/users/${user.id}`);
      await loadData();
      Swal.fire({
        title: t("usuarios.modal.deleted"),
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      if (err.response?.status === 409) {
        Swal.fire({
          title: t("usuarios.cannot_delete"),
          text: err.response?.data?.message || t("usuarios.cannot_delete_text"),
          icon: "warning",
          confirmButtonText: t("usuarios.understood"),
        });
      } else {
        Swal.fire(
          t("usuarios.error_delete"),
          err.response?.data?.message || t("usuarios.error_delete"),
          "error",
        );
      }
    }
  };

  const isUserLocked = (user) => {
    if (!user.locked_until) return false;
    return new Date(user.locked_until) > new Date();
  };

  const formatLockTime = (lockedUntil) => {
    if (!lockedUntil) return "";
    const diff = new Date(lockedUntil) - new Date();
    const minutes = Math.ceil(diff / 1000 / 60);
    if (minutes <= 0) return "";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return <LoaderPOS message={t("usuarios.loading")} />;
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("usuarios.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {t("usuarios.subtitle")}
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary">
          <Plus size={18} /> {t("usuarios.new_user")}
        </button>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder={t("usuarios.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-icon"
          />
        </div>
      </div>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t("usuarios.columns.user")}</th>
                <th>{t("usuarios.columns.email")}</th>
                <th>{t("usuarios.columns.role")}</th>
                <th>{t("usuarios.columns.status")}</th>
                <th>{t("usuarios.columns.security")}</th>
                <th>{t("usuarios.columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((u) => {
                  const locked = isUserLocked(u);
                  const lockTime = formatLockTime(u.locked_until);
                  const attempts = u.login_attempts || 0;

                  return (
                    <tr
                      key={u.id}
                      className={
                        locked ? "bg-red-50/30 dark:bg-red-900/10" : ""
                      }
                    >
                      <td className="font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full flex items-center justify-center font-bold text-sm">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          {u.name}
                        </div>
                      </td>
                      <td className="text-gray-600 dark:text-gray-400">
                        {u.email}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            u.role === "admin"
                              ? "badge-info"
                              : u.role === "cashier"
                                ? "badge-warning"
                                : "badge-success"
                          }`}
                        >
                          <Shield size={12} className="mr-1" />
                          {u.role === "admin"
                            ? t("usuarios.roles.admin")
                            : u.role === "cashier"
                              ? t("usuarios.roles.cashier")
                              : t("usuarios.roles.warehouse")}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${u.is_active ? "badge-success" : "badge-danger"}`}
                        >
                          {u.is_active
                            ? t("usuarios.status.active")
                            : t("usuarios.status.inactive")}
                        </span>
                      </td>
                      <td>
                        {locked ? (
                          <div className="flex flex-col gap-1">
                            <span className="badge badge-danger flex items-center gap-1">
                              <Lock size={12} />{" "}
                              {t("usuarios.security.blocked")}
                            </span>
                            {lockTime && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Clock size={12} /> {lockTime}
                              </span>
                            )}
                          </div>
                        ) : attempts > 0 ? (
                          <span className="badge badge-warning text-xs flex items-center gap-1">
                            <AlertTriangle size={12} />{" "}
                            {t("usuarios.security.attempts", {
                              count: attempts,
                            })}
                          </span>
                        ) : (
                          <span className="badge badge-success flex items-center gap-1">
                            <Unlock size={12} />{" "}
                            {t("usuarios.security.unblocked")}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {locked && (
                            <button
                              onClick={() => handleUnlock(u)}
                              className="btn-ghost p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
                              title={t("usuarios.actions.unlock")}
                            >
                              <Unlock size={16} />
                            </button>
                          )}

                          <button
                            onClick={() => openEditModal(u)}
                            className="btn-ghost p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                            title={t("usuarios.actions.edit")}
                          >
                            <Edit size={16} />
                          </button>

                          <button
                            onClick={() => openPasswordModal(u)}
                            className="btn-ghost p-1.5 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg"
                            title={t("usuarios.actions.change_password")}
                          >
                            <Key size={16} />
                          </button>

                          <button
                            onClick={() =>
                              toggleStatus(u.id, u.is_active, u.name)
                            }
                            className={`btn-ghost p-1.5 ${
                              u.is_active
                                ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30"
                            } rounded-lg`}
                            title={
                              u.is_active
                                ? t("usuarios.actions.deactivate")
                                : t("usuarios.actions.activate")
                            }
                          >
                            {u.is_active ? (
                              <UserX size={16} />
                            ) : (
                              <UserCheck size={16} />
                            )}
                          </button>

                          <button
                            onClick={() => handleDelete(u)}
                            className="btn-ghost p-1.5 text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg"
                            title={t("usuarios.actions.delete")}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-12 text-gray-500 dark:text-gray-400"
                  >
                    {t("usuarios.no_users")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CREAR */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {t("usuarios.modal.create_title")}
              </h2>
              <button
                onClick={() => setModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="input-group">
                <label className="label">{t("usuarios.modal.name")}</label>
                <input
                  required
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: María González"
                />
              </div>
              <div className="input-group">
                <label className="label">{t("usuarios.modal.email")}</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@tienda.com"
                />
              </div>
              <div className="input-group">
                <label className="label">{t("usuarios.modal.password")}</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="input"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="••••••••"
                />
              </div>
              <div className="input-group">
                <label className="label">{t("usuarios.modal.role")}</label>
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="cashier">
                    🛒 {t("usuarios.roles.cashier")}
                  </option>
                  <option value="warehouse">
                    📦 {t("usuarios.roles.warehouse")}
                  </option>
                  <option value="admin">👑 {t("usuarios.roles.admin")}</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  {t("usuarios.modal.create")}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="btn-secondary px-6"
                >
                  {t("usuarios.modal.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {editModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setEditModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {t("usuarios.modal.edit_title")}
              </h2>
              <button
                onClick={() => setEditModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              <div className="input-group">
                <label className="label">{t("usuarios.modal.name")}</label>
                <input
                  required
                  className="input"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label className="label">{t("usuarios.modal.email")}</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
              </div>
              <div className="input-group">
                <label className="label">{t("usuarios.modal.role")}</label>
                <select
                  className="input"
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                >
                  <option value="cashier">
                    🛒 {t("usuarios.roles.cashier")}
                  </option>
                  <option value="warehouse">
                    📦 {t("usuarios.roles.warehouse")}
                  </option>
                  <option value="admin">👑 {t("usuarios.roles.admin")}</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  {t("usuarios.modal.update")}
                </button>
                <button
                  type="button"
                  onClick={() => setEditModal(false)}
                  className="btn-secondary px-6"
                >
                  {t("usuarios.modal.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONTRASEÑA */}
      {passwordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setPasswordModal(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {t("usuarios.modal.password_title")}
              </h2>
              <button
                onClick={() => setPasswordModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-5 space-y-4">
              <div className="text-center mb-4">
                <p className="text-gray-600 dark:text-gray-300">
                  {t("usuarios.modal.user")}{" "}
                  <span className="font-semibold">{editingUser?.name}</span>
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {editingUser?.email}
                </p>
              </div>
              <div className="input-group">
                <label className="label">
                  {t("usuarios.modal.new_password")}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="input"
                  value={passwordForm.password}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      password: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                />
              </div>
              <div className="input-group">
                <label className="label">
                  {t("usuarios.modal.confirm_password")}
                </label>
                <input
                  type="password"
                  required
                  className="input"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  {t("usuarios.modal.change_password")}
                </button>
                <button
                  type="button"
                  onClick={() => setPasswordModal(false)}
                  className="btn-secondary px-6"
                >
                  {t("usuarios.modal.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
