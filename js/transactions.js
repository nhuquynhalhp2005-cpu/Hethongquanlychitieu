/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Lịch Sử Giao Dịch Tổng Hợp (Transactions History)
 * ==========================================================================
 */

import { requireAuth } from './auth.js';
import { getTransactions, deleteTransaction, getCategories } from './db.js';
import { renderAppShell } from './layout.js';
import { formatCurrency, formatDate, showToast, showConfirmModal, exportToCSV } from './utils.js';

let allTransactions = [];
let categoriesList = [];
let currentUser = null;

export async function initTransactionsPage() {
  currentUser = requireAuth();
  if (!currentUser) return;

  renderAppShell('transactions', 'Lịch Sử Giao Dịch', 'Toàn bộ lịch sử các giao dịch thu và chi');

  await loadData();
  bindEvents();
}

async function loadData() {
  const [trans, cats] = await Promise.all([
    getTransactions(currentUser.uid),
    getCategories(currentUser.uid)
  ]);

  allTransactions = trans;
  categoriesList = cats;

  populateCategoryFilter();
  renderTable();
}

function populateCategoryFilter() {
  const filterCatSelect = document.getElementById('filter-category');
  if (!filterCatSelect) return;

  const catOptions = categoriesList.map(c => `<option value="${c.id}">${c.name} (${c.type === 'income' ? 'Thu' : 'Chi'})</option>`).join('');
  filterCatSelect.innerHTML = `<option value="">Tất cả danh mục</option>${catOptions}`;
}

function filterAndSort() {
  const search = (document.getElementById('trans-search-input')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('filter-type')?.value || '';
  const catFilter = document.getElementById('filter-category')?.value || '';
  const monthFilter = document.getElementById('filter-month')?.value || '';
  const dateFilter = document.getElementById('filter-date')?.value || '';
  const sortBy = document.getElementById('sort-by')?.value || 'date-desc';

  let list = allTransactions.filter(item => {
    const matchSearch = !search || 
      (item.title && item.title.toLowerCase().includes(search)) || 
      (item.note && item.note.toLowerCase().includes(search));
    const matchType = !typeFilter || item.type === typeFilter;
    const matchCat = !catFilter || item.categoryId === catFilter;
    const matchMonth = !monthFilter || (item.date && item.date.startsWith(monthFilter));
    const matchDate = !dateFilter || item.date === dateFilter;

    return matchSearch && matchType && matchCat && matchMonth && matchDate;
  });

  list.sort((a, b) => {
    if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
    if (sortBy === 'amount-desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
    if (sortBy === 'amount-asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
    return 0;
  });

  return list;
}

function renderTable() {
  const list = filterAndSort();
  const tbody = document.getElementById('transactions-tbody');
  const countEl = document.getElementById('trans-count');
  const netTotalEl = document.getElementById('trans-net-total');

  const totalIncome = list.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalExpense = list.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const netTotal = totalIncome - totalExpense;

  if (countEl) countEl.textContent = `${list.length} giao dịch`;
  if (netTotalEl) {
    netTotalEl.textContent = `${netTotal >= 0 ? '+' : ''}${formatCurrency(netTotal)}`;
    netTotalEl.className = `stat-value ${netTotal >= 0 ? 'text-success' : 'text-danger'}`;
  }

  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon"><i class="fas fa-search"></i></div>
          <div class="empty-state-title">Không tìm thấy giao dịch nào</div>
          <p class="empty-state-text">Thử thay đổi bộ lọc tìm kiếm hoặc ghi nhận giao dịch mới.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(item => {
    const isIncome = item.type === 'income';
    return `
      <tr>
        <td>${formatDate(item.date)}</td>
        <td>
          <span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">
            <i class="fas ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
            ${isIncome ? 'Khoản Thu' : 'Khoản Chi'}
          </span>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--brand-navy);">${item.title}</div>
        </td>
        <td>
          <span class="badge badge-neutral">${item.categoryName || 'Khác'}</span>
        </td>
        <td style="font-weight: 700; color: ${isIncome ? 'var(--income-color)' : 'var(--expense-color)'};">
          ${isIncome ? '+' : '-'}${formatCurrency(item.amount)}
        </td>
        <td style="color: var(--text-muted); font-size: 0.8125rem;">
          ${item.note || '--'}
        </td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-ghost btn-delete-trans" data-id="${item.id}" style="color: var(--expense-color);" title="Xóa giao dịch">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-delete-trans').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const item = allTransactions.find(i => i.id === id);
      showConfirmModal({
        title: 'Xóa giao dịch',
        message: `Bạn có chắc chắn muốn xóa giao dịch "${item?.title || ''}" (${formatCurrency(item?.amount || 0)}) không?`,
        confirmText: 'Xóa vĩnh viễn',
        isDanger: true,
        onConfirm: async () => {
          await deleteTransaction(id, currentUser.uid);
          showToast('Đã xóa giao dịch thành công!');
          await loadData();
        }
      });
    };
  });
}

function bindEvents() {
  document.getElementById('trans-search-input')?.addEventListener('input', renderTable);
  document.getElementById('filter-type')?.addEventListener('change', renderTable);
  document.getElementById('filter-category')?.addEventListener('change', renderTable);
  document.getElementById('filter-month')?.addEventListener('change', renderTable);
  document.getElementById('filter-date')?.addEventListener('change', renderTable);
  document.getElementById('sort-by')?.addEventListener('change', renderTable);

  document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
    if (document.getElementById('trans-search-input')) document.getElementById('trans-search-input').value = '';
    if (document.getElementById('filter-type')) document.getElementById('filter-type').value = '';
    if (document.getElementById('filter-category')) document.getElementById('filter-category').value = '';
    if (document.getElementById('filter-month')) document.getElementById('filter-month').value = '';
    if (document.getElementById('filter-date')) document.getElementById('filter-date').value = '';
    if (document.getElementById('sort-by')) document.getElementById('sort-by').value = 'date-desc';
    renderTable();
  });

  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const list = filterAndSort();
    const headers = ['Ngày', 'Loại Giao Dịch', 'Nội Dung', 'Danh Mục', 'Số Tiền (VNĐ)', 'Ghi Chú'];
    const rows = list.map(item => [
      item.date,
      item.type === 'income' ? 'Khoản Thu' : 'Khoản Chi',
      item.title,
      item.categoryName || '',
      item.type === 'income' ? `+${item.amount}` : `-${item.amount}`,
      item.note || ''
    ]);
    exportToCSV('lich-su-giao-dich', headers, rows);
    showToast('Đã xuất lịch sử giao dịch ra file CSV!');
  });
}
