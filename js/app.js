/**
 * app.js
 * Main application bootstrap:
 * - Initializes storage seed data
 * - Manages sidebar navigation and responsive mobile drawer
 * - Coordinates view rendering across Dashboard, Transactions, Analytics, and Budget
 * - Handles confirmation modal, CSV export, keyboard shortcuts, and toast notifications
 */

import {
  getBudgetLimitForMonth,
  getCurrentMonthKey,
  getTodayDateString,
  getTransactions,
  initializeStorage,
  resetToSampleData,
} from './storage.js';
import {
  calculateFinancialSummary,
  formatCurrency,
  initTransactionsModule,
  openAddTransactionModal,
  closeTransactionModal,
  renderTransactionsView,
} from './transactions.js';
import { renderDashboardView } from './dashboard.js';
import { initAnalyticsModule, renderAnalyticsView } from './analytics.js';
import { initBudgetModule, renderBudgetView } from './budget.js';

const VIEW_META = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Overview of cash flow and spending',
  },
  transactions: {
    title: 'Transaction History',
    subtitle: 'Search, filter, edit, and manage all records',
  },
  analytics: {
    title: 'Expense Analytics',
    subtitle: 'Category breakdowns, trends, and savings',
  },
  budget: {
    title: 'Budget Management',
    subtitle: 'Set monthly limits and monitor spending thresholds',
  },
};

let activeView = 'dashboard';
let confirmAcceptCallback = null;

function showToast(message, variant = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${variant === 'error' ? 'is-error' : ''}`;
  const iconName = variant === 'error' ? 'alert-circle' : 'check-circle-2';
  toast.innerHTML = `<i data-lucide="${iconName}" class="toast-icon"></i><span></span>`;
  toast.querySelector('span').textContent = message;
  container.appendChild(toast);

  if (window.lucide) window.lucide.createIcons({ nodes: [toast] });

  setTimeout(() => {
    toast.remove();
  }, 2800);
}

function openConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm }) {
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-message').textContent = message;
  document.getElementById('btn-confirm-accept').textContent = confirmLabel;
  confirmAcceptCallback = onConfirm;
  document.getElementById('confirm-modal').hidden = false;
  document.getElementById('btn-confirm-accept').focus();
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').hidden = true;
  confirmAcceptCallback = null;
}

function setMobileSidebarOpen(isOpen) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const menuBtn = document.getElementById('btn-mobile-menu');

  sidebar.classList.toggle('is-open', isOpen);
  backdrop.hidden = !isOpen;
  menuBtn.setAttribute('aria-expanded', String(isOpen));
}

function navigateToView(viewName) {
  if (!VIEW_META[viewName]) return;
  activeView = viewName;

  // Update nav items
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    const isMatch = btn.dataset.view === viewName;
    btn.classList.toggle('is-active', isMatch);
    if (isMatch) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  // Update view sections
  document.querySelectorAll('.view-section').forEach((section) => {
    const isMatch = section.id === `view-${viewName}`;
    section.hidden = !isMatch;
    section.classList.toggle('is-active', isMatch);
  });

  // Update top bar header
  document.getElementById('page-title').textContent = VIEW_META[viewName].title;
  document.getElementById('page-subtitle').textContent = VIEW_META[viewName].subtitle;

  setMobileSidebarOpen(false);
  refreshApplication();
}

function refreshApplication() {
  const transactions = getTransactions();
  const currentMonth = getCurrentMonthKey();
  const currentBudgetLimit = getBudgetLimitForMonth(currentMonth);
  const summary = calculateFinancialSummary(transactions, currentMonth);

  // Update sidebar balance widget
  const sidebarBalance = document.getElementById('sidebar-net-balance');
  sidebarBalance.textContent = formatCurrency(summary.totalBalance);
  sidebarBalance.classList.toggle('text-danger', summary.totalBalance < 0);

  if (activeView === 'dashboard') {
    renderDashboardView(transactions, currentBudgetLimit, {
      onNavigate: navigateToView,
    });
  } else if (activeView === 'transactions') {
    renderTransactionsView(transactions);
  } else if (activeView === 'analytics') {
    renderAnalyticsView(transactions);
  } else if (activeView === 'budget') {
    renderBudgetView(transactions);
  }
}

function exportTransactionsAsCsv() {
  const transactions = getTransactions();
  if (transactions.length === 0) {
    showToast('No transactions available to export', 'error');
    return;
  }

  const headers = ['ID', 'Title', 'Type', 'Category', 'Amount', 'Date', 'Description'];
  const escapeCsvCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const rows = transactions.map((tx) =>
    [tx.id, tx.title, tx.type, tx.category, Number(tx.amount).toFixed(2), tx.date, tx.description]
      .map(escapeCsvCell)
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `ledgerly-transactions-${getTodayDateString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Exported ${transactions.length} transactions to CSV`);
}

function bootstrap() {
  initializeStorage();

  // Initialize feature modules
  initTransactionsModule({
    getTransactions,
    onDataChanged: refreshApplication,
    onRequestConfirm: openConfirmModal,
    showToast,
  });

  initAnalyticsModule(getTransactions);

  initBudgetModule({
    getTransactions,
    onBudgetChanged: refreshApplication,
    showToast,
  });

  // Navigation events
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => navigateToView(btn.dataset.view));
  });

  document.getElementById('btn-view-all-tx').addEventListener('click', () => {
    navigateToView('transactions');
  });

  // Mobile sidebar drawer
  document.getElementById('btn-mobile-menu').addEventListener('click', () => {
    const isOpen = document.getElementById('sidebar').classList.contains('is-open');
    setMobileSidebarOpen(!isOpen);
  });
  document.getElementById('sidebar-backdrop').addEventListener('click', () => {
    setMobileSidebarOpen(false);
  });

  // Top bar Add Transaction CTA
  document.getElementById('btn-open-add-modal').addEventListener('click', openAddTransactionModal);

  // Sidebar utility actions
  document.getElementById('btn-export-csv').addEventListener('click', exportTransactionsAsCsv);
  document.getElementById('btn-reset-demo').addEventListener('click', () => {
    openConfirmModal({
      title: 'Reset Sample Data',
      message:
        'This will replace your current transactions and budget settings with the initial sample dataset. Continue?',
      confirmLabel: 'Reset Data',
      onConfirm: () => {
        resetToSampleData();
        showToast('Sample data restored');
        refreshApplication();
      },
    });
  });

  // Confirm modal controls
  document.getElementById('btn-close-confirm-modal').addEventListener('click', closeConfirmModal);
  document.getElementById('btn-confirm-cancel').addEventListener('click', closeConfirmModal);
  document.getElementById('confirm-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('confirm-modal')) closeConfirmModal();
  });
  document.getElementById('btn-confirm-accept').addEventListener('click', () => {
    const cb = confirmAcceptCallback;
    closeConfirmModal();
    if (typeof cb === 'function') cb();
  });

  // Global Escape key handler for modals & mobile drawer
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('confirm-modal').hidden) {
      closeConfirmModal();
    } else if (!document.getElementById('tx-modal').hidden) {
      closeTransactionModal();
    } else if (document.getElementById('sidebar').classList.contains('is-open')) {
      setMobileSidebarOpen(false);
    }
  });

  // Initial render
  navigateToView('dashboard');
}

document.addEventListener('DOMContentLoaded', bootstrap);
