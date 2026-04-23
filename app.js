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

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_PETS = 6;

const PET_RELEASES = [
  {
    id: "pet-2026-04-charmander",
    month: "2026-04",
    badge: "4 月限定夥伴",
    image: "assets/dragons/dragon-stage-1.png",
    stages: [
      { minDays: 0, name: "小火火", hp: 50, atk: 20, def: 10, level: 14 },
      { minDays: 15, name: "火龍", hp: 108, atk: 52, def: 36, level: 26 },
      { minDays: 30, name: "火焰飛龍", hp: 168, atk: 92, def: 64, level: 38 },
    ],
  },
  {
    id: "pet-2026-05-turtwig",
    month: "2026-05",
    badge: "5 月限定夥伴",
    image: "assets/pets/pet-2026-05-grass.png",
    stages: [
      { minDays: 0, name: "芽芽龜", hp: 72, atk: 48, def: 65, level: 18 },
      { minDays: 15, name: "森甲龜", hp: 118, atk: 68, def: 94, level: 29 },
      { minDays: 30, name: "蒼岳靈龜", hp: 182, atk: 86, def: 128, level: 40 },
    ],
  },
  {
    id: "pet-2026-06-greninja",
    month: "2026-06",
    badge: "6 月限定夥伴",
    image: "assets/pets/pet-2026-06-frog.png",
    stages: [
      { minDays: 0, name: "泡影忍蛙", hp: 88, atk: 95, def: 67, level: 24 },
      { minDays: 15, name: "影躍忍蛙", hp: 126, atk: 118, def: 80, level: 34 },
      { minDays: 30, name: "霜影蛙王", hp: 176, atk: 148, def: 96, level: 44 },
    ],
  },
];

const NEXT_PET_PLACEHOLDER = {
  month: "2026-07",
  name: "待公布",
};

const CELEBRATION_IMAGES = [
  "assets/celebration/celebrate-yuanbao.png",
];

const state = {
  transactions: [],
  localTransactions: [],
  petTeamOrder: [],
  equippedPetId: "",
  petDockCollapsed: false,
  activeTab: "quick",
  filters: {
    date: "",
    type: "all",
    query: "",
    listLimit: 50,
  },
  summaryMonth: "",
  monthlyBudget: 0,
  installPrompt: null,
  user: null,
  syncMode: "initializing",
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
  dateInput: document.querySelector("#dateInput"),
  noteInput: document.querySelector("#noteInput"),
  todayRecordCountValue: document.querySelector("#todayRecordCountValue"),
  todayExpenseValue: document.querySelector("#todayExpenseValue"),
  dragonCompanionCard: document.querySelector("#dragonCompanionCard"),
  dragonStageImage: document.querySelector("#dragonStageImage"),
  dragonStageName: document.querySelector("#dragonStageName"),
  dragonStageBadge: document.querySelector("#dragonStageBadge"),
  dragonStageHint: document.querySelector("#dragonStageHint"),
  dragonStreakValue: document.querySelector("#dragonStreakValue"),
  dragonMilestoneValue: document.querySelector("#dragonMilestoneValue"),
  dragonProgressFill: document.querySelector("#dragonProgressFill"),
  dragonProgressText: document.querySelector("#dragonProgressText"),
  dragonStatHp: document.querySelector("#dragonStatHp"),
  dragonStatAtk: document.querySelector("#dragonStatAtk"),
  dragonStatDef: document.querySelector("#dragonStatDef"),
  dragonStatLevel: document.querySelector("#dragonStatLevel"),
  copyLastButton: document.querySelector("#copyLastButton"),
  monthlyBudgetInput: document.querySelector("#monthlyBudgetInput"),
  budgetProgressWrap: document.querySelector("#budgetProgressWrap"),
  budgetProgressFill: document.querySelector("#budgetProgressFill"),
  budgetProgressText: document.querySelector("#budgetProgressText"),
  summaryInProgressBadge: document.querySelector("#summaryInProgressBadge"),
  loadMoreButton: document.querySelector("#loadMoreButton"),
  petCurrentMonth: document.querySelector("#petCurrentMonth"),
  petSelect: document.querySelector("#petSelect"),
  petCollectionCount: document.querySelector("#petCollectionCount"),
  petTeamCount: document.querySelector("#petTeamCount"),
  petBoxCount: document.querySelector("#petBoxCount"),
  petTeamList: document.querySelector("#petTeamList"),
  petBoxList: document.querySelector("#petBoxList"),
  petDock: document.querySelector("#petDock"),
  petDockTitle: document.querySelector("#petDockTitle"),
  petDockCount: document.querySelector("#petDockCount"),
  petDockList: document.querySelector("#petDockList"),
  petDockToggle: document.querySelector("#petDockToggle"),
  summaryMonth: document.querySelector("#summaryMonth"),
  summaryTitle: document.querySelector("#summaryTitle"),
  balanceValue: document.querySelector("#balanceValue"),
  incomeValue: document.querySelector("#incomeValue"),
  expenseValue: document.querySelector("#expenseValue"),
  topCategoryValue: document.querySelector("#topCategoryValue"),
  transactionCountValue: document.querySelector("#transactionCountValue"),
  needSpendValue: document.querySelector("#needSpendValue"),
  wantSpendValue: document.querySelector("#wantSpendValue"),
  largestExpenseValue: document.querySelector("#largestExpenseValue"),
  averageExpenseValue: document.querySelector("#averageExpenseValue"),
  monthlyPulseValue: document.querySelector("#monthlyPulseValue"),
  categoryChart: document.querySelector("#categoryChart"),
  pieChartEmpty: document.querySelector("#pieChartEmpty"),
  filterDate: document.querySelector("#filterDate"),
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
  installBadge: document.querySelector("#installBadge"),
  installDescription: document.querySelector("#installDescription"),
  installSteps: document.querySelector("#installSteps"),
  downloadShortcutButton: document.querySelector("#downloadShortcutButton"),
  syncModeBadge: document.querySelector("#syncModeBadge"),
  accountStatus: document.querySelector("#accountStatus"),
  accountDetail: document.querySelector("#accountDetail"),
  accountHint: document.querySelector("#accountHint"),
  signInButton: document.querySelector("#signInButton"),
  signOutButton: document.querySelector("#signOutButton"),
  migrateButton: document.querySelector("#migrateButton"),
  backupNote: document.querySelector("#backupNote"),
  tabButtons: Array.from(document.querySelectorAll("[data-tab-target]")),
  tabPages: Array.from(document.querySelectorAll("[data-tab-page]")),
  installTriggers: Array.from(document.querySelectorAll("[data-install-trigger]")),
};

let toastTimer = null;
let firebaseInitPromise = null;

void bootstrap();

async function bootstrap() {
  const today = new Date();
  const currentMonth = formatMonthInput(today);
  const todayDate = formatDateInput(today);
  const initialTab = getInitialTabFromUrl();

  state.summaryMonth = currentMonth;
  state.filters.date = "";
  if (initialTab) {
    state.activeTab = initialTab;
  }

  elements.summaryMonth.value = currentMonth;
  elements.filterDate.value = "";
  elements.dateInput.value = todayDate;

  state.localTransactions = loadLocalTransactions();
  state.transactions = [...state.localTransactions];
  hydrateSettings();

  // Always land on quick entry when opening the app unless a tab is explicitly requested in the URL.
  state.activeTab = initialTab || "quick";

  attachEventListeners();
  renderCategoryOptions();
  updateCategoryVisibility();
  updateNeedWantVisibility();
  updateNeedWantToggle();
  render();
  applyActiveTab();
  registerServiceWorker();
  firebaseInitPromise = initFirebase();
  await firebaseInitPromise;
}

function attachEventListeners() {
  elements.transactionForm.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.categorySelect.addEventListener("change", updateCategoryVisibility);
  for (const tabButton of elements.tabButtons) {
    tabButton.addEventListener("click", () => {
      setActiveTab(tabButton.dataset.tabTarget || "quick");
    });
  }

  for (const radio of elements.transactionForm.querySelectorAll('input[name="type"]')) {
    radio.addEventListener("change", () => {
      renderCategoryOptions();
      updateCategoryVisibility();
      updateNeedWantVisibility();
    });
  }

  for (const radio of elements.needWantField.querySelectorAll('input[name="needWant"]')) {
    radio.addEventListener("change", () => updateNeedWantToggle());
  }

  elements.amountInput.addEventListener("input", () => {
    const v = Number(elements.amountInput.value);
    elements.amountInput.classList.toggle("is-invalid", elements.amountInput.value !== "" && v <= 0);
  });

  if (elements.copyLastButton) {
    elements.copyLastButton.addEventListener("click", copyLastEntry);
  }

  for (const btn of document.querySelectorAll("[data-quick-date]")) {
    btn.addEventListener("click", () => {
      const range = btn.dataset.quickDate;
      const today = formatDateInput(new Date());
      if (range === "today") {
        state.filters.date = today;
        elements.filterDate.value = today;
      } else if (range === "week") {
        const d = new Date(); d.setDate(d.getDate() - 6);
        state.filters.date = formatDateInput(d);
        elements.filterDate.value = state.filters.date;
      } else if (range === "month") {
        const d = new Date(); d.setDate(d.getDate() - 29);
        state.filters.date = formatDateInput(d);
        elements.filterDate.value = state.filters.date;
      }
      state.filters.listLimit = 50;
      persistSettings();
      renderTransactions();
    });
  }

  if (elements.monthlyBudgetInput) {
    elements.monthlyBudgetInput.addEventListener("input", () => {
      state.monthlyBudget = Math.max(0, Number(elements.monthlyBudgetInput.value) || 0);
      persistSettings();
      renderSummary();
    });
  }

  if (elements.loadMoreButton) {
    elements.loadMoreButton.addEventListener("click", () => {
      state.filters.listLimit += 50;
      renderTransactions();
    });
  }

  elements.summaryMonth.addEventListener("input", (event) => {
    state.summaryMonth = event.target.value;
    persistSettings();
    renderSummary();
  });

  elements.filterDate.addEventListener("input", (event) => {
    state.filters.date = event.target.value;
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
    state.filters.date = "";
    state.filters.type = "all";
    state.filters.query = "";
    state.filters.listLimit = 50;
    elements.filterDate.value = "";
    elements.filterType.value = "all";
    elements.filterQuery.value = "";
    persistSettings();
    renderTransactions();
  });

  elements.filterDate.addEventListener("change", () => { state.filters.listLimit = 50; });
  elements.filterType.addEventListener("change", () => { state.filters.listLimit = 50; });
  elements.filterQuery.addEventListener("input", () => { state.filters.listLimit = 50; });

  elements.exportJsonButton.addEventListener("click", exportJson);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.importInput.addEventListener("change", importJson);
  elements.signInButton.addEventListener("click", handleGoogleSignIn);
  elements.signOutButton.addEventListener("click", handleSignOut);
  elements.migrateButton.addEventListener("click", migrateLocalToCloud);
  elements.downloadShortcutButton?.addEventListener("click", downloadWindowsShortcut);
  elements.petSelect?.addEventListener("change", (event) => {
    setEquippedPet(event.target.value);
  });
  elements.petTeamList?.addEventListener("click", handlePetRosterClick);
  elements.petBoxList?.addEventListener("click", handlePetRosterClick);
  elements.petDockList?.addEventListener("click", handlePetRosterClick);
  elements.petDockToggle?.addEventListener("click", togglePetDockCollapsed);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    renderInstallExperience();
  });

  elements.installButton.addEventListener("click", async () => {
    await handleInstall();
  });

  for (const trigger of elements.installTriggers) {
    trigger.addEventListener("click", async () => {
      await handleInstall();
    });
  }

  window.addEventListener("appinstalled", () => {
    state.installPrompt = null;
    elements.installButton.hidden = true;
    renderInstallExperience();
    showToast("已安裝到主畫面");
  });

  const displayModeQuery = window.matchMedia?.("(display-mode: standalone)");
  displayModeQuery?.addEventListener?.("change", () => {
    renderInstallExperience();
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
      setTimeout(() => {
        if (state.syncMode === "syncing") {
          state.syncMode = "error";
          state.syncError = "連線逾時，請重新整理頁面。";
          renderAuthPanel();
        }
      }, 12000);
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
      showToast(getFirestoreErrorMessage(error));
    }
  );
}

async function handleGoogleSignIn() {
  if (firebaseInitPromise) {
    try {
      await firebaseInitPromise;
    } catch (error) {
      console.error(error);
    }
  }

  if (state.syncMode === "config-missing") {
    showToast("這個版本尚未載入 Firebase 設定，請重新整理後再試一次");
    return;
  }

  if (!state.firebaseReady || !state.firebase) {
    showToast("Firebase 還在初始化，請等一下再試");
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
  const needWant = type === "expense" ? (elements.needWantField.querySelector('input[name="needWant"]:checked')?.value || "need") : "";
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
  elements.saveButton.textContent = "儲存中…";
  const petRelease = PET_RELEASES.find((pet) => pet.month === payload.date.slice(0, 7));
  const previousPetStageName = petRelease
    ? decoratePetForMonth(petRelease, state.transactions).name
    : "";
  const nextTransactionsPreview = buildNextTransactionsPreview(payload, existingId);
  const nextPetStageName = petRelease
    ? decoratePetForMonth(petRelease, nextTransactionsPreview).name
    : "";

  try {
    await saveTransaction(payload);
    renderCategoryOptions();
    render();
    resetForm();
    if (!existing && petRelease && previousPetStageName !== nextPetStageName) {
      showToast(`${previousPetStageName} 進化成 ${nextPetStageName} 了！`);
    } else if (existing) {
      showToast("已更新這筆記錄");
    } else {
      showToast("已存下這筆記帳");
    }
    if (!existing) showCelebration();
  } catch (error) {
    console.error(error);
    showToast(state.user ? getFirestoreErrorMessage(error) : "本機儲存失敗");
  } finally {
    elements.saveButton.disabled = false;
    elements.saveButton.textContent = "儲存紀錄";
  }
}

function buildNextTransactionsPreview(payload, existingId) {
  const normalized = normalizeTransaction(payload);
  if (!normalized) {
    return [...state.transactions];
  }

  const nextItems = [...state.transactions];
  const existingIndex = nextItems.findIndex((item) => item.id === existingId);
  if (existingIndex >= 0) {
    nextItems[existingIndex] = normalized;
  } else {
    nextItems.push(normalized);
  }

  return nextItems;
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
  renderPetCompanion();
  renderQuickGlance();
  renderSummary();
  renderTransactions();
  renderAuthPanel();
  renderInstallExperience();
  renderBackupNote();
  applyActiveTab();
}

function renderSummary() {
  const items = filterByMonth(state.transactions, state.summaryMonth);
  const incomeItems = items.filter((item) => item.type === "income");
  const expenseItems = items.filter((item) => item.type === "expense");
  const income = sumAmounts(incomeItems);
  const expense = sumAmounts(expenseItems);
  const balance = income - expense;
  const expenseByCategory = groupExpenseByCategory(items);
  const topCategory = expenseByCategory[0];
  const needExpense = sumAmounts(expenseItems.filter((item) => item.needWant !== "want"));
  const wantExpense = sumAmounts(expenseItems.filter((item) => item.needWant === "want"));
  const largestExpense = [...expenseItems].sort((left, right) => right.amount - left.amount)[0];
  const averageExpense = expenseItems.length ? expense / expenseItems.length : 0;

  elements.summaryTitle.textContent = state.summaryMonth
    ? formatMonthLabel(state.summaryMonth)
    : "全部月份";

  const currentMonth = formatMonthInput(new Date());
  if (elements.summaryInProgressBadge) {
    elements.summaryInProgressBadge.hidden = state.summaryMonth !== currentMonth;
  }

  if (elements.budgetProgressWrap && elements.monthlyBudgetInput) {
    if (state.monthlyBudget > 0) {
      const pct = Math.min(100, Math.round((expense / state.monthlyBudget) * 100));
      elements.budgetProgressWrap.hidden = false;
      elements.budgetProgressFill.style.width = `${pct}%`;
      elements.budgetProgressFill.className = `budget-progress-fill${pct >= 100 ? " over-budget" : pct >= 80 ? " warn-budget" : ""}`;
      elements.budgetProgressText.textContent = `本月支出 ${formatCurrency(expense)} / 預算 ${formatCurrency(state.monthlyBudget)}（${pct}%）`;
    } else {
      elements.budgetProgressWrap.hidden = true;
    }
  }
  elements.balanceValue.textContent = formatCurrency(balance);
  elements.incomeValue.textContent = formatCurrency(income);
  elements.expenseValue.textContent = formatCurrency(expense);
  elements.topCategoryValue.textContent = topCategory
    ? `${topCategory.category} ${formatCurrency(topCategory.total)}`
    : "暫無資料";
  elements.transactionCountValue.textContent = `${items.length} 筆`;
  elements.needSpendValue.textContent = formatCurrency(needExpense);
  elements.wantSpendValue.textContent = formatCurrency(wantExpense);
  elements.largestExpenseValue.textContent = largestExpense
    ? `${largestExpense.category} ${formatCurrency(largestExpense.amount)}`
    : "暫無資料";
  elements.averageExpenseValue.textContent = formatCurrency(averageExpense);
  elements.monthlyPulseValue.textContent = getMonthlyPulse({
    income,
    expense,
    needExpense,
    wantExpense,
    expenseCount: expenseItems.length,
    topCategory,
  });

  renderCategoryChart(expenseByCategory, expense);
  renderPieChart(expenseByCategory, expense);
}

function renderTransactions() {
  const allItems = getFilteredTransactions();
  const items = allItems.slice(0, state.filters.listLimit);

  if (elements.loadMoreButton) {
    elements.loadMoreButton.hidden = allItems.length <= state.filters.listLimit;
    elements.loadMoreButton.textContent = `顯示更多（還有 ${allItems.length - items.length} 筆）`;
  }

  if (allItems.length === 0) {
    elements.transactionList.className = "transaction-list empty-state";
    elements.transactionList.textContent = state.filters.date || state.filters.type !== "all" || state.filters.query
      ? "沒有符合篩選條件的資料，試試清除篩選"
      : "目前還沒有任何記帳資料";
    return;
  }

  elements.transactionList.className = "transaction-list";
  elements.transactionList.innerHTML = "";

  const fragment = document.createDocumentFragment();

  for (const [dateValue, groupItems] of Object.entries(groupTransactionsByDate(items))) {
    const section = document.createElement("section");
    section.className = "transaction-group";

    const heading = document.createElement("header");
    heading.className = "transaction-group-heading";
    heading.innerHTML = `
      <h3 class="transaction-group-title">${escapeHtml(formatFullDateLabel(dateValue))}</h3>
      <span class="transaction-group-count">${groupItems.length} 筆</span>
    `;
    section.appendChild(heading);

    for (const item of groupItems) {
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
      date.hidden = true;
      date.textContent = "";
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

      section.appendChild(node);
    }

    fragment.appendChild(section);
  }

  elements.transactionList.appendChild(fragment);
}

function groupTransactionsByDate(items) {
  return items.reduce((groups, item) => {
    if (!groups[item.date]) {
      groups[item.date] = [];
    }

    groups[item.date].push(item);
    return groups;
  }, {});
}

function renderCategoryOptions() {
  const type = getCurrentType();
  const categories = DEFAULT_CATEGORIES[type].filter(
    (category) => category !== "自訂分類" || (elements.customCategoryField && elements.customCategoryInput)
  );
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

function renderPieChart(expenseByCategory, totalExpense) {
  const container = document.querySelector("#pieChartContainer");
  const legend = document.querySelector("#pieChartLegend");
  const row = document.querySelector("#pieChartRow");
  if (!container || !legend || !row) return;

  if (!expenseByCategory.length || totalExpense <= 0) {
    row.hidden = true;
    if (elements.pieChartEmpty) elements.pieChartEmpty.hidden = false;
    return;
  }

  row.hidden = false;
  if (elements.pieChartEmpty) elements.pieChartEmpty.hidden = true;
  container.innerHTML = "";
  legend.innerHTML = "";

  const SIZE = 160;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 62;
  const INNER = 38;
  const COLORS = ["#c96830", "#e8914a", "#8a3812", "#d4a060", "#a87040"];
  const ns = "http://www.w3.org/2000/svg";

  const slices = expenseByCategory.slice(0, 5);
  let startAngle = -Math.PI / 2;

  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute("class", "pie-chart-svg");

  for (let i = 0; i < slices.length; i++) {
    const pct = slices[i].total / totalExpense;
    const end = startAngle + pct * 2 * Math.PI;
    const large = end - startAngle > Math.PI ? 1 : 0;

    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(end);
    const y2 = CY + R * Math.sin(end);
    const xi1 = CX + INNER * Math.cos(end);
    const yi1 = CY + INNER * Math.sin(end);
    const xi2 = CX + INNER * Math.cos(startAngle);
    const yi2 = CY + INNER * Math.sin(startAngle);

    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${xi1.toFixed(2)} ${yi1.toFixed(2)} A ${INNER} ${INNER} 0 ${large} 0 ${xi2.toFixed(2)} ${yi2.toFixed(2)} Z`);
    path.setAttribute("fill", COLORS[i % COLORS.length]);
    path.setAttribute("stroke", "rgba(255,253,249,1)");
    path.setAttribute("stroke-width", "2");
    path.style.cursor = "pointer";
    path.title = slices[i].category;
    path.addEventListener("click", () => filterByCategory(slices[i].category));
    svg.appendChild(path);

    const li = document.createElement("li");
    li.className = "pie-legend-item";
    li.style.cursor = "pointer";
    li.innerHTML = `<span class="pie-legend-dot" style="background:${COLORS[i % COLORS.length]}"></span><span class="pie-legend-name">${escapeHtml(slices[i].category)}</span><span class="pie-legend-pct">${Math.round(pct * 100)}%</span>`;
    li.addEventListener("click", () => filterByCategory(slices[i].category));
    legend.appendChild(li);

    startAngle = end;
  }

  container.appendChild(svg);
}

function filterByCategory(category) {
  state.filters.query = category;
  state.filters.listLimit = 50;
  elements.filterQuery.value = category;
  persistSettings();
  setActiveTab("records");
  renderTransactions();
}

function copyLastEntry() {
  const sorted = [...state.transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const last = sorted[0];
  if (!last) { showToast("還沒有任何記錄可以複製"); return; }
  elements.amountInput.value = String(last.amount);
  const typeRadio = elements.transactionForm.querySelector(`input[name="type"][value="${last.type}"]`);
  if (typeRadio) typeRadio.checked = true;
  renderCategoryOptions();
  updateNeedWantVisibility();
  elements.categorySelect.value = last.category;
  if (last.needWant) {
    const nwRadio = elements.needWantField.querySelector(`input[name="needWant"][value="${last.needWant}"]`);
    if (nwRadio) nwRadio.checked = true;
    updateNeedWantToggle();
  }
  elements.noteInput.value = last.note || "";
  showToast(`已帶入：${last.category} $${last.amount}`);
}

function showCelebration() {
  const overlay = document.querySelector("#celebrationOverlay");
  if (!overlay) return;

  const sticker = overlay.querySelector("#celebrationSticker");
  if (sticker) {
    const nextImage = CELEBRATION_IMAGES[Math.floor(Math.random() * CELEBRATION_IMAGES.length)];
    sticker.src = nextImage;
  }

  overlay.hidden = false;
  const card = overlay.querySelector(".celebration-card");
  card.style.animation = "none";
  void card.offsetHeight;
  card.style.animation = "";

  if (sticker) {
    sticker.style.animation = "none";
    void sticker.offsetHeight;
    sticker.style.animation = "";
  }

  setTimeout(() => { overlay.hidden = true; }, 900);
}

function updateNeedWantToggle() {
  for (const label of elements.needWantField.querySelectorAll("label")) {
    const radio = label.querySelector("input");
    label.classList.toggle("is-need", radio?.value === "need" && !!radio?.checked);
    label.classList.toggle("is-want", radio?.value === "want" && !!radio?.checked);
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
  elements.signInButton.disabled = state.syncMode === "initializing" || state.syncMode === "signing-in";
  elements.signOutButton.disabled = state.syncMode === "signing-in";
  elements.migrateButton.disabled = state.syncMode === "syncing";

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

function renderQuickGlance() {
  const today = formatDateInput(new Date());
  const items = state.transactions.filter((item) => item.date === today);
  const expense = sumAmounts(items.filter((item) => item.type === "expense"));
  elements.todayRecordCountValue.textContent = `${items.length} 筆`;
  elements.todayExpenseValue.textContent = formatCurrency(expense);
}

function renderPetCompanion() {
  if (!elements.dragonCompanionCard) {
    return;
  }

  const collection = syncPetPreferences();
  const activePet = collection.activePet;
  if (!activePet) {
    return;
  }

  const nextEvolution = getNextEvolutionTarget(activePet);
  const evolutionProgress = Math.max(8, Math.min(100, Math.round((activePet.recordedDays / 30) * 100)));

  elements.dragonCompanionCard.dataset.stage = String(collection.teamPets.length || 1);
  elements.dragonStageImage.src = activePet.image;
  elements.dragonStageImage.alt = `首頁陪伴寵物 ${activePet.name}`;
  elements.dragonStageName.textContent = activePet.name;
  elements.dragonStageBadge.textContent = activePet.badge;
  elements.dragonStageHint.textContent = `${activePet.monthLabel} 已記錄 ${activePet.recordedDays} 天`;
  elements.dragonStreakValue.textContent = `${collection.teamPets.length} / ${MAX_ACTIVE_PETS}`;
  elements.dragonMilestoneValue.textContent = nextEvolution ? `${nextEvolution.minDays} 天` : "完全體";
  elements.dragonProgressFill.style.width = `${evolutionProgress}%`;
  elements.dragonProgressText.textContent = nextEvolution
    ? `再記錄 ${Math.max(0, nextEvolution.minDays - activePet.recordedDays)} 天，${activePet.name} 就會進化成 ${nextEvolution.name}。`
    : `${activePet.name} 已經達到這個月的最終型態。`;
  if (elements.dragonStatHp) elements.dragonStatHp.textContent = activePet.hp;
  if (elements.dragonStatAtk) elements.dragonStatAtk.textContent = activePet.atk;
  if (elements.dragonStatDef) elements.dragonStatDef.textContent = activePet.def;
  if (elements.dragonStatLevel) elements.dragonStatLevel.textContent = `Level ${activePet.level}`;

  if (elements.petCurrentMonth) {
    elements.petCurrentMonth.textContent = collection.currentMonthLabel;
  }

  if (elements.petCollectionCount) {
    elements.petCollectionCount.textContent = `${collection.unlockedPets.length} 隻`;
  }

  if (elements.petTeamCount) {
    elements.petTeamCount.textContent = `${collection.teamPets.length} / ${MAX_ACTIVE_PETS}`;
  }

  if (elements.petBoxCount) {
    elements.petBoxCount.textContent = `${collection.boxPets.length} 隻`;
  }

  if (elements.petSelect) {
    const options = collection.teamPets.map(
      (pet) => `<option value="${escapeHtml(pet.id)}">${escapeHtml(pet.name)}</option>`
    );
    elements.petSelect.innerHTML = options.join("");
    elements.petSelect.value = collection.activePet.id;
  }

  renderPetRoster(elements.petTeamList, collection.teamPets, collection.activePet.id, "team");
  renderPetRoster(elements.petBoxList, collection.boxPets, collection.activePet.id, "box");
  renderPetDock(collection);
}

function renderPetRoster(container, pets, activePetId, mode) {
  if (!container) {
    return;
  }

  if (!pets.length) {
    container.className = "pet-grid empty-state-inline";
    container.textContent = mode === "box" ? "目前還沒有放進精靈盒的夥伴" : "還沒有可出戰的夥伴";
    return;
  }

  container.className = `pet-grid${mode === "box" ? " pet-grid-box" : ""}`;
  container.innerHTML = pets
    .map((pet) => {
      const isActive = pet.id === activePetId;
      const buttonLabel = mode === "box"
        ? "帶進隊伍"
        : isActive
          ? "目前帶出中"
          : "設為首頁夥伴";
      const action = mode === "box" ? "carry" : "equip";

      return `
        <article class="pet-card${isActive ? " is-active" : ""}">
          <img class="pet-card-image" src="${escapeHtml(pet.image)}" alt="${escapeHtml(pet.name)}">
          <div class="pet-card-meta">
            <strong>${escapeHtml(pet.name)}</strong>
            <span>${escapeHtml(formatMonthLabel(pet.month))} · ${pet.recordedDays} / 30 天</span>
          </div>
          <button
            class="ghost-button pet-card-button"
            type="button"
            data-pet-action="${action}"
            data-pet-id="${escapeHtml(pet.id)}"
            ${mode === "team" && isActive ? "disabled" : ""}
          >${buttonLabel}</button>
        </article>
      `;
    })
    .join("");
}

function renderPetDock(collection) {
  if (!elements.petDock || !elements.petDockList || !elements.petDockCount || !elements.petDockTitle) {
    return;
  }

  const shouldHideDock = state.activeTab === "records";
  elements.petDock.hidden = shouldHideDock;
  if (shouldHideDock) {
    return;
  }

  elements.petDockTitle.textContent = collection.activePet
    ? `隊伍 · ${collection.activePet.name}`
    : "目前隊伍";
  elements.petDockCount.textContent = `${collection.teamPets.length} / ${MAX_ACTIVE_PETS}`;
  elements.petDock.classList.toggle("is-collapsed", state.petDockCollapsed);
  if (elements.petDockToggle) {
    elements.petDockToggle.textContent = state.petDockCollapsed ? "＋" : "－";
    elements.petDockToggle.setAttribute("aria-expanded", String(!state.petDockCollapsed));
    elements.petDockToggle.setAttribute("aria-label", state.petDockCollapsed ? "展開隊伍面板" : "縮小隊伍面板");
  }

  if (!collection.teamPets.length) {
    elements.petDockList.className = "pet-dock-list empty-state-inline";
    elements.petDockList.textContent = "還沒有隊伍夥伴";
    return;
  }

  const visiblePets = state.petDockCollapsed ? collection.teamPets.slice(0, 1) : collection.teamPets;
  elements.petDockList.className = `pet-dock-list${state.petDockCollapsed ? " is-collapsed" : ""}`;
  elements.petDockList.innerHTML = visiblePets
      .map((pet) => {
        const isActive = pet.id === collection.activePet?.id;
        return `
        <button
          class="pet-dock-item${isActive ? " is-active" : ""}"
          type="button"
          data-pet-action="equip"
          data-pet-id="${escapeHtml(pet.id)}"
        >
          <img class="pet-dock-image" src="${escapeHtml(pet.image)}" alt="${escapeHtml(pet.name)}">
          <span class="pet-dock-name">${escapeHtml(pet.name)}</span>
        </button>
      `;
      })
      .join("");
}

function togglePetDockCollapsed() {
  state.petDockCollapsed = !state.petDockCollapsed;
  persistSettings();
  renderPetCompanion();
}

function handlePetRosterClick(event) {
  const trigger = event.target.closest("[data-pet-action]");
  if (!trigger) {
    return;
  }

  const petId = trigger.dataset.petId || "";
  const action = trigger.dataset.petAction || "";
  if (!petId) {
    return;
  }

  if (action === "carry") {
    bringPetToTeam(petId);
    return;
  }

  if (action === "equip") {
    setEquippedPet(petId);
  }
}

function setEquippedPet(petId) {
  const collection = syncPetPreferences();
  if (!collection.teamPets.some((pet) => pet.id === petId)) {
    bringPetToTeam(petId);
    return;
  }

  state.equippedPetId = petId;
  persistSettings();
  renderPetCompanion();
}

function bringPetToTeam(petId) {
  const collection = syncPetPreferences();
  if (!collection.unlockedPets.some((pet) => pet.id === petId)) {
    return;
  }

  state.petTeamOrder = [petId, ...state.petTeamOrder.filter((id) => id !== petId)];
  state.equippedPetId = petId;
  persistSettings();
  renderPetCompanion();
  showToast("已把這隻寵物帶進首頁隊伍");
}

function syncPetPreferences() {
  const previousOrder = JSON.stringify(state.petTeamOrder);
  const previousEquippedPetId = state.equippedPetId;
  const unlockedPets = getUnlockedPets(new Date());
  const unlockedIds = unlockedPets.map((pet) => pet.id);
  const nextTeamOrder = state.petTeamOrder.filter((id) => unlockedIds.includes(id));

  for (const pet of unlockedPets) {
    if (!nextTeamOrder.includes(pet.id)) {
      nextTeamOrder.push(pet.id);
    }
  }

  state.petTeamOrder = nextTeamOrder;
  const teamPets = nextTeamOrder
    .slice(0, MAX_ACTIVE_PETS)
    .map((id) => unlockedPets.find((pet) => pet.id === id))
    .filter(Boolean);

  if (!teamPets.some((pet) => pet.id === state.equippedPetId)) {
    state.equippedPetId = teamPets[0]?.id || "";
  }

  if (JSON.stringify(state.petTeamOrder) !== previousOrder || state.equippedPetId !== previousEquippedPetId) {
    persistSettings();
  }

  return getPetCollectionStateFromPets(unlockedPets);
}

function getPetCollectionState(items = state.transactions) {
  const unlockedPets = getUnlockedPets(new Date(), items);
  return getPetCollectionStateFromPets(unlockedPets);
}

function getPetCollectionStateFromPets(unlockedPets) {
  const unlockedIds = unlockedPets.map((pet) => pet.id);
  const orderedIds = state.petTeamOrder.filter((id) => unlockedIds.includes(id));
  for (const pet of unlockedPets) {
    if (!orderedIds.includes(pet.id)) {
      orderedIds.push(pet.id);
    }
  }

  const teamPets = orderedIds
    .slice(0, MAX_ACTIVE_PETS)
    .map((id) => unlockedPets.find((pet) => pet.id === id))
    .filter(Boolean);
  const boxPets = orderedIds
    .slice(MAX_ACTIVE_PETS)
    .map((id) => unlockedPets.find((pet) => pet.id === id))
    .filter(Boolean);
  const activePet = teamPets.find((pet) => pet.id === state.equippedPetId) || teamPets[0] || unlockedPets[0] || null;
  const nextRelease = getNextPetRelease();
  const currentMonthPet = getCurrentMonthPet(new Date(), state.transactions);

  return {
    unlockedPets,
    teamPets,
    boxPets,
    activePet,
    nextReleaseLabel: nextRelease ? formatMonthLabel(nextRelease.month) : "待公布",
    currentMonthLabel: currentMonthPet
      ? `${formatMonthLabel(currentMonthPet.month)} · ${currentMonthPet.name}`
      : `${formatMonthLabel(formatMonthInput(new Date()))} · 待公布`,
    progressText: boxPets.length
      ? `隊伍已滿編，超過的 ${boxPets.length} 隻已先放進精靈盒。`
      : nextRelease
        ? `下個月登場：${formatMonthLabel(nextRelease.month)} · ${getPetReleasePreviewName(nextRelease)}`
        : "接下來的新寵物可以每月再加進收藏。",
    teamProgressPercent: Math.max(12, Math.min(100, Math.round((teamPets.length / MAX_ACTIVE_PETS) * 100))),
  };
}

function getUnlockedPets(now = new Date(), items = state.transactions) {
  const currentMonth = formatMonthInput(now);
  return PET_RELEASES
    .filter((pet) => pet.month <= currentMonth)
    .map((pet) => decoratePetForMonth(pet, items));
}

function getCurrentMonthPet(now = new Date(), items = state.transactions) {
  const currentMonth = formatMonthInput(now);
  const pet = PET_RELEASES.find((entry) => entry.month === currentMonth);
  return pet ? decoratePetForMonth(pet, items) : null;
}

function getNextPetRelease(now = new Date()) {
  const currentMonth = formatMonthInput(now);
  const configuredRelease = PET_RELEASES.find((pet) => pet.month > currentMonth);
  if (configuredRelease) {
    return configuredRelease;
  }

  return NEXT_PET_PLACEHOLDER.month > currentMonth ? NEXT_PET_PLACEHOLDER : null;
}

function getPetReleasePreviewName(petRelease) {
  if (petRelease.stages?.[0]?.name) {
    return petRelease.stages[0].name;
  }

  return petRelease.name || "待公布";
}

function getNextEvolutionTarget(pet) {
  return pet.stages.find((stage) => stage.minDays > pet.recordedDays) || null;
}

function decoratePetForMonth(petRelease, items = state.transactions) {
  const recordedDays = getRecordedDaysForMonth(items, petRelease.month);
  const stage = getPetStage(petRelease, recordedDays);

  return {
    ...petRelease,
    ...stage,
    recordedDays,
    monthLabel: formatMonthLabel(petRelease.month),
  };
}

function getPetStage(petRelease, recordedDays) {
  const stages = [...petRelease.stages].sort((left, right) => left.minDays - right.minDays);
  let activeStage = stages[0];

  for (const stage of stages) {
    if (recordedDays >= stage.minDays) {
      activeStage = stage;
    }
  }

  return {
    stageName: activeStage.name,
    stageMinDays: activeStage.minDays,
    name: activeStage.name,
    hp: activeStage.hp,
    atk: activeStage.atk,
    def: activeStage.def,
    level: activeStage.level,
  };
}

function getRecordedDaysForMonth(items, month) {
  return Array.from(
    new Set(items.filter((item) => item.date.startsWith(month)).map((item) => item.date))
  ).length;
}

function getDayStamp(dateInput) {
  const [year, month, day] = String(dateInput || "").split("-").map(Number);
  if (!year || !month || !day) {
    return NaN;
  }

  return Date.UTC(year, month - 1, day);
}

function getSyncModeMeta() {
  const email = state.user?.email || "你的 Google 帳號";
  const hasLocalBackup = state.localTransactions.length > 0;

  switch (state.syncMode) {
    case "initializing":
      return {
        badge: "準備中",
        variant: "warning",
        status: "正在連線雲端服務。",
        detail: "第一次開啟或剛更新版本時，Firebase 會先初始化一下。",
        hint: "如果這個狀態停太久，重新整理一次通常就會恢復正常。",
        hideSignIn: true,
        hideSignOut: true,
        hideMigrate: true,
      };
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

  items = filterByDate(items, state.filters.date);

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

  setActiveTab("quick");

  elements.transactionId.value = item.id;
  elements.amountInput.value = String(item.amount);
  elements.dateInput.value = item.date;
  elements.noteInput.value = item.note;
  if (elements.formTitle) {
    elements.formTitle.textContent = "編輯記錄";
  }
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

  const needVal = item.needWant === "want" ? "want" : "need";
  const needRadio = elements.needWantField.querySelector(`input[name="needWant"][value="${needVal}"]`);
  if (needRadio) needRadio.checked = true;
  updateCategoryVisibility();
  updateNeedWantVisibility();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  elements.transactionId.value = "";
  elements.transactionForm.reset();
  elements.transactionForm.querySelector('input[name="type"][value="expense"]').checked = true;
  elements.dateInput.value = formatDateInput(new Date());
  if (elements.formTitle) {
    elements.formTitle.textContent = "快速記一筆";
  }
  elements.cancelEditButton.hidden = true;
  const needDefault = elements.needWantField.querySelector('input[name="needWant"][value="need"]');
  if (needDefault) needDefault.checked = true;
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
    showToast(isCloudMode() ? getFirestoreErrorMessage(error) : "刪除本機資料失敗");
  }
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    mode: isCloudMode() ? "cloud" : "local",
    transactions: state.transactions,
    petPreferences: {
      equippedPetId: state.equippedPetId,
      petTeamOrder: state.petTeamOrder,
    },
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
    const petPreferences = !Array.isArray(parsed) && parsed.petPreferences && typeof parsed.petPreferences === "object"
      ? parsed.petPreferences
      : null;

    if (!Array.isArray(transactions)) {
      throw new Error("invalid-format");
    }

    const existingCount = state.transactions.length;
    if (existingCount > 0) {
      const ok = window.confirm(`匯入將覆蓋目前 ${existingCount} 筆記錄，確定繼續嗎？`);
      if (!ok) { event.target.value = ""; return; }
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
      if (petPreferences) {
        state.equippedPetId = String(petPreferences.equippedPetId || "");
        state.petTeamOrder = Array.isArray(petPreferences.petTeamOrder)
          ? petPreferences.petTeamOrder.map(String)
          : state.petTeamOrder;
        persistSettings();
      }
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
    showToast(getFirestoreErrorMessage(error));
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

function filterByDate(items, date) {
  if (!date) {
    return items;
  }

  return items.filter((item) => item.date === date);
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
    state.activeTab = settings.activeTab || state.activeTab;
    state.filters.date = settings.filters?.date ?? state.filters.date;
    state.filters.type = settings.filters?.type || state.filters.type;
    state.filters.query = settings.filters?.query || state.filters.query;
    state.petTeamOrder = Array.isArray(settings.petTeamOrder) ? settings.petTeamOrder.map(String) : [];
    state.equippedPetId = String(settings.equippedPetId || "");
    state.petDockCollapsed = Boolean(settings.petDockCollapsed);
    state.monthlyBudget = Number(settings.monthlyBudget) || 0;
    if (elements.monthlyBudgetInput && state.monthlyBudget > 0) {
      elements.monthlyBudgetInput.value = String(state.monthlyBudget);
    }

    elements.summaryMonth.value = state.summaryMonth;
    elements.filterDate.value = state.filters.date;
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
      activeTab: state.activeTab,
      filters: state.filters,
      petTeamOrder: state.petTeamOrder,
      equippedPetId: state.equippedPetId,
      petDockCollapsed: state.petDockCollapsed,
      monthlyBudget: state.monthlyBudget,
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

function setActiveTab(tab) {
  const validTab = elements.tabPages.some((page) => page.dataset.tabPage === tab) ? tab : "quick";
  if (validTab !== "quick" && elements.transactionId.value) {
    if (!window.confirm("正在編輯記錄中，離開後變更不會儲存，確定要離開嗎？")) return;
    resetForm();
  }
  state.activeTab = validTab;
  applyActiveTab();
  renderPetCompanion();
  persistSettings();
}

function applyActiveTab() {
  for (const page of elements.tabPages) {
    page.classList.toggle("is-active", page.dataset.tabPage === state.activeTab);
  }

  for (const button of elements.tabButtons) {
    const isActive = button.dataset.tabTarget === state.activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  }
}

function getInstallContext() {
  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isWindows = /Windows/i.test(userAgent);
  const isEdge = /Edg/i.test(userAgent);
  const isChrome = /Chrome|CriOS/i.test(userAgent) && !isEdge;
  const isSafari =
    /Safari/i.test(userAgent) && !/Chrome|CriOS|Edg|FxiOS|Firefox|OPR/i.test(userAgent);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

  return {
    isIOS,
    isAndroid,
    isWindows,
    isSafari,
    isChrome,
    isEdge,
    isStandalone,
    canPromptInstall: Boolean(state.installPrompt),
  };
}

function getInstallUi(context) {
  if (context.isStandalone) {
    return {
      badge: "已安裝",
      variant: "cloud",
      buttonLabel: "已安裝",
      description: "這台裝置已經可以從主畫面、桌面或開始選單直接開啟元寶記帳。",
      steps: [
        "之後直接從桌面或主畫面的圖示開啟即可。",
        "如果你換了新版本又看不到圖示，刪掉舊捷徑後重新加入一次就好。",
      ],
      showHeaderButton: false,
      showInlineButton: false,
      showWindowsShortcut: false,
    };
  }

  if (context.isIOS) {
    return {
      badge: "iPhone",
      variant: "warning",
      buttonLabel: context.isSafari ? "加入主畫面" : "改用 Safari",
      description: context.isSafari
        ? "iPhone 不允許網站直接建立桌面捷徑，但可以透過 Safari 的「加入主畫面」放到桌面。"
        : "請先改用 Safari 開啟這個網址，才能把元寶記帳加入 iPhone 主畫面。",
      steps: context.isSafari
        ? [
            "請用 Safari 開啟這個網址。",
            "點下方分享按鈕。",
            "往下選「加入主畫面」。",
            "點右上角「加入」，之後就能從桌面直接開啟。",
          ]
        : [
            "先在目前瀏覽器把網址複製起來。",
            "改用 Safari 開啟這個網址。",
            "打開分享選單後選「加入主畫面」。",
          ],
      showHeaderButton: true,
      showInlineButton: true,
      showWindowsShortcut: false,
    };
  }

  if (context.canPromptInstall) {
    return {
      badge: context.isWindows ? "Windows 可安裝" : "可安裝",
      variant: "warning",
      buttonLabel: "安裝 App",
      description: "這台裝置支援直接把網站安裝成 App，安裝後可從桌面或開始選單開啟。",
      steps: [
        "按下「安裝 App」。",
        "在瀏覽器跳出的安裝視窗按確認。",
        "安裝完成後就能像一般 App 一樣從桌面或開始選單直接開啟。",
      ],
      showHeaderButton: true,
      showInlineButton: true,
      showWindowsShortcut: context.isWindows,
    };
  }

  if (context.isWindows) {
    return {
      badge: "Windows",
      variant: "local",
      buttonLabel: "查看安裝步驟",
      description: "如果瀏覽器沒有自動跳出安裝視窗，可以在 Edge 或 Chrome 裡手動安裝，或先下載桌面捷徑。",
      steps: [
        "請用 Edge 或 Chrome 開啟這個網站。",
        "點右上角選單，找「安裝此網站為應用程式」或「應用程式」。",
        "確認安裝後，就能從桌面與開始選單直接開啟。",
      ],
      showHeaderButton: true,
      showInlineButton: true,
      showWindowsShortcut: true,
    };
  }

  return {
    badge: context.isAndroid ? "Android" : "瀏覽器",
    variant: "local",
    buttonLabel: "查看安裝步驟",
    description: "這台裝置目前沒有自動安裝提示，你仍可以使用瀏覽器的安裝或加入主畫面功能。",
    steps: [
      "先用支援 PWA 的瀏覽器開啟這個網站。",
      "在瀏覽器選單中找「安裝應用程式」或「加入主畫面」。",
      "安裝後就能像一般 App 一樣從桌面開啟。",
    ],
    showHeaderButton: true,
    showInlineButton: true,
    showWindowsShortcut: false,
  };
}

function renderInstallExperience() {
  if (!elements.installDescription || !elements.installSteps || !elements.installBadge) {
    return;
  }

  const context = getInstallContext();
  const ui = getInstallUi(context);

  elements.installBadge.textContent = ui.badge;
  elements.installBadge.className = `mode-badge ${ui.variant}`;
  elements.installDescription.textContent = ui.description;
  elements.installSteps.innerHTML = ui.steps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  elements.downloadShortcutButton.hidden = !ui.showWindowsShortcut;
  elements.installButton.hidden = !ui.showHeaderButton;
  elements.installButton.textContent = ui.buttonLabel;

  for (const trigger of elements.installTriggers) {
    trigger.hidden = !ui.showInlineButton;
    trigger.textContent = ui.buttonLabel;
  }
}

function scrollToInstallGuide() {
  setActiveTab("cloud-backup");
  requestAnimationFrame(() => {
    elements.installDescription?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

async function handleInstall() {
  const context = getInstallContext();

  if (context.isStandalone) {
    showToast("已安裝，可直接從桌面或主畫面開啟");
    return;
  }

  if (!state.installPrompt) {
    scrollToInstallGuide();
    if (context.isIOS) {
      showToast(context.isSafari ? "請照畫面步驟加入主畫面" : "請改用 Safari 再加入主畫面");
      return;
    }

    if (context.isWindows) {
      showToast("請照畫面步驟安裝，或下載 Windows 捷徑");
      return;
    }

    showToast("請照畫面步驟安裝 App");
    return;
  }

  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  renderInstallExperience();
}

function downloadWindowsShortcut() {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";

  const content = ["[InternetShortcut]", `URL=${url.toString()}`].join("\r\n");
  downloadFile("YuanbaoLedger.url", content, "application/internet-shortcut");
  showToast("已下載 Windows 捷徑，放到桌面後即可直接開啟");
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

function getMonthlyPulse({ income, expense, needExpense, wantExpense, expenseCount, topCategory }) {
  if (!expenseCount) {
    return "先記幾筆，這裡就會開始有本月消費輪廓。";
  }

  if (income > 0 && expense <= income * 0.7) {
    return "這個月目前花得還算穩，結餘空間充足。";
  }

  if (wantExpense > needExpense) {
    return "想要支出高於需要支出，可以留意一下衝動購物。";
  }

  if (topCategory) {
    return `這個月目前最大宗支出在「${topCategory.category}」。`;
  }

  return "本月支出正在累積，記得偶爾回來看看分類分布。";
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

function formatFullDateLabel(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
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

function getInitialTabFromUrl() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  if (!tab) {
    return "";
  }

  return elements.tabPages.some((page) => page.dataset.tabPage === tab) ? tab : "";
}

function getSelectedCategory() {
  const selected = elements.categorySelect.value;
  if (selected === "自訂分類") {
    return elements.customCategoryInput?.value.trim() || "";
  }
  return selected.trim();
}

function updateCategoryVisibility() {
  if (!elements.customCategoryField || !elements.customCategoryInput) {
    return;
  }

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
    const r = elements.needWantField.querySelector('input[name="needWant"][value="need"]');
    if (r) r.checked = true;
  }
  updateNeedWantToggle();
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

function getFirestoreErrorMessage(error) {
  const code = error?.code || "";

  switch (code) {
    case "permission-denied":
      return "雲端儲存失敗：Firestore 規則拒絕寫入，請確認規則已發布且登入帳號正確";
    case "unauthenticated":
      return "雲端儲存失敗：登入狀態已失效，請重新登入 Google";
    case "unavailable":
      return "雲端儲存失敗：目前連不到 Firestore，請稍後再試";
    case "failed-precondition":
      return "雲端儲存失敗：Firestore 尚未完成設定或資料庫未就緒";
    case "resource-exhausted":
      return "雲端儲存失敗：Firebase 免費額度可能已達上限";
    default:
      return `雲端儲存失敗：${stringifyError(error) || "請檢查 Firestore 設定"}`;
  }
}
