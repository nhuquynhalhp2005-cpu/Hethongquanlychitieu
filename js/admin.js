/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Quản Trị Hệ Thống (Admin Control Panel)
 * ==========================================================================
 */

import { requireAdmin } from './auth.js';
import { getAllUsers, updateUserRole, toggleLockUser, getSystemStats, getCategories, saveCategory, deleteCategory } from './db.js';
import { renderAppShell } from './layout.js';
import { formatCurrency, formatDate, showToast, showConfirmModal } from './utils.js';

let adminUser = null;
let allUsersList = [];
let systemCategories = [];

export async function initAdminPage() {
  adminUser = requireAdmin();
  if (!adminUser) return;

  renderAppShell('admin', 'Quản Trị Hệ Thống', 'Quản lý tài khoản người dùng, danh mục chung và thống kê toàn sàn');

  await loadAdminData();
  bindEvents();
}

async function loadAdminData() {
  const [stats, users, categories] = await Promise.all([
    getSystemStats(),
    getAllUsers(),
    getCategories('system')
  ]);

  allUsersList = users;
  systemCategories = categories.filter(c => c.uid === 'system');

  // Render Stats
  const elUsers = document.getElementById('admin-stat-users');
  const elNewUsers = document.getElementById('admin-stat-new-users');
  const elTrans = document.getElementById('admin-stat-trans');
  const elIncome = document.getElementById('admin-stat-income');
  const elExpense = document.getElementById('admin-stat-expense');

  if (elUsers) elUsers.textContent = stats.totalUsers;
  if (elNewUsers) elNewUsers.textContent = `+${stats.newUsersThisMonth} tháng này`;
  if (elTrans) elTrans.textContent = stats.totalTransactions;
  if (elIncome) elIncome.textContent = formatCurrency(stats.totalIncome);
  if (elExpense) elExpense.textContent = formatCurrency(stats.totalExpense);

  renderUsersTable();
  renderSystemCategoriesList();
}

function renderUsersTable() {
  const search = (document.getElementById('admin-user-search')?.value || '').toLowerCase().trim();
  const roleFilter = document.getElementById('admin-user-role-filter')?.value || '';

  const list = allUsersList.filter(u => {
    const matchSearch = !search || (u.name && u.name.toLowerCase().includes(search)) || (u.email && u.email.toLowerCase().includes(search));
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const tbody = document.getElementById('admin-users-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Không tìm thấy người dùng nào phù hợp</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(u => {
    const isLocked = !!u.isLocked;
    const isMe = u.uid === adminUser.uid;
    const avatarUrl = u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=3b82f6&color=fff`;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <img src="${avatarUrl}" class="user-avatar" style="width: 34px; height: 34px;" />
            <div>
              <div style="font-weight: 700; color: var(--brand-navy);">${u.name} ${isMe ? '<span style="font-size: 0.7rem; color: var(--primary);">(Bạn)</span>' : ''}</div>
              <div style="font-size: 0.75rem; color: var(--text-light);">${u.email}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="user-role-badge ${u.role === 'admin' ? 'admin' : ''}">${u.role === 'admin' ? 'Admin' : 'User'}</span>
        </td>
        <td>
          <span class="badge ${isLocked ? 'badge-expense' : 'badge-income'}">
            <i class="fas ${isLocked ? 'fa-lock' : 'fa-check'}"></i>
            ${isLocked ? 'Đã Khóa' : 'Hoạt Động'}
          </span>
        </td>
        <td>${formatDate(u.createdAt)}</td>
        <td style="text-align: right;">
          ${!isMe ? `
            <div class="item-card-actions" style="justify-content: flex-end;">
              <button class="btn btn-sm btn-secondary btn-toggle-role" data-uid="${u.uid}" data-role="${u.role}" title="Đổi quyền">
                <i class="fas fa-user-tag"></i> ${u.role === 'admin' ? 'Hạ User' : 'Lên Admin'}
              </button>
              <button class="btn btn-sm ${isLocked ? 'btn-success' : 'btn-ghost'}" data-uid="${u.uid}" data-locked="${isLocked}" style="${isLocked ? '' : 'color: var(--expense-color);'}" title="${isLocked ? 'Mở khóa' : 'Khóa tài khoản'}">
                <i class="fas ${isLocked ? 'fa-unlock' : 'fa-lock'}"></i> ${isLocked ? 'Mở' : 'Khóa'}
              </button>
            </div>
          ` : '<span style="font-size: 0.75rem; color: var(--text-light);">Tài khoản hiện tại</span>'}
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-toggle-role').forEach(btn => {
    btn.onclick = () => {
      const uid = btn.getAttribute('data-uid');
      const currentRole = btn.getAttribute('data-role');
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      showConfirmModal({
        title: 'Đổi quyền tài khoản',
        message: `Bạn có chắc muốn chuyển quyền người dùng này sang "${newRole.toUpperCase()}"?`,
        onConfirm: async () => {
          await updateUserRole(uid, newRole);
          showToast('Đã cập nhật quyền người dùng thành công!');
          await loadAdminData();
        }
      });
    };
  });

  tbody.querySelectorAll('.btn-toggle-lock').forEach(btn => {
    btn.onclick = () => {
      const uid = btn.getAttribute('data-uid');
      const isLocked = btn.getAttribute('data-locked') === 'true';
      showConfirmModal({
        title: isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
        message: `Bạn có chắc muốn ${isLocked ? 'mở khóa' : 'tạm khóa'} tài khoản này?`,
        isDanger: !isLocked,
        onConfirm: async () => {
          await toggleLockUser(uid, !isLocked);
          showToast(`Đã ${isLocked ? 'mở khóa' : 'khóa'} tài khoản!`);
          await loadAdminData();
        }
      });
    };
  });
}

function renderSystemCategoriesList() {
  const container = document.getElementById('admin-categories-list');
  if (!container) return;

  if (systemCategories.length === 0) {
    container.innerHTML = `<div class="empty-state">Chưa có danh mục hệ thống</div>`;
    return;
  }

  container.innerHTML = systemCategories.map(c => `
    <div class="card" style="padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="width: 32px; height: 32px; border-radius: var(--radius-sm); background-color: ${c.color || '#64748b'}20; color: ${c.color || '#64748b'}; display: flex; align-items: center; justify-content: center; font-size: 0.95rem;">
          <i class="fas ${c.icon || 'fa-tag'}"></i>
        </div>
        <div>
          <span style="font-weight: 700; font-size: 0.875rem;">${c.name}</span>
          <span class="badge ${c.type === 'income' ? 'badge-income' : 'badge-expense'}" style="font-size: 0.65rem; margin-left: 0.5rem;">${c.type === 'income' ? 'Thu' : 'Chi'}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function bindEvents() {
  document.getElementById('admin-user-search')?.addEventListener('input', renderUsersTable);
  document.getElementById('admin-user-role-filter')?.addEventListener('change', renderUsersTable);
}
