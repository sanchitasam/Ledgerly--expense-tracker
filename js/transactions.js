/**
 * transactions.js
 * Pure financial calculations (storage-independent) + Transaction Management UI
 * (Add/Edit modal, validation, and Transaction History table with search, filters, sorting).
 */

import {
  CATEGORIES,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTodayDateString,
  getCurrentMonthKey,
} from './storage.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value) {
  const num = Number(value) || 0;
  return currencyFormatter.format(num);
}

export function formatDate(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '—';
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonthLabel(monthKey) {
  if (!monthKey || !monthKey.includes('-')) return monthKey;
  const [y, m] = monthKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, 1);
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Computes core financial totals dynamically from any transaction array.
 * Independent of storage for future REST API compatibility.
 */
export function calculateFinancialSummary(transactions, targetMonthKey = getCurrentMonthKey()) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let monthlyIncome = 0;
  let monthlySpending = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let monthlyExpenseCount = 0;

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    const isTargetMonth = typeof tx.date === 'string' && tx.date.startsWith(targetMonthKey);

    if (tx.type === 'income') {
      totalIncome += amount;
      incomeCount += 1;
      if (isTargetMonth) {
        monthlyIncome += amount;
      }
    } else if (tx.type === 'expense') {
      totalExpenses += amount;
      expenseCount += 1;
      if (isTargetMonth) {
        monthlySpending += amount;
        monthlyExpenseCount += 1;
      }
    }
  }

  return {
    totalBalance: totalIncome - totalExpenses,
    totalIncome,
    totalExpenses,
    monthlyIncome,
    monthlySpending,
    incomeCount,
    expenseCount,
    monthlyExpenseCount,
  };
}

/**
 * Returns sorted category breakdown for a transaction set.
 */
export function getCategoryBreakdown(transactions, type = 'expense') {
  const map = new Map();
  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    const amount = Number(tx.amount) || 0;
    grandTotal += amount;
    const prev = map.get(tx.category) || { category: tx.category, total: 0, count: 0 };
    prev.total += amount;
    prev.count += 1;
    map.set(tx.category, prev);
  }

  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .map((item) => ({
      ...item,
      percentage: grandTotal > 0 ? (item.total / grandTotal) * 100 : 0,
    }));
}

/**
 * Generates an ordered list of YYYY-MM keys ending at the current month (or latest month).
 */
export function getRecentMonthKeys(count = 6, baseMonthKey = getCurrentMonthKey()) {
  const [year, month] = baseMonthKey.split('-').map(Number);
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(year, month - 1 - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/**
 * Computes monthly income and expense arrays for charting.
 */
export function getMonthlySeries(transactions, monthKeys) {
  const buckets = new Map();
  for (const key of monthKeys) {
    buckets.set(key, { income: 0, expense: 0 });
  }

  for (const tx of transactions) {
    if (typeof tx.date !== 'string') continue;
    const key = tx.date.slice(0, 7);
    if (!buckets.has(key)) continue;
    const bucket = buckets.get(key);
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      bucket.income += amount;
    } else if (tx.type === 'expense') {
      bucket.expense += amount;
    }
  }

  return {
    labels: monthKeys.map(formatMonthLabel),
    incomeSeries: monthKeys.map((k) => Number(buckets.get(k).income.toFixed(2))),
    expenseSeries: monthKeys.map((k) => Number(buckets.get(k).expense.toFixed(2))),
  };
}

/**
 * Filters and sorts transactions according to active filter state.
 */
export function filterAndSortTransactions(transactions, filters) {
  const query = (filters.search || '').trim().toLowerCase();
  const typeFilter = filters.type || 'all';
  const categoryFilter = filters.category || 'all';
  const sortOrder = filters.sort || 'date-desc';

  const filtered = transactions.filter((tx) => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;
    if (query) {
      const haystack = `${tx.title} ${tx.category} ${tx.description} ${tx.date}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (sortOrder === 'date-asc') {
      return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
    }
    if (sortOrder === 'amount-desc') {
      return Number(b.amount) - Number(a.amount);
    }
    if (sortOrder === 'amount-asc') {
      return Number(a.amount) - Number(b.amount);
    }
    // Default: date-desc
    return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
  });
}

/**
 * Validates transaction form input and returns field errors.
 */
export function validateTransactionInput(data) {
  const errors = {};
  const title = String(data.title || '').trim();
  const amount = Number(data.amount);
  const category = String(data.category || '').trim();
  const type = data.type;
  const date = String(data.date || '').trim();

  if (!title) {
    errors.title = 'Enter a transaction title.';
  } else if (title.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter a valid amount greater than 0.';
  } else if (amount > 100000000) {
    errors.amount = 'Amount exceeds maximum allowed limit.';
  }

  if (!category) {
    errors.category = 'Select a category.';
  }

  if (type !== 'income' && type !== 'expense') {
    errors.type = 'Select income or expense.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Select a valid date.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/* ==========================================================================
   Transaction Management UI Controller
   ========================================================================== */

const filterState = {
  search: '',
  type: 'all',
  category: 'all',
  sort: 'date-desc',
};

let moduleCallbacks = {
  onDataChanged: () => {},
  onRequestConfirm: () => {},
  showToast: () => {},
  getTransactions: () => [],
};

export function initTransactionsModule(callbacks) {
  moduleCallbacks = { ...moduleCallbacks, ...callbacks };

  const modal = document.getElementById('tx-modal');
  const form = document.getElementById('tx-form');
  const closeBtn = document.getElementById('btn-close-tx-modal');
  const cancelBtn = document.getElementById('btn-cancel-tx-modal');
  const typeButtons = document.querySelectorAll('[data-form-type]');

  // Modal controls
  closeBtn.addEventListener('click', closeTransactionModal);
  cancelBtn.addEventListener('click', closeTransactionModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeTransactionModal();
  });

  // Type toggle inside modal
  typeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextType = btn.dataset.formType;
      setModalTransactionType(nextType);
    });
  });

  // Form submission
  form.addEventListener('submit', handleTransactionFormSubmit);

  // History view filters
  const searchInput = document.getElementById('tx-search-input');
  const categorySelect = document.getElementById('tx-category-filter');
  const sortSelect = document.getElementById('tx-sort-select');
  const typeFilterButtons = document.querySelectorAll('[data-type-filter]');

  searchInput.addEventListener('input', (e) => {
    filterState.search = e.target.value;
    renderTransactionsView(moduleCallbacks.getTransactions());
  });

  categorySelect.addEventListener('change', (e) => {
    filterState.category = e.target.value;
    renderTransactionsView(moduleCallbacks.getTransactions());
  });

  sortSelect.addEventListener('change', (e) => {
    filterState.sort = e.target.value;
    renderTransactionsView(moduleCallbacks.getTransactions());
  });

  typeFilterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterState.type = btn.dataset.typeFilter;
      typeFilterButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      populateCategoryFilterOptions(moduleCallbacks.getTransactions());
      renderTransactionsView(moduleCallbacks.getTransactions());
    });
  });
}

function setModalTransactionType(type, preferredCategory = null) {
  const safeType = type === 'income' ? 'income' : 'expense';
  document.getElementById('tx-type-input').value = safeType;

  document.querySelectorAll('[data-form-type]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.formType === safeType);
  });

  const categorySelect = document.getElementById('tx-category-input');
  const options = CATEGORIES[safeType];
  categorySelect.innerHTML = options
    .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
    .join('');

  if (preferredCategory && options.includes(preferredCategory)) {
    categorySelect.value = preferredCategory;
  }
}

function clearFormErrors() {
  const fields = [
    { input: 'tx-title-input', err: 'err-tx-title' },
    { input: 'tx-amount-input', err: 'err-tx-amount' },
    { input: 'tx-category-input', err: 'err-tx-category' },
    { input: 'tx-date-input', err: 'err-tx-date' },
    { input: 'tx-description-input', err: 'err-tx-description' },
  ];
  fields.forEach(({ input, err }) => {
    document.getElementById(input).classList.remove('is-invalid');
    const errEl = document.getElementById(err);
    errEl.textContent = '';
    errEl.hidden = true;
  });
}

function showFormErrors(errors) {
  const mapping = {
    title: { input: 'tx-title-input', err: 'err-tx-title' },
    amount: { input: 'tx-amount-input', err: 'err-tx-amount' },
    category: { input: 'tx-category-input', err: 'err-tx-category' },
    date: { input: 'tx-date-input', err: 'err-tx-date' },
  };

  Object.entries(errors).forEach(([key, message]) => {
    const target = mapping[key];
    if (!target) return;
    document.getElementById(target.input).classList.add('is-invalid');
    const errEl = document.getElementById(target.err);
    errEl.textContent = message;
    errEl.hidden = false;
  });
}

export function openAddTransactionModal() {
  clearFormErrors();
  document.getElementById('tx-modal-title').textContent = 'Add Transaction';
  document.getElementById('btn-save-tx').textContent = 'Save Transaction';
  document.getElementById('tx-id-input').value = '';
  document.getElementById('tx-title-input').value = '';
  document.getElementById('tx-amount-input').value = '';
  document.getElementById('tx-date-input').value = getTodayDateString();
  document.getElementById('tx-description-input').value = '';
  setModalTransactionType('expense');

  const modal = document.getElementById('tx-modal');
  modal.hidden = false;
  document.getElementById('tx-title-input').focus();
}

export function openEditTransactionModal(transaction) {
  if (!transaction) return;
  clearFormErrors();
  document.getElementById('tx-modal-title').textContent = 'Edit Transaction';
  document.getElementById('btn-save-tx').textContent = 'Update Transaction';
  document.getElementById('tx-id-input').value = transaction.id;
  document.getElementById('tx-title-input').value = transaction.title;
  document.getElementById('tx-amount-input').value = Number(transaction.amount).toFixed(2);
  document.getElementById('tx-date-input').value = transaction.date;
  document.getElementById('tx-description-input').value = transaction.description || '';
  setModalTransactionType(transaction.type, transaction.category);

  const modal = document.getElementById('tx-modal');
  modal.hidden = false;
  document.getElementById('tx-title-input').focus();
}

export function closeTransactionModal() {
  const modal = document.getElementById('tx-modal');
  modal.hidden = true;
}

function handleTransactionFormSubmit(e) {
  e.preventDefault();
  clearFormErrors();

  const id = document.getElementById('tx-id-input').value.trim();
  const payload = {
    type: document.getElementById('tx-type-input').value,
    title: document.getElementById('tx-title-input').value,
    amount: document.getElementById('tx-amount-input').value,
    category: document.getElementById('tx-category-input').value,
    date: document.getElementById('tx-date-input').value,
    description: document.getElementById('tx-description-input').value,
  };

  const validation = validateTransactionInput(payload);
  if (!validation.valid) {
    showFormErrors(validation.errors);
    return;
  }

  if (id) {
    updateTransaction(id, payload);
    moduleCallbacks.showToast('Transaction updated');
  } else {
    createTransaction(payload);
    moduleCallbacks.showToast('Transaction added');
  }

  closeTransactionModal();
  moduleCallbacks.onDataChanged();
}

export function requestDeleteTransaction(transaction) {
  if (!transaction) return;
  moduleCallbacks.onRequestConfirm({
    title: 'Delete Transaction',
    message: `Are you sure you want to permanently delete "${transaction.title}" (${formatCurrency(
      transaction.amount
    )})? This action cannot be undone.`,
    confirmLabel: 'Delete',
    onConfirm: () => {
      deleteTransaction(transaction.id);
      moduleCallbacks.showToast('Transaction deleted');
      moduleCallbacks.onDataChanged();
    },
  });
}

function populateCategoryFilterOptions(transactions) {
  const select = document.getElementById('tx-category-filter');
  const currentVal = filterState.category;

  const set = new Set();
  if (filterState.type === 'income') {
    CATEGORIES.income.forEach((c) => set.add(c));
  } else if (filterState.type === 'expense') {
    CATEGORIES.expense.forEach((c) => set.add(c));
  } else {
    CATEGORIES.expense.forEach((c) => set.add(c));
    CATEGORIES.income.forEach((c) => set.add(c));
  }

  transactions.forEach((tx) => {
    if (filterState.type === 'all' || tx.type === filterState.type) {
      set.add(tx.category);
    }
  });

  const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
  select.innerHTML = [
    '<option value="all">All Categories</option>',
    ...sorted.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`),
  ].join('');

  if (currentVal !== 'all' && sorted.includes(currentVal)) {
    select.value = currentVal;
  } else {
    filterState.category = 'all';
    select.value = 'all';
  }
}

export function renderTransactionsView(transactions) {
  populateCategoryFilterOptions(transactions);

  const filtered = filterAndSortTransactions(transactions, filterState);
  const countEl = document.getElementById('tx-result-count');
  const inEl = document.getElementById('tx-filtered-in');
  const outEl = document.getElementById('tx-filtered-out');
  const container = document.getElementById('transactions-table-container');

  let filteredIn = 0;
  let filteredOut = 0;
  for (const tx of filtered) {
    if (tx.type === 'income') filteredIn += Number(tx.amount) || 0;
    else filteredOut += Number(tx.amount) || 0;
  }

  countEl.textContent = `Showing ${filtered.length} ${filtered.length === 1 ? 'transaction' : 'transactions'}`;
  inEl.textContent = formatCurrency(filteredIn);
  outEl.textContent = formatCurrency(filteredOut);

  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="receipt" class="empty-state-icon"></i>
        <h3 class="empty-state-title">No transactions recorded yet</h3>
        <p class="empty-state-desc">Add your first income or expense entry to start tracking your financial activity.</p>
        <button type="button" class="btn-primary" id="empty-add-tx-btn">
          <i data-lucide="plus" class="btn-icon"></i>
          <span>Add Transaction</span>
        </button>
      </div>
    `;
    document.getElementById('empty-add-tx-btn')?.addEventListener('click', openAddTransactionModal);
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="search-x" class="empty-state-icon"></i>
        <h3 class="empty-state-title">No matching transactions</h3>
        <p class="empty-state-desc">Try adjusting your search query, category, or transaction type filter.</p>
        <button type="button" class="btn-secondary" id="empty-clear-filters-btn">Clear Filters</button>
      </div>
    `;
    document.getElementById('empty-clear-filters-btn')?.addEventListener('click', () => {
      filterState.search = '';
      filterState.type = 'all';
      filterState.category = 'all';
      filterState.sort = 'date-desc';
      document.getElementById('tx-search-input').value = '';
      document.getElementById('tx-sort-select').value = 'date-desc';
      document.querySelectorAll('[data-type-filter]').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.typeFilter === 'all');
      });
      renderTransactionsView(moduleCallbacks.getTransactions());
    });
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const rowsHtml = filtered
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'text-income' : 'text-expense';
      const typeLabel = isIncome ? 'Income' : 'Expense';
      const descLine = tx.description
        ? `<span class="tx-desc" title="${escapeHtml(tx.description)}">${escapeHtml(tx.description)}</span>`
        : '';

      return `
        <tr data-tx-id="${escapeHtml(tx.id)}">
          <td>
            <div class="tx-title-cell">
              <span class="tx-title">${escapeHtml(tx.title)}</span>
              ${descLine}
            </div>
          </td>
          <td class="tx-meta-text">${escapeHtml(tx.category)}</td>
          <td class="tx-meta-text">${typeLabel}</td>
          <td class="tx-meta-text tabular-nums">${escapeHtml(formatDate(tx.date))}</td>
          <td class="col-right tx-amount tabular-nums ${amountClass}">${sign}${formatCurrency(tx.amount)}</td>
          <td class="col-actions">
            <div class="row-actions">
              <button type="button" class="btn-icon-only" data-action="edit" data-id="${escapeHtml(tx.id)}" aria-label="Edit ${escapeHtml(tx.title)}">
                <i data-lucide="pencil"></i>
              </button>
              <button type="button" class="btn-icon-only btn-action-danger" data-action="delete" data-id="${escapeHtml(tx.id)}" aria-label="Delete ${escapeHtml(tx.title)}">
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
          <th>Type</th>
          <th>Date</th>
          <th class="col-right">Amount</th>
          <th class="col-actions">Actions</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;

  // Delegate row edit & delete clicks
  container.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = transactions.find((item) => item.id === btn.dataset.id);
      openEditTransactionModal(tx);
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = transactions.find((item) => item.id === btn.dataset.id);
      requestDeleteTransaction(tx);
    });
  });

  if (window.lucide) window.lucide.createIcons();
}
