// frontend/src/utils/sanitize.js
export const escapeHtml = (unsafe) => {
  if (!unsafe) return "";
  return String(unsafe).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
};