/**
 * budget.js
 * Budget calculation logic (storage-independent) and Budget Management UI:
 * - Set monthly budget per month
 * - Track monthly expenses dynamically
 * - Calculate remaining budget & utilization percentage
 * - Warning banner at >= 80% utilization
 * - Exceeded alert banner at > 100% utilization
 */

import {
  getBudgetLimitForMonth,
  getCurrentMonthKey,
  setMonthlyBudgetLimit,
} from './storage.js';
import {
  calculateFinancialSummary,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getCategoryBreakdown,
} from './transactions.js';

let selectedBudgetMonth = getCurrentMonthKey();

let budgetCallbacks = {
  getTransactions: () => [],
  onBudgetChanged: () => {},
  showToast: () => {},
};

/**
 * Pure calculation of monthly budget utilization & threshold state.
 */
export function calculateBudgetStatus(transactions, monthKey, limitAmount) {
  const limit = Number(limitAmount) || 0;
  const summary = calculateFinancialSummary(transactions, monthKey);
  const spent = summary.monthlySpending;
  const remaining = limit - spent;
  const utilizationPct = limit > 0 ? (spent / limit) * 100 : 0;

  let status = 'unset';
  if (limit > 0) {
    if (utilizationPct > 100) {
      status = 'exceeded';
    } else if (utilizationPct >= 80) {
      status = 'warning';
    } else {
      status = 'nominal';
    }
  }

  return {
    monthKey,
    limit,
    spent,
    remaining,
    utilizationPct,
    status,
  };
}

export function initBudgetModule(callbacks) {
  budgetCallbacks = { ...budgetCallbacks, ...callbacks };

  const monthInput = document.getElementById('budget-month-input');
  const limitInput = document.getElementById('budget-limit-input');
  const form = document.getElementById('budget-form');

  monthInput.value = selectedBudgetMonth;
  limitInput.value = getBudgetLimitForMonth(selectedBudgetMonth).toFixed(2);

  monthInput.addEventListener('change', (e) => {
    if (!e.target.value) return;
    selectedBudgetMonth = e.target.value;
    const savedLimit = getBudgetLimitForMonth(selectedBudgetMonth);
    limitInput.value = savedLimit > 0 ? savedLimit.toFixed(2) : '';
    clearBudgetError();
    renderBudgetView(budgetCallbacks.getTransactions());
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearBudgetError();

    const monthKey = monthInput.value || getCurrentMonthKey();
    const rawVal = Number(limitInput.value);

    if (!Number.isFinite(rawVal) || rawVal <= 0) {
      showBudgetError('Enter a monthly budget greater than $0.00.');
      return;
    }

    if (rawVal > 100000000) {
      showBudgetError('Budget amount exceeds maximum allowed limit.');
      return;
    }

    selectedBudgetMonth = monthKey;
    setMonthlyBudgetLimit(monthKey, rawVal);
    budgetCallbacks.showToast(`Budget updated for ${formatMonthLabel(monthKey)}`);
    budgetCallbacks.onBudgetChanged();
  });
}

function clearBudgetError() {
  const errEl = document.getElementById('budget-error-msg');
  const input = document.getElementById('budget-limit-input');
  input.classList.remove('is-invalid');
  errEl.textContent = '';
  errEl.hidden = true;
}

function showBudgetError(msg) {
  const errEl = document.getElementById('budget-error-msg');
  const input = document.getElementById('budget-limit-input');
  input.classList.add('is-invalid');
  errEl.textContent = msg;
  errEl.hidden = false;
}

export function renderBudgetView(transactions) {
  const limit = getBudgetLimitForMonth(selectedBudgetMonth);
  const state = calculateBudgetStatus(transactions, selectedBudgetMonth, limit);
  const monthLabel = formatMonthLabel(selectedBudgetMonth);

  // Sync inputs if changed externally (e.g., reset to sample data)
  const monthInput = document.getElementById('budget-month-input');
  const limitInput = document.getElementById('budget-limit-input');
  if (monthInput.value !== selectedBudgetMonth) {
    monthInput.value = selectedBudgetMonth;
  }
  if (document.activeElement !== limitInput) {
    limitInput.value = limit > 0 ? limit.toFixed(2) : '';
  }

  document.getElementById('budget-period-label').textContent = `${monthLabel} spending against target limit`;
  document.getElementById('budget-val-limit').textContent = formatCurrency(state.limit);
  document.getElementById('budget-val-spent').textContent = formatCurrency(state.spent);

  const remainingEl = document.getElementById('budget-val-remaining');
  if (state.remaining < 0) {
    remainingEl.textContent = `-${formatCurrency(Math.abs(state.remaining))}`;
    remainingEl.classList.add('text-danger');
    remainingEl.classList.remove('text-income');
  } else {
    remainingEl.textContent = formatCurrency(state.remaining);
    remainingEl.classList.remove('text-danger');
    remainingEl.classList.toggle('text-income', state.limit > 0);
  }

  document.getElementById('budget-val-percent').textContent = `${state.utilizationPct.toFixed(1)}%`;

  // Progress Bar & Status Label
  const fillEl = document.getElementById('budget-progress-fill');
  const trackEl = document.getElementById('budget-progress-bar-track');
  const statusTextEl = document.getElementById('budget-status-text');
  const clampedWidth = Math.min(100, Math.max(0, state.utilizationPct));

  fillEl.style.width = `${clampedWidth.toFixed(1)}%`;
  fillEl.classList.remove('is-warning', 'is-exceeded');
  statusTextEl.classList.remove('is-nominal', 'is-warning', 'is-exceeded');
  trackEl.setAttribute('aria-valuenow', String(Math.round(state.utilizationPct)));

  const bannerEl = document.getElementById('budget-status-banner');

  if (state.status === 'exceeded') {
    fillEl.classList.add('is-exceeded');
    statusTextEl.classList.add('is-exceeded');
    statusTextEl.textContent = 'Budget exceeded';
    bannerEl.hidden = false;
    bannerEl.className = 'alert-banner alert-banner-danger';
    bannerEl.innerHTML = `
      <div class="alert-banner-content">
        <i data-lucide="alert-octagon" class="alert-banner-icon"></i>
        <span><strong>Budget Exceeded:</strong> Spending in ${monthLabel} has reached ${formatCurrency(
      state.spent
    )}, which is ${formatCurrency(Math.abs(state.remaining))} over your ${formatCurrency(state.limit)} limit.</span>
      </div>
    `;
  } else if (state.status === 'warning') {
    fillEl.classList.add('is-warning');
    statusTextEl.classList.add('is-warning');
    statusTextEl.textContent = 'Approaching limit (80%+)';
    bannerEl.hidden = false;
    bannerEl.className = 'alert-banner alert-banner-warning';
    bannerEl.innerHTML = `
      <div class="alert-banner-content">
        <i data-lucide="alert-triangle" class="alert-banner-icon"></i>
        <span><strong>Budget Warning:</strong> You have spent ${state.utilizationPct.toFixed(
          1
        )}% of your ${monthLabel} budget. ${formatCurrency(state.remaining)} remaining.</span>
      </div>
    `;
  } else if (state.status === 'nominal') {
    statusTextEl.classList.add('is-nominal');
    statusTextEl.textContent = 'On track';
    bannerEl.hidden = true;
    bannerEl.innerHTML = '';
  } else {
    statusTextEl.textContent = 'No budget set';
    bannerEl.hidden = true;
    bannerEl.innerHTML = '';
  }

  // Monthly Category Impact Table
  renderBudgetCategoryImpact(transactions, selectedBudgetMonth, state.limit);

  if (window.lucide) window.lucide.createIcons();
}

function renderBudgetCategoryImpact(transactions, monthKey, budgetLimit) {
  const container = document.getElementById('budget-category-impact');
  const monthTransactions = transactions.filter(
    (tx) => tx.type === 'expense' && typeof tx.date === 'string' && tx.date.startsWith(monthKey)
  );
  const breakdown = getCategoryBreakdown(monthTransactions, 'expense');

  if (breakdown.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="calendar-off" class="empty-state-icon"></i>
        <h3 class="empty-state-title">No expenses recorded for ${escapeHtml(formatMonthLabel(monthKey))}</h3>
        <p class="empty-state-desc">Expenses recorded during this month will appear here with their share of your monthly budget.</p>
      </div>
    `;
    return;
  }

  const rowsHtml = breakdown
    .map((item) => {
      const budgetShare = budgetLimit > 0 ? (item.total / budgetLimit) * 100 : 0;
      return `
        <tr>
          <td class="tx-title">${escapeHtml(item.category)}</td>
          <td class="col-right tabular-nums">${item.count}</td>
          <td class="col-right tx-amount tabular-nums">${formatCurrency(item.total)}</td>
          <td>
            <div class="share-bar-cell">
              <div class="share-bar-track">
                <div class="share-bar-fill" style="width: ${Math.min(100, budgetShare).toFixed(1)}%"></div>
              </div>
              <span class="tabular-nums legend-pct">${budgetShare.toFixed(1)}%</span>
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
          <th>Category</th>
          <th class="col-right">Entries</th>
          <th class="col-right">Spent in ${escapeHtml(formatMonthLabel(monthKey))}</th>
          <th>% of Monthly Budget</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}
