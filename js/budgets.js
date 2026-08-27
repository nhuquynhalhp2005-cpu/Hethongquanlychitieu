/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Quản Lý Ngân Sách (Budgets Management)
 * ==========================================================================
 */

import { requireAuth } from './auth.js';
import { getBudgets, saveBudget, deleteBudget, getTransactions, getCategories } from './db.js';
import { renderAppShell } from './layout.js';
import { formatCurrency, getCurrentMonth, showToast, showConfirmModal } from './utils.js';

let currentUser = null;
let currentMonthBudgets = [];
let allTransactions = [];
let expenseCategories = [];

export async function initBudgetsPage() {
  currentUser = requireAuth();
  if (!currentUser) return;

  renderAppShell('budgets', 'Quản Lý Ngân Sách', 'Thiết lập và kiểm soát hạn mức chi tiêu theo tháng');

  const monthInput = document.getElementById('budget-month-filter');
  if (monthInput && !monthInput.value) {
    monthInput.value = getCurrentMonth();
  }

  await loadData();
  bindEvents();
}

async function loadData() {
  const selectedMonth = document.getElementById('budget-month-filter')?.value || getCurrentMonth();

  const [budgets, trans, cats] = await Promise.all([
    getBudgets(currentUser.uid, selectedMonth),
    getTransactions(currentUser.uid),
    getCategories(currentUser.uid)
  ]);

  currentMonthBudgets = budgets;
  allTransactions = trans.filter(t => t.type === 'expense' && t.date && t.date.startsWith(selectedMonth));
  expenseCategories = cats.filter(c => c.type === 'expense');

  populateModalCategories();
  renderBudgetsGrid();
}

function populateModalCategories() {
  const select = document.getElementById('budget-category-select');
  if (!select) return;

  select.innerHTML = expenseCategories.map(c => `
    <option value="${c.id}">${c.name}</option>
  `).join('');
}

function renderBudgetsGrid() {
  const container = document.getElementById('budgets-grid');
  const totalBudgetEl = document.getElementById('stat-total-budget');
  const totalSpentEl = document.getElementById('stat-total-spent');
  const remainingBudgetEl = document.getElementById('stat-remaining-budget');
  const warningCountEl = document.getElementById('stat-warning-count');

  let totalBudgetSum = 0;
  let totalSpentSum = 0;
  let warningCount = 0;

  const budgetCardsHtml = currentMonthBudgets.map(budget => {
    totalBudgetSum += Number(budget.amount) || 0;

    // Calculate actual spent for this category this month
    const spent = allTransactions
      .filter(t => t.categoryId === budget.categoryId)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    totalSpentSum += spent;
    const remaining = (Number(budget.amount) || 0) - spent;
    const percent = budget.amount > 0 ? Math.round((spent / budget.amount) * 100) : 0;

    let statusClass = 'success';
    let statusText = 'Trong tầm kiểm soát';
    let badgeHtml = `<span class="badge badge-income"><i class="fas fa-check-circle"></i> Bình thường</span>`;

    if (percent >= 100) {
      statusClass = 'danger';
      statusText = 'Đã vượt ngân sách!';
      badgeHtml = `<span class="badge badge-expense"><i class="fas fa-exclamation-triangle"></i> Vượt ngân sách (${percent}%)</span>`;
      warningCount++;
    } else if (percent >= 80) {
      statusClass = 'warning';
      statusText = 'Cảnh báo: Sắp chạm giới hạn!';
      badgeHtml = `<span class="badge badge-warning"><i class="fas fa-exclamation-circle"></i> Sắp vượt (${percent}%)</span>`;
      warningCount++;
    }

    return `
      <div class="item-card" style="border-top: 4px solid ${percent >= 100 ? 'var(--expense-color)' : percent >= 80 ? 'var(--warning-color)' : 'var(--income-color)'};">
        <div class="item-card-header">
          <div>
            <div class="item-card-title">${budget.categoryName || 'Danh mục'}</div>
            <div class="item-card-sub">Tháng ${budget.month}</div>
          </div>
          ${badgeHtml}
        </div>

        <div class="item-card-body">
          <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.5rem;">
            <span>Đã chi: <strong style="color: ${spent > budget.amount ? 'var(--expense-color)' : 'var(--brand-navy)'};">${formatCurrency(spent)}</strong></span>
            <span>Ngân sách: <strong>${formatCurrency(budget.amount)}</strong></span>
          </div>

          <div class="progress-container" style="height: 10px;">
            <div class="progress-bar ${statusClass}" style="width: ${Math.min(100, percent)}%;"></div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.5rem;">
            <span>${statusText}</span>
            <span>Còn lại: <strong style="color: ${remaining < 0 ? 'var(--expense-color)' : 'var(--income-color)'};">${formatCurrency(remaining)}</strong></span>
          </div>
        </div>

        <div class="item-card-footer">
          <span style="font-size: 0.8rem; color: var(--text-light);">Đã sử dụng ${percent}%</span>
          <div class="item-card-actions">
            <button class="btn btn-sm btn-secondary btn-edit-budget" data-id="${budget.id}">
              <i class="fas fa-edit"></i> Sửa
            </button>
            <button class="btn btn-sm btn-ghost btn-delete-budget" data-id="${budget.id}" style="color: var(--expense-color);">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (totalBudgetEl) totalBudgetEl.textContent = formatCurrency(totalBudgetSum);
  if (totalSpentEl) totalSpentEl.textContent = formatCurrency(totalSpentSum);
  if (remainingBudgetEl) {
    const rem = totalBudgetSum - totalSpentSum;
    remainingBudgetEl.textContent = formatCurrency(rem);
    remainingBudgetEl.className = `stat-value ${rem < 0 ? 'text-danger' : 'text-success'}`;
  }
  if (warningCountEl) warningCountEl.textContent = `${warningCount} cảnh báo`;

  if (!container) return;

  if (currentMonthBudgets.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1;" class="empty-state card">
        <div class="empty-state-icon"><i class="fas fa-piggy-bank"></i></div>
        <div class="empty-state-title">Chưa thiết lập ngân sách cho tháng này</div>
        <p class="empty-state-text">Lập ngân sách giúp bạn theo dõi giới hạn chi tiêu cho từng danh mục như Ăn uống, Đi lại, Mua sắm...</p>
        <button class="btn btn-primary" id="btn-empty-add-budget">+ Thiết Lập Ngân Sách Ngay</button>
      </div>
    `;
    document.getElementById('btn-empty-add-budget')?.addEventListener('click', () => openBudgetModal());
    return;
  }

  container.innerHTML = budgetCardsHtml;

  container.querySelectorAll('.btn-edit-budget').forEach(btn => {
    btn.onclick = () => openBudgetModal(btn.getAttribute('data-id'));
  });

  container.querySelectorAll('.btn-delete-budget').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const b = currentMonthBudgets.find(item => item.id === id);
      showConfirmModal({
        title: 'Xóa ngân sách',
        message: `Bạn có chắc muốn xóa hạn mức ngân sách danh mục "${b?.categoryName || ''}" không?`,
        confirmText: 'Xóa',
        isDanger: true,
        onConfirm: async () => {
          await deleteBudget(id);
          showToast('Đã xóa ngân sách!');
          await loadData();
        }
      });
    };
  });
}

function bindEvents() {
  document.getElementById('budget-month-filter')?.addEventListener('change', loadData);

  document.getElementById('btn-open-add-budget')?.addEventListener('click', () => {
    openBudgetModal();
  });

  document.getElementById('budget-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('budget-edit-id')?.value;
    const categoryId = document.getElementById('budget-category-select')?.value;
    const amount = Number(document.getElementById('budget-amount')?.value) || 0;
    const month = document.getElementById('budget-month-input')?.value || getCurrentMonth();

    if (amount <= 0) {
      showToast('Số tiền ngân sách phải lớn hơn 0!', 'error');
      return;
    }

    const catObj = expenseCategories.find(c => c.id === categoryId);
    const categoryName = catObj ? catObj.name : 'Chi tiêu';

    await saveBudget({
      id: id || undefined,
      uid: currentUser.uid,
      categoryId,
      categoryName,
      amount,
      month
    });

    showToast(id ? 'Đã cập nhật ngân sách!' : 'Đã thiết lập ngân sách thành công!');
    closeBudgetModal();
    await loadData();
  });

  document.getElementById('budget-modal-close')?.addEventListener('click', closeBudgetModal);
  document.getElementById('budget-modal-cancel')?.addEventListener('click', closeBudgetModal);
}

function openBudgetModal(id = null) {
  const modal = document.getElementById('budget-modal');
  const titleEl = document.getElementById('budget-modal-title');
  const form = document.getElementById('budget-form');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('budget-edit-id').value = '';
  document.getElementById('budget-month-input').value = document.getElementById('budget-month-filter')?.value || getCurrentMonth();

  if (id) {
    const b = currentMonthBudgets.find(item => item.id === id);
    if (b) {
      titleEl.textContent = 'Chỉnh Sửa Ngân Sách';
      document.getElementById('budget-edit-id').value = b.id;
      document.getElementById('budget-category-select').value = b.categoryId;
      document.getElementById('budget-amount').value = b.amount;
      document.getElementById('budget-month-input').value = b.month;
    }
  } else {
    titleEl.textContent = 'Thiết Lập Ngân Sách Mới';
  }

  modal.classList.add('active');
}

function closeBudgetModal() {
  const modal = document.getElementById('budget-modal');
  if (modal) modal.classList.remove('active');
}
