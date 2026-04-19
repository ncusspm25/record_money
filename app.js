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
const SBD_RECORDS_KEY = "yuanbao-ledger-sbd-records";

const DEFAULT_CATEGORIES = {
  expense: ["餐飲", "交通", "日用品", "雜費", "娛樂"],
  income: ["薪水", "獎金", "接案", "投資", "退款", "其他收入"],
};

const DAY_MS = 24 * 60 * 60 * 1000;

const DRAGON_STAGES = [
  {
    stage: 1,
    minDays: 0,
    name: "小火龍",
    badge: "初始型態",
    image: "assets/dragons/dragon-stage-1.png",
    hp: 50, atk: 20, def: 10, level: 1,
  },
  {
    stage: 2,
    minDays: 5,
    name: "展翼火龍",
    badge: "5 天進化",
    image: "assets/dragons/dragon-stage-2.png",
    hp: 120, atk: 55, def: 35, level: 2,
  },
  {
    stage: 3,
    minDays: 30,
    name: "終焰聖龍",
    badge: "30 天最終型態",
    image: "assets/dragons/dragon-stage-3.png",
    hp: 250, atk: 120, def: 80, level: 3,
  },
];

const CELEBRATION_IMAGES = [
  "assets/celebration/celebrate-yuanbao.png",
];

const state = {
  transactions: [],
  localTransactions: [],
  sbdRecords: [],
  sbdCalculator: {
    squat: "",
    bench: "",
    deadlift: "",
  },
  activeTab: "quick",
  filters: {
    date: "",
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
  sbdSquatInput: document.querySelector("#sbdSquatInput"),
  sbdBenchInput: document.querySelector("#sbdBenchInput"),
  sbdDeadliftInput: document.querySelector("#sbdDeadliftInput"),
  sbdCalcSummary: document.querySelector("#sbdCalcSummary"),
  sbdAttemptCards: document.querySelector("#sbdAttemptCards"),
  sbdRecordForm: document.querySelector("#sbdRecordForm"),
  sbdRecordId: document.querySelector("#sbdRecordId"),
  sbdRecordDate: document.querySelector("#sbdRecordDate"),
  sbdBodyweightInput: document.querySelector("#sbdBodyweightInput"),
  sbdRecordSquat: document.querySelector("#sbdRecordSquat"),
  sbdRecordBench: document.querySelector("#sbdRecordBench"),
  sbdRecordDeadlift: document.querySelector("#sbdRecordDeadlift"),
  sbdRecordNote: document.querySelector("#sbdRecordNote"),
  sbdRecordTotalPreview: document.querySelector("#sbdRecordTotalPreview"),
  sbdRecordBestLiftPreview: document.querySelector("#sbdRecordBestLiftPreview"),
  sbdSaveRecordButton: document.querySelector("#sbdSaveRecordButton"),
  sbdCancelEditButton: document.querySelector("#sbdCancelEditButton"),
  sbdRecordList: document.querySelector("#sbdRecordList"),
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

void bootstrap();

async function bootstrap() {
  const today = new Date();
  const currentMonth = formatMonthInput(today);
  const todayDate = formatDateInput(today);

  state.summaryMonth = currentMonth;
  state.filters.date = "";

  elements.summaryMonth.value = currentMonth;
  elements.filterDate.value = "";
  elements.dateInput.value = todayDate;
  if (elements.sbdRecordDate) {
    elements.sbdRecordDate.value = todayDate;
  }

  state.localTransactions = loadLocalTransactions();
  state.transactions = [...state.localTransactions];
  state.sbdRecords = loadSbdRecords();
  hydrateSettings();

  attachEventListeners();
  renderCategoryOptions();
  updateCategoryVisibility();
  updateNeedWantVisibility();
  updateNeedWantToggle();
  render();
  applyActiveTab();
  registerServiceWorker();
  await initFirebase();
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

  for (const input of [elements.sbdSquatInput, elements.sbdBenchInput, elements.sbdDeadliftInput]) {
    input?.addEventListener("input", () => {
      syncSbdCalculatorStateFromInputs();
      persistSettings();
      renderSbdCalculator();
    });
  }

  for (const input of [
    elements.sbdBodyweightInput,
    elements.sbdRecordSquat,
    elements.sbdRecordBench,
    elements.sbdRecordDeadlift,
  ]) {
    input?.addEventListener("input", renderSbdRecordPreview);
  }

  elements.sbdRecordForm?.addEventListener("submit", handleSbdRecordSubmit);
  elements.sbdCancelEditButton?.addEventListener("click", resetSbdRecordForm);

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
    elements.filterDate.value = "";
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
    await handleInstall();
  });

  for (const trigger of elements.installTriggers) {
    trigger.addEventListener("click", async () => {
      await handleInstall();
    });
  }

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
      showToast(getFirestoreErrorMessage(error));
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
  const needWant = type === "expense" ? (elements.needWantField.querySelector('input[name="needWant"]:checked')?.value || "need") : "";
  const existingId = elements.transactionId.value;
  const existing = state.transactions.find((item) => item.id === existingId);

  if (!amount || amount <= 0) {
    showToast("請輸入正確金額");
    elements.amountInput.focus();
    return;
  }

  if (!category) {
    showToast("請選擇分類");
    elements.categorySelect.focus();
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
  const previousDragonStage = getDragonStatus(state.transactions).stage;

  try {
    await saveTransaction(payload);
    renderCategoryOptions();
    render();
    resetForm();
    const currentDragon = getDragonStatus(state.transactions);
    const leveledUp = !existing && currentDragon.stage > previousDragonStage;
    if (leveledUp) {
      showToast(`${currentDragon.name} 進化了！`);
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
  renderDragonCompanion();
  renderQuickGlance();
  renderSummary();
  renderTransactions();
  renderSbdCalculator();
  renderSbdRecordPreview();
  renderSbdRecords();
  renderAuthPanel();
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
  const items = getFilteredTransactions();

  if (items.length === 0) {
    elements.transactionList.className = "transaction-list empty-state";
    elements.transactionList.textContent = "沒有符合目前篩選條件的資料";
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

function renderSbdCalculator() {
  if (!elements.sbdCalcSummary || !elements.sbdAttemptCards) {
    return;
  }

  const calculator = getSbdCalculatorValues();
  const lifts = [
    { key: "squat", label: "深蹲", value: calculator.squat },
    { key: "bench", label: "臥推", value: calculator.bench },
    { key: "deadlift", label: "硬舉", value: calculator.deadlift },
  ];

  const validValues = lifts.map((lift) => lift.value).filter((value) => value > 0);
  const maxTotal = validValues.reduce((sum, value) => sum + value, 0);
  const openerTotal = lifts.reduce((sum, lift) => sum + getAttemptWeight(lift.value, 0.9), 0);
  const thirdTotal = lifts.reduce((sum, lift) => sum + getAttemptWeight(lift.value, 1.02), 0);
  const bestLift = [...lifts].sort((left, right) => right.value - left.value)[0];

  elements.sbdCalcSummary.innerHTML = `
    <article class="surface">
      <span class="surface-label">目前三項總和</span>
      <strong class="metric-value">${maxTotal ? formatKg(maxTotal) : "--"}</strong>
    </article>
    <article class="surface">
      <span class="surface-label">建議開把總和</span>
      <strong class="metric-value">${openerTotal ? formatKg(openerTotal) : "--"}</strong>
    </article>
    <article class="surface">
      <span class="surface-label">第三把目標總和</span>
      <strong class="metric-value">${thirdTotal ? formatKg(thirdTotal) : "--"}</strong>
    </article>
    <article class="surface">
      <span class="surface-label">目前最強項目</span>
      <strong class="metric-value">${bestLift?.value ? `${bestLift.label} ${formatKg(bestLift.value)}` : "--"}</strong>
    </article>
  `;

  elements.sbdAttemptCards.innerHTML = lifts
    .map((lift) => {
      const opener = getAttemptWeight(lift.value, 0.9);
      const second = getAttemptWeight(lift.value, 0.96);
      const third = getAttemptWeight(lift.value, 1.02);

      return `
        <article class="surface sbd-attempt-card">
          <div class="surface-head">
            <div>
              <p class="eyebrow">${lift.key.toUpperCase()}</p>
              <h3>${lift.label}</h3>
            </div>
            <span class="mode-badge">${lift.value ? formatKg(lift.value) : "未輸入"}</span>
          </div>
          <div class="sbd-attempt-list">
            <div class="sbd-attempt-row"><span>Opener</span><strong>${opener ? formatKg(opener) : "--"}</strong></div>
            <div class="sbd-attempt-row"><span>Second</span><strong>${second ? formatKg(second) : "--"}</strong></div>
            <div class="sbd-attempt-row"><span>Third</span><strong>${third ? formatKg(third) : "--"}</strong></div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderSbdRecordPreview() {
  if (!elements.sbdRecordTotalPreview || !elements.sbdRecordBestLiftPreview) {
    return;
  }

  const preview = getSbdFormValues();
  const total = preview.squat + preview.bench + preview.deadlift;
  const bestLift = getBestLiftLabel(preview);

  elements.sbdRecordTotalPreview.textContent = total ? formatKg(total) : "--";
  elements.sbdRecordBestLiftPreview.textContent = bestLift;
}

function renderSbdRecords() {
  if (!elements.sbdRecordList) {
    return;
  }

  if (!state.sbdRecords.length) {
    elements.sbdRecordList.className = "transaction-list empty-state";
    elements.sbdRecordList.textContent = "還沒有 SBD 紀錄";
    return;
  }

  elements.sbdRecordList.className = "transaction-list";
  elements.sbdRecordList.innerHTML = "";
  const fragment = document.createDocumentFragment();

  for (const [dateValue, groupItems] of Object.entries(groupSbdRecordsByDate(state.sbdRecords))) {
    const section = document.createElement("section");
    section.className = "transaction-group";
    section.innerHTML = `
      <header class="transaction-group-heading">
        <h3 class="transaction-group-title">${escapeHtml(formatFullDateLabel(dateValue))}</h3>
        <span class="transaction-group-count">${groupItems.length} 筆</span>
      </header>
    `;

    for (const record of groupItems) {
      const article = document.createElement("article");
      article.className = "transaction-item sbd-record-item";
      article.innerHTML = `
        <div class="transaction-main">
          <div class="transaction-meta">
            <p class="transaction-category">Total ${formatKg(record.total)}</p>
            <p class="transaction-note">深蹲 ${formatKg(record.squat)} / 臥推 ${formatKg(record.bench)} / 硬舉 ${formatKg(record.deadlift)}</p>
          </div>
          <div class="transaction-side">
            <strong class="transaction-amount" style="color: var(--gold)">${record.bodyweight ? `BW ${formatKg(record.bodyweight)}` : getBestLiftLabel(record)}</strong>
            <span class="transaction-date">${record.note || "沒有備註"}</span>
          </div>
        </div>
        <div class="transaction-actions">
          <div class="transaction-labels">
            <span class="transaction-badge">SBD</span>
            <span class="transaction-badge transaction-badge-secondary need">${getBestLiftLabel(record)}</span>
          </div>
          <button class="ghost-button sbd-edit-button" type="button">編輯</button>
          <button class="ghost-button danger-button sbd-delete-button" type="button">刪除</button>
        </div>
      `;

      article.querySelector(".sbd-edit-button")?.addEventListener("click", () => startSbdEdit(record.id));
      article.querySelector(".sbd-delete-button")?.addEventListener("click", () => void deleteSbdRecord(record.id));
      section.appendChild(article);
    }

    fragment.appendChild(section);
  }

  elements.sbdRecordList.appendChild(fragment);
}

async function handleSbdRecordSubmit(event) {
  event.preventDefault();

  const payload = getSbdFormValues();
  const existingId = elements.sbdRecordId?.value || "";
  const existing = state.sbdRecords.find((item) => item.id === existingId);

  if (!payload.date) {
    showToast("請先選擇 SBD 日期");
    elements.sbdRecordDate?.focus();
    return;
  }

  if (!payload.squat || !payload.bench || !payload.deadlift) {
    showToast("請把深蹲、臥推、硬舉都填好");
    return;
  }

  const record = normalizeSbdRecord({
    id: existingId || createId(),
    ...payload,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (!record) {
    showToast("SBD 紀錄格式不正確");
    return;
  }

  const nextRecords = [...state.sbdRecords];
  const existingIndex = nextRecords.findIndex((item) => item.id === record.id);

  if (existingIndex >= 0) {
    nextRecords[existingIndex] = record;
  } else {
    nextRecords.unshift(record);
  }

  nextRecords.sort(compareSbdRecords);
  state.sbdRecords = nextRecords;
  saveSbdRecords();
  renderSbdRecords();
  resetSbdRecordForm();
  showToast(existing ? "已更新 SBD 紀錄" : "已新增 SBD 紀錄");
}

function startSbdEdit(id) {
  const record = state.sbdRecords.find((item) => item.id === id);
  if (!record || !elements.sbdRecordForm) {
    return;
  }

  setActiveTab("sbd");
  elements.sbdRecordId.value = record.id;
  elements.sbdRecordDate.value = record.date;
  elements.sbdBodyweightInput.value = record.bodyweight ? String(record.bodyweight) : "";
  elements.sbdRecordSquat.value = String(record.squat);
  elements.sbdRecordBench.value = String(record.bench);
  elements.sbdRecordDeadlift.value = String(record.deadlift);
  elements.sbdRecordNote.value = record.note || "";
  elements.sbdSaveRecordButton.textContent = "更新紀錄";
  elements.sbdCancelEditButton.hidden = false;
  renderSbdRecordPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetSbdRecordForm() {
  if (!elements.sbdRecordForm) {
    return;
  }

  elements.sbdRecordId.value = "";
  elements.sbdRecordForm.reset();
  elements.sbdRecordDate.value = formatDateInput(new Date());
  elements.sbdSaveRecordButton.textContent = "儲存 SBD 紀錄";
  elements.sbdCancelEditButton.hidden = true;
  renderSbdRecordPreview();
}

async function deleteSbdRecord(id) {
  const record = state.sbdRecords.find((item) => item.id === id);
  if (!record) {
    return;
  }

  const confirmed = window.confirm(`要刪除這筆 SBD 紀錄嗎？ Total ${formatKg(record.total)}`);
  if (!confirmed) {
    return;
  }

  state.sbdRecords = state.sbdRecords.filter((item) => item.id !== id);
  saveSbdRecords();
  renderSbdRecords();
  if (elements.sbdRecordId?.value === id) {
    resetSbdRecordForm();
  }
  showToast("已刪除 SBD 紀錄");
}

function syncSbdCalculatorStateFromInputs() {
  state.sbdCalculator.squat = elements.sbdSquatInput?.value || "";
  state.sbdCalculator.bench = elements.sbdBenchInput?.value || "";
  state.sbdCalculator.deadlift = elements.sbdDeadliftInput?.value || "";
}

function getSbdCalculatorValues() {
  return {
    squat: Number(state.sbdCalculator.squat) || 0,
    bench: Number(state.sbdCalculator.bench) || 0,
    deadlift: Number(state.sbdCalculator.deadlift) || 0,
  };
}

function getSbdFormValues() {
  return {
    date: elements.sbdRecordDate?.value || "",
    bodyweight: Number(elements.sbdBodyweightInput?.value || 0) || 0,
    squat: Number(elements.sbdRecordSquat?.value || 0) || 0,
    bench: Number(elements.sbdRecordBench?.value || 0) || 0,
    deadlift: Number(elements.sbdRecordDeadlift?.value || 0) || 0,
    note: elements.sbdRecordNote?.value.trim() || "",
  };
}

function getAttemptWeight(value, ratio) {
  if (!value) {
    return 0;
  }

  return roundToStep(value * ratio, 2.5);
}

function roundToStep(value, step) {
  if (!value || !step) {
    return 0;
  }

  return Math.round(value / step) * step;
}

function getBestLiftLabel(record) {
  const lifts = [
    { label: "深蹲", value: Number(record.squat) || 0 },
    { label: "臥推", value: Number(record.bench) || 0 },
    { label: "硬舉", value: Number(record.deadlift) || 0 },
  ].sort((left, right) => right.value - left.value);

  return lifts[0]?.value ? `${lifts[0].label} ${formatKg(lifts[0].value)}` : "--";
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
    svg.appendChild(path);

    const li = document.createElement("li");
    li.className = "pie-legend-item";
    li.innerHTML = `<span class="pie-legend-dot" style="background:${COLORS[i % COLORS.length]}"></span><span class="pie-legend-name">${escapeHtml(slices[i].category)}</span><span class="pie-legend-pct">${Math.round(pct * 100)}%</span>`;
    legend.appendChild(li);

    startAngle = end;
  }

  container.appendChild(svg);
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

  setTimeout(() => { overlay.hidden = true; }, 1600);
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

function renderDragonCompanion() {
  if (!elements.dragonCompanionCard) {
    return;
  }

  const status = getDragonStatus(state.transactions);
  elements.dragonCompanionCard.dataset.stage = String(status.stage);
  elements.dragonStageImage.src = status.image;
  elements.dragonStageName.textContent = status.name;
  elements.dragonStageBadge.textContent = status.badge;
  elements.dragonStageHint.textContent = status.hint;
  elements.dragonStreakValue.textContent = `${status.streak} 天`;
  elements.dragonMilestoneValue.textContent = status.nextMilestoneLabel;
  elements.dragonProgressFill.style.width = `${status.progressPercent}%`;
  elements.dragonProgressText.textContent = status.progressText;
  if (elements.dragonStatHp) elements.dragonStatHp.textContent = status.hp;
  if (elements.dragonStatAtk) elements.dragonStatAtk.textContent = status.atk;
  if (elements.dragonStatDef) elements.dragonStatDef.textContent = status.def;
  if (elements.dragonStatLevel) elements.dragonStatLevel.textContent = `Level ${status.level}`;
}

function getDragonStatus(items) {
  const streak = getCurrentStreak(items);
  const stageConfig = getDragonStageConfig(streak);
  const latestStamp = getLatestRecordedDayStamp(items);
  const todayStamp = getDayStamp(formatDateInput(new Date()));
  const hasTodayRecord = latestStamp === todayStamp;
  const hasCarryover = latestStamp === todayStamp - DAY_MS;
  const nextStage = DRAGON_STAGES.find((candidate) => candidate.minDays > streak);
  const baseProgress = stageConfig.stage === 1
    ? streak / 5
    : stageConfig.stage === 2
      ? (streak - 5) / 25
      : 1;
  const progressPercent = Math.max(10, Math.min(100, Math.round(baseProgress * 100)));

  let hint = "今天先記一筆，讓小火龍開始陪你連續成長。";
  let progressText = "距離第一次進化還有 5 天。";
  let nextMilestoneLabel = nextStage ? `${nextStage.minDays} 天` : "最終型態已解鎖";

  if (streak === 0) {
    progressText = "這一筆會是新的連續起點。";
  } else if (stageConfig.stage === 3) {
    hint = "你已達成 30 天連續記帳，火龍已經完全進化。";
    progressText = hasTodayRecord
      ? "今天也有照顧到最終型態火龍，保持得很漂亮。"
      : "今天再記一筆，讓最終型態繼續保持滿能量。";
  } else if (nextStage) {
    const daysLeft = Math.max(0, nextStage.minDays - streak);
    hint = `再連續 ${daysLeft} 天就會進化成${nextStage.name}。`;
    if (hasTodayRecord) {
      progressText = `今天已完成記帳，距離下一次進化還差 ${daysLeft} 天。`;
    } else if (hasCarryover) {
      progressText = `今天再記一筆，就能把 ${streak} 天連續記帳延續下去。`;
    } else {
      progressText = `連續紀錄已中斷，今天重新開始培養 ${stageConfig.name}。`;
    }
  }

  return {
    ...stageConfig,
    streak,
    hint,
    progressText,
    progressPercent,
    nextMilestoneLabel,
  };
}

function getDragonStageConfig(streak) {
  if (streak >= 30) {
    return DRAGON_STAGES[2];
  }

  if (streak >= 5) {
    return DRAGON_STAGES[1];
  }

  return DRAGON_STAGES[0];
}

function getCurrentStreak(items) {
  const uniqueDayStamps = getUniqueRecordedDayStamps(items);
  if (!uniqueDayStamps.length) {
    return 0;
  }

  const todayStamp = getDayStamp(formatDateInput(new Date()));
  const latestStamp = uniqueDayStamps[0];
  if (latestStamp < todayStamp - DAY_MS) {
    return 0;
  }

  let streak = 1;
  for (let index = 1; index < uniqueDayStamps.length; index += 1) {
    if (uniqueDayStamps[index] === uniqueDayStamps[index - 1] - DAY_MS) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
}

function getUniqueRecordedDayStamps(items) {
  return Array.from(
    new Set(items.map((item) => getDayStamp(item.date)).filter((stamp) => Number.isFinite(stamp)))
  ).sort((left, right) => right - left);
}

function getLatestRecordedDayStamp(items) {
  return getUniqueRecordedDayStamps(items)[0] ?? null;
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
  elements.categorySelect.value = item.category;

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
    sbdRecords: state.sbdRecords,
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
    const rawSbdRecords = Array.isArray(parsed?.sbdRecords) ? parsed.sbdRecords : [];

    if (!Array.isArray(transactions)) {
      throw new Error("invalid-format");
    }

    const normalized = transactions
      .map(normalizeTransaction)
      .filter(Boolean)
      .sort(compareTransactions);
    const normalizedSbdRecords = rawSbdRecords
      .map(normalizeSbdRecord)
      .filter(Boolean)
      .sort(compareSbdRecords);

    if (normalizedSbdRecords.length || rawSbdRecords.length) {
      state.sbdRecords = normalizedSbdRecords;
      saveSbdRecords();
    }

    if (isCloudMode()) {
      await importTransactionsToCloud(normalized);
      render();
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

function loadSbdRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SBD_RECORDS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeSbdRecord).filter(Boolean).sort(compareSbdRecords) : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

function saveSbdRecords() {
  localStorage.setItem(SBD_RECORDS_KEY, JSON.stringify(state.sbdRecords));
}

function normalizeSbdRecord(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const date = String(item.date || "").slice(0, 10);
  const squat = Number(item.squat);
  const bench = Number(item.bench);
  const deadlift = Number(item.deadlift);
  const bodyweight = Number(item.bodyweight || 0) || 0;

  if (!date || squat <= 0 || bench <= 0 || deadlift <= 0) {
    return null;
  }

  return {
    id: String(item.id || createId()),
    date,
    bodyweight,
    squat,
    bench,
    deadlift,
    total: squat + bench + deadlift,
    note: String(item.note || "").trim(),
    createdAt: String(item.createdAt || new Date().toISOString()),
    updatedAt: String(item.updatedAt || new Date().toISOString()),
  };
}

function compareSbdRecords(left, right) {
  const dateCompare = right.date.localeCompare(left.date);
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function groupSbdRecordsByDate(items) {
  return items.reduce((groups, item) => {
    if (!groups[item.date]) {
      groups[item.date] = [];
    }

    groups[item.date].push(item);
    return groups;
  }, {});
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
    state.sbdCalculator.squat = settings.sbdCalculator?.squat || "";
    state.sbdCalculator.bench = settings.sbdCalculator?.bench || "";
    state.sbdCalculator.deadlift = settings.sbdCalculator?.deadlift || "";

    elements.summaryMonth.value = state.summaryMonth;
    elements.filterDate.value = state.filters.date;
    elements.filterType.value = state.filters.type;
    elements.filterQuery.value = state.filters.query;
    if (elements.sbdSquatInput) {
      elements.sbdSquatInput.value = state.sbdCalculator.squat;
      elements.sbdBenchInput.value = state.sbdCalculator.bench;
      elements.sbdDeadliftInput.value = state.sbdCalculator.deadlift;
    }
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
      sbdCalculator: state.sbdCalculator,
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
  state.activeTab = validTab;
  applyActiveTab();
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

async function handleInstall() {
  if (!state.installPrompt) {
    showToast("目前這台裝置沒有出現安裝提示");
    return;
  }

  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  elements.installButton.hidden = true;
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

function formatKg(value) {
  const numericValue = Number(value) || 0;
  const hasDecimal = Math.abs(numericValue % 1) > 0.001;

  return `${new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: hasDecimal ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(numericValue)} kg`;
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

function getSelectedCategory() {
  return elements.categorySelect.value.trim();
}

function updateCategoryVisibility() {}

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
