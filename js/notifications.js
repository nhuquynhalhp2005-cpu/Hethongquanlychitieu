/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Thông Báo & Cảnh Báo Tài Chính (Notifications Center)
 * ==========================================================================
 */

import { requireAuth } from './auth.js';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, checkAndTriggerBudgetAlerts } from './db.js';
import { renderAppShell } from './layout.js';
import { formatDate, showToast } from './utils.js';

let currentUser = null;
let allNotifications = [];

export async function initNotificationsPage() {
  currentUser = requireAuth();
  if (!currentUser) return;

  renderAppShell('notifications', 'Trung Tâm Thông Báo & Cảnh Báo', 'Cảnh báo hạn mức ngân sách, hạn nợ và tiến độ tiết kiệm');

  // Trigger alert checks
  await checkAndTriggerBudgetAlerts(currentUser.uid);
  await loadData();
  bindEvents();
}

async function loadData() {
  allNotifications = await getNotifications(currentUser.uid);
  renderList();
}

function renderList() {
  const container = document.getElementById('notifications-list');
  const countEl = document.getElementById('notif-unread-count');
  const unread = allNotifications.filter(n => !n.isRead);

  if (countEl) countEl.textContent = `${unread.length} chưa đọc`;

  if (!container) return;

  if (allNotifications.length === 0) {
    container.innerHTML = `
      <div class="empty-state card">
        <div class="empty-state-icon"><i class="fas fa-bell-slash"></i></div>
        <div class="empty-state-title">Không có thông báo nào</div>
        <p class="empty-state-text">Mọi chỉ số tài chính của bạn đang ở trạng thái an toàn!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = allNotifications.map(n => `
    <div class="card" style="padding: 1.25rem; margin-bottom: 1rem; display: flex; gap: 1rem; align-items: flex-start; border-left: 4px solid ${n.type === 'danger' ? 'var(--expense-color)' : n.type === 'warning' ? 'var(--warning-color)' : 'var(--info-color)'}; background-color: ${!n.isRead ? 'rgba(16, 185, 129, 0.03)' : 'var(--bg-surface)'};">
      <div class="notif-icon ${n.type || 'info'}" style="width: 42px; height: 42px; font-size: 1.1rem; border-radius: var(--radius-md);">
        <i class="fas ${n.type === 'danger' ? 'fa-exclamation-circle' : n.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
      </div>

      <div style="flex: 1;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;">
          <h4 style="font-size: 1rem; font-weight: 700; color: var(--brand-navy);">${n.title}</h4>
          <span style="font-size: 0.75rem; color: var(--text-light);">${formatDate(n.createdAt)}</span>
        </div>
        <p style="font-size: 0.875rem; color: var(--text-muted); line-height: 1.5;">${n.message}</p>
      </div>

      ${!n.isRead ? `
        <button class="btn btn-sm btn-ghost btn-mark-read" data-id="${n.id}" title="Đánh dấu đã đọc">
          <i class="fas fa-check"></i>
        </button>
      ` : `
        <span style="font-size: 0.75rem; color: var(--text-light);"><i class="fas fa-check-double"></i> Đã đọc</span>
      `}
    </div>
  `).join('');

  container.querySelectorAll('.btn-mark-read').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      await markNotificationAsRead(id);
      showToast('Đã đánh dấu đã đọc!');
      await loadData();
    };
  });
}

function bindEvents() {
  document.getElementById('btn-mark-all-read-page')?.addEventListener('click', async () => {
    await markAllNotificationsAsRead(currentUser.uid);
    showToast('Đã đánh dấu đã đọc tất cả thông báo!');
    await loadData();
  });
}
