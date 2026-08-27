/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Utility Functions & Helpers
 * ==========================================================================
 */

/**
 * Format number to Vietnamese Currency (VNĐ)
 * Example: 1500000 -> 1.500.000 ₫
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0 ₫';
  }
  const num = Math.round(Number(amount));
  return new Intl.NumberFormat('vi-VN').format(num) + ' ₫';
}

/**
 * Format short financial milestone amounts for charts & widgets
 * Example: 0 -> 0k, 500000 -> 500k, 1000000 -> 1tr, 5000000 -> 5tr, 10000000 -> 10tr...
 */
export function formatShortMoney(val) {
  const num = Number(val);
  if (isNaN(num) || Math.abs(num) < 100) return '0k';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1000000000) {
    const v = abs / 1000000000;
    const str = Number.isInteger(v) ? v : v.toFixed(1).replace('.0', '');
    return `${sign}${str}tỷ`;
  }
  if (abs >= 1000000) {
    const v = abs / 1000000;
    const str = Number.isInteger(v) ? v : v.toFixed(1).replace('.0', '');
    return `${sign}${str}tr`;
  }
  if (abs >= 1000) {
    const v = abs / 1000;
    const str = Number.isInteger(v) ? v : v.toFixed(1).replace('.0', '');
    return `${sign}${str}k`;
  }
  return `${sign}${Math.round(abs)}đ`;
}

/**
 * Parse currency string back to number
 */
export function parseCurrency(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const clean = str.replace(/[^\d.-]/g, '');
  return parseFloat(clean) || 0;
}

/**
 * Format ISO or standard date string to DD/MM/YYYY
 * Example: 2026-08-24 -> 24/08/2026
 */
export function formatDate(dateInput) {
  if (!dateInput) return '--/--/----';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format to ISO Date string YYYY-MM-DD for date inputs
 */
export function toISODate(dateInput = new Date()) {
  const date = new Date(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current year-month in YYYY-MM format
 */
export function getCurrentMonth() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Calculate days remaining until deadline
 */
export function calculateDaysRemaining(deadlineInput) {
  if (!deadlineInput) return 0;
  const target = new Date(deadlineInput);
  const now = new Date();
  // Set both to midnight for pure day comparison
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate months remaining
 */
export function calculateMonthsRemaining(endDateInput) {
  if (!endDateInput) return 1;
  const target = new Date(endDateInput);
  const now = new Date();
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return Math.max(1, months);
}

/**
 * Toast Notification System
 */
export function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-check-circle';
  if (type === 'error') iconClass = 'fa-exclamation-circle';
  if (type === 'warning') iconClass = 'fa-exclamation-triangle';
  if (type === 'info') iconClass = 'fa-info-circle';

  toast.innerHTML = `
    <span class="toast-icon"><i class="fas ${iconClass}"></i></span>
    <div style="flex: 1;">${message}</div>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3500);
}

/**
 * Global Confirmation Modal
 */
export function showConfirmModal({
  title = 'Xác nhận hành động',
  message = 'Bạn có chắc chắn muốn thực hiện hành động này?',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  isDanger = false,
  onConfirm = () => {}
}) {
  let modalOverlay = document.getElementById('global-confirm-modal');
  if (modalOverlay) {
    modalOverlay.remove();
  }

  modalOverlay = document.createElement('div');
  modalOverlay.id = 'global-confirm-modal';
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = `
    <div class="modal" style="max-width: 420px;">
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" id="confirm-modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 0.95rem; color: var(--text-main); line-height: 1.6;">${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="confirm-modal-cancel-btn">${cancelText}</button>
        <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="confirm-modal-ok-btn">${confirmText}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // Animate in
  requestAnimationFrame(() => {
    modalOverlay.classList.add('active');
  });

  const closeModal = () => {
    modalOverlay.classList.remove('active');
    setTimeout(() => modalOverlay.remove(), 250);
  };

  document.getElementById('confirm-modal-close-btn').onclick = closeModal;
  document.getElementById('confirm-modal-cancel-btn').onclick = closeModal;
  document.getElementById('confirm-modal-ok-btn').onclick = () => {
    closeModal();
    onConfirm();
  };

  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeModal();
  };
}

/**
 * Generate unique random ID
 */
export function generateId() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Export array of data objects to CSV file
 */
export function exportToCSV(filename, headers, rows) {
  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
