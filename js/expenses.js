/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Quản Lý Khoản Chi (Expenses Management)
 * ==========================================================================
 */

import { requireAuth } from './auth.js';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction, getCategories, getBudgets } from './db.js';
import { renderAppShell } from './layout.js';
import { formatCurrency, formatDate, toISODate, getCurrentMonth, showToast, showConfirmModal, exportToCSV } from './utils.js';

let allExpenses = [];
let categoriesList = [];
let currentUser = null;

export async function initExpensesPage() {
  currentUser = requireAuth();
  if (!currentUser) return;

  renderAppShell('expenses', 'Quản Lý Khoản Chi', 'Kiểm soát các chi phí sinh hoạt và mua sắm');

  await loadData();
  bindEvents();
}

async function loadData() {
  const [trans, cats] = await Promise.all([
    getTransactions(currentUser.uid),
    getCategories(currentUser.uid)
  ]);

  allExpenses = trans.filter(t => t.type === 'expense');
  categoriesList = cats.filter(c => c.type === 'expense');

  populateCategorySelects();
  renderTable();
}

function populateCategorySelects() {
  const filterCatSelect = document.getElementById('filter-category');
  const modalCatSelect = document.getElementById('expense-category-select');

  const catOptions = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  if (filterCatSelect) {
    filterCatSelect.innerHTML = `<option value="">Tất cả danh mục</option>${catOptions}`;
  }

  if (modalCatSelect) {
    modalCatSelect.innerHTML = catOptions;
  }
}

function filterAndSortExpenses() {
  const search = (document.getElementById('expense-search-input')?.value || '').toLowerCase().trim();
  const catFilter = document.getElementById('filter-category')?.value || '';
  const monthFilter = document.getElementById('filter-month')?.value || '';
  const dateFilter = document.getElementById('filter-date')?.value || '';
  const sortBy = document.getElementById('sort-by')?.value || 'date-desc';

  let result = allExpenses.filter(item => {
    const matchSearch = !search || 
      (item.title && item.title.toLowerCase().includes(search)) || 
      (item.note && item.note.toLowerCase().includes(search));
    const matchCat = !catFilter || item.categoryId === catFilter;
    const matchMonth = !monthFilter || (item.date && item.date.startsWith(monthFilter));
    const matchDate = !dateFilter || item.date === dateFilter;

    return matchSearch && matchCat && matchMonth && matchDate;
  });

  result.sort((a, b) => {
    if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
    if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
    if (sortBy === 'amount-desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
    if (sortBy === 'amount-asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
    return 0;
  });

  return result;
}

function renderTable() {
  const list = filterAndSortExpenses();
  const tbody = document.getElementById('expense-tbody');
  const countEl = document.getElementById('expense-count');
  const totalAmountEl = document.getElementById('expense-total-amount');

  const totalSum = list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  if (countEl) countEl.textContent = `${list.length} khoản chi`;
  if (totalAmountEl) totalAmountEl.textContent = formatCurrency(totalSum);

  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="empty-state-icon"><i class="fas fa-shopping-cart"></i></div>
          <div class="empty-state-title">Chưa có khoản chi nào phù hợp</div>
          <p class="empty-state-text">Nhấn nút "+ Thêm Khoản Chi" để ghi chép chi tiêu mới.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((item, idx) => `
    <tr>
      <td style="color: var(--text-light); font-size: 0.8rem;">#${idx + 1}</td>
      <td>
        <div style="font-weight: 600; color: var(--brand-navy);">${item.title}</div>
        ${item.note ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${item.note}</div>` : ''}
      </td>
      <td>
        <span class="badge badge-expense">
          <i class="fas fa-tag"></i>
          ${item.categoryName || 'Chi tiêu'}
        </span>
      </td>
      <td>${formatDate(item.date)}</td>
      <td style="font-weight: 700; color: var(--expense-color); font-size: 0.95rem;">
        -${formatCurrency(item.amount)}
      </td>
      <td style="text-align: right;">
        <div class="item-card-actions" style="justify-content: flex-end;">
          <button class="btn btn-sm btn-secondary btn-edit-expense" data-id="${item.id}" title="Chỉnh sửa">
            <i class="fas fa-edit"></i> Sửa
          </button>
          <button class="btn btn-sm btn-ghost btn-delete-expense" data-id="${item.id}" style="color: var(--expense-color);" title="Xóa">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-edit-expense').forEach(btn => {
    btn.onclick = () => openExpenseModal(btn.getAttribute('data-id'));
  });

  tbody.querySelectorAll('.btn-delete-expense').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const item = allExpenses.find(i => i.id === id);
      showConfirmModal({
        title: 'Xóa khoản chi',
        message: `Bạn có chắc chắn muốn xóa khoản chi "${item?.title || ''}" số tiền ${formatCurrency(item?.amount || 0)} không?`,
        confirmText: 'Xóa vĩnh viễn',
        isDanger: true,
        onConfirm: async () => {
          await deleteTransaction(id, currentUser.uid);
          showToast('Đã xóa khoản chi thành công!');
          await loadData();
        }
      });
    };
  });
}

function bindEvents() {
  document.getElementById('expense-search-input')?.addEventListener('input', renderTable);
  document.getElementById('filter-category')?.addEventListener('change', renderTable);
  document.getElementById('filter-month')?.addEventListener('change', renderTable);
  document.getElementById('filter-date')?.addEventListener('change', renderTable);
  document.getElementById('sort-by')?.addEventListener('change', renderTable);

  document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
    if (document.getElementById('expense-search-input')) document.getElementById('expense-search-input').value = '';
    if (document.getElementById('filter-category')) document.getElementById('filter-category').value = '';
    if (document.getElementById('filter-month')) document.getElementById('filter-month').value = '';
    if (document.getElementById('filter-date')) document.getElementById('filter-date').value = '';
    if (document.getElementById('sort-by')) document.getElementById('sort-by').value = 'date-desc';
    renderTable();
  });

  document.getElementById('btn-open-add-expense')?.addEventListener('click', () => {
    openExpenseModal();
  });

  document.getElementById('btn-export-expense-csv')?.addEventListener('click', () => {
    const list = filterAndSortExpenses();
    const headers = ['STT', 'Tên Khoản Chi', 'Danh Mục', 'Ngày Chi', 'Số Tiền (VNĐ)', 'Ghi Chú'];
    const rows = list.map((item, idx) => [
      idx + 1,
      item.title,
      item.categoryName || '',
      item.date,
      item.amount,
      item.note || ''
    ]);
    exportToCSV('danh-sach-khoan-chi', headers, rows);
    showToast('Đã xuất danh sách khoản chi thành công!');
  });

  document.getElementById('expense-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('expense-edit-id')?.value;
    const title = document.getElementById('expense-title')?.value.trim();
    const amount = Number(document.getElementById('expense-amount')?.value) || 0;
    const categoryId = document.getElementById('expense-category-select')?.value;
    const date = document.getElementById('expense-date')?.value || toISODate();
    const note = document.getElementById('expense-note')?.value.trim();

    if (!title) {
      showToast('Vui lòng nhập tên khoản chi!', 'error');
      return;
    }
    if (amount <= 0) {
      showToast('Số tiền chi phải lớn hơn 0!', 'error');
      return;
    }

    const catObj = categoriesList.find(c => c.id === categoryId);
    const categoryName = catObj ? catObj.name : 'Chi tiêu';

    const data = {
      uid: currentUser.uid,
      type: 'expense',
      title,
      amount,
      categoryId,
      categoryName,
      date,
      note
    };

    if (id) {
      await updateTransaction(id, data);
      showToast('Đã cập nhật khoản chi thành công!');
    } else {
      await addTransaction(data);
      showToast('Đã thêm khoản chi mới thành công!');
    }

    closeExpenseModal();
    await loadData();
  });

  document.getElementById('expense-modal-close')?.addEventListener('click', closeExpenseModal);
  document.getElementById('expense-modal-cancel')?.addEventListener('click', closeExpenseModal);
}

function openExpenseModal(id = null) {
  const modal = document.getElementById('expense-modal');
  const titleEl = document.getElementById('expense-modal-title');
  const form = document.getElementById('expense-form');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('expense-edit-id').value = '';
  document.getElementById('expense-date').value = toISODate();

  if (id) {
    const item = allExpenses.find(i => i.id === id);
    if (item) {
      titleEl.textContent = 'Chỉnh Sửa Khoản Chi';
      document.getElementById('expense-edit-id').value = item.id;
      document.getElementById('expense-title').value = item.title;
      document.getElementById('expense-amount').value = item.amount;
      document.getElementById('expense-category-select').value = item.categoryId;
      document.getElementById('expense-date').value = item.date;
      document.getElementById('expense-note').value = item.note || '';
    }
  } else {
    titleEl.textContent = 'Thêm Khoản Chi Mới';
  }

  modal.classList.add('active');
}

function closeExpenseModal() {
  const modal = document.getElementById('expense-modal');
  if (modal) modal.classList.remove('active');
}
