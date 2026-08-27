/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Báo Cáo & Phân Tích Thống Kê (Reports & Financial Analytics)
 * ==========================================================================
 */

import { requireAuth } from './auth.js';
import { getTransactions, getCategories } from './db.js';
import { renderAppShell } from './layout.js';
import { formatCurrency, formatShortMoney, formatDate, getCurrentMonth, exportToCSV, showToast } from './utils.js';

let currentUser = null;
let allTransactions = [];
let allCategories = [];

let chartMonthly = null;
let chartCategory = null;
let chartBalanceTrend = null;
let chartSavingsRatio = null;

export async function initReportsPage() {
  currentUser = requireAuth();
  if (!currentUser) return;

  renderAppShell('reports', 'Báo Cáo & Thống Kê', 'Phân tích đa chiều dữ liệu thu chi và dòng tiền');

  // Set default period
  const monthInput = document.getElementById('report-month-picker');
  if (monthInput && !monthInput.value) {
    monthInput.value = getCurrentMonth();
  }

  await loadData();
  bindEvents();
}

async function loadData() {
  const [trans, cats] = await Promise.all([
    getTransactions(currentUser.uid),
    getCategories(currentUser.uid)
  ]);

  allTransactions = trans;
  allCategories = cats;

  updateReports();
}

function getFilteredTransactions() {
  const periodType = document.getElementById('report-period-type')?.value || 'month';
  const monthVal = document.getElementById('report-month-picker')?.value || getCurrentMonth();
  const yearVal = document.getElementById('report-year-picker')?.value || new Date().getFullYear().toString();
  const quarterVal = document.getElementById('report-quarter-picker')?.value || '1';

  return allTransactions.filter(t => {
    if (!t.date) return false;
    const dateObj = new Date(t.date);
    const yyyy = dateObj.getFullYear().toString();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const quarter = Math.ceil((dateObj.getMonth() + 1) / 3).toString();

    if (periodType === 'month') {
      return `${yyyy}-${mm}` === monthVal;
    } else if (periodType === 'quarter') {
      return yyyy === yearVal && quarter === quarterVal;
    } else if (periodType === 'year') {
      return yyyy === yearVal;
    }
    return true;
  });
}

function updateReports() {
  const filtered = getFilteredTransactions();

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const netSavings = totalIncome - totalExpense;
  const savingsRatio = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // Find top expense category
  const expenseCatMap = {};
  filtered.filter(t => t.type === 'expense').forEach(t => {
    const name = t.categoryName || 'Khác';
    expenseCatMap[name] = (expenseCatMap[name] || 0) + (Number(t.amount) || 0);
  });

  let topCategoryName = 'Không có';
  let topCategoryAmount = 0;
  for (const [name, amount] of Object.entries(expenseCatMap)) {
    if (amount > topCategoryAmount) {
      topCategoryAmount = amount;
      topCategoryName = name;
    }
  }

  // Update DOM Cards
  const elIncome = document.getElementById('rep-total-income');
  const elExpense = document.getElementById('rep-total-expense');
  const elSavings = document.getElementById('rep-total-savings');
  const elTopCat = document.getElementById('rep-top-category');

  if (elIncome) elIncome.textContent = formatCurrency(totalIncome);
  if (elExpense) elExpense.textContent = formatCurrency(totalExpense);
  if (elSavings) {
    elSavings.textContent = formatCurrency(netSavings);
    elSavings.className = `stat-value ${netSavings >= 0 ? 'text-success' : 'text-danger'}`;
  }
  if (elTopCat) elTopCat.textContent = topCategoryName !== 'Không có' ? `${topCategoryName} (${formatCurrency(topCategoryAmount)})` : 'Chưa có chi tiêu';

  // Render Charts
  renderMonthlyBarChart();
  renderCategoryDoughnutChart(expenseCatMap);
  renderBalanceTrendChart();
  renderSavingsRatioChart(totalIncome, totalExpense, netSavings, savingsRatio);
  renderCategoryBreakdownTable(filtered);
}

/**
 * Chart 1: Monthly Income vs Expense
 */
function renderMonthlyBarChart() {
  const canvas = document.getElementById('chart-rep-monthly');
  if (!canvas || typeof Chart === 'undefined') return;

  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    months.push({ key: `${yyyy}-${mm}`, label: `T${d.getMonth() + 1}/${yyyy}` });
  }

  const incomeData = months.map(m => {
    return allTransactions
      .filter(t => t.type === 'income' && t.date && t.date.startsWith(m.key))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  });

  const expenseData = months.map(m => {
    return allTransactions
      .filter(t => t.type === 'expense' && t.date && t.date.startsWith(m.key))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  });

  if (chartMonthly) chartMonthly.destroy();

  const ctx = canvas.getContext('2d');
  chartMonthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Thu Nhập',
          data: incomeData,
          backgroundColor: '#10b981',
          borderRadius: 4
        },
        {
          label: 'Chi Tiêu',
          data: expenseData,
          backgroundColor: '#ef4444',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
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
            callback: (v) => formatShortMoney(v)
          }
        }
      }
    }
  });
}

/**
 * Chart 2: Category Expense Doughnut
 */
function renderCategoryDoughnutChart(expenseCatMap) {
  const canvas = document.getElementById('chart-rep-category');
  if (!canvas || typeof Chart === 'undefined') return;

  const labels = Object.keys(expenseCatMap);
  const data = Object.values(expenseCatMap);
  const colors = ['#ef4444', '#f97316', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981', '#6366f1', '#eab308', '#64748b'];

  if (chartCategory) chartCategory.destroy();

  const ctx = canvas.getContext('2d');
  if (labels.length === 0) {
    chartCategory = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['Chưa có dữ liệu'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    return;
  }

  chartCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors.slice(0, labels.length) }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } },
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
 * Chart 3: Balance Trend Line
 */
function renderBalanceTrendChart() {
  const canvas = document.getElementById('chart-rep-balance-trend');
  if (!canvas || typeof Chart === 'undefined') return;

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    months.push({ key: `${yyyy}-${mm}`, label: `T${d.getMonth() + 1}` });
  }

  let cumulativeBalance = 0;
  const balancePoints = months.map(m => {
    const inc = allTransactions
      .filter(t => t.type === 'income' && t.date && t.date.startsWith(m.key))
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const exp = allTransactions
      .filter(t => t.type === 'expense' && t.date && t.date.startsWith(m.key))
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    cumulativeBalance += (inc - exp);
    return cumulativeBalance;
  });

  if (chartBalanceTrend) chartBalanceTrend.destroy();

  const ctx = canvas.getContext('2d');
  chartBalanceTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: 'Số Dư Tích Lũy',
        data: balancePoints,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.08)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#2563eb',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (item) => `Số dư: ${formatCurrency(item.raw)}`
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
            callback: (v) => formatShortMoney(v)
          }
        }
      }
    }
  });
}

/**
 * Chart 4: Savings Ratio
 */
function renderSavingsRatioChart(totalIncome, totalExpense, netSavings, savingsRatio) {
  const canvas = document.getElementById('chart-rep-savings-ratio');
  if (!canvas || typeof Chart === 'undefined') return;

  if (chartSavingsRatio) chartSavingsRatio.destroy();

  const ctx = canvas.getContext('2d');
  const safeRatio = Math.max(0, savingsRatio);

  chartSavingsRatio = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Chi Tiêu', 'Tiết Kiệm / Dư'],
      datasets: [{
        data: [totalExpense, Math.max(0, netSavings)],
        backgroundColor: ['#ef4444', '#10b981']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
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
 * Table Breakdown
 */
function renderCategoryBreakdownTable(transactions) {
  const tbody = document.getElementById('report-category-tbody');
  if (!tbody) return;

  const catMap = {};
  transactions.forEach(t => {
    const key = `${t.type}_${t.categoryId || 'other'}`;
    if (!catMap[key]) {
      catMap[key] = {
        name: t.categoryName || 'Khác',
        type: t.type,
        count: 0,
        total: 0
      };
    }
    catMap[key].count++;
    catMap[key].total += (Number(t.amount) || 0);
  });

  const list = Object.values(catMap).sort((a, b) => b.total - a.total);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state" style="padding: 1.5rem;">Không có giao dịch trong kỳ báo cáo đã chọn</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(item => `
    <tr>
      <td>
        <span class="badge ${item.type === 'income' ? 'badge-income' : 'badge-expense'}">
          <i class="fas ${item.type === 'income' ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
          ${item.type === 'income' ? 'Thu' : 'Chi'}
        </span>
      </td>
      <td style="font-weight: 600;">${item.name}</td>
      <td>${item.count} giao dịch</td>
      <td style="text-align: right; font-weight: 700; color: ${item.type === 'income' ? 'var(--income-color)' : 'var(--expense-color)'};">
        ${item.type === 'income' ? '+' : '-'}${formatCurrency(item.total)}
      </td>
    </tr>
  `).join('');
}

function bindEvents() {
  document.getElementById('report-period-type')?.addEventListener('change', (e) => {
    const type = e.target.value;
    const monthWrap = document.getElementById('report-month-wrap');
    const quarterWrap = document.getElementById('report-quarter-wrap');
    const yearWrap = document.getElementById('report-year-wrap');

    if (monthWrap) monthWrap.style.display = type === 'month' ? 'block' : 'none';
    if (quarterWrap) quarterWrap.style.display = type === 'quarter' ? 'block' : 'none';
    if (yearWrap) yearWrap.style.display = (type === 'year' || type === 'quarter') ? 'block' : 'none';

    updateReports();
  });

  document.getElementById('report-month-picker')?.addEventListener('change', updateReports);
  document.getElementById('report-quarter-picker')?.addEventListener('change', updateReports);
  document.getElementById('report-year-picker')?.addEventListener('change', updateReports);

  document.getElementById('btn-export-report-csv')?.addEventListener('click', () => {
    const filtered = getFilteredTransactions();
    const headers = ['Ngày', 'Loại', 'Nội Dung', 'Danh Mục', 'Số Tiền (VNĐ)', 'Ghi Chú'];
    const rows = filtered.map(t => [
      t.date,
      t.type === 'income' ? 'Thu Nhập' : 'Chi Tiêu',
      t.title,
      t.categoryName || '',
      t.amount,
      t.note || ''
    ]);
    exportToCSV('bao-cao-tai-chinh', headers, rows);
    showToast('Đã xuất báo cáo ra tệp CSV!');
  });
}
