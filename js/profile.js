/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Hồ Sơ Cá Nhân (User Profile & Account Settings)
 * ==========================================================================
 */

import { requireAuth, updateUserProfile } from './auth.js';
import { getTransactions } from './db.js';
import { renderAppShell } from './layout.js';
import { formatCurrency, formatDate, showToast } from './utils.js';

let currentUser = null;

export async function initProfilePage() {
  currentUser = requireAuth();
  if (!currentUser) return;

  renderAppShell('profile', 'Hồ Sơ Cá Nhân', 'Quản lý thông tin tài khoản và bảo mật');

  await loadProfileData();
  bindEvents();
}

async function loadProfileData() {
  const transactions = await getTransactions(currentUser.uid);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const balance = totalIncome - totalExpense;

  const elAvatar = document.getElementById('profile-avatar-img');
  const elName = document.getElementById('profile-display-name');
  const elEmail = document.getElementById('profile-display-email');
  const elRole = document.getElementById('profile-display-role');
  const elCreated = document.getElementById('profile-display-created');
  const elBalance = document.getElementById('profile-display-balance');
  const elTransCount = document.getElementById('profile-display-trans-count');

  const avatarUrl = currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'User')}&background=0284c7&color=fff`;

  if (elAvatar) elAvatar.src = avatarUrl;
  if (elName) elName.textContent = currentUser.name;
  if (elEmail) elEmail.textContent = currentUser.email;
  if (elRole) elRole.textContent = currentUser.role === 'admin' ? 'Quản Trị Viên (Admin)' : 'Người Dùng (User)';
  if (elCreated) elCreated.textContent = formatDate(currentUser.createdAt);
  if (elBalance) elBalance.textContent = formatCurrency(balance);
  if (elTransCount) elTransCount.textContent = `${transactions.length} giao dịch`;

  // Form fields
  const nameInput = document.getElementById('profile-name-input');
  const avatarInput = document.getElementById('profile-avatar-input');
  if (nameInput) nameInput.value = currentUser.name || '';
  if (avatarInput) avatarInput.value = currentUser.avatar || '';
}

function bindEvents() {
  // Update Profile Form
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('profile-name-input')?.value.trim();
    const avatar = document.getElementById('profile-avatar-input')?.value.trim();
    const newPassword = document.getElementById('profile-new-password')?.value;
    const confirmPassword = document.getElementById('profile-confirm-password')?.value;

    if (!name) {
      showToast('Họ tên không được để trống!', 'error');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        showToast('Mật khẩu mới phải từ 6 ký tự trở lên!', 'error');
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast('Mật khẩu xác nhận không khớp!', 'error');
        return;
      }
    }

    try {
      await updateUserProfile({ name, avatar, newPassword });
      showToast('Đã cập nhật thông tin hồ sơ thành công!');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật hồ sơ!', 'error');
    }
  });
}
