/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Shared UI Shell, Sidebar, Header & Notification Bell
 * ==========================================================================
 */

import { getCurrentUser, logoutUser } from './auth.js';
import { getNotifications, markAllNotificationsAsRead, markNotificationAsRead } from './db.js';
import { isFirebaseConfigured, getActiveFirebaseConfig, saveFirebaseConfig } from './firebase-config.js';
import { formatDate, showToast, showConfirmModal } from './utils.js';

export function renderAppShell(activePage = 'dashboard', pageTitle = 'Trang Chủ', pageSub = 'Tổng quan tình hình tài chính') {
  const user = getCurrentUser();
  if (!user) return;

  const sidebarEl = document.getElementById('sidebar') || document.getElementById('app-sidebar');
  const headerEl = document.getElementById('header') || document.getElementById('app-header');

  const isAdmin = user.role === 'admin';
  const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=0284c7&color=fff`;

  // 1. Render Sidebar
  if (sidebarEl) {
    sidebarEl.className = 'sidebar';
    sidebarEl.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-brand-icon">
          <i class="fas fa-wallet"></i>
        </div>
        <div class="sidebar-brand-info">
          <span class="sidebar-brand-text">Hệ Thống Quản Lý</span>
          <span class="sidebar-brand-sub">Chi Tiêu Tài Chính Cá Nhân</span>
        </div>
      </div>

      <div class="sidebar-content">
        <div class="nav-group-title">TỔNG QUAN</div>
        <ul class="nav-menu">
          <li>
            <a href="/dashboard.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
              <i class="fas fa-chart-pie"></i>
              <span>Trang Chủ</span>
            </a>
          </li>
        </ul>

        <div class="nav-group-title">THU CHI & GIAO DỊCH</div>
        <ul class="nav-menu">
          <li>
            <a href="/income.html" class="nav-item ${activePage === 'income' ? 'active' : ''}">
              <i class="fas fa-arrow-down" style="color: var(--income-color);"></i>
              <span>Khoản Thu</span>
            </a>
          </li>
          <li>
            <a href="/expenses.html" class="nav-item ${activePage === 'expenses' ? 'active' : ''}">
              <i class="fas fa-arrow-up" style="color: var(--expense-color);"></i>
              <span>Khoản Chi</span>
            </a>
          </li>
          <li>
            <a href="/transactions.html" class="nav-item ${activePage === 'transactions' ? 'active' : ''}">
              <i class="fas fa-list-ul"></i>
              <span>Lịch Sử Giao Dịch</span>
            </a>
          </li>
          <li>
            <a href="/categories.html" class="nav-item ${activePage === 'categories' ? 'active' : ''}">
              <i class="fas fa-tags"></i>
              <span>Quản Lý Danh Mục</span>
            </a>
          </li>
        </ul>

        <div class="nav-group-title">KẾ HOẠCH & MỤC TIÊU</div>
        <ul class="nav-menu">
          <li>
            <a href="/budgets.html" class="nav-item ${activePage === 'budgets' ? 'active' : ''}">
              <i class="fas fa-piggy-bank"></i>
              <span>Quản Lý Ngân Sách</span>
            </a>
          </li>
          <li>
            <a href="/financial-plans.html" class="nav-item ${activePage === 'financial-plans' ? 'active' : ''}">
              <i class="fas fa-compass"></i>
              <span>Kế Hoạch Tài Chính</span>
            </a>
          </li>
          <li>
            <a href="/saving-goals.html" class="nav-item ${activePage === 'saving-goals' ? 'active' : ''}">
              <i class="fas fa-bullseye"></i>
              <span>Mục Tiêu Tiết Kiệm</span>
            </a>
          </li>
          <li>
            <a href="/debts.html" class="nav-item ${activePage === 'debts' ? 'active' : ''}">
              <i class="fas fa-hand-holding-usd"></i>
              <span>Khoản Nợ & Cho Vay</span>
            </a>
          </li>
        </ul>

        <div class="nav-group-title">PHÂN TÍCH & BÁO CÁO</div>
        <ul class="nav-menu">
          <li>
            <a href="/reports.html" class="nav-item ${activePage === 'reports' ? 'active' : ''}">
              <i class="fas fa-chart-line"></i>
              <span>Báo Cáo & Thống Kê</span>
            </a>
          </li>
          <li>
            <a href="/notifications.html" class="nav-item ${activePage === 'notifications' ? 'active' : ''}">
              <i class="fas fa-bell"></i>
              <span>Cảnh Báo & Thông Báo</span>
              <span class="nav-badge" id="sidebar-unread-badge" style="display: none;">0</span>
            </a>
          </li>
        </ul>

        ${isAdmin ? `
          <div class="nav-group-title" style="color: #f87171;">HỆ THỐNG (ADMIN)</div>
          <ul class="nav-menu">
            <li>
              <a href="/admin.html" class="nav-item ${activePage === 'admin' ? 'active' : ''}" style="border-left: 3px solid #ef4444;">
                <i class="fas fa-user-shield" style="color: #f87171;"></i>
                <span>Quản Trị Admin</span>
              </a>
            </li>
          </ul>
        ` : ''}
      </div>

      <div class="sidebar-footer">
        <div class="user-mini-card">
          <img src="${avatarUrl}" alt="${user.name}" class="user-avatar" id="sidebar-user-avatar" />
          <div class="user-info">
            <div class="user-name" title="${user.name}">${user.name}</div>
            <span class="user-role-badge ${isAdmin ? 'admin' : ''}">${isAdmin ? 'Admin' : 'Thành viên'}</span>
          </div>
          <button class="btn-logout" id="sidebar-logout-btn" title="Đăng xuất">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    `;
  }

  // 2. Render Header
  if (headerEl) {
    const isFb = isFirebaseConfigured();
    headerEl.className = 'top-header';
    headerEl.innerHTML = `
      <div class="header-left">
        <button class="menu-toggle-btn" id="mobile-menu-toggle" aria-label="Toggle Navigation">
          <i class="fas fa-bars"></i>
        </button>
        <div class="header-title-wrap">
          <h2>${pageTitle}</h2>
          <p>${pageSub}</p>
        </div>
      </div>

      <div class="header-right">
        <!-- Notification Bell -->
        <div style="position: relative;">
          <button class="header-action-btn" id="header-notif-btn" aria-label="Thông báo">
            <i class="fas fa-bell"></i>
            <span class="notification-badge" id="header-notif-badge" style="display: none;">0</span>
          </button>

          <!-- Notifications Dropdown Popover -->
          <div class="notifications-dropdown" id="notifications-popover">
            <div class="notif-header">
              <h4>Thông báo & Cảnh báo</h4>
              <button class="btn btn-ghost btn-sm" id="btn-mark-all-read" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">Đã đọc hết</button>
            </div>
            <div class="notif-body" id="header-notif-list">
              <div class="loading-overlay" style="padding: 1.5rem;">
                <div class="spinner spinner-sm"></div>
              </div>
            </div>
            <div class="notif-footer">
              <a href="/notifications.html" class="auth-link" style="font-size: 0.8125rem;">Xem tất cả cảnh báo &rarr;</a>
            </div>
          </div>
        </div>

        <!-- Profile Link -->
        <a href="/profile.html" class="header-action-btn" title="Hồ sơ cá nhân">
          <i class="fas fa-user-circle"></i>
        </a>
      </div>
    `;
  }

  // 3. Setup Backdrop for Mobile
  let backdrop = document.getElementById('sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'sidebar-backdrop';
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }

  // 4. Attach Events
  bindShellEvents(user);
  loadHeaderNotifications(user.uid);
}

function bindShellEvents(user) {
  // Mobile Menu Toggle
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar') || document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (toggleBtn && sidebar && backdrop) {
    toggleBtn.onclick = () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active');
    };

    backdrop.onclick = () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    };
  }

  // Logout button
  const logoutBtn = document.getElementById('sidebar-logout-btn');
  if (logoutBtn) {
    logoutBtn.onclick = (e) => {
      e.preventDefault();
      showConfirmModal({
        title: 'Đăng xuất tài khoản',
        message: 'Bạn có chắc chắn muốn đăng xuất và quay về màn hình đăng nhập?',
        confirmText: 'Đăng xuất',
        cancelText: 'Ở lại',
        isDanger: true,
        onConfirm: async () => {
          await logoutUser();
        }
      });
    };
  }

  // Notifications Popover Toggle
  const notifBtn = document.getElementById('header-notif-btn');
  const notifDropdown = document.getElementById('notifications-popover');
  if (notifBtn && notifDropdown) {
    notifBtn.onclick = (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('active');
    };

    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
        notifDropdown.classList.remove('active');
      }
    });

    const markAllBtn = document.getElementById('btn-mark-all-read');
    if (markAllBtn) {
      markAllBtn.onclick = async () => {
        await markAllNotificationsAsRead(user.uid);
        loadHeaderNotifications(user.uid);
        showToast('Đã đánh dấu đã đọc tất cả thông báo!');
      };
    }
  }

  // Firebase Config Modal Trigger
  const fbBtn = document.getElementById('firebase-config-modal-btn');
  if (fbBtn) {
    fbBtn.onclick = () => openFirebaseConfigModal();
  }
}

async function loadHeaderNotifications(uid) {
  const notifListEl = document.getElementById('header-notif-list');
  const headerBadge = document.getElementById('header-notif-badge');
  const sidebarBadge = document.getElementById('sidebar-unread-badge');
  if (!notifListEl) return;

  const notifs = await getNotifications(uid);
  const unread = notifs.filter(n => !n.isRead);

  if (headerBadge) {
    if (unread.length > 0) {
      headerBadge.textContent = unread.length > 9 ? '9+' : unread.length;
      headerBadge.style.display = 'flex';
    } else {
      headerBadge.style.display = 'none';
    }
  }

  if (sidebarBadge) {
    if (unread.length > 0) {
      sidebarBadge.textContent = unread.length;
      sidebarBadge.style.display = 'inline-block';
    } else {
      sidebarBadge.style.display = 'none';
    }
  }

  if (notifs.length === 0) {
    notifListEl.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.8125rem;">
        <i class="fas fa-check-circle" style="font-size: 1.5rem; color: var(--income-color); margin-bottom: 0.5rem; display: block;"></i>
        Không có thông báo mới nào
      </div>
    `;
    return;
  }

  notifListEl.innerHTML = notifs.slice(0, 5).map(n => `
    <div class="notif-item ${!n.isRead ? 'unread' : ''}" data-id="${n.id}">
      <div class="notif-icon ${n.type || 'info'}">
        <i class="fas ${n.type === 'danger' ? 'fa-exclamation-circle' : n.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
      </div>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-text">${n.message}</div>
        <div class="notif-time">${formatDate(n.createdAt)}</div>
      </div>
    </div>
  `).join('');

  notifListEl.querySelectorAll('.notif-item').forEach(el => {
    el.onclick = async () => {
      const id = el.getAttribute('data-id');
      await markNotificationAsRead(id);
      loadHeaderNotifications(uid);
    };
  });
}

/**
 * Global Firebase Configuration Modal
 */
export function openFirebaseConfigModal() {
  let modal = document.getElementById('firebase-config-modal');
  if (modal) modal.remove();

  const currentCfg = getActiveFirebaseConfig();
  const isFb = isFirebaseConfigured();

  modal = document.createElement('div');
  modal.id = 'firebase-config-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal" style="max-width: 580px;">
      <div class="modal-header">
        <h3 class="modal-title"><i class="fas fa-fire" style="color: #f59e0b; margin-right: 0.5rem;"></i>Cấu Hình Firebase Firestore & Auth</h3>
        <button class="modal-close" id="fb-modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="firebase-banner" style="margin-bottom: 1rem;">
          <div class="fb-status">
            <span class="fb-dot ${isFb ? '' : 'pending'}"></span>
            <span>Trạng thái: ${isFb ? 'Đã kết nối Firebase Cloud' : 'Đang chạy Local Storage Bridge'}</span>
          </div>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem; line-height: 1.5;">
          Bạn có thể dán thông số Firebase của dự án trực tiếp vào form dưới đây hoặc chỉnh sửa trong file <code>js/firebase-config.js</code>. Dữ liệu sẽ đồng bộ hóa tự động lên Firestore Database.
        </p>

        <form id="fb-config-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">API Key</label>
              <input type="text" class="form-control" id="fb-apiKey" value="${currentCfg.apiKey || ''}" placeholder="AIzaSy..." required />
            </div>
            <div class="form-group">
              <label class="form-label">Project ID</label>
              <input type="text" class="form-control" id="fb-projectId" value="${currentCfg.projectId || ''}" placeholder="my-finance-app" required />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Auth Domain</label>
              <input type="text" class="form-control" id="fb-authDomain" value="${currentCfg.authDomain || ''}" placeholder="my-finance-app.firebaseapp.com" />
            </div>
            <div class="form-group">
              <label class="form-label">Storage Bucket</label>
              <input type="text" class="form-control" id="fb-storageBucket" value="${currentCfg.storageBucket || ''}" placeholder="my-finance-app.appspot.com" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Messaging Sender ID</label>
              <input type="text" class="form-control" id="fb-messagingSenderId" value="${currentCfg.messagingSenderId || ''}" placeholder="1234567890" />
            </div>
            <div class="form-group">
              <label class="form-label">App ID</label>
              <input type="text" class="form-control" id="fb-appId" value="${currentCfg.appId || ''}" placeholder="1:123456:web:abcd" />
            </div>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="fb-modal-cancel">Đóng</button>
        <button class="btn btn-primary" id="fb-modal-save"><i class="fas fa-save"></i> Lưu & Kết Nối</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 250);
  };

  document.getElementById('fb-modal-close').onclick = close;
  document.getElementById('fb-modal-cancel').onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  document.getElementById('fb-modal-save').onclick = () => {
    const newCfg = {
      apiKey: document.getElementById('fb-apiKey').value.trim(),
      projectId: document.getElementById('fb-projectId').value.trim(),
      authDomain: document.getElementById('fb-authDomain').value.trim(),
      storageBucket: document.getElementById('fb-storageBucket').value.trim(),
      messagingSenderId: document.getElementById('fb-messagingSenderId').value.trim(),
      appId: document.getElementById('fb-appId').value.trim()
    };

    if (!newCfg.apiKey || !newCfg.projectId) {
      showToast('Vui lòng nhập tối thiểu API Key và Project ID!', 'error');
      return;
    }

    saveFirebaseConfig(newCfg);
    showToast('Cấu hình Firebase đã được lưu thành công! Đang tải lại...');
    close();
    setTimeout(() => window.location.reload(), 1000);
  };
}
