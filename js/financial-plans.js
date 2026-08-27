/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Kế Hoạch Tài Chính Cá Nhân (Financial Plans)
 * ==========================================================================
 */

import { requireAuth } from './auth.js';
import { getFinancialPlans, saveFinancialPlan, deleteFinancialPlan } from './db.js';
import { renderAppShell } from './layout.js';
import { formatCurrency, formatDate, toISODate, calculateMonthsRemaining, showToast, showConfirmModal } from './utils.js';

let currentUser = null;
let allPlans = [];

export async function initFinancialPlansPage() {
  currentUser = requireAuth();
  if (!currentUser) return;

  renderAppShell('financial-plans', 'Kế Hoạch Tài Chính', 'Xây dựng và theo dõi lộ trình tài chính dài hạn');

  await loadData();
  bindEvents();
}

async function loadData() {
  allPlans = await getFinancialPlans(currentUser.uid);
  renderPlans();
}

function renderPlans() {
  const container = document.getElementById('plans-grid');
  const countEl = document.getElementById('plans-count');
  const totalTargetEl = document.getElementById('plans-total-target');
  const totalCurrentEl = document.getElementById('plans-total-current');

  const totalTarget = allPlans.reduce((sum, p) => sum + (Number(p.targetAmount) || 0), 0);
  const totalCurrent = allPlans.reduce((sum, p) => sum + (Number(p.currentAmount) || 0), 0);

  if (countEl) countEl.textContent = `${allPlans.length} kế hoạch`;
  if (totalTargetEl) totalTargetEl.textContent = formatCurrency(totalTarget);
  if (totalCurrentEl) totalCurrentEl.textContent = formatCurrency(totalCurrent);

  if (!container) return;

  if (allPlans.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1;" class="empty-state card">
        <div class="empty-state-icon"><i class="fas fa-compass"></i></div>
        <div class="empty-state-title">Chưa có kế hoạch tài chính nào</div>
        <p class="empty-state-text">Lập kế hoạch mua nhà, kinh doanh, tự do tài chính hoặc chuẩn bị quỹ hưu trí.</p>
        <button class="btn btn-primary" id="btn-empty-add-plan">+ Tạo Kế Hoạch Đầu Tiên</button>
      </div>
    `;
    document.getElementById('btn-empty-add-plan')?.addEventListener('click', () => openPlanModal());
    return;
  }

  container.innerHTML = allPlans.map(plan => {
    const target = Number(plan.targetAmount) || 1;
    const current = Number(plan.currentAmount) || 0;
    const missing = Math.max(0, target - current);
    const progress = Math.min(100, Math.round((current / target) * 100));
    const monthsLeft = calculateMonthsRemaining(plan.endDate);
    const monthlyNeeded = monthsLeft > 0 ? Math.round(missing / monthsLeft) : missing;

    const isCompleted = progress >= 100;

    return `
      <div class="item-card">
        <div class="item-card-header">
          <div>
            <div class="item-card-title">${plan.name}</div>
            <div class="item-card-sub">${formatDate(plan.startDate)} &rarr; ${formatDate(plan.endDate)}</div>
          </div>
          <span class="badge ${isCompleted ? 'badge-income' : 'badge-info'}">
            <i class="fas ${isCompleted ? 'fa-check-circle' : 'fa-hourglass-half'}"></i>
            ${isCompleted ? 'Đã hoàn thành' : 'Đang thực hiện'}
          </span>
        </div>

        <div class="item-card-body">
          ${plan.description ? `<p style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.75rem;">${plan.description}</p>` : ''}

          <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.35rem;">
            <span>Hiện có: <strong style="color: var(--primary);">${formatCurrency(current)}</strong></span>
            <span>Mục tiêu: <strong>${formatCurrency(target)}</strong></span>
          </div>

          <div class="progress-container" style="height: 10px;">
            <div class="progress-bar ${isCompleted ? 'success' : ''}" style="width: ${progress}%;"></div>
          </div>

          <div style="background-color: var(--bg-subtle); border-radius: var(--radius-md); padding: 0.75rem; margin-top: 0.75rem; font-size: 0.8125rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
              <span style="color: var(--text-muted);">Còn thiếu:</span>
              <strong style="color: var(--expense-color);">${formatCurrency(missing)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
              <span style="color: var(--text-muted);">Thời gian còn lại:</span>
              <strong>${monthsLeft} tháng</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 0.25rem; border-top: 1px dashed var(--border-color);">
              <span style="color: var(--brand-navy); font-weight: 600;">Cần tích lũy mỗi tháng:</span>
              <strong style="color: var(--brand-blue);">${formatCurrency(monthlyNeeded)}</strong>
            </div>
          </div>
        </div>

        <div class="item-card-footer">
          <span style="font-weight: 700; color: var(--primary); font-size: 0.85rem;">Tiến độ: ${progress}%</span>
          <div class="item-card-actions">
            <button class="btn btn-sm btn-secondary btn-edit-plan" data-id="${plan.id}">
              <i class="fas fa-edit"></i> Sửa
            </button>
            <button class="btn btn-sm btn-ghost btn-delete-plan" data-id="${plan.id}" style="color: var(--expense-color);">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-edit-plan').forEach(btn => {
    btn.onclick = () => openPlanModal(btn.getAttribute('data-id'));
  });

  container.querySelectorAll('.btn-delete-plan').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const p = allPlans.find(item => item.id === id);
      showConfirmModal({
        title: 'Xóa kế hoạch',
        message: `Bạn có chắc muốn xóa kế hoạch tài chính "${p?.name || ''}" không?`,
        confirmText: 'Xóa',
        isDanger: true,
        onConfirm: async () => {
          await deleteFinancialPlan(id);
          showToast('Đã xóa kế hoạch tài chính!');
          await loadData();
        }
      });
    };
  });
}

function bindEvents() {
  document.getElementById('btn-open-add-plan')?.addEventListener('click', () => openPlanModal());

  document.getElementById('plan-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('plan-edit-id')?.value;
    const name = document.getElementById('plan-name')?.value.trim();
    const targetAmount = Number(document.getElementById('plan-target-amount')?.value) || 0;
    const currentAmount = Number(document.getElementById('plan-current-amount')?.value) || 0;
    const startDate = document.getElementById('plan-start-date')?.value || toISODate();
    const endDate = document.getElementById('plan-end-date')?.value;
    const description = document.getElementById('plan-desc')?.value.trim();

    if (!name) {
      showToast('Vui lòng nhập tên kế hoạch!', 'error');
      return;
    }
    if (targetAmount <= 0) {
      showToast('Mục tiêu số tiền phải lớn hơn 0!', 'error');
      return;
    }
    if (!endDate) {
      showToast('Vui lòng chọn ngày kết thúc kế hoạch!', 'error');
      return;
    }

    await saveFinancialPlan({
      id: id || undefined,
      uid: currentUser.uid,
      name,
      targetAmount,
      currentAmount,
      startDate,
      endDate,
      description,
      status: currentAmount >= targetAmount ? 'completed' : 'active'
    });

    showToast(id ? 'Đã cập nhật kế hoạch!' : 'Đã thêm kế hoạch tài chính mới!');
    closePlanModal();
    await loadData();
  });

  document.getElementById('plan-modal-close')?.addEventListener('click', closePlanModal);
  document.getElementById('plan-modal-cancel')?.addEventListener('click', closePlanModal);
}

function openPlanModal(id = null) {
  const modal = document.getElementById('plan-modal');
  const titleEl = document.getElementById('plan-modal-title');
  const form = document.getElementById('plan-form');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('plan-edit-id').value = '';
  document.getElementById('plan-start-date').value = toISODate();

  if (id) {
    const p = allPlans.find(item => item.id === id);
    if (p) {
      titleEl.textContent = 'Chỉnh Sửa Kế Hoạch Tài Chính';
      document.getElementById('plan-edit-id').value = p.id;
      document.getElementById('plan-name').value = p.name;
      document.getElementById('plan-target-amount').value = p.targetAmount;
      document.getElementById('plan-current-amount').value = p.currentAmount;
      document.getElementById('plan-start-date').value = p.startDate;
      document.getElementById('plan-end-date').value = p.endDate;
      document.getElementById('plan-desc').value = p.description || '';
    }
  } else {
    titleEl.textContent = 'Tạo Kế Hoạch Tài Chính Mới';
  }

  modal.classList.add('active');
}

function closePlanModal() {
  const modal = document.getElementById('plan-modal');
  if (modal) modal.classList.remove('active');
}
