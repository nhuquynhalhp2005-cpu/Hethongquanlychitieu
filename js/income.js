/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Quản Lý Khoản Thu (Income Management)
 * ==========================================================================
 */

import { requireAuth } from './auth.js';
import { getTransactions, addTransaction, updateTransaction, deleteTransaction, getCategories } from './db.js';
import { renderAppShell } from './layout.js';
import { formatCurrency, formatDate, toISODate, showToast, showConfirmModal, exportToCSV } from './utils.js';

let allIncomes = [];
let categoriesList = [];
let currentUser = null;

export async function initIncomePage() {
  currentUser = requireAuth();
  if (!currentUser) return;

  renderAppShell('income', 'Quản Lý Khoản Thu', 'Ghi nhận và theo dõi các nguồn thu nhập');

  await loadData();
  bindEvents();
}

async function loadData() {
  const [trans, cats] = await Promise.all([
    getTransactions(currentUser.uid),
    getCategories(currentUser.uid)
  ]);

  allIncomes = trans.filter(t => t.type === 'income');
  categoriesList = cats.filter(c => c.type === 'income');

  populateCategorySelects();
  renderTable();
}

function populateCategorySelects() {
  const filterCatSelect = document.getElementById('filter-category');
  const modalCatSelect = document.getElementById('income-category-select');

  const catOptions = categoriesList.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  if (filterCatSelect) {
    filterCatSelect.innerHTML = `<option value="">Tất cả danh mục</option>${catOptions}`;
  }

  if (modalCatSelect) {
    modalCatSelect.innerHTML = catOptions;
  }
}

function filterAndSortIncomes() {
  const search = (document.getElementById('income-search-input')?.value || '').toLowerCase().trim();
  const catFilter = document.getElementById('filter-category')?.value || '';
  const monthFilter = document.getElementById('filter-month')?.value || '';
  const dateFilter = document.getElementById('filter-date')?.value || '';
  const sortBy = document.getElementById('sort-by')?.value || 'date-desc';

  let result = allIncomes.filter(item => {
    const matchSearch = !search || 
      (item.title && item.title.toLowerCase().includes(search)) || 
      (item.note && item.note.toLowerCase().includes(search));
    const matchCat = !catFilter || item.categoryId === catFilter;
    const matchMonth = !monthFilter || (item.date && item.date.startsWith(monthFilter));
    const matchDate = !dateFilter || item.date === dateFilter;

    return matchSearch && matchCat && matchMonth && matchDate;
  });

  // Sort
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
  const list = filterAndSortIncomes();
  const tbody = document.getElementById('income-tbody');
  const countEl = document.getElementById('income-count');
  const totalAmountEl = document.getElementById('income-total-amount');

  const totalSum = list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  if (countEl) countEl.textContent = `${list.length} khoản thu`;
  if (totalAmountEl) totalAmountEl.textContent = formatCurrency(totalSum);

  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="empty-state-icon"><i class="fas fa-hand-holding-usd"></i></div>
          <div class="empty-state-title">Chưa có khoản thu nào phù hợp</div>
          <p class="empty-state-text">Nhấn nút "+ Thêm Khoản Thu" để ghi nhận khoản thu nhập mới.</p>
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
        <span class="badge badge-income">
          <i class="fas fa-tag"></i>
          ${item.categoryName || 'Thu nhập'}
        </span>
      </td>
      <td>${formatDate(item.date)}</td>
      <td style="font-weight: 700; color: var(--income-color); font-size: 0.95rem;">
        +${formatCurrency(item.amount)}
      </td>
      <td style="text-align: right;">
        <div class="item-card-actions" style="justify-content: flex-end;">
          <button class="btn btn-sm btn-secondary btn-edit-income" data-id="${item.id}" title="Chỉnh sửa">
            <i class="fas fa-edit"></i> Sửa
          </button>
          <button class="btn btn-sm btn-ghost btn-delete-income" data-id="${item.id}" style="color: var(--expense-color);" title="Xóa">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  // Attach row edit/delete events
  tbody.querySelectorAll('.btn-edit-income').forEach(btn => {
    btn.onclick = () => openIncomeModal(btn.getAttribute('data-id'));
  });

  tbody.querySelectorAll('.btn-delete-income').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const item = allIncomes.find(i => i.id === id);
      showConfirmModal({
        title: 'Xóa khoản thu',
        message: `Bạn có chắc chắn muốn xóa khoản thu "${item?.title || ''}" số tiền ${formatCurrency(item?.amount || 0)} không?`,
        confirmText: 'Xóa vĩnh viễn',
        isDanger: true,
        onConfirm: async () => {
          await deleteTransaction(id, currentUser.uid);
          showToast('Đã xóa khoản thu thành công!');
          await loadData();
        }
      });
    };
  });
}

function bindEvents() {
  // Search & Filters change
  document.getElementById('income-search-input')?.addEventListener('input', renderTable);
  document.getElementById('filter-category')?.addEventListener('change', renderTable);
  document.getElementById('filter-month')?.addEventListener('change', renderTable);
  document.getElementById('filter-date')?.addEventListener('change', renderTable);
  document.getElementById('sort-by')?.addEventListener('change', renderTable);

  document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
    if (document.getElementById('income-search-input')) document.getElementById('income-search-input').value = '';
    if (document.getElementById('filter-category')) document.getElementById('filter-category').value = '';
    if (document.getElementById('filter-month')) document.getElementById('filter-month').value = '';
    if (document.getElementById('filter-date')) document.getElementById('filter-date').value = '';
    if (document.getElementById('sort-by')) document.getElementById('sort-by').value = 'date-desc';
    renderTable();
  });

  // Open Add Modal
  document.getElementById('btn-open-add-income')?.addEventListener('click', () => {
    openIncomeModal();
  });

  // Export CSV
  document.getElementById('btn-export-income-csv')?.addEventListener('click', () => {
    const list = filterAndSortIncomes();
    const headers = ['STT', 'Tên Khoản Thu', 'Danh Mục', 'Ngày Thu', 'Số Tiền (VNĐ)', 'Ghi Chú'];
    const rows = list.map((item, idx) => [
      idx + 1,
      item.title,
      item.categoryName || '',
      item.date,
      item.amount,
      item.note || ''
    ]);
    exportToCSV('danh-sach-khoan-thu', headers, rows);
    showToast('Đã xuất danh sách khoản thu thành công!');
  });

  // Save Modal Form
  document.getElementById('income-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('income-edit-id')?.value;
    const title = document.getElementById('income-title')?.value.trim();
    const amount = Number(document.getElementById('income-amount')?.value) || 0;
    const categoryId = document.getElementById('income-category-select')?.value;
    const date = document.getElementById('income-date')?.value || toISODate();
    const note = document.getElementById('income-note')?.value.trim();

    if (!title) {
      showToast('Vui lòng nhập tên khoản thu!', 'error');
      return;
    }
    if (amount <= 0) {
      showToast('Số tiền thu phải lớn hơn 0!', 'error');
      return;
    }

    const catObj = categoriesList.find(c => c.id === categoryId);
    const categoryName = catObj ? catObj.name : 'Thu nhập';

    const data = {
      uid: currentUser.uid,
      type: 'income',
      title,
      amount,
      categoryId,
      categoryName,
      date,
      note
    };

    if (id) {
      await updateTransaction(id, data);
      showToast('Đã cập nhật khoản thu thành công!');
    } else {
      await addTransaction(data);
      showToast('Đã thêm khoản thu mới thành công!');
    }

    closeIncomeModal();
    await loadData();
  });

  document.getElementById('income-modal-close')?.addEventListener('click', closeIncomeModal);
  document.getElementById('income-modal-cancel')?.addEventListener('click', closeIncomeModal);
}

function openIncomeModal(id = null) {
  const modal = document.getElementById('income-modal');
  const titleEl = document.getElementById('income-modal-title');
  const form = document.getElementById('income-form');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('income-edit-id').value = '';
  document.getElementById('income-date').value = toISODate();

  if (id) {
    const item = allIncomes.find(i => i.id === id);
    if (item) {
      titleEl.textContent = 'Chỉnh Sửa Khoản Thu';
      document.getElementById('income-edit-id').value = item.id;
      document.getElementById('income-title').value = item.title;
      document.getElementById('income-amount').value = item.amount;
      document.getElementById('income-category-select').value = item.categoryId;
      document.getElementById('income-date').value = item.date;
      document.getElementById('income-note').value = item.note || '';
    }
  } else {
    titleEl.textContent = 'Thêm Khoản Thu Mới';
  }

  modal.classList.add('active');
}

function closeIncomeModal() {
  const modal = document.getElementById('income-modal');
  if (modal) modal.classList.remove('active');
}
