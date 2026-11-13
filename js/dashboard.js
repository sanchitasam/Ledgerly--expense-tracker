/**
 * dashboard.js
 * Renders the Dashboard summary cards, budget warning strip,
 * Monthly Spending Overview chart, Expense Category Breakdown chart,
 * and Recent Transactions table.
 */

import { getCurrentMonthKey } from './storage.js';
import {
  calculateFinancialSummary,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  getCategoryBreakdown,
  getMonthlySeries,
  getRecentMonthKeys,
  escapeHtml,
  openAddTransactionModal,
  openEditTransactionModal,
  requestDeleteTransaction,
} from './transactions.js';
import { calculateBudgetStatus } from './budget.js';

const CHART_COLORS = [
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

let monthlyChartInstance = null;
let categoryChartInstance = null;

export function renderDashboardView(transactions, budgetLimit, callbacks = {}) {
  const currentMonth = getCurrentMonthKey();
  const summary = calculateFinancialSummary(transactions, currentMonth);

  // 1. Update KPI Cards
  const balanceEl = document.getElementById('kpi-total-balance');
  balanceEl.textContent = formatCurrency(summary.totalBalance);
  balanceEl.classList.toggle('text-danger', summary.totalBalance < 0);
  balanceEl.classList.toggle('text-income', summary.totalBalance > 0);

  document.getElementById('kpi-balance-meta').textContent =
    summary.totalBalance >= 0 ? 'Positive net position' : 'Expenses exceed income';

  document.getElementById('kpi-total-income').textContent = formatCurrency(summary.totalIncome);
  document.getElementById('kpi-income-meta').textContent = `${summary.incomeCount} ${
    summary.incomeCount === 1 ? 'income entry' : 'income entries'
  }`;

  document.getElementById('kpi-total-expenses').textContent = formatCurrency(summary.totalExpenses);
  document.getElementById('kpi-expenses-meta').textContent = `${summary.expenseCount} ${
    summary.expenseCount === 1 ? 'expense entry' : 'expense entries'
  }`;

  document.getElementById('kpi-monthly-spending').textContent = formatCurrency(summary.monthlySpending);
  const monthlyMetaEl = document.getElementById('kpi-monthly-meta');
  if (budgetLimit > 0) {
    const pct = ((summary.monthlySpending / budgetLimit) * 100).toFixed(1);
    monthlyMetaEl.textContent = `${formatMonthLabel(currentMonth)} · ${pct}% of ${formatCurrency(budgetLimit)} budget`;
  } else {
    monthlyMetaEl.textContent = `${formatMonthLabel(currentMonth)} · ${summary.monthlyExpenseCount} expenses`;
  }

  // 2. Dashboard Budget Alert Banner (if >= 80% or > 100%)
  const alertEl = document.getElementById('dashboard-budget-alert');
  const budgetStatus = calculateBudgetStatus(transactions, currentMonth, budgetLimit);
  if (budgetStatus.status === 'exceeded') {
    alertEl.hidden = false;
    alertEl.className = 'alert-banner alert-banner-danger';
    alertEl.innerHTML = `
      <div class="alert-banner-content">
        <i data-lucide="alert-octagon" class="alert-banner-icon"></i>
        <span><strong>Budget Exceeded:</strong> ${formatMonthLabel(currentMonth)} spending (${formatCurrency(
      budgetStatus.spent
    )}) is ${formatCurrency(Math.abs(budgetStatus.remaining))} over your ${formatCurrency(
      budgetStatus.limit
    )} monthly budget.</span>
      </div>
      <button type="button" class="btn-link" id="dash-go-budget">Manage Budget</button>
    `;
    document.getElementById('dash-go-budget')?.addEventListener('click', () => {
      callbacks.onNavigate?.('budget');
    });
  } else if (budgetStatus.status === 'warning') {
    alertEl.hidden = false;
    alertEl.className = 'alert-banner alert-banner-warning';
    alertEl.innerHTML = `
      <div class="alert-banner-content">
        <i data-lucide="alert-triangle" class="alert-banner-icon"></i>
        <span><strong>Budget Warning:</strong> You have used ${budgetStatus.utilizationPct.toFixed(
          1
        )}% of your ${formatMonthLabel(currentMonth)} budget (${formatCurrency(budgetStatus.remaining)} remaining).</span>
      </div>
      <button type="button" class="btn-link" id="dash-go-budget">Manage Budget</button>
    `;
    document.getElementById('dash-go-budget')?.addEventListener('click', () => {
      callbacks.onNavigate?.('budget');
    });
  } else {
    alertEl.hidden = true;
    alertEl.innerHTML = '';
  }

  // 3. Monthly Spending Overview Chart (6 months)
  renderMonthlyOverviewChart(transactions, currentMonth);

  // 4. Expense Category Breakdown Chart
  renderCategoryBreakdownChart(transactions, currentMonth);

  // 5. Recent Transactions Table
  renderRecentTransactions(transactions);

  if (window.lucide) window.lucide.createIcons();
}

function renderMonthlyOverviewChart(transactions, currentMonth) {
  const canvas = document.getElementById('chart-dashboard-monthly');
  if (!canvas || typeof window.Chart === 'undefined') return;

  const monthKeys = getRecentMonthKeys(6, currentMonth);
  const series = getMonthlySeries(transactions, monthKeys);

  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  monthlyChartInstance = new window.Chart(canvas.getContext('2d'), {
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
          categoryPercentage: 0.65,
        },
        {
          label: 'Expenses',
          data: series.expenseSeries,
          backgroundColor: '#0F172A',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
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

function renderCategoryBreakdownChart(transactions, currentMonth) {
  const canvas = document.getElementById('chart-dashboard-categories');
  const legendEl = document.getElementById('dashboard-category-legend');
  const subtitleEl = document.getElementById('dashboard-breakdown-period');
  if (!canvas) return;

  const currentMonthExpenses = transactions.filter(
    (tx) => tx.type === 'expense' && typeof tx.date === 'string' && tx.date.startsWith(currentMonth)
  );

  const usingCurrentMonth = currentMonthExpenses.length > 0;
  const targetSet = usingCurrentMonth ? currentMonthExpenses : transactions;
  const breakdown = getCategoryBreakdown(targetSet, 'expense');

  subtitleEl.textContent = usingCurrentMonth
    ? `${formatMonthLabel(currentMonth)} expense distribution`
    : 'All-time expense distribution';

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }

  if (breakdown.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    legendEl.innerHTML = `<span class="muted-text">No expense data available yet.</span>`;
    return;
  }

  const topItems = breakdown.slice(0, 5);
  const remainingItems = breakdown.slice(5);
  if (remainingItems.length > 0) {
    const otherTotal = remainingItems.reduce((acc, item) => acc + item.total, 0);
    const otherPct = remainingItems.reduce((acc, item) => acc + item.percentage, 0);
    topItems.push({
      category: 'Other Categories',
      total: otherTotal,
      percentage: otherPct,
      count: remainingItems.reduce((acc, item) => acc + item.count, 0),
    });
  }

  if (typeof window.Chart !== 'undefined') {
    categoryChartInstance = new window.Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: topItems.map((item) => item.category),
        datasets: [
          {
            data: topItems.map((item) => Number(item.total.toFixed(2))),
            backgroundColor: topItems.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]),
            borderColor: '#FFFFFF',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            padding: 10,
            callbacks: {
              label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}`,
            },
          },
        },
      },
    });
  }

  legendEl.innerHTML = topItems
    .map(
      (item, idx) => `
      <div class="legend-row">
        <div class="legend-label-group">
          <span class="legend-swatch" style="background-color: ${CHART_COLORS[idx % CHART_COLORS.length]}"></span>
          <span class="legend-name">${escapeHtml(item.category)}</span>
        </div>
        <div class="legend-values tabular-nums">
          <span>${formatCurrency(item.total)}</span>
          <span class="legend-pct">${item.percentage.toFixed(1)}%</span>
        </div>
      </div>
    `
    )
    .join('');
}

function renderRecentTransactions(transactions) {
  const container = document.getElementById('dashboard-recent-container');
  const recent = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="wallet-cards" class="empty-state-icon"></i>
        <h3 class="empty-state-title">No activity yet</h3>
        <p class="empty-state-desc">Record an income or expense entry to populate your dashboard overview.</p>
        <button type="button" class="btn-primary" id="dash-empty-add-btn">
          <i data-lucide="plus" class="btn-icon"></i>
          <span>Add Transaction</span>
        </button>
      </div>
    `;
    document.getElementById('dash-empty-add-btn')?.addEventListener('click', openAddTransactionModal);
    return;
  }

  const rowsHtml = recent
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'text-income' : 'text-expense';

      return `
        <tr>
          <td>
            <div class="tx-title-cell">
              <span class="tx-title">${escapeHtml(tx.title)}</span>
              ${tx.description ? `<span class="tx-desc">${escapeHtml(tx.description)}</span>` : ''}
            </div>
          </td>
          <td class="tx-meta-text">${escapeHtml(tx.category)}</td>
          <td class="tx-meta-text tabular-nums">${escapeHtml(formatDate(tx.date))}</td>
          <td class="col-right tx-amount tabular-nums ${amountClass}">${sign}${formatCurrency(tx.amount)}</td>
          <td class="col-actions">
            <div class="row-actions">
              <button type="button" class="btn-icon-only" data-dash-edit="${escapeHtml(tx.id)}" aria-label="Edit ${escapeHtml(tx.title)}">
                <i data-lucide="pencil"></i>
              </button>
              <button type="button" class="btn-icon-only btn-action-danger" data-dash-delete="${escapeHtml(tx.id)}" aria-label="Delete ${escapeHtml(tx.title)}">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Transaction</th>
          <th>Category</th>
          <th>Date</th>
          <th class="col-right">Amount</th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;

  container.querySelectorAll('[data-dash-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = transactions.find((t) => t.id === btn.dataset.dashEdit);
      openEditTransactionModal(tx);
    });
  });

  container.querySelectorAll('[data-dash-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = transactions.find((t) => t.id === btn.dataset.dashDelete);
      requestDeleteTransaction(tx);
    });
  });
}
