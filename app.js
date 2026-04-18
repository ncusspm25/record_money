import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const STORAGE_KEY = "pocket-ledger-transactions";
const SETTINGS_KEY = "pocket-ledger-settings";

const DEFAULT_CATEGORIES = {
  expense: ["餐飲", "交通", "日用品", "雜費", "娛樂", "自訂分類"],
  income: ["薪水", "獎金", "接案", "投資", "退款", "其他收入", "自訂分類"],
};

const state = {
  transactions: [],
  localTransactions: [],
  filters: {
    month: "",
    type: "all",
    query: "",
  },
  summaryMonth: "",
  installPrompt: null,
  user: null,
  syncMode: "local",
  syncError: "",
  firebaseReady: false,
  firebase: null,
  unsubscribeTransactions: null,
};

const elements = {
  transactionForm: document.querySelector("#transactionForm"),
  transactionId: document.querySelector("#transactionId"),
  formTitle: document.querySelector("#formTitle"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  saveButton: document.querySelector("#saveButton"),
  amountInput: document.querySelector("#amountInput"),
  categorySelect: document.querySelector("#categorySelect"),
  customCategoryField: document.querySelector("#customCategoryField"),
  customCategoryInput: document.querySelector("#customCategoryInput"),
  needWantField: document.querySelector("#needWantField"),
  needWantSelect: document.querySelector("#needWantSelect"),
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
  syncModeBadge: document.querySelector("#syncModeBadge"),
  accountStatus: document.querySelector("#accountStatus"),
  accountDetail: document.querySelector("#accountDetail"),
  accountHint: document.querySelector("#accountHint"),
  signInButton: document.querySelector("#signInButton"),
  signOutButton: document.querySelector("#signOutButton"),
  migrateButton: document.querySelector("#migrateButton"),
  backupNote: document.querySelector("#backupNote"),
};

let toastTimer = null;

void bootstrap();

async function bootstrap() {
  const today = new Date();
  const currentMonth = formatMonthInput(today);
  const todayDate = formatDateInput(today);

  state.summaryMonth = currentMonth;
  state.filters.month = currentMonth;

  elements.summaryMonth.value = currentMonth;
  elements.filterMonth.value = currentMonth;
  elements.dateInput.value = todayDate;

  state.localTransactions = loadLocalTransactions();
  state.transactions = [...state.localTransactions];
  hydrateSettings();

  attachEventListeners();
  renderCategoryOptions();
  updateCategoryVisibility();
  updateNeedWantVisibility();
  render();
  registerServiceWorker();
  await initFirebase();
}

function attachEventListeners() {
  elements.transactionForm.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.categorySelect.addEventListener("change", updateCategoryVisibility);

  for (const radio of elements.transactionForm.querySelectorAll('input[name="type"]')) {
    radio.addEventListener("change", () => {
      renderCategoryOptions();
      updateCategoryVisibility();
      updateNeedWantVisibility();
    });
  }

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
  elements.signInButton.addEventListener("click", handleGoogleSignIn);
  elements.signOutButton.addEventListener("click", handleSignOut);
  elements.migrateButton.addEventListener("click", migrateLocalToCloud);

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

async function initFirebase() {
  if (!isFirebaseConfigured(firebaseConfig)) {
    state.syncMode = "config-missing";
    renderAuthPanel();
    return;
  }

  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    await setPersistence(auth, browserLocalPersistence);

    state.firebaseReady = true;
    state.firebase = { app, auth, db, provider };
    state.syncMode = "signed-out";
    renderAuthPanel();

    getRedirectResult(auth).catch((error) => {
      console.error(error);
      state.syncMode = "signed-out";
      renderAuthPanel();
      showToast(getAuthErrorMessage(error));
    });

    onAuthStateChanged(auth, (user) => {
      if (state.unsubscribeTransactions) {
        state.unsubscribeTransactions();
        state.unsubscribeTransactions = null;
      }

      state.user = user;

      if (!user) {
        state.syncMode = "signed-out";
        state.transactions = [...state.localTransactions];
        renderCategoryOptions();
        render();
        renderAuthPanel();
        return;
      }

      state.syncMode = "syncing";
      renderAuthPanel();
      subscribeToCloudTransactions(user.uid);
    });
  } catch (error) {
    console.error(error);
    state.syncMode = "error";
    state.syncError = stringifyError(error);
    renderAuthPanel();
    showToast("Firebase 初始化失敗");
  }
}

function subscribeToCloudTransactions(uid) {
  if (!state.firebase) {
    return;
  }

  const transactionsRef = collection(state.firebase.db, "users", uid, "transactions");

  state.unsubscribeTransactions = onSnapshot(
    transactionsRef,
    (snapshot) => {
      state.transactions = snapshot.docs
        .map((entry) => normalizeTransaction({ id: entry.id, ...entry.data() }))
        .filter(Boolean)
        .sort(compareTransactions);

      state.syncMode = "cloud";
      renderCategoryOptions();
      render();
      renderAuthPanel();
    },
    (error) => {
      console.error(error);
      state.syncMode = "error";
      state.syncError = stringifyError(error);
      renderAuthPanel();
      showToast("雲端同步失敗");
    }
  );
}

async function handleGoogleSignIn() {
  if (!state.firebaseReady || !state.firebase) {
    showToast("請先把 firebase-config.js 換成你的 Firebase 設定");
    return;
  }

  try {
    state.syncMode = "signing-in";
    renderAuthPanel();

    await signInWithPopup(state.firebase.auth, state.firebase.provider);
  } catch (error) {
    console.error(error);
    state.syncMode = state.user ? "cloud" : "signed-out";
    renderAuthPanel();
    showToast(getAuthErrorMessage(error));
  }
}

async function handleSignOut() {
  if (!state.firebase?.auth) {
    return;
  }

  try {
    await signOut(state.firebase.auth);
    showToast("已登出 Google 帳號");
  } catch (error) {
    console.error(error);
    showToast("登出失敗");
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.transactionForm);
  const type = formData.get("type");
  const amount = Number(elements.amountInput.value);
  const category = getSelectedCategory();
  const date = elements.dateInput.value;
  const note = elements.noteInput.value.trim();
  const needWant = type === "expense" ? elements.needWantSelect.value : "";
  const existingId = elements.transactionId.value;
  const existing = state.transactions.find((item) => item.id === existingId);

  if (!amount || amount <= 0) {
    showToast("請輸入正確金額");
    elements.amountInput.focus();
    return;
  }

  if (!category) {
    showToast("請輸入分類");
    if (elements.categorySelect.value === "自訂分類") {
      elements.customCategoryInput.focus();
    } else {
      elements.categorySelect.focus();
    }
    return;
  }

  if (!date) {
    showToast("請選擇日期");
    elements.dateInput.focus();
    return;
  }

  const payload = {
    id: existingId || createId(),
    type: type === "income" ? "income" : "expense",
    amount,
    category,
    needWant,
    date,
    note,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  elements.saveButton.disabled = true;

  try {
    await saveTransaction(payload);
    renderCategoryOptions();
    render();
    resetForm();
    showToast(existing ? "紀錄已更新" : "已新增記錄");
  } catch (error) {
    console.error(error);
    showToast(state.user ? "雲端儲存失敗" : "本機儲存失敗");
  } finally {
    elements.saveButton.disabled = false;
  }
}

async function saveTransaction(transaction) {
  const normalized = normalizeTransaction(transaction);
  if (!normalized) {
    throw new Error("invalid-transaction");
  }

  if (isCloudMode()) {
    await saveTransactionToCloud(normalized);
    return;
  }

  saveTransactionToLocal(normalized);
}

function saveTransactionToLocal(transaction) {
  const nextTransactions = [...state.localTransactions];
  const existingIndex = nextTransactions.findIndex((item) => item.id === transaction.id);

  if (existingIndex >= 0) {
    nextTransactions[existingIndex] = transaction;
  } else {
    nextTransactions.unshift(transaction);
  }

  nextTransactions.sort(compareTransactions);
  state.localTransactions = nextTransactions;
  state.transactions = [...nextTransactions];
  saveLocalTransactions();
}

async function saveTransactionToCloud(transaction) {
  if (!state.firebase?.db || !state.user?.uid) {
    throw new Error("cloud-not-ready");
  }

  const transactionRef = doc(state.firebase.db, "users", state.user.uid, "transactions", transaction.id);
  await setDoc(transactionRef, transaction);
}

function render() {
  renderSummary();
  renderTransactions();
  renderAuthPanel();
  renderBackupNote();
}

function renderSummary() {
  const items = filterByMonth(state.transactions, state.summaryMonth);
  const income = sumAmounts(items.filter((item) => item.type === "income"));
  const expense = sumAmounts(items.filter((item) => item.type === "expense"));
  const balance = income - expense;
  const expenseByCategory = groupExpenseByCategory(items);
  const topCategory = expenseByCategory[0];

  elements.summaryTitle.textContent = state.summaryMonth
    ? formatMonthLabel(state.summaryMonth)
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
    const category = node.querySelector(".transaction-category");
    const note = node.querySelector(".transaction-note");
    const amount = node.querySelector(".transaction-amount");
    const date = node.querySelector(".transaction-date");
    const badge = node.querySelector(".transaction-badge");
    const secondaryBadge = node.querySelector(".transaction-badge-secondary");
    const editButton = node.querySelector(".edit-button");
    const deleteButton = node.querySelector(".delete-button");

    category.textContent = item.category;
    note.textContent = item.note || "沒有備註";
    amount.textContent = `${item.type === "expense" ? "-" : "+"}${formatCurrency(item.amount)}`;
    amount.style.color = item.type === "expense" ? "var(--expense)" : "var(--income)";
    date.textContent = formatDisplayDate(item.date);
    badge.textContent = item.type === "expense" ? "支出" : "收入";
    badge.classList.add(item.type);
    if (item.type === "expense" && item.needWant) {
      secondaryBadge.hidden = false;
      secondaryBadge.textContent = item.needWant === "want" ? "想要" : "需要";
      secondaryBadge.classList.toggle("want", item.needWant === "want");
      secondaryBadge.classList.toggle("need", item.needWant !== "want");
    } else {
      secondaryBadge.hidden = true;
      secondaryBadge.textContent = "";
      secondaryBadge.classList.remove("want", "need");
    }

    editButton.addEventListener("click", () => startEdit(item.id));
    deleteButton.addEventListener("click", () => void deleteTransaction(item.id));

    fragment.appendChild(node);
  }

  elements.transactionList.appendChild(fragment);
}

function renderCategoryOptions() {
  const type = getCurrentType();
  const categories = DEFAULT_CATEGORIES[type];
  const selected = elements.categorySelect.value;
  elements.categorySelect.innerHTML = [
    '<option value="">請選擇分類</option>',
    ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
  ].join("");

  if (categories.includes(selected)) {
    elements.categorySelect.value = selected;
  } else if (!selected && categories.includes("餐飲") && type === "expense") {
    elements.categorySelect.value = "餐飲";
  }
}

function renderCategoryChart(expenseByCategory, totalExpense) {
  if (!expenseByCategory.length || totalExpense <= 0) {
    elements.categoryChart.className = "chart-list empty-state-inline";
    elements.categoryChart.textContent = "本月還沒有支出紀錄";
    return;
  }

  elements.categoryChart.className = "chart-list";
  elements.categoryChart.innerHTML = "";

  for (const item of expenseByCategory.slice(0, 5)) {
    const row = document.createElement("article");
    row.className = "chart-row";

    const percent = Math.round((item.total / totalExpense) * 100);
    row.innerHTML = `
      <header>
        <strong>${escapeHtml(item.category)}</strong>
        <span>${formatCurrency(item.total)} (${percent}%)</span>
      </header>
      <div class="chart-track">
        <div class="chart-fill" style="width: ${Math.max(6, percent)}%"></div>
      </div>
    `;

    elements.categoryChart.appendChild(row);
  }
}

function renderAuthPanel() {
  const meta = getSyncModeMeta();

  elements.syncModeBadge.textContent = meta.badge;
  elements.syncModeBadge.className = `mode-badge ${meta.variant}`;
  elements.accountStatus.textContent = meta.status;
  elements.accountDetail.textContent = meta.detail;
  elements.accountHint.textContent = meta.hint;
  elements.signInButton.hidden = meta.hideSignIn;
  elements.signOutButton.hidden = meta.hideSignOut;
  elements.migrateButton.hidden = meta.hideMigrate;

  if (!meta.hideMigrate) {
    elements.migrateButton.textContent = `把本機 ${state.localTransactions.length} 筆資料同步到雲端`;
  }
}

function renderBackupNote() {
  if (isCloudMode()) {
    elements.backupNote.textContent = "目前已登入 Google，資料會同步到你自己的 Firestore。仍建議偶爾匯出 JSON 做額外備份。";
    return;
  }

  elements.backupNote.textContent = "目前資料保存在本機瀏覽器。建議定期匯出 JSON 備份。";
}

function getSyncModeMeta() {
  const email = state.user?.email || "你的 Google 帳號";
  const hasLocalBackup = state.localTransactions.length > 0;

  switch (state.syncMode) {
    case "config-missing":
      return {
        badge: "待設定 Firebase",
        variant: "warning",
        status: "目前是本機模式。",
        detail: "設定 Firebase 後可啟用 Google 登入與雲端同步。",
        hint: "公開網址公開的是程式，不是你的資料。",
        hideSignIn: false,
        hideSignOut: true,
        hideMigrate: true,
      };
    case "signing-in":
      return {
        badge: "登入中",
        variant: "warning",
        status: "正在開啟 Google 登入視窗。",
        detail: "若瀏覽器擋住彈出視窗，請允許後再重試。",
        hint: "如果登入失敗，請檢查 Google provider、授權網域，或瀏覽器是否阻擋彈出視窗。",
        hideSignIn: false,
        hideSignOut: true,
        hideMigrate: true,
      };
    case "syncing":
      return {
        badge: "同步中",
        variant: "warning",
        status: `已登入 ${email}`,
        detail: "正在讀取你的 Firestore 資料。",
        hint: hasLocalBackup ? "這台裝置有舊資料時，可再按同步本機資料。" : "資料會以你的 Firebase 帳號隔離保存。",
        hideSignIn: true,
        hideSignOut: false,
        hideMigrate: !hasLocalBackup,
      };
    case "cloud":
      return {
        badge: "雲端模式",
        variant: "cloud",
        status: `已登入 ${email}`,
        detail: "資料會同步到你的 Firestore。",
        hint: hasLocalBackup ? "如需合併這台裝置的舊資料，可按同步本機資料。" : "換手機後用同一個 Google 帳號登入即可看到同一份資料。",
        hideSignIn: true,
        hideSignOut: false,
        hideMigrate: !hasLocalBackup,
      };
    case "error":
      return {
        badge: "同步失敗",
        variant: "error",
        status: "目前無法完成同步。",
        detail: state.syncError || "請檢查 Firebase config、Google provider、Firestore 與授權網域設定。",
        hint: "你仍可先使用本機模式。",
        hideSignIn: false,
        hideSignOut: !state.user,
        hideMigrate: true,
      };
    case "signed-out":
      return {
        badge: "本機模式",
        variant: "local",
        status: "目前尚未登入。",
        detail: "資料只會存在這台裝置的瀏覽器裡。",
        hint: hasLocalBackup ? "登入後可把這台裝置的本機資料同步到雲端。" : "若只想單機使用，也可以不登入。",
        hideSignIn: false,
        hideSignOut: true,
        hideMigrate: true,
      };
    default:
      return {
        badge: "本機模式",
        variant: "local",
        status: "目前尚未登入，資料只會存在這台裝置的瀏覽器裡。",
        detail: "登入 Google 後會切換到 Firestore 雲端模式。",
        hint: "若你只想單機使用，也可以不登入。",
        hideSignIn: false,
        hideSignOut: true,
        hideMigrate: true,
      };
  }
}

function getFilteredTransactions() {
  let items = [...state.transactions].sort(compareTransactions);

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
  elements.dateInput.value = item.date;
  elements.noteInput.value = item.note;
  elements.formTitle.textContent = "編輯記錄";
  elements.cancelEditButton.hidden = false;

  const radio = elements.transactionForm.querySelector(`input[name="type"][value="${item.type}"]`);
  if (radio) {
    radio.checked = true;
  }

  renderCategoryOptions();
  if (DEFAULT_CATEGORIES[item.type].includes(item.category)) {
    elements.categorySelect.value = item.category;
    elements.customCategoryInput.value = "";
  } else {
    elements.categorySelect.value = "自訂分類";
    elements.customCategoryInput.value = item.category;
  }

  elements.needWantSelect.value = item.needWant === "want" ? "want" : "need";
  updateCategoryVisibility();
  updateNeedWantVisibility();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  elements.transactionId.value = "";
  elements.transactionForm.reset();
  elements.transactionForm.querySelector('input[name="type"][value="expense"]').checked = true;
  elements.dateInput.value = formatDateInput(new Date());
  elements.formTitle.textContent = "快速記一筆";
  elements.cancelEditButton.hidden = true;
  elements.needWantSelect.value = "need";
  renderCategoryOptions();
  updateCategoryVisibility();
  updateNeedWantVisibility();
}

async function deleteTransaction(id) {
  const item = state.transactions.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  const confirmed = window.confirm(`確定刪除這筆「${item.category}」紀錄嗎？`);
  if (!confirmed) {
    return;
  }

  try {
    if (isCloudMode()) {
      if (!state.firebase?.db || !state.user?.uid) {
        throw new Error("cloud-not-ready");
      }
      await deleteDoc(doc(state.firebase.db, "users", state.user.uid, "transactions", id));
    } else {
      state.localTransactions = state.localTransactions.filter((entry) => entry.id !== id);
      state.transactions = [...state.localTransactions];
      saveLocalTransactions();
      renderCategoryOptions();
      render();
    }

    if (elements.transactionId.value === id) {
      resetForm();
    }

    showToast("紀錄已刪除");
  } catch (error) {
    console.error(error);
    showToast(isCloudMode() ? "刪除雲端資料失敗" : "刪除本機資料失敗");
  }
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    mode: isCloudMode() ? "cloud" : "local",
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
  const header = ["日期", "類型", "分類", "需要或想要", "金額", "備註"];
  const rows = state.transactions.map((item) => [
    item.date,
    item.type === "expense" ? "支出" : "收入",
    item.category,
    item.needWant === "want" ? "想要" : item.needWant === "need" ? "需要" : "",
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
      .sort(compareTransactions);

    if (isCloudMode()) {
      await importTransactionsToCloud(normalized);
      showToast("已匯入到 Firestore");
    } else {
      state.localTransactions = normalized;
      state.transactions = [...normalized];
      saveLocalTransactions();
      renderCategoryOptions();
      render();
      resetForm();
      showToast("已匯入到本機");
    }
  } catch (error) {
    console.error(error);
    showToast("匯入失敗，請確認 JSON 格式");
  } finally {
    event.target.value = "";
  }
}

async function importTransactionsToCloud(transactions) {
  if (!state.firebase?.db || !state.user?.uid) {
    throw new Error("cloud-not-ready");
  }

  const batch = writeBatch(state.firebase.db);

  for (const transaction of transactions) {
    const transactionRef = doc(
      state.firebase.db,
      "users",
      state.user.uid,
      "transactions",
      transaction.id
    );
    batch.set(transactionRef, transaction);
  }

  await batch.commit();
}

async function migrateLocalToCloud() {
  if (!state.localTransactions.length) {
    showToast("這台裝置目前沒有本機資料");
    return;
  }

  if (!isCloudMode()) {
    showToast("請先登入 Google 再同步到 Firestore");
    return;
  }

  try {
    await importTransactionsToCloud(state.localTransactions);
    showToast("本機資料已同步到雲端");
  } catch (error) {
    console.error(error);
    showToast("同步本機資料到雲端失敗");
  }
}

function normalizeTransaction(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const amount = Number(item.amount);
  const type = item.type === "income" ? "income" : "expense";
  const category = String(item.category || "").trim();
  const date = String(item.date || "").slice(0, 10);

  if (!amount || amount <= 0 || !category || !date) {
    return null;
  }

  return {
    id: String(item.id || createId()),
    type,
    amount,
    category,
    needWant: type === "expense" ? (item.needWant === "want" ? "want" : "need") : "",
    date,
    note: String(item.note || "").trim(),
    createdAt: String(item.createdAt || new Date().toISOString()),
    updatedAt: String(item.updatedAt || new Date().toISOString()),
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

function loadLocalTransactions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeTransaction).filter(Boolean) : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

function saveLocalTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.localTransactions));
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
  }, 2400);
}

function isCloudMode() {
  return state.syncMode === "cloud" || state.syncMode === "syncing";
}

function isFirebaseConfigured(config) {
  const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];
  return requiredKeys.every((key) => {
    const value = String(config?.[key] || "").trim();
    return value && !value.startsWith("YOUR_");
  });
}

function compareTransactions(left, right) {
  const dateCompare = right.date.localeCompare(left.date);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
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

function getCurrentType() {
  return elements.transactionForm.querySelector('input[name="type"]:checked')?.value === "income"
    ? "income"
    : "expense";
}

function getSelectedCategory() {
  const selected = elements.categorySelect.value;
  if (selected === "自訂分類") {
    return elements.customCategoryInput.value.trim();
  }
  return selected.trim();
}

function updateCategoryVisibility() {
  const isCustom = elements.categorySelect.value === "自訂分類";
  elements.customCategoryField.hidden = !isCustom;
  if (!isCustom) {
    elements.customCategoryInput.value = "";
  }
}

function updateNeedWantVisibility() {
  const isExpense = getCurrentType() === "expense";
  elements.needWantField.hidden = !isExpense;
  if (!isExpense) {
    elements.needWantSelect.value = "need";
  }
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function stringifyError(error) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error.code) {
    return `${error.code}: ${error.message || ""}`.trim();
  }

  return error.message || String(error);
}

function getAuthErrorMessage(error) {
  const code = error?.code || "";

  switch (code) {
    case "auth/unauthorized-domain":
      return "登入失敗：請到 Firebase Authentication 的授權網域加入 ncusspm25.github.io";
    case "auth/operation-not-allowed":
      return "登入失敗：Firebase Authentication 裡的 Google 登入尚未啟用";
    case "auth/popup-blocked":
      return "登入失敗：瀏覽器擋住了 Google 登入視窗，請允許彈出視窗後重試";
    case "auth/popup-closed-by-user":
      return "登入已取消：Google 登入視窗被關閉";
    case "auth/cancelled-popup-request":
      return "登入中斷：有另一個登入視窗正在處理";
    default:
      return `登入失敗：${stringifyError(error) || "請檢查 Firebase Authentication 設定"}`;
  }
}
