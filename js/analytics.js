/**
 * analytics.js
 * Computes and renders Expense Analytics:
 * - Total Savings & savings rate
 * - Highest spending category
 * - Monthly income vs. expenses chart
 * - Category-wise expense bar chart
 * - Spending distribution doughnut chart
 * - Category summary table
 */

import { getCurrentMonthKey } from './storage.js';
import {
  calculateFinancialSummary,
  formatCurrency,
  formatMonthLabel,
  getCategoryBreakdown,
  getMonthlySeries,
  getRecentMonthKeys,
  escapeHtml,
} from './transactions.js';

const ANALYTICS_PALETTE = [
  '#0F172A',
  '#2563EB',
  '#0D9488',
  '#D97706',
  '#7C3AED',
  '#DC2626',
  '#475569',
  '#059669',
  '#EA580C',
  '#64748B',
];

let incomeExpenseChart = null;
let categoryBarChart = null;
let distributionChart = null;
let currentPeriod = 'last-6-months';

export function initAnalyticsModule(getTransactionsFn) {
  const periodSelect = document.getElementById('analytics-period-select');
  periodSelect.addEventListener('change', (e) => {
    currentPeriod = e.target.value;
    renderAnalyticsView(getTransactionsFn());
  });
}

function filterByPeriod(transactions, period) {
  const currentMonth = getCurrentMonthKey();

  if (period === 'current-month') {
    return {
      filtered: transactions.filter((tx) => typeof tx.date === 'string' && tx.date.startsWith(currentMonth)),
      monthKeys: [currentMonth],
    };
  }

  if (period === 'last-3-months') {
    const keys = getRecentMonthKeys(3, currentMonth);
    const keySet = new Set(keys);
    return {
      filtered: transactions.filter((tx) => typeof tx.date === 'string' && keySet.has(tx.date.slice(0, 7))),
      monthKeys: keys,
    };
  }

  if (period === 'last-6-months') {
    const keys = getRecentMonthKeys(6, currentMonth);
    const keySet = new Set(keys);
    return {
      filtered: transactions.filter((tx) => typeof tx.date === 'string' && keySet.has(tx.date.slice(0, 7))),
      monthKeys: keys,
    };
  }

  // all-time: build contiguous or sorted distinct month keys present in data
  const distinctMonths = Array.from(
    new Set(
      transactions
        .map((tx) => (typeof tx.date === 'string' ? tx.date.slice(0, 7) : ''))
        .filter((m) => /^\d{4}-\d{2}$/.test(m))
    )
  ).sort();

  return {
    filtered: transactions,
    monthKeys: distinctMonths.length > 0 ? distinctMonths : [currentMonth],
  };
}

export function renderAnalyticsView(transactions) {
  const { filtered, monthKeys } = filterByPeriod(transactions, currentPeriod);
  const summary = calculateFinancialSummary(filtered, getCurrentMonthKey());
  const breakdown = getCategoryBreakdown(filtered, 'expense');

  // 1. Total Savings & Savings Rate
  const totalSavings = summary.totalIncome - summary.totalExpenses;
  const savingsRate = summary.totalIncome > 0 ? (totalSavings / summary.totalIncome) * 100 : 0;

  const savingsEl = document.getElementById('analytics-total-savings');
  savingsEl.textContent = formatCurrency(totalSavings);
  savingsEl.classList.toggle('text-income', totalSavings >= 0);
  savingsEl.classList.toggle('text-danger', totalSavings < 0);

  document.getElementById('analytics-savings-rate').textContent =
    summary.totalIncome > 0
      ? `${savingsRate.toFixed(1)}% of ${formatCurrency(summary.totalIncome)} income saved`
      : 'No income recorded in selected period';

  // 2. Highest Spending Category
  const topCatEl = document.getElementById('analytics-top-category');
  const topCatMetaEl = document.getElementById('analytics-top-category-meta');
  if (breakdown.length > 0) {
    const top = breakdown[0];
    topCatEl.textContent = top.category;
    topCatMetaEl.textContent = `${formatCurrency(top.total)} · ${top.percentage.toFixed(1)}% of expenses`;
  } else {
    topCatEl.textContent = '—';
    topCatMetaEl.textContent = 'No expense data in selected period';
  }

  // 3. Average Expense
  const avgExpense = summary.expenseCount > 0 ? summary.totalExpenses / summary.expenseCount : 0;
  document.getElementById('analytics-avg-expense').textContent = formatCurrency(avgExpense);
  document.getElementById('analytics-avg-meta').textContent = `${summary.expenseCount} ${
    summary.expenseCount === 1 ? 'expense transaction' : 'expense transactions'
  }`;

  // 4. Charts
  renderIncomeVsExpenseChart(filtered, monthKeys);
  renderCategoryBarChart(breakdown);
  renderDistributionChart(breakdown);

  // 5. Category Summary Table
  renderAnalyticsCategoryTable(breakdown);

  if (window.lucide) window.lucide.createIcons();
}

function renderIncomeVsExpenseChart(transactions, monthKeys) {
  const canvas = document.getElementById('chart-analytics-income-expense');
  if (!canvas || typeof window.Chart === 'undefined') return;

  const series = getMonthlySeries(transactions, monthKeys);

  if (incomeExpenseChart) {
    incomeExpenseChart.destroy();
  }

  incomeExpenseChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.labels,
      datasets: [
        {
          label: 'Income',
          data: series.incomeSeries,
          backgroundColor: '#16A34A',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.6,
        },
        {
          label: 'Expenses',
          data: series.expenseSeries,
          backgroundColor: '#DC2626',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            color: '#475569',
            font: { family: "'DM Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748B', font: { family: "'DM Sans', sans-serif", size: 12 } },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#E2E8F0' },
          ticks: {
            color: '#64748B',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (val) => `$${Number(val).toLocaleString('en-US')}`,
          },
        },
      },
    },
  });
}

function renderCategoryBarChart(breakdown) {
  const canvas = document.getElementById('chart-analytics-category-bar');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (categoryBarChart) {
    categoryBarChart.destroy();
    categoryBarChart = null;
  }

  if (breakdown.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  categoryBarChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          label: 'Total Spent',
          data: breakdown.map((b) => Number(b.total.toFixed(2))),
          backgroundColor: '#0F172A',
          borderRadius: 4,
          barThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          callbacks: {
            label: (ctx) => `Spent: ${formatCurrency(ctx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#E2E8F0' },
          ticks: {
            color: '#64748B',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (val) => `$${Number(val).toLocaleString('en-US')}`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#475569', font: { family: "'DM Sans', sans-serif", size: 12 } },
        },
      },
    },
  });
}

function renderDistributionChart(breakdown) {
  const canvas = document.getElementById('chart-analytics-distribution');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (distributionChart) {
    distributionChart.destroy();
    distributionChart = null;
  }

  if (breakdown.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  distributionChart = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          data: breakdown.map((b) => Number(b.total.toFixed(2))),
          backgroundColor: breakdown.map((_, idx) => ANALYTICS_PALETTE[idx % ANALYTICS_PALETTE.length]),
          borderColor: '#FFFFFF',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            color: '#475569',
            font: { family: "'DM Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const item = breakdown[ctx.dataIndex];
              return `${ctx.label}: ${formatCurrency(ctx.parsed)} (${item.percentage.toFixed(1)}%)`;
            },
          },
        },
      },
    },
  });
}

function renderAnalyticsCategoryTable(breakdown) {
  const container = document.getElementById('analytics-category-table');

  if (breakdown.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="bar-chart-2" class="empty-state-icon"></i>
        <h3 class="empty-state-title">No expense breakdown for this period</h3>
        <p class="empty-state-desc">Add expense transactions or choose a wider timeframe to inspect category analytics.</p>
      </div>
    `;
    return;
  }

  const rowsHtml = breakdown
    .map(
      (item, idx) => `
      <tr>
        <td>
          <div class="legend-label-group">
            <span class="legend-swatch" style="background-color: ${ANALYTICS_PALETTE[idx % ANALYTICS_PALETTE.length]}"></span>
            <span class="tx-title">${escapeHtml(item.category)}</span>
          </div>
        </td>
        <td class="col-right tabular-nums">${item.count}</td>
        <td class="col-right tx-amount tabular-nums">${formatCurrency(item.total)}</td>
        <td>
          <div class="share-bar-cell">
            <div class="share-bar-track">
              <div class="share-bar-fill" style="width: ${Math.min(100, item.percentage).toFixed(1)}%"></div>
            </div>
            <span class="tabular-nums legend-pct">${item.percentage.toFixed(1)}%</span>
          </div>
        </td>
      </tr>
    `
    )
    .join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Category</th>
          <th class="col-right">Transactions</th>
          <th class="col-right">Total Spent</th>
          <th>Share of Expenses</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}

export function getAnalyticsPeriodLabel() {
  return currentPeriod === 'current-month' ? formatMonthLabel(getCurrentMonthKey()) : currentPeriod;
}
