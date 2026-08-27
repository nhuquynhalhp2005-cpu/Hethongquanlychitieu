/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Dashboard Logic & Interactive Charts
 * ==========================================================================
 */

import { requireAuth } from './auth.js';
import { getTransactions, getSavingGoals, getDebts, getBudgets, getCategories } from './db.js';
import { renderAppShell } from './layout.js';
import { formatCurrency, formatShortMoney, formatDate, getCurrentMonth, showToast } from './utils.js';

let incomeExpenseChart = null;
let expenseCategoryChart = null;

export async function initDashboard() {
  const user = requireAuth();
  if (!user) return;

  renderAppShell('dashboard', 'Trang Chủ', 'Tổng quan tình hình tài chính');

  await loadDashboardData(user.uid);
}

async function loadDashboardData(uid) {
  const currentMonth = getCurrentMonth();

  // Load parallel data
  const [transactions, savingGoals, debts, budgets, categories] = await Promise.all([
    getTransactions(uid),
    getSavingGoals(uid),
    getDebts(uid),
    getBudgets(uid, currentMonth),
    getCategories(uid)
  ]);

  // 1. Calculations
  const allIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const allExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalBalance = allIncome - allExpense;

  const monthIncome = transactions
    .filter(t => t.type === 'income' && t.date && t.date.startsWith(currentMonth))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const monthExpense = transactions
    .filter(t => t.type === 'expense' && t.date && t.date.startsWith(currentMonth))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const monthSavings = monthIncome - monthExpense;

  const totalDebtRemaining = debts
    .filter(d => d.status !== 'paid')
    .reduce((sum, d) => sum + ((Number(d.totalAmount) || 0) - (Number(d.paidAmount) || 0)), 0);

  const activeGoalsCount = savingGoals.filter(g => (Number(g.savedAmount) || 0) < (Number(g.targetAmount) || 0)).length;

  // 2. Render Cards
  const elTotalBalance = document.getElementById('stat-total-balance');
  const elMonthIncome = document.getElementById('stat-month-income');
  const elMonthExpense = document.getElementById('stat-month-expense');
  const elMonthSavings = document.getElementById('stat-month-savings');
  const elTotalDebt = document.getElementById('stat-total-debt');
  const elActiveGoals = document.getElementById('stat-active-goals');

  if (elTotalBalance) elTotalBalance.textContent = formatCurrency(totalBalance);
  if (elMonthIncome) elMonthIncome.textContent = formatCurrency(monthIncome);
  if (elMonthExpense) elMonthExpense.textContent = formatCurrency(monthExpense);
  if (elMonthSavings) elMonthSavings.textContent = formatCurrency(monthSavings);
  if (elTotalDebt) elTotalDebt.textContent = formatCurrency(totalDebtRemaining);
  if (elActiveGoals) elActiveGoals.textContent = `${activeGoalsCount} mục tiêu`;

  // 3. Render Charts
  renderIncomeExpenseMonthlyChart(transactions);
  renderExpenseCategoryPieChart(transactions, categories, currentMonth);

  // 4. Render Recent Transactions (5-10 items)
  renderRecentTransactionsList(transactions.slice(0, 7));

  // 5. Render Saving Goals Widgets
  renderDashboardGoalsList(savingGoals.slice(0, 4));
}

/**
 * Monthly Income vs Expense Bar Chart
 */
function renderIncomeExpenseMonthlyChart(transactions) {
  const canvas = document.getElementById('chart-income-expense');
  if (!canvas || typeof Chart === 'undefined') return;

  // Generate last 6 months labels
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    months.push({ key: `${yyyy}-${mm}`, label: `T${d.getMonth() + 1}/${yyyy}` });
  }

  const incomeData = months.map(m => {
    return transactions
      .filter(t => t.type === 'income' && t.date && t.date.startsWith(m.key))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  });

  const expenseData = months.map(m => {
    return transactions
      .filter(t => t.type === 'expense' && t.date && t.date.startsWith(m.key))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  });

  if (incomeExpenseChart) incomeExpenseChart.destroy();

  const ctx = canvas.getContext('2d');
  incomeExpenseChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Tổng Thu',
          data: incomeData,
          backgroundColor: '#10b981',
          borderRadius: 6,
          barPercentage: 0.6
        },
        {
          label: 'Tổng Chi',
          data: expenseData,
          backgroundColor: '#ef4444',
          borderRadius: 6,
          barPercentage: 0.6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { family: "'Plus Jakarta Sans', sans-serif" } } },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${formatCurrency(item.raw)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMin: 0,
          suggestedMax: 5000000,
          ticks: {
            maxTicksLimit: 6,
            callback: (val) => formatShortMoney(val),
            font: { family: "'Plus Jakarta Sans', sans-serif" }
          },
          grid: { color: '#f1f5f9' }
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Plus Jakarta Sans', sans-serif" } }
        }
      }
    }
  });
}

/**
 * Expense by Category Doughnut Chart
 */
function renderExpenseCategoryPieChart(transactions, categories, currentMonth) {
  const canvas = document.getElementById('chart-expense-category');
  if (!canvas || typeof Chart === 'undefined') return;

  const currentExpenses = transactions.filter(t => t.type === 'expense' && t.date && t.date.startsWith(currentMonth));
  
  const catMap = {};
  currentExpenses.forEach(t => {
    const catName = t.categoryName || 'Khác';
    catMap[catName] = (catMap[catName] || 0) + (Number(t.amount) || 0);
  });

  const labels = Object.keys(catMap);
  const data = Object.values(catMap);
  const colors = ['#ef4444', '#f97316', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#6366f1', '#eab308', '#64748b'];

  if (expenseCategoryChart) expenseCategoryChart.destroy();

  const ctx = canvas.getContext('2d');
  
  if (labels.length === 0) {
    expenseCategoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Chưa có chi tiêu'],
        datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
    return;
  }

  expenseCategoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 10, font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" } }
        },
        tooltip: {
          callbacks: {
            label: (item) => `${item.label}: ${formatCurrency(item.raw)}`
          }
        }
      }
    }
  });
}

/**
 * Render Recent Transactions
 */
function renderRecentTransactionsList(transactions) {
  const tbody = document.getElementById('recent-transactions-tbody');
  if (!tbody) return;

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state" style="padding: 2rem;">
          <div class="empty-state-icon"><i class="fas fa-receipt"></i></div>
          <div class="empty-state-title">Chưa có giao dịch nào</div>
          <p class="empty-state-text">Bắt đầu bằng cách thêm khoản thu hoặc chi đầu tiên của bạn.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(t => {
    const isIncome = t.type === 'income';
    return `
      <tr>
        <td>
          <div style="font-weight: 600; color: var(--brand-navy);">${t.title || 'Giao dịch'}</div>
          ${t.note ? `<div style="font-size: 0.75rem; color: var(--text-light);">${t.note}</div>` : ''}
        </td>
        <td>
          <span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">
            <i class="fas ${isIncome ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
            ${t.categoryName || (isIncome ? 'Thu nhập' : 'Chi tiêu')}
          </span>
        </td>
        <td>${formatDate(t.date)}</td>
        <td style="text-align: right; font-weight: 700; color: ${isIncome ? 'var(--income-color)' : 'var(--expense-color)'};">
          ${isIncome ? '+' : '-'}${formatCurrency(t.amount)}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Render Dashboard Goals
 */
function renderDashboardGoalsList(goals) {
  const container = document.getElementById('dashboard-goals-list');
  if (!container) return;

  if (goals.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 1.5rem;">
        <i class="fas fa-bullseye" style="font-size: 2rem; color: var(--text-light); margin-bottom: 0.5rem; display: block;"></i>
        <div style="font-size: 0.9rem; font-weight: 600;">Chưa có mục tiêu tiết kiệm</div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">Thiết lập mục tiêu mua xe, du lịch, quỹ khẩn cấp...</p>
        <a href="saving-goals.html" class="btn btn-sm btn-outline-primary">+ Tạo Mục Tiêu</a>
      </div>
    `;
    return;
  }

  container.innerHTML = goals.map(g => {
    const target = Number(g.targetAmount) || 1;
    const saved = Number(g.savedAmount) || 0;
    const percent = Math.min(100, Math.round((saved / target) * 100));

    return `
      <div style="margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <span style="font-weight: 600; font-size: 0.875rem; color: var(--brand-navy);">${g.name}</span>
          <span style="font-size: 0.8125rem; font-weight: 700; color: var(--primary);">${percent}%</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar ${percent >= 100 ? 'success' : ''}" style="width: ${percent}%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
          <span>Đã có: <strong>${formatCurrency(saved)}</strong></span>
          <span>Mục tiêu: <strong>${formatCurrency(target)}</strong></span>
        </div>
      </div>
    `;
  }).join('');
}
