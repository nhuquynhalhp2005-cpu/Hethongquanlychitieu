/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Quản Lý Khoản Nợ (Debts & Loans Management)
 * ==========================================================================
 */

import { requireAuth } from './auth.js';
import { getDebts, saveDebt, payDebt, deleteDebt } from './db.js';
import { renderAppShell } from './layout.js';
import { formatCurrency, formatDate, toISODate, calculateDaysRemaining, showToast, showConfirmModal } from './utils.js';

let currentUser = null;
let allDebts = [];

export async function initDebtsPage() {
  currentUser = requireAuth();
  if (!currentUser) return;

  renderAppShell('debts', 'Quản Lý Khoản Nợ & Cho Vay', 'Theo dõi chi tiết các khoản đi vay và cho người khác vay');

  await loadData();
  bindEvents();
}

async function loadData() {
  allDebts = await getDebts(currentUser.uid);
  renderDebts();
}

function renderDebts() {
  const container = document.getElementById('debts-grid');
  const countEl = document.getElementById('debts-count');
  const totalDebtRemainingEl = document.getElementById('debts-total-remaining');
  const totalPaidEl = document.getElementById('debts-total-paid');

  const activeDebts = allDebts.filter(d => d.status !== 'paid');
  const totalRemaining = activeDebts.reduce((sum, d) => sum + ((Number(d.totalAmount) || 0) - (Number(d.paidAmount) || 0)), 0);
  const totalPaid = allDebts.reduce((sum, d) => sum + (Number(d.paidAmount) || 0), 0);

  if (countEl) countEl.textContent = `${allDebts.length} khoản nợ`;
  if (totalDebtRemainingEl) totalDebtRemainingEl.textContent = formatCurrency(totalRemaining);
  if (totalPaidEl) totalPaidEl.textContent = formatCurrency(totalPaid);

  if (!container) return;

  if (allDebts.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1;" class="empty-state card">
        <div class="empty-state-icon"><i class="fas fa-hand-holding-usd"></i></div>
        <div class="empty-state-title">Chưa có khoản nợ hay cho vay nào</div>
        <p class="empty-state-text">Ghi chép các khoản vay ngân hàng, bạn bè hoặc người khác mượn tiền để không bị quên hạn trả.</p>
        <button class="btn btn-primary" id="btn-empty-add-debt">+ Thêm Khoản Nợ Mới</button>
      </div>
    `;
    document.getElementById('btn-empty-add-debt')?.addEventListener('click', () => openDebtModal());
    return;
  }

  container.innerHTML = allDebts.map(debt => {
    const total = Number(debt.totalAmount) || 0;
    const paid = Number(debt.paidAmount) || 0;
    const remaining = Math.max(0, total - paid);
    const progress = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    const daysLeft = calculateDaysRemaining(debt.dueDate);
    const isPaid = debt.status === 'paid' || remaining === 0;

    let dueBadgeText = `${daysLeft} ngày nữa`;
    let dueBadgeClass = 'badge-neutral';

    if (isPaid) {
      dueBadgeText = 'Đã thanh toán hết';
      dueBadgeClass = 'badge-income';
    } else if (daysLeft < 0) {
      dueBadgeText = `Quá hạn ${Math.abs(daysLeft)} ngày!`;
      dueBadgeClass = 'badge-expense';
    } else if (daysLeft <= 7) {
      dueBadgeText = `Sắp đến hạn (${daysLeft} ngày)`;
      dueBadgeClass = 'badge-warning';
    }

    return `
      <div class="item-card">
        <div class="item-card-header">
          <div>
            <div class="item-card-title">${debt.name}</div>
            <div class="item-card-sub">${debt.type === 'lent' ? 'Cho vay:' : 'Người cho vay:'} <strong>${debt.lender || 'Không rõ'}</strong></div>
          </div>
          <span class="badge ${dueBadgeClass}">
            <i class="fas ${isPaid ? 'fa-check' : 'fa-clock'}"></i>
            ${dueBadgeText}
          </span>
        </div>

        <div class="item-card-body">
          ${debt.note ? `<p style="font-size: 0.8125rem; color: var(--text-muted); margin-bottom: 0.75rem;">${debt.note}</p>` : ''}

          <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.35rem;">
            <span>Đã trả: <strong style="color: var(--income-color);">${formatCurrency(paid)}</strong></span>
            <span>Tổng số nợ: <strong>${formatCurrency(total)}</strong></span>
          </div>

          <div class="progress-container" style="height: 10px;">
            <div class="progress-bar ${isPaid ? 'success' : ''}" style="width: ${progress}%;"></div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.8125rem; color: var(--text-muted); margin-top: 0.5rem;">
            <span>Hạn trả: <strong>${formatDate(debt.dueDate)}</strong></span>
            <span>Còn nợ: <strong style="color: ${isPaid ? 'var(--income-color)' : 'var(--expense-color)'}; font-size: 0.95rem;">${formatCurrency(remaining)}</strong></span>
          </div>
        </div>

        <div class="item-card-footer">
          <button class="btn btn-sm btn-primary btn-pay-debt" data-id="${debt.id}" ${isPaid ? 'disabled' : ''}>
            <i class="fas fa-money-check-alt"></i> Trả Nợ
          </button>
          <div class="item-card-actions">
            <button class="btn btn-sm btn-secondary btn-edit-debt" data-id="${debt.id}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-ghost btn-delete-debt" data-id="${debt.id}" style="color: var(--expense-color);">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-pay-debt').forEach(btn => {
    btn.onclick = () => openPaymentModal(btn.getAttribute('data-id'));
  });

  container.querySelectorAll('.btn-edit-debt').forEach(btn => {
    btn.onclick = () => openDebtModal(btn.getAttribute('data-id'));
  });

  container.querySelectorAll('.btn-delete-debt').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const d = allDebts.find(item => item.id === id);
      showConfirmModal({
        title: 'Xóa khoản nợ',
        message: `Bạn có chắc muốn xóa bản ghi khoản nợ "${d?.name || ''}" không?`,
        confirmText: 'Xóa',
        isDanger: true,
        onConfirm: async () => {
          await deleteDebt(id);
          showToast('Đã xóa khoản nợ thành công!');
          await loadData();
        }
      });
    };
  });
}

function bindEvents() {
  document.getElementById('btn-open-add-debt')?.addEventListener('click', () => openDebtModal());

  // Save Debt Form
  document.getElementById('debt-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('debt-edit-id')?.value;
    const name = document.getElementById('debt-name')?.value.trim();
    const lender = document.getElementById('debt-lender')?.value.trim();
    const totalAmount = Number(document.getElementById('debt-total-amount')?.value) || 0;
    const paidAmount = Number(document.getElementById('debt-paid-amount')?.value) || 0;
    const dueDate = document.getElementById('debt-due-date')?.value;
    const type = document.getElementById('debt-type')?.value || 'borrowed';
    const note = document.getElementById('debt-note')?.value.trim();

    if (!name) {
      showToast('Vui lòng nhập tên khoản nợ!', 'error');
      return;
    }
    if (totalAmount <= 0) {
      showToast('Tổng số tiền nợ phải lớn hơn 0!', 'error');
      return;
    }

    await saveDebt({
      id: id || undefined,
      uid: currentUser.uid,
      name,
      lender,
      totalAmount,
      paidAmount,
      dueDate,
      type,
      note,
      status: paidAmount >= totalAmount ? 'paid' : 'active'
    });

    showToast(id ? 'Đã cập nhật khoản nợ!' : 'Đã thêm khoản nợ mới thành công!');
    closeDebtModal();
    await loadData();
  });

  document.getElementById('debt-modal-close')?.addEventListener('click', closeDebtModal);
  document.getElementById('debt-modal-cancel')?.addEventListener('click', closeDebtModal);

  // Pay Debt Form
  document.getElementById('pay-debt-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const debtId = document.getElementById('pay-debt-id')?.value;
    const amount = Number(document.getElementById('pay-debt-amount')?.value) || 0;

    if (amount <= 0) {
      showToast('Số tiền thanh toán phải lớn hơn 0!', 'error');
      return;
    }

    await payDebt(debtId, amount);
    showToast(`Đã ghi nhận thanh toán ${formatCurrency(amount)} cho khoản nợ!`);
    closePaymentModal();
    await loadData();
  });

  document.getElementById('pay-modal-close')?.addEventListener('click', closePaymentModal);
  document.getElementById('pay-modal-cancel')?.addEventListener('click', closePaymentModal);
}

function openDebtModal(id = null) {
  const modal = document.getElementById('debt-modal');
  const titleEl = document.getElementById('debt-modal-title');
  const form = document.getElementById('debt-form');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('debt-edit-id').value = '';
  document.getElementById('debt-paid-amount').value = '0';

  if (id) {
    const d = allDebts.find(item => item.id === id);
    if (d) {
      titleEl.textContent = 'Chỉnh Sửa Khoản Nợ';
      document.getElementById('debt-edit-id').value = d.id;
      document.getElementById('debt-name').value = d.name;
      document.getElementById('debt-lender').value = d.lender;
      document.getElementById('debt-total-amount').value = d.totalAmount;
      document.getElementById('debt-paid-amount').value = d.paidAmount || 0;
      document.getElementById('debt-due-date').value = d.dueDate || '';
      document.getElementById('debt-type').value = d.type || 'borrowed';
      document.getElementById('debt-note').value = d.note || '';
    }
  } else {
    titleEl.textContent = 'Ghi Chép Khoản Nợ / Cho Vay Mới';
  }

  modal.classList.add('active');
}

function closeDebtModal() {
  const modal = document.getElementById('debt-modal');
  if (modal) modal.classList.remove('active');
}

function openPaymentModal(debtId) {
  const modal = document.getElementById('pay-debt-modal');
  const debt = allDebts.find(d => d.id === debtId);
  if (!modal || !debt) return;

  const remaining = Math.max(0, (Number(debt.totalAmount) || 0) - (Number(debt.paidAmount) || 0));

  document.getElementById('pay-debt-id').value = debt.id;
  document.getElementById('pay-debt-name').textContent = debt.name;
  document.getElementById('pay-debt-remaining').textContent = formatCurrency(remaining);
  document.getElementById('pay-debt-amount').value = remaining;

  modal.classList.add('active');
}

function closePaymentModal() {
  const modal = document.getElementById('pay-debt-modal');
  if (modal) modal.classList.remove('active');
}
