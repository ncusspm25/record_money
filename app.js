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

const DRAGON_STAGES = [
  {
    stage: 1,
    minDays: 0,
    name: "小火龍",
    badge: "初始型態",
    image: "assets/dragons/dragon-stage-1.png",
  },
  {
    stage: 2,
    minDays: 5,
    name: "展翼火龍",
    badge: "5 天進化",
    image: "assets/dragons/dragon-stage-2.png",
  },
  {
    stage: 3,
    minDays: 30,
    name: "終焰聖龍",
    badge: "30 天最終型態",
    image: "assets/dragons/dragon-stage-3.png",
  },
];

const CELEBRATION_IMAGES = [
  "assets/celebration/celebrate-tea-party.png",
  "assets/celebration/celebrate-bunny-coin.png",
  "assets/celebration/celebrate-checklist.png",
];

const state = {
  transactions: [],
  localTransactions: [],
  activeTab: "quick",
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
  renderDragonCompanion();
  renderQuickGlance();
  renderSummary();
  renderTransactions();
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

  const stickerImages = Array.from(overlay.querySelectorAll(".celebration-sticker"));
  const order = [...CELEBRATION_IMAGES].sort(() => Math.random() - 0.5);
  stickerImages.forEach((image, index) => {
    image.src = order[index % order.length];
  });

  overlay.hidden = false;
  const card = overlay.querySelector(".celebration-card");
  card.style.animation = "none";
  void card.offsetHeight;
  card.style.animation = "";
  for (const sticker of stickerImages) {
    sticker.style.animation = "none";
    void sticker.offsetHeight;
    sticker.style.animation = "";
  }
  setTimeout(() => { overlay.hidden = true; }, 2700);
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

  setActiveTab("quick");

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
  elements.formTitle.textContent = "快速記一筆";
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
    state.activeTab = settings.activeTab || state.activeTab;
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
      activeTab: state.activeTab,
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
