/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Mục Tiêu Tiết Kiệm (Saving Goals)
 * ==========================================================================
 */

import { requireAuth } from './auth.js';
import { getSavingGoals, saveSavingGoal, depositToGoal, deleteSavingGoal } from './db.js';
import { renderAppShell } from './layout.js';
import { formatCurrency, formatDate, toISODate, calculateDaysRemaining, showToast, showConfirmModal } from './utils.js';

let currentUser = null;
let allGoals = [];

export async function initSavingGoalsPage() {
  currentUser = requireAuth();
  if (!currentUser) return;

  renderAppShell('saving-goals', 'Mục Tiêu Tiết Kiệm', 'Tích lũy tài chính cho các mục tiêu cá nhân quan trọng');

  await loadData();
  bindEvents();
}

async function loadData() {
  allGoals = await getSavingGoals(currentUser.uid);
  renderGoals();
}

function renderGoals() {
  const container = document.getElementById('goals-grid');
  const countEl = document.getElementById('goals-count');
  const totalTargetEl = document.getElementById('goals-total-target');
  const totalSavedEl = document.getElementById('goals-total-saved');
  const completedCountEl = document.getElementById('goals-completed-count');

  const totalTarget = allGoals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
  const totalSaved = allGoals.reduce((sum, g) => sum + (Number(g.savedAmount) || 0), 0);
  const completedCount = allGoals.filter(g => (Number(g.savedAmount) || 0) >= (Number(g.targetAmount) || 1)).length;

  if (countEl) countEl.textContent = `${allGoals.length} mục tiêu`;
  if (totalTargetEl) totalTargetEl.textContent = formatCurrency(totalTarget);
  if (totalSavedEl) totalSavedEl.textContent = formatCurrency(totalSaved);
  if (completedCountEl) completedCountEl.textContent = `${completedCount} hoàn thành`;

  if (!container) return;

  if (allGoals.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1;" class="empty-state card">
        <div class="empty-state-icon"><i class="fas fa-bullseye"></i></div>
        <div class="empty-state-title">Chưa có mục tiêu tiết kiệm nào</div>
        <p class="empty-state-text">Đặt mục tiêu mua laptop mới, sắm xe máy, đi du lịch hoặc xây dựng quỹ khẩn cấp 6 tháng.</p>
        <button class="btn btn-primary" id="btn-empty-add-goal">+ Tạo Mục Tiêu Tiết Kiệm</button>
      </div>
    `;
    document.getElementById('btn-empty-add-goal')?.addEventListener('click', () => openGoalModal());
    return;
  }

  container.innerHTML = allGoals.map(goal => {
    const target = Number(goal.targetAmount) || 1;
    const saved = Number(goal.savedAmount) || 0;
    const missing = Math.max(0, target - saved);
    const progress = Math.min(100, Math.round((saved / target) * 100));
    const daysLeft = calculateDaysRemaining(goal.deadline);
    const isCompleted = progress >= 100;

    let timeBadgeText = `${daysLeft} ngày nữa`;
    let timeBadgeClass = 'badge-neutral';

    if (isCompleted) {
      timeBadgeText = 'Đã hoàn thành';
      timeBadgeClass = 'badge-income';
    } else if (daysLeft < 0) {
      timeBadgeText = `Quá hạn ${Math.abs(daysLeft)} ngày`;
      timeBadgeClass = 'badge-expense';
    } else if (daysLeft <= 14) {
      timeBadgeText = `Gấp: Còn ${daysLeft} ngày`;
      timeBadgeClass = 'badge-warning';
    }

    return `
      <div class="item-card">
        <div class="item-card-header">
          <div>
            <div class="item-card-title">${goal.name}</div>
            <div class="item-card-sub">Hạn chót: ${formatDate(goal.deadline)}</div>
          </div>
          <span class="badge ${timeBadgeClass}">
            <i class="fas ${isCompleted ? 'fa-check' : 'fa-calendar-alt'}"></i>
            ${timeBadgeText}
          </span>
        </div>

        <div class="item-card-body">
          ${goal.description ? `<p style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.75rem;">${goal.description}</p>` : ''}

          <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.35rem;">
            <span>Đã tiết kiệm: <strong style="color: var(--income-color);">${formatCurrency(saved)}</strong></span>
            <span>Cần có: <strong>${formatCurrency(target)}</strong></span>
          </div>

          <div class="progress-container" style="height: 10px;">
            <div class="progress-bar ${isCompleted ? 'success' : ''}" style="width: ${progress}%;"></div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.5rem;">
            <span>Tiến độ: <strong style="color: var(--brand-navy);">${progress}%</strong></span>
            <span>Còn thiếu: <strong style="color: var(--expense-color);">${formatCurrency(missing)}</strong></span>
          </div>
        </div>

        <div class="item-card-footer">
          <button class="btn btn-sm btn-outline-primary btn-deposit-goal" data-id="${goal.id}" ${isCompleted ? 'disabled' : ''}>
            <i class="fas fa-plus-circle"></i> Nạp Tiền
          </button>
          <div class="item-card-actions">
            <button class="btn btn-sm btn-secondary btn-edit-goal" data-id="${goal.id}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-ghost btn-delete-goal" data-id="${goal.id}" style="color: var(--expense-color);">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-deposit-goal').forEach(btn => {
    btn.onclick = () => openDepositModal(btn.getAttribute('data-id'));
  });

  container.querySelectorAll('.btn-edit-goal').forEach(btn => {
    btn.onclick = () => openGoalModal(btn.getAttribute('data-id'));
  });

  container.querySelectorAll('.btn-delete-goal').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const g = allGoals.find(item => item.id === id);
      showConfirmModal({
        title: 'Xóa mục tiêu',
        message: `Bạn có chắc muốn xóa mục tiêu tiết kiệm "${g?.name || ''}" không?`,
        confirmText: 'Xóa',
        isDanger: true,
        onConfirm: async () => {
          await deleteSavingGoal(id);
          showToast('Đã xóa mục tiêu tiết kiệm!');
          await loadData();
        }
      });
    };
  });
}

function bindEvents() {
  document.getElementById('btn-open-add-goal')?.addEventListener('click', () => openGoalModal());

  // Save Goal Form
  document.getElementById('goal-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('goal-edit-id')?.value;
    const name = document.getElementById('goal-name')?.value.trim();
    const targetAmount = Number(document.getElementById('goal-target-amount')?.value) || 0;
    const savedAmount = Number(document.getElementById('goal-saved-amount')?.value) || 0;
    const deadline = document.getElementById('goal-deadline')?.value;
    const description = document.getElementById('goal-desc')?.value.trim();

    if (!name) {
      showToast('Vui lòng nhập tên mục tiêu!', 'error');
      return;
    }
    if (targetAmount <= 0) {
      showToast('Số tiền cần tiết kiệm phải lớn hơn 0!', 'error');
      return;
    }
    if (!deadline) {
      showToast('Vui lòng chọn thời hạn hoàn thành (Deadline)!', 'error');
      return;
    }

    await saveSavingGoal({
      id: id || undefined,
      uid: currentUser.uid,
      name,
      targetAmount,
      savedAmount,
      deadline,
      description
    });

    showToast(id ? 'Đã cập nhật mục tiêu!' : 'Đã tạo mục tiêu tiết kiệm mới thành công!');
    closeGoalModal();
    await loadData();
  });

  document.getElementById('goal-modal-close')?.addEventListener('click', closeGoalModal);
  document.getElementById('goal-modal-cancel')?.addEventListener('click', closeGoalModal);

  // Deposit Form
  document.getElementById('deposit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const goalId = document.getElementById('deposit-goal-id')?.value;
    const amount = Number(document.getElementById('deposit-amount')?.value) || 0;

    if (amount <= 0) {
      showToast('Số tiền nạp vào phải lớn hơn 0!', 'error');
      return;
    }

    await depositToGoal(goalId, amount);
    showToast(`Đã nạp ${formatCurrency(amount)} vào mục tiêu tiết kiệm!`);
    closeDepositModal();
    await loadData();
  });

  document.getElementById('deposit-modal-close')?.addEventListener('click', closeDepositModal);
  document.getElementById('deposit-modal-cancel')?.addEventListener('click', closeDepositModal);
}

function openGoalModal(id = null) {
  const modal = document.getElementById('goal-modal');
  const titleEl = document.getElementById('goal-modal-title');
  const form = document.getElementById('goal-form');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('goal-edit-id').value = '';

  if (id) {
    const g = allGoals.find(item => item.id === id);
    if (g) {
      titleEl.textContent = 'Chỉnh Sửa Mục Tiêu Tiết Kiệm';
      document.getElementById('goal-edit-id').value = g.id;
      document.getElementById('goal-name').value = g.name;
      document.getElementById('goal-target-amount').value = g.targetAmount;
      document.getElementById('goal-saved-amount').value = g.savedAmount;
      document.getElementById('goal-deadline').value = g.deadline;
      document.getElementById('goal-desc').value = g.description || '';
    }
  } else {
    titleEl.textContent = 'Tạo Mục Tiêu Tiết Kiệm Mới';
  }

  modal.classList.add('active');
}

function closeGoalModal() {
  const modal = document.getElementById('goal-modal');
  if (modal) modal.classList.remove('active');
}

function openDepositModal(goalId) {
  const modal = document.getElementById('deposit-modal');
  const goal = allGoals.find(g => g.id === goalId);
  if (!modal || !goal) return;

  document.getElementById('deposit-goal-id').value = goal.id;
  document.getElementById('deposit-goal-name').textContent = goal.name;
  document.getElementById('deposit-amount').value = '';

  modal.classList.add('active');
}

function closeDepositModal() {
  const modal = document.getElementById('deposit-modal');
  if (modal) modal.classList.remove('active');
}
