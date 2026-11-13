/**
 * storage.js
 * Centralized persistence layer backed by LocalStorage.
 * Designed with an explicit CRUD interface so LocalStorage calls can be
 * replaced cleanly with async REST API calls (Node.js/Express/SQL) later
 * without refactoring UI modules.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'ledgerly_transactions_v1',
  BUDGET: 'ledgerly_budget_v1',
  INITIALIZED: 'ledgerly_initialized_v1',
};

export const CATEGORIES = {
  expense: [
    'Food',
    'Housing',
    'Transportation',
    'Utilities',
    'Healthcare',
    'Entertainment',
    'Shopping',
    'Education',
    'Travel',
    'Other',
  ],
  income: [
    'Salary',
    'Freelance',
    'Investments',
    'Rental',
    'Refund',
    'Other',
  ],
};

/**
 * Generates a unique identifier suitable for client records and future DB keys.
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Returns YYYY-MM string for the current local date.
 */
export function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns YYYY-MM-DD string for today's local date.
 */
export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftMonthKey(baseMonthKey, deltaMonths) {
  const [y, m] = baseMonthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Builds cohesive initial sample transactions anchored to the current month.
 */
function buildInitialTransactions() {
  const m0 = getCurrentMonthKey();
  const m1 = shiftMonthKey(m0, -1);
  const m2 = shiftMonthKey(m0, -2);
  const m3 = shiftMonthKey(m0, -3);

  return [
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: `${m0}-01`,
      description: 'Primary engineering payroll deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: `${m0}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Whole Foods Groceries',
      amount: 184.5,
      category: 'Food',
      type: 'expense',
      date: `${m0}-05`,
      description: 'Weekly groceries and household staples',
    },
    {
      id: generateId(),
      title: 'Electric & Fiber Internet',
      amount: 142.8,
      category: 'Utilities',
      type: 'expense',
      date: `${m0}-07`,
      description: 'ConEdison electricity and gigabit fiber',
    },
    {
      id: generateId(),
      title: 'Design System Audit',
      amount: 950,
      category: 'Freelance',
      type: 'income',
      date: `${m0}-09`,
      description: 'Consulting invoice #1042',
    },
    {
      id: generateId(),
      title: 'Metro Pass & Fuel',
      amount: 96,
      category: 'Transportation',
      type: 'expense',
      date: `${m0}-10`,
      description: 'Monthly transit pass and rideshare',
    },
    {
      id: generateId(),
      title: 'Pharmacy & Dental Checkup',
      amount: 115,
      category: 'Healthcare',
      type: 'expense',
      date: `${m0}-11`,
      description: 'Preventive care co-pay and prescriptions',
    },
    {
      id: generateId(),
      title: 'Trader Joe’s Market',
      amount: 138.25,
      category: 'Food',
      type: 'expense',
      date: `${m0}-12`,
      description: 'Fresh produce and pantry restock',
    },
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: `${m1}-01`,
      description: 'Primary engineering payroll deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: `${m1}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Grocery & Dining',
      amount: 465.4,
      category: 'Food',
      type: 'expense',
      date: `${m1}-14`,
      description: 'Monthly groceries and dinner out',
    },
    {
      id: generateId(),
      title: 'Autumn Jacket & Shoes',
      amount: 210,
      category: 'Shopping',
      type: 'expense',
      date: `${m1}-19`,
      description: 'Seasonal wardrobe replacement',
    },
    {
      id: generateId(),
      title: 'Dividend Payout',
      amount: 320,
      category: 'Investments',
      type: 'income',
      date: `${m1}-25`,
      description: 'Quarterly index fund distribution',
    },
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: `${m2}-01`,
      description: 'Primary engineering payroll deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: `${m2}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Weekend Rail Trip',
      amount: 340,
      category: 'Travel',
      type: 'expense',
      date: `${m2}-16`,
      description: 'Amtrak tickets and hotel stay',
    },
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: `${m3}-01`,
      description: 'Primary engineering payroll deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: `${m3}-02`,
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Streaming & Books',
      amount: 78.9,
      category: 'Entertainment',
      type: 'expense',
      date: `${m3}-12`,
      description: 'Annual audiobook and music subscription',
    },
  ];
}

/**
 * Seeds initial transactions & default budget once per browser profile.
 */
export function initializeStorage() {
  const alreadyInitialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  if (!alreadyInitialized) {
    const initialTransactions = buildInitialTransactions();
    const defaultBudget = {
      monthlyLimit: 2800,
      budgetsByMonth: {
        [getCurrentMonthKey()]: 2800,
      },
    };
    saveTransactions(initialTransactions);
    saveBudget(defaultBudget);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }
}

/**
 * Retrieves all stored transactions sorted safely as an array.
 * @returns {Array<Object>}
 */
export function getTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read transactions from LocalStorage:', error);
    return [];
  }
}

/**
 * Overwrites stored transactions list.
 * @param {Array<Object>} transactions
 */
export function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

/**
 * Creates and persists a new transaction record.
 * @param {Object} payload
 * @returns {Object} Created transaction
 */
export function createTransaction(payload) {
  const transactions = getTransactions();
  const newTx = {
    id: generateId(),
    title: String(payload.title).trim(),
    amount: Number(Number(payload.amount).toFixed(2)),
    category: String(payload.category),
    type: payload.type === 'income' ? 'income' : 'expense',
    date: String(payload.date),
    description: String(payload.description || '').trim(),
  };
  transactions.push(newTx);
  saveTransactions(transactions);
  return newTx;
}

/**
 * Updates an existing transaction by ID.
 * @param {string} id
 * @param {Object} updates
 * @returns {Object|null}
 */
export function updateTransaction(id, updates) {
  const transactions = getTransactions();
  const index = transactions.findIndex((tx) => tx.id === id);
  if (index === -1) return null;

  const updated = {
    ...transactions[index],
    title: String(updates.title).trim(),
    amount: Number(Number(updates.amount).toFixed(2)),
    category: String(updates.category),
    type: updates.type === 'income' ? 'income' : 'expense',
    date: String(updates.date),
    description: String(updates.description || '').trim(),
  };

  transactions[index] = updated;
  saveTransactions(transactions);
  return updated;
}

/**
 * Deletes a transaction by ID.
 * @param {string} id
 * @returns {boolean}
 */
export function deleteTransaction(id) {
  const transactions = getTransactions();
  const next = transactions.filter((tx) => tx.id !== id);
  if (next.length === transactions.length) return false;
  saveTransactions(next);
  return true;
}

/**
 * Retrieves budget configuration.
 * @returns {{ monthlyLimit: number, budgetsByMonth: Object<string, number> }}
 */
export function getBudget() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (!raw) {
      return { monthlyLimit: 2800, budgetsByMonth: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      monthlyLimit: Number(parsed.monthlyLimit) || 0,
      budgetsByMonth: parsed.budgetsByMonth && typeof parsed.budgetsByMonth === 'object' ? parsed.budgetsByMonth : {},
    };
  } catch (error) {
    console.error('Failed to read budget from LocalStorage:', error);
    return { monthlyLimit: 2800, budgetsByMonth: {} };
  }
}

/**
 * Persists budget configuration.
 * @param {Object} budgetData
 */
export function saveBudget(budgetData) {
  localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(budgetData));
}

/**
 * Saves a budget limit for a specific month key (YYYY-MM).
 * @param {string} monthKey
 * @param {number} limitAmount
 */
export function setMonthlyBudgetLimit(monthKey, limitAmount) {
  const budget = getBudget();
  const cleanLimit = Number(Number(limitAmount).toFixed(2));
  budget.monthlyLimit = cleanLimit;
  budget.budgetsByMonth[monthKey] = cleanLimit;
  saveBudget(budget);
  return budget;
}

/**
 * Resolves the active budget limit for a given month key (YYYY-MM).
 * @param {string} monthKey
 * @returns {number}
 */
export function getBudgetLimitForMonth(monthKey) {
  const budget = getBudget();
  if (Object.prototype.hasOwnProperty.call(budget.budgetsByMonth, monthKey)) {
    return Number(budget.budgetsByMonth[monthKey]) || 0;
  }
  return Number(budget.monthlyLimit) || 0;
}

/**
 * Restores initial demo data.
 */
export function resetToSampleData() {
  const initialTransactions = buildInitialTransactions();
  const defaultBudget = {
    monthlyLimit: 2800,
    budgetsByMonth: {
      [getCurrentMonthKey()]: 2800,
    },
  };
  saveTransactions(initialTransactions);
  saveBudget(defaultBudget);
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
}
