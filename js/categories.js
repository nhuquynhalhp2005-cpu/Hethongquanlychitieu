/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Quản Lý Danh Mục (Categories Management)
 * ==========================================================================
 */

import { requireAuth } from './auth.js';
import { getCategories, saveCategory, deleteCategory, getTransactions } from './db.js';
import { renderAppShell } from './layout.js';
import { showToast, showConfirmModal } from './utils.js';

let currentUser = null;
let allCategories = [];

export async function initCategoriesPage() {
  currentUser = requireAuth();
  if (!currentUser) return;

  renderAppShell('categories', 'Quản Lý Danh Mục', 'Tùy chỉnh danh mục thu và chi theo thói quen của bạn');

  await loadData();
  bindEvents();
}

async function loadData() {
  allCategories = await getCategories(currentUser.uid);
  renderCategoryLists();
}

function renderCategoryLists() {
  const incomeListEl = document.getElementById('income-categories-list');
  const expenseListEl = document.getElementById('expense-categories-list');

  const incomes = allCategories.filter(c => c.type === 'income');
  const expenses = allCategories.filter(c => c.type === 'expense');

  if (incomeListEl) {
    incomeListEl.innerHTML = incomes.map(c => renderCategoryItem(c)).join('');
  }

  if (expenseListEl) {
    expenseListEl.innerHTML = expenses.map(c => renderCategoryItem(c)).join('');
  }

  // Attach Edit/Delete
  document.querySelectorAll('.btn-edit-cat').forEach(btn => {
    btn.onclick = () => openCategoryModal(btn.getAttribute('data-id'));
  });

  document.querySelectorAll('.btn-delete-cat').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const cat = allCategories.find(c => c.id === id);
      showConfirmModal({
        title: 'Xóa danh mục',
        message: `Bạn có chắc muốn xóa danh mục "${cat?.name || ''}" không? Lưu ý không thể xóa danh mục đang có giao dịch phát sinh.`,
        confirmText: 'Xóa danh mục',
        isDanger: true,
        onConfirm: async () => {
          try {
            await deleteCategory(id, currentUser.uid);
            showToast('Đã xóa danh mục thành công!');
            await loadData();
          } catch (err) {
            showToast(err.message || 'Lỗi khi xóa danh mục!', 'error');
          }
        }
      });
    };
  });
}

function renderCategoryItem(cat) {
  const isSystem = cat.uid === 'system';
  return `
    <div class="card" style="padding: 1rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background-color: ${cat.color || '#e2e8f0'}20; color: ${cat.color || '#64748b'}; display: flex; align-items: center; justify-content: center; font-size: 1.15rem;">
          <i class="fas ${cat.icon || 'fa-tag'}"></i>
        </div>
        <div>
          <div style="font-weight: 700; color: var(--brand-navy); font-size: 0.9375rem;">${cat.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-light);">${isSystem ? 'Danh mục hệ thống' : 'Danh mục cá nhân'}</div>
        </div>
      </div>

      <div class="item-card-actions">
        <button class="btn btn-sm btn-secondary btn-edit-cat" data-id="${cat.id}">
          <i class="fas fa-edit"></i>
        </button>
        ${!isSystem ? `
          <button class="btn btn-sm btn-ghost btn-delete-cat" data-id="${cat.id}" style="color: var(--expense-color);">
            <i class="fas fa-trash-alt"></i>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function bindEvents() {
  document.getElementById('btn-add-income-cat')?.addEventListener('click', () => openCategoryModal(null, 'income'));
  document.getElementById('btn-add-expense-cat')?.addEventListener('click', () => openCategoryModal(null, 'expense'));

  document.getElementById('category-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('category-edit-id')?.value;
    const name = document.getElementById('category-name')?.value.trim();
    const type = document.getElementById('category-type')?.value;
    const icon = document.getElementById('category-icon')?.value || 'fa-tag';
    const color = document.getElementById('category-color')?.value || '#10b981';

    if (!name) {
      showToast('Vui lòng nhập tên danh mục!', 'error');
      return;
    }

    await saveCategory({
      id: id || undefined,
      uid: currentUser.uid,
      name,
      type,
      icon,
      color
    });

    showToast(id ? 'Đã cập nhật danh mục!' : 'Đã thêm danh mục mới thành công!');
    closeCategoryModal();
    await loadData();
  });

  document.getElementById('category-modal-close')?.addEventListener('click', closeCategoryModal);
  document.getElementById('category-modal-cancel')?.addEventListener('click', closeCategoryModal);
}

function openCategoryModal(id = null, defaultType = 'expense') {
  const modal = document.getElementById('category-modal');
  const titleEl = document.getElementById('category-modal-title');
  const form = document.getElementById('category-form');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('category-edit-id').value = '';
  document.getElementById('category-type').value = defaultType;

  if (id) {
    const c = allCategories.find(item => item.id === id);
    if (c) {
      titleEl.textContent = 'Chỉnh Sửa Danh Mục';
      document.getElementById('category-edit-id').value = c.id;
      document.getElementById('category-name').value = c.name;
      document.getElementById('category-type').value = c.type;
      document.getElementById('category-icon').value = c.icon || 'fa-tag';
      document.getElementById('category-color').value = c.color || '#10b981';
    }
  } else {
    titleEl.textContent = 'Thêm Danh Mục Mới';
  }

  modal.classList.add('active');
}

function closeCategoryModal() {
  const modal = document.getElementById('category-modal');
  if (modal) modal.classList.remove('active');
}
