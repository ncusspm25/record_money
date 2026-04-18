const STORAGE_KEY = "pocket-ledger-transactions";
const SETTINGS_KEY = "pocket-ledger-settings";

const DEFAULT_CATEGORIES = {
  expense: ["餐飲", "交通", "日用品", "娛樂", "醫療", "房租", "水電", "學習"],
  income: ["薪水", "獎金", "接案", "投資", "退款", "其他收入"],
};

const state = {
  transactions: [],
  filters: {
    month: "",
    type: "all",
    query: "",
  },
  summaryMonth: "",
  installPrompt: null,
};

const elements = {
  transactionForm: document.querySelector("#transactionForm"),
  transactionId: document.querySelector("#transactionId"),
  formTitle: document.querySelector("#formTitle"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  amountInput: document.querySelector("#amountInput"),
  categoryInput: document.querySelector("#categoryInput"),
  categoryOptions: document.querySelector("#categoryOptions"),
  dateInput: document.querySelector("#dateInput"),
  noteInput: document.querySelector("#noteInput"),
  summaryMonth: document.querySelector("#summaryMonth"),
  summaryTitle: document.querySelector("#summaryTitle"),
  balanceValue: document.querySelector("#balanceValue"),
  incomeValue: document.querySelector("#incomeValue"),
  expenseValue: document.querySelector("#expenseValue"),
  topCategoryValue: document.querySelector("#topCategoryValue"),
  transactionCountValue: document.querySelector("#transactionCountValue"),
  categoryChart: document.querySelector("#categoryChart"),
  filterMonth: document.querySelector("#filterMonth"),
  filterType: document.querySelector("#filterType"),
  filterQuery: document.querySelector("#filterQuery"),
  clearFiltersButton: document.querySelector("#clearFiltersButton"),
  transactionList: document.querySelector("#transactionList"),
  transactionItemTemplate: document.querySelector("#transactionItemTemplate"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  importInput: document.querySelector("#importInput"),
  toast: document.querySelector("#toast"),
  installButton: document.querySelector("#installButton"),
};

let toastTimer = null;

bootstrap();

function bootstrap() {
  const today = new Date();
  const currentMonth = formatMonthInput(today);
  const todayDate = formatDateInput(today);

  state.summaryMonth = currentMonth;
  state.filters.month = currentMonth;

  elements.summaryMonth.value = currentMonth;
  elements.filterMonth.value = currentMonth;
  elements.dateInput.value = todayDate;

  state.transactions = loadTransactions();
  hydrateSettings();

  renderCategoryOptions();
  attachEventListeners();
  render();
  registerServiceWorker();
}

function attachEventListeners() {
  elements.transactionForm.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", resetForm);

  elements.summaryMonth.addEventListener("input", (event) => {
    state.summaryMonth = event.target.value;
    persistSettings();
    renderSummary();
  });

  elements.filterMonth.addEventListener("input", (event) => {
    state.filters.month = event.target.value;
    persistSettings();
    renderTransactions();
  });

  elements.filterType.addEventListener("change", (event) => {
    state.filters.type = event.target.value;
    persistSettings();
    renderTransactions();
  });

  elements.filterQuery.addEventListener("input", (event) => {
    state.filters.query = event.target.value.trim();
    persistSettings();
    renderTransactions();
  });

  elements.clearFiltersButton.addEventListener("click", () => {
    state.filters.month = "";
    state.filters.type = "all";
    state.filters.query = "";
    elements.filterMonth.value = "";
    elements.filterType.value = "all";
    elements.filterQuery.value = "";
    persistSettings();
    renderTransactions();
  });

  elements.exportJsonButton.addEventListener("click", exportJson);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.importInput.addEventListener("change", importJson);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    elements.installButton.hidden = false;
  });

  elements.installButton.addEventListener("click", async () => {
    if (!state.installPrompt) {
      showToast("目前這台裝置沒有出現安裝提示");
      return;
    }

    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    elements.installButton.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    elements.installButton.hidden = true;
    showToast("已安裝到主畫面");
  });
}

function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.transactionForm);
  const type = formData.get("type");
  const amount = Number(elements.amountInput.value);
  const category = elements.categoryInput.value.trim();
  const date = elements.dateInput.value;
  const note = elements.noteInput.value.trim();
  const existingId = elements.transactionId.value;

  if (!amount || amount <= 0) {
    showToast("請輸入正確金額");
    elements.amountInput.focus();
    return;
  }

  if (!category) {
    showToast("請輸入分類");
    elements.categoryInput.focus();
    return;
  }

  if (!date) {
    showToast("請選擇日期");
    elements.dateInput.focus();
    return;
  }

  const payload = {
    id: existingId || createId(),
    type,
    amount,
    category,
    date,
    note,
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = state.transactions.findIndex((item) => item.id === payload.id);

  if (existingIndex >= 0) {
    state.transactions[existingIndex] = {
      ...state.transactions[existingIndex],
      ...payload,
    };
    showToast("紀錄已更新");
  } else {
    state.transactions.unshift({
      ...payload,
      createdAt: new Date().toISOString(),
    });
    showToast("已新增記錄");
  }

  saveTransactions();
  renderCategoryOptions();
  render();
  resetForm();
}

function render() {
  renderSummary();
  renderTransactions();
}

function renderSummary() {
  const summaryMonth = state.summaryMonth;
  const items = filterByMonth(state.transactions, summaryMonth);
  const income = sumAmounts(items.filter((item) => item.type === "income"));
  const expense = sumAmounts(items.filter((item) => item.type === "expense"));
  const balance = income - expense;
  const expenseByCategory = groupExpenseByCategory(items);
  const topCategory = expenseByCategory[0];

  elements.summaryTitle.textContent = summaryMonth
    ? formatMonthLabel(summaryMonth)
    : "全部月份";
  elements.balanceValue.textContent = formatCurrency(balance);
  elements.incomeValue.textContent = formatCurrency(income);
  elements.expenseValue.textContent = formatCurrency(expense);
  elements.topCategoryValue.textContent = topCategory
    ? `${topCategory.category} ${formatCurrency(topCategory.total)}`
    : "暫無資料";
  elements.transactionCountValue.textContent = `${items.length} 筆`;

  renderCategoryChart(expenseByCategory, expense);
}

function renderTransactions() {
  const items = getFilteredTransactions();

  if (items.length === 0) {
    elements.transactionList.className = "transaction-list empty-state";
    elements.transactionList.textContent = "沒有符合目前篩選條件的資料";
    return;
  }

  elements.transactionList.className = "transaction-list";
  elements.transactionList.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const node = elements.transactionItemTemplate.content.cloneNode(true);
    const container = node.querySelector(".transaction-item");
    const category = node.querySelector(".transaction-category");
    const note = node.querySelector(".transaction-note");
    const amount = node.querySelector(".transaction-amount");
    const date = node.querySelector(".transaction-date");
    const badge = node.querySelector(".transaction-badge");
    const editButton = node.querySelector(".edit-button");
    const deleteButton = node.querySelector(".delete-button");

    category.textContent = item.category;
    note.textContent = item.note || "沒有備註";
    amount.textContent = `${item.type === "expense" ? "-" : "+"}${formatCurrency(item.amount)}`;
    amount.style.color = item.type === "expense" ? "var(--expense)" : "var(--income)";
    date.textContent = formatDisplayDate(item.date);
    badge.textContent = item.type === "expense" ? "支出" : "收入";
    badge.classList.add(item.type);

    editButton.addEventListener("click", () => startEdit(item.id));
    deleteButton.addEventListener("click", () => deleteTransaction(item.id));

    container.dataset.id = item.id;
    fragment.appendChild(node);
  }

  elements.transactionList.appendChild(fragment);
}

function renderCategoryOptions() {
  const customCategories = Array.from(
    new Set(state.transactions.map((item) => item.category.trim()).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right, "zh-Hant"));

  const allCategories = [
    ...DEFAULT_CATEGORIES.expense,
    ...DEFAULT_CATEGORIES.income,
    ...customCategories,
  ];

  const uniqueCategories = Array.from(new Set(allCategories));
  elements.categoryOptions.innerHTML = uniqueCategories
    .map((category) => `<option value="${escapeHtml(category)}"></option>`)
    .join("");
}

function renderCategoryChart(expenseByCategory, totalExpense) {
  if (!expenseByCategory.length || totalExpense <= 0) {
    elements.categoryChart.className = "chart-list empty-state-inline";
    elements.categoryChart.textContent = "本月還沒有支出紀錄";
    return;
  }

  elements.categoryChart.className = "chart-list";
  elements.categoryChart.innerHTML = "";

  const topFive = expenseByCategory.slice(0, 5);

  for (const item of topFive) {
    const row = document.createElement("article");
    row.className = "chart-row";

    const ratio = Math.max(6, Math.round((item.total / totalExpense) * 100));
    row.innerHTML = `
      <header>
        <strong>${escapeHtml(item.category)}</strong>
        <span>${formatCurrency(item.total)} (${Math.round((item.total / totalExpense) * 100)}%)</span>
      </header>
      <div class="chart-track">
        <div class="chart-fill" style="width: ${ratio}%"></div>
      </div>
    `;

    elements.categoryChart.appendChild(row);
  }
}

function getFilteredTransactions() {
  let items = [...state.transactions].sort((left, right) => right.date.localeCompare(left.date));

  items = filterByMonth(items, state.filters.month);

  if (state.filters.type !== "all") {
    items = items.filter((item) => item.type === state.filters.type);
  }

  if (state.filters.query) {
    const normalizedQuery = state.filters.query.toLowerCase();
    items = items.filter((item) =>
      `${item.category} ${item.note}`.toLowerCase().includes(normalizedQuery)
    );
  }

  return items;
}

function startEdit(id) {
  const item = state.transactions.find((entry) => entry.id === id);

  if (!item) {
    return;
  }

  elements.transactionId.value = item.id;
  elements.amountInput.value = String(item.amount);
  elements.categoryInput.value = item.category;
  elements.dateInput.value = item.date;
  elements.noteInput.value = item.note;
  elements.formTitle.textContent = "編輯記錄";
  elements.cancelEditButton.hidden = false;

  const radio = elements.transactionForm.querySelector(`input[name="type"][value="${item.type}"]`);
  if (radio) {
    radio.checked = true;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  elements.transactionId.value = "";
  elements.transactionForm.reset();
  elements.transactionForm.querySelector('input[name="type"][value="expense"]').checked = true;
  elements.dateInput.value = formatDateInput(new Date());
  elements.formTitle.textContent = "快速記一筆";
  elements.cancelEditButton.hidden = true;
}

function deleteTransaction(id) {
  const item = state.transactions.find((entry) => entry.id === id);

  if (!item) {
    return;
  }

  const confirmed = window.confirm(`確定刪除這筆${item.category}紀錄嗎？`);
  if (!confirmed) {
    return;
  }

  state.transactions = state.transactions.filter((entry) => entry.id !== id);
  saveTransactions();
  renderCategoryOptions();
  render();

  if (elements.transactionId.value === id) {
    resetForm();
  }

  showToast("紀錄已刪除");
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    transactions: state.transactions,
  };

  downloadFile(
    `ledger-backup-${formatDateInput(new Date())}.json`,
    JSON.stringify(payload, null, 2),
    "application/json"
  );
  showToast("已匯出 JSON 備份");
}

function exportCsv() {
  const header = ["日期", "類型", "分類", "金額", "備註"];
  const rows = state.transactions.map((item) => [
    item.date,
    item.type === "expense" ? "支出" : "收入",
    item.category,
    item.amount,
    item.note || "",
  ]);

  const csvContent = [header, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  downloadFile(
    `ledger-backup-${formatDateInput(new Date())}.csv`,
    `\uFEFF${csvContent}`,
    "text/csv;charset=utf-8"
  );
  showToast("已匯出 CSV");
}

async function importJson(event) {
  const [file] = event.target.files || [];

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const transactions = Array.isArray(parsed) ? parsed : parsed.transactions;

    if (!Array.isArray(transactions)) {
      throw new Error("invalid-format");
    }

    const normalized = transactions
      .map(normalizeTransaction)
      .filter(Boolean)
      .sort((left, right) => right.date.localeCompare(left.date));

    state.transactions = normalized;
    saveTransactions();
    renderCategoryOptions();
    render();
    resetForm();
    showToast("匯入完成");
  } catch (error) {
    console.error(error);
    showToast("匯入失敗，請確認 JSON 格式");
  } finally {
    event.target.value = "";
  }
}

function normalizeTransaction(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const amount = Number(item.amount);
  if (!item.type || !item.category || !item.date || !amount) {
    return null;
  }

  return {
    id: item.id || createId(),
    type: item.type === "income" ? "income" : "expense",
    amount,
    category: String(item.category).trim(),
    date: String(item.date).slice(0, 10),
    note: String(item.note || "").trim(),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
  };
}

function filterByMonth(items, month) {
  if (!month) {
    return items;
  }

  return items.filter((item) => item.date.startsWith(month));
}

function groupExpenseByCategory(items) {
  const totals = new Map();

  for (const item of items) {
    if (item.type !== "expense") {
      continue;
    }

    totals.set(item.category, (totals.get(item.category) || 0) + item.amount);
  }

  return Array.from(totals.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((left, right) => right.total - left.total);
}

function sumAmounts(items) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

function loadTransactions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeTransaction).filter(Boolean) : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
}

function hydrateSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return;
    }

    const settings = JSON.parse(raw);
    if (typeof settings !== "object" || !settings) {
      return;
    }

    state.summaryMonth = settings.summaryMonth || state.summaryMonth;
    state.filters.month = settings.filters?.month ?? state.filters.month;
    state.filters.type = settings.filters?.type || state.filters.type;
    state.filters.query = settings.filters?.query || state.filters.query;

    elements.summaryMonth.value = state.summaryMonth;
    elements.filterMonth.value = state.filters.month;
    elements.filterType.value = state.filters.type;
    elements.filterQuery.value = state.filters.query;
  } catch (error) {
    console.error(error);
  }
}

function persistSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      summaryMonth: state.summaryMonth,
      filters: state.filters,
    })
  );
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("service worker register failed", error);
    });
  });
}

function downloadFile(filename, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2200);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDisplayDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-TW", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatMonthLabel(value) {
  const [year, month] = value.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

function formatMonthInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
