'use strict';

const STORAGE_KEY = 'homebound_journey_v1';
const SCHEMA_VERSION = 6;
const LEGACY_KEY = 'freedomCountdownData';
const PAYMENT_LEDGER_KEY = 'homebound_payment_ledger_v1';

const LEGACY_ORIGINAL = {
  consumerDebt: 35985.64,
  car: 35221.00,
  savingsGoal: 5000
};

const LEGACY_RATES = {
  cc1: 9.99,
  cc2: 13.99,
  zipPlus: 13.7,
  zipMoney: 0,
  car: 13.0
};

const LEGACY_DEFAULTS = {
  fund: 0,
  cc1: 9209.08,
  cc2: 18803,
  zipPlus: 3846,
  zipMoney: 2509,
  car: 27617.56,
  updatedAt: null,
  history: []
};

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseCurrency(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const cleaned = String(value ?? '').replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function syncLegacyBalance(milestone) {
  const keyMap = {
    'zip-money': 'zipMoney',
    'zip-plus': 'zipPlus',
    'cc1': 'cc1',
    'cc2': 'cc2',
    'car': 'car'
  };
  try {
    const legacy = readLegacyData();
    if (milestone.kind === 'savings' && milestone.id === 'fund') {
      legacy.fund = Math.max(0, safeNumber(milestone.starting) - safeNumber(milestone.balance));
    } else if (keyMap[milestone.id]) {
      legacy[keyMap[milestone.id]] = safeNumber(milestone.balance);
    }
    legacy.updatedAt = milestone.updatedAt || new Date().toISOString();
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
  } catch (error) {
    console.warn('Could not sync legacy balance', error);
  }
}


function readPaymentLedger() {
  try {
    const value = JSON.parse(localStorage.getItem(PAYMENT_LEDGER_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writePaymentLedger(ledger) {
  const payload = JSON.stringify(ledger);
  localStorage.setItem(PAYMENT_LEDGER_KEY, payload);
  return localStorage.getItem(PAYMENT_LEDGER_KEY) === payload;
}

function mergeLedgerIntoState(candidate) {
  const ledger = readPaymentLedger();
  if (!candidate || !Array.isArray(candidate.milestones)) return candidate;
  candidate.milestones.forEach(m => {
    const entries = Array.isArray(ledger[m.id]) ? ledger[m.id] : [];
    const existingIds = new Set((Array.isArray(m.payments) ? m.payments : []).map(x => x.id).filter(Boolean));
    if (!Array.isArray(m.payments)) m.payments = [];
    entries.forEach(entry => {
      if (!entry.id || !existingIds.has(entry.id)) m.payments.push(entry);
    });
    if (entries.length) {
      const latest = entries[entries.length - 1];
      if (Number.isFinite(Number(latest.balanceAfter))) m.balance = Number(latest.balanceAfter);
      if (latest.date) m.updatedAt = latest.date + 'T12:00:00.000Z';
    }
  });
  return candidate;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readLegacyData() {
  try {
    return { ...LEGACY_DEFAULTS, ...JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}') };
  } catch {
    return { ...LEGACY_DEFAULTS };
  }
}

function buildMilestonesFromLegacy(legacy) {
  const consumerCurrent = safeNumber(legacy.cc1) + safeNumber(legacy.cc2) + safeNumber(legacy.zipPlus) + safeNumber(legacy.zipMoney);
  const previouslyCleared = Math.max(0, LEGACY_ORIGINAL.consumerDebt - consumerCurrent);
  const fund = Math.max(0, safeNumber(legacy.fund));

  return [
    {
      id: 'zip-money',
      icon: '🏁',
      publicName: 'The Beginning',
      accountName: 'Zip Money',
      kind: 'debt',
      starting: safeNumber(legacy.zipMoney) + previouslyCleared,
      balance: safeNumber(legacy.zipMoney),
      interest: LEGACY_RATES.zipMoney,
      minPayment: 40,
      extraPayment: 0,
      frequency: 'week',
      due: '2027-01-14',
      why: 'Clearing this first stop creates momentum for every milestone that follows.',
      updatedAt: legacy.updatedAt || null,
      payments: []
    },
    {
      id: 'zip-plus',
      icon: '🌳',
      publicName: 'Building',
      accountName: 'Zip Plus',
      kind: 'debt',
      starting: safeNumber(legacy.zipPlus),
      balance: safeNumber(legacy.zipPlus),
      interest: LEGACY_RATES.zipPlus,
      minPayment: 300,
      extraPayment: 0,
      frequency: 'month',
      due: '2027-05-31',
      why: 'Moving through Forest Bend brings you closer to becoming completely Zip-free.',
      updatedAt: legacy.updatedAt || null,
      payments: []
    },
    {
      id: 'cc1',
      icon: '🌿',
      publicName: 'Growing',
      accountName: 'Credit Card 1',
      kind: 'debt',
      starting: safeNumber(legacy.cc1),
      balance: safeNumber(legacy.cc1),
      interest: LEGACY_RATES.cc1,
      minPayment: 459.95,
      extraPayment: 0,
      frequency: 'month',
      due: '2028-03-31',
      why: 'Crossing this bridge reduces interest and frees more of your monthly income.',
      updatedAt: legacy.updatedAt || null,
      payments: []
    },
    {
      id: 'cc2',
      icon: '🌳',
      publicName: 'Strengthening',
      accountName: 'Credit Card 2',
      kind: 'debt',
      starting: safeNumber(legacy.cc2),
      balance: safeNumber(legacy.cc2),
      interest: LEGACY_RATES.cc2,
      minPayment: 686,
      extraPayment: 0,
      frequency: 'month',
      due: '2028-12-31',
      why: 'This is the biggest climb, and completing it removes the largest consumer balance.',
      updatedAt: legacy.updatedAt || null,
      payments: []
    },
    {
      id: 'car',
      icon: '🚗',
      publicName: 'Freedom',
      accountName: 'Mahindra XUV700 loan',
      kind: 'debt',
      starting: LEGACY_ORIGINAL.car,
      balance: safeNumber(legacy.car),
      interest: LEGACY_RATES.car,
      minPayment: 151.17,
      extraPayment: 0,
      frequency: 'week',
      due: '',
      why: 'Each payment means more freedom and one step closer to owning your Mahindra outright.',
      updatedAt: legacy.updatedAt || null,
      payments: []
    },
    {
      id: 'fund',
      icon: '🏡',
      publicName: 'Security',
      accountName: 'Freedom Fund',
      kind: 'savings',
      starting: LEGACY_ORIGINAL.savingsGoal,
      balance: Math.max(0, LEGACY_ORIGINAL.savingsGoal - fund),
      saved: fund,
      interest: 0,
      minPayment: 0,
      extraPayment: 0,
      frequency: 'month',
      due: '2026-12-30',
      why: 'This fund protects your plans and gives every future decision more breathing room.',
      updatedAt: legacy.updatedAt || null,
      payments: []
    }
  ];
}

const defaults = {
  schemaVersion: SCHEMA_VERSION,
  recoveryDismissed: false,
  lastBackup: null,
  garden: {
    reflection: '',
    reflectionDate: null,
    relationshipMoments: 0,
    personalGrowthNotes: 0
  },
  today: {
    entries: []
  },
  milestones: buildMilestonesFromLegacy(LEGACY_DEFAULTS)
};

function looksLikePlaceholderState(candidate) {
  if (!candidate || !Array.isArray(candidate.milestones)) return false;
  const ids = candidate.milestones.map(m => m.id).sort().join('|');
  return ids === ['car-loan', 'emergency', 'home-deposit', 'trip'].sort().join('|');
}

function hasRealPaymentEvidence(milestone) {
  if (!milestone) return false;
  const payments = Array.isArray(milestone.payments) ? milestone.payments : [];
  const ledger = readPaymentLedger();
  return payments.length > 0 || (Array.isArray(ledger[milestone.id]) && ledger[milestone.id].length > 0);
}

function normalizeMilestones(candidateMilestones) {
  const legacy = readLegacyData();
  const canonical = buildMilestonesFromLegacy(legacy);
  const existing = Array.isArray(candidateMilestones) ? candidateMilestones : [];
  const byId = new Map(existing.filter(Boolean).map(m => [m.id, m]));

  const aliases = {
    'zip-money': ['zip-money', 'zipMoney', 'scenic-lookout'],
    'zip-plus': ['zip-plus', 'zipPlus', 'forest-bend'],
    'cc1': ['cc1', 'credit-card-1', 'river-crossing'],
    'cc2': ['cc2', 'credit-card-2', 'mountain-pass'],
    'car': ['car', 'car-loan', 'mahindra', 'sunrise-point'],
    'fund': ['fund', 'emergency', 'emergency-fund', 'home-path']
  };

  function findExisting(base) {
    for (const id of (aliases[base.id] || [base.id])) {
      if (byId.has(id)) return byId.get(id);
    }
    return existing.find(m => String(m.accountName || '').toLowerCase() === String(base.accountName || '').toLowerCase());
  }

  const normalized = canonical.map(base => {
    const current = findExisting(base);
    if (!current) return clone(base);
    const merged = { ...clone(base), ...current, id: base.id };
    const payments = Array.isArray(current.payments) ? current.payments : [];
    merged.payments = payments;

    const currentStarting = safeNumber(current.starting, NaN);
    const currentBalance = safeNumber(current.balance, NaN);
    const legacyBalance = safeNumber(base.balance);
    const suspiciousZero = currentBalance === 0 && legacyBalance > 0 && !hasRealPaymentEvidence(current);

    if (!Number.isFinite(currentStarting) || currentStarting <= 0) merged.starting = base.starting;
    if (!Number.isFinite(currentBalance) || currentBalance < 0 || suspiciousZero) merged.balance = legacyBalance;
    if (!merged.accountName) merged.accountName = base.accountName;
    if (!merged.kind) merged.kind = base.kind;
    return merged;
  });

  // Preserve genuine custom milestones, but never duplicate legacy aliases.
  const canonicalIds = new Set(normalized.map(m => m.id));
  existing.forEach(m => {
    if (!m || canonicalIds.has(m.id)) return;
    const isAlias = Object.values(aliases).flat().includes(m.id);
    if (!isAlias) normalized.push(m);
  });
  return mergeLedgerIntoState({ milestones: normalized }).milestones;
}

function load() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const base = (!stored || looksLikePlaceholderState(stored)) ? clone(defaults) : {
      ...clone(defaults),
      ...stored,
      garden: { ...clone(defaults.garden), ...(stored.garden || {}) },
      today: { ...clone(defaults.today), ...(stored.today || {}), entries: Array.isArray(stored.today?.entries) ? stored.today.entries : [] }
    };
    base.schemaVersion = SCHEMA_VERSION;
    base.milestones = normalizeMilestones(stored?.milestones);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
    return base;
  } catch (error) {
    console.warn('Homebound migration recovery used', error);
    const recovered = clone(defaults);
    recovered.schemaVersion = SCHEMA_VERSION;
    recovered.milestones = normalizeMilestones([]);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recovered)); } catch {}
    return recovered;
  }
}

let state = load();
let activeTab = 'home';
let selectedMilestone = null;
let activeSheetTab = 'overview';

function save() {
  state.schemaVersion = SCHEMA_VERSION;
  const payload = JSON.stringify(state);
  try {
    if (localStorage.getItem(STORAGE_KEY) !== payload) localStorage.setItem(STORAGE_KEY, payload);
    return localStorage.getItem(STORAGE_KEY) === payload;
  } catch (error) {
    console.error('Homebound save failed', error);
    return false;
  }
}

const money = n => new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0
}).format(safeNumber(n));

const money2 = n => new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(safeNumber(n));

function pct(m) {
  return Math.max(0, Math.min(100, ((safeNumber(m.starting) - safeNumber(m.balance)) / safeNumber(m.starting)) * 100 || 0));
}

function debtMilestones() {
  return state.milestones.filter(m => m.kind === 'debt');
}

function totals() {
  const debts = debtMilestones();
  const starting = debts.reduce((sum, m) => sum + safeNumber(m.starting), 0);
  const left = debts.reduce((sum, m) => sum + safeNumber(m.balance), 0);
  return {
    starting,
    left,
    cleared: Math.max(0, starting - left),
    percent: starting ? ((starting - left) / starting) * 100 : 0
  };
}

function greeting() {
  const now = new Date();
  const hour = now.getHours();
  const greetingText = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const skyIcon = hour < 11 ? '🌅' : hour < 17 ? '☀️' : hour < 20 ? '🌇' : '🌙';
  document.getElementById('greetingTitle').textContent = `${greetingText} ${skyIcon}`;
  document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(now);

}

function render() {
  const t = totals();
  const clearedNode = document.getElementById('clearedTogether');
  if (clearedNode) clearedNode.textContent = money(t.cleared);
  document.getElementById('journeyPercent').textContent = `${t.percent.toFixed(1)}%`;
  document.getElementById('journeyBar').style.setProperty('--progress', `${t.percent}%`);
  document.getElementById('recoveryBanner').hidden = state.recoveryDismissed;

  const next = debtMilestones().find(m => m.balance > 0) || debtMilestones()[0];
  document.getElementById('homeNextStopName').textContent = next ? next.publicName : 'Freedom';
  document.getElementById('homeNextStopDue').textContent = next ? `${money(next.balance)} left` : 'Completed';
  document.getElementById('overallJourneyPercent').textContent = `${t.percent.toFixed(1)}%`;
  document.getElementById('ringPercent').textContent = `${t.percent.toFixed(0)}%`;
  document.getElementById('summaryRing').style.setProperty('--ring', `${t.percent}%`);
  document.getElementById('totalStarting').textContent = money2(t.starting);
  document.getElementById('totalCleared').textContent = money2(t.cleared);
  document.getElementById('totalLeft').textContent = money2(t.left);
  renderMap();
  renderGarden();
  renderToday();
}

function gardenMetrics() {
  const t = totals();
  const fund = state.milestones.find(m => m.id === 'fund');
  const fundSaved = fund ? Math.max(0, safeNumber(fund.starting) - safeNumber(fund.balance)) : 0;
  const debtScore = Math.min(100, t.percent);
  const safetyScore = fund && safeNumber(fund.starting) ? Math.min(100, (fundSaved / safeNumber(fund.starting)) * 100) : 0;
  const overall = Math.max(0, Math.min(100, debtScore * 0.75 + safetyScore * 0.25));
  const stages = [
    { min: 0, title: 'New Sprout', icon: '🌱', message: 'A strong future starts with one small seed.' },
    { min: 15, title: 'Taking Root', icon: '🌿', message: 'Your steady choices are creating strong roots.' },
    { min: 35, title: 'Growing Strong', icon: '🌳', message: 'Your garden is becoming stronger with every step.' },
    { min: 60, title: 'Blooming', icon: '🌳🌸', message: 'Your progress is beginning to bloom beautifully.' },
    { min: 85, title: 'In Full Bloom', icon: '🌳🌸🦋', message: 'The future you planted together is flourishing.' }
  ];
  const stage = stages.filter(item => overall >= item.min).pop() || stages[0];
  return { ...t, fundSaved, safetyScore, overall, stage };
}

function recentGardenWins() {
  const entries = [];
  state.milestones.forEach(m => {
    (Array.isArray(m.payments) ? m.payments : []).forEach(payment => entries.push({
      date: payment.date,
      icon: m.kind === 'savings' ? '🌱' : '🌸',
      text: `${money2(payment.amount)} ${m.kind === 'savings' ? 'added to' : 'cleared from'} ${m.publicName}`
    }));
  });
  entries.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!entries.length) {
    return [
      { icon: '🌱', text: 'Your first saved update will appear here.' },
      { icon: '💛', text: 'Small steps still help your garden grow.' }
    ];
  }
  return entries.slice(0, 4);
}

function renderGarden() {
  const page = document.getElementById('gardenPage');
  if (!page) return;
  const g = gardenMetrics();
  document.getElementById('gardenStageTitle').textContent = g.stage.title;
  document.getElementById('gardenStageMessage').textContent = g.stage.message;
  document.getElementById('gardenTree').textContent = g.stage.icon;
  document.getElementById('gardenPercent').textContent = `${g.overall.toFixed(0)}%`;
  document.getElementById('gardenBar').style.setProperty('--progress', `${g.overall}%`);
  document.getElementById('financialHealthStatus').textContent = `${g.percent.toFixed(1)}% of debt cleared`;
  document.getElementById('futureHomeStatus').textContent = g.fundSaved > 0 ? `${money(g.fundSaved)} protected` : 'Planting the foundation';
  const wins = document.getElementById('gardenWins');
  wins.innerHTML = recentGardenWins().map(item => `<article><span>${item.icon}</span><p>${item.text}</p></article>`).join('');
  const reflection = document.getElementById('gardenReflection');
  if (reflection && document.activeElement !== reflection) reflection.value = state.garden?.reflection || '';
  const label = document.getElementById('reflectionSavedLabel');
  if (label) label.textContent = state.garden?.reflectionDate ? `Saved ${formatDate(state.garden.reflectionDate)}` : 'Saved only on this phone';
}

function gardenDetail(key) {
  const g = gardenMetrics();
  const details = {
    'future-home': ['🏡', 'Future Home', 'Every contribution brings your future front door a little closer.', `<div class="finance-grid"><div class="finance-stat"><small>Protected so far</small><strong>${money2(g.fundSaved)}</strong></div><div class="finance-stat"><small>Current safety goal</small><strong>${money2(LEGACY_ORIGINAL.savingsGoal)}</strong></div></div><div class="detail-block"><strong>Next step</strong><span>Keep strengthening Security first. The home-deposit chapter follows Freedom.</span></div>`],
    relationship: ['❤️', 'Relationship', 'The strongest future is one you keep building together.', `<div class="detail-block"><strong>Stronger every day</strong><span>Use Memories and Adventures to preserve the moments that matter. Relationship tracking stays gentle and private.</span></div>`],
    'financial-health': ['💰', 'Financial Health', 'Your financial roots strengthen whenever a balance falls or savings rise.', `<div class="finance-grid"><div class="finance-stat"><small>Debt cleared</small><strong>${money2(g.cleared)}</strong></div><div class="finance-stat"><small>Debt remaining</small><strong>${money2(g.left)}</strong></div><div class="finance-stat"><small>Journey complete</small><strong>${g.percent.toFixed(1)}%</strong></div><div class="finance-stat"><small>Security saved</small><strong>${money2(g.fundSaved)}</strong></div></div>`],
    'personal-growth': ['🌱', 'Personal Growth', 'Progress is more than money. It is also the habits and confidence you build together.', `<div class="detail-block"><strong>A small reflection</strong><span>Record one thing you learned, changed or appreciated in the Daily Reflection card.</span></div>`],
    'recent-wins': ['🌸', 'Recent Wins', 'The newest actions helping your garden grow.', `<div class="payment-list">${recentGardenWins().map(item => `<div class="payment-row"><span>${item.icon} ${item.text}</span></div>`).join('')}</div>`]
  };
  return details[key];
}


function localDateKey(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthKey(value) {
  return String(value || '').slice(0, 7);
}

function todayEntries() {
  state.today = state.today || clone(defaults.today);
  if (!Array.isArray(state.today.entries)) state.today.entries = [];
  return state.today.entries;
}

function allMoneyActivity() {
  const activity = todayEntries().map(entry => ({ ...entry, source: 'today' }));
  state.milestones.forEach(m => {
    (Array.isArray(m.payments) ? m.payments : []).forEach(payment => {
      activity.push({
        id: payment.id,
        date: payment.date,
        createdAt: payment.createdAt,
        type: m.kind === 'savings' ? 'savings' : 'journey',
        amount: safeNumber(payment.amount),
        title: m.kind === 'savings' ? `Saved to ${m.publicName}` : `Payment to ${m.publicName}`,
        category: m.accountName,
        milestoneId: m.id,
        source: 'journey'
      });
    });
  });
  return activity.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function activitySummary(periodKey, exactDay = false) {
  const entries = allMoneyActivity().filter(item => exactDay ? item.date === periodKey : monthKey(item.date) === periodKey);
  const sum = type => entries.filter(item => item.type === type).reduce((total, item) => total + safeNumber(item.amount), 0);
  const income = sum('income');
  const expenses = sum('expense');
  const journey = sum('journey');
  const savings = sum('savings');
  return { entries, income, expenses, journey, savings, left: income - expenses - journey - savings };
}

function activityIcon(item) {
  if (item.type === 'income') return '💰';
  if (item.type === 'expense') {
    const icons = { Groceries: '🛒', Fuel: '⛽', Dining: '🍽️', Bills: '🧾', Shopping: '🛍️', Transport: '🚕', Health: '❤️', Other: '💳' };
    return icons[item.category] || '💳';
  }
  if (item.type === 'savings') return '🌱';
  return '🚗';
}

function activityTitle(item) {
  return item.title || item.sourceName || item.category || (item.type === 'income' ? 'Income' : item.type === 'expense' ? 'Expense' : item.type === 'savings' ? 'Savings' : 'Journey payment');
}

function renderActivityRows(entries, limit = 6) {
  if (!entries.length) return '<div class="activity-empty">No activity yet. Use Quick add to record your first entry.</div>';
  return entries.slice(0, limit).map(item => {
    const incoming = item.type === 'income';
    const sign = incoming ? '+' : '−';
    return `<article class="activity-row"><span>${activityIcon(item)}</span><div><strong>${activityTitle(item)}</strong><small>${formatDate(item.date)}${item.note ? ` • ${item.note}` : ''}</small></div><b class="${incoming ? 'in' : 'out'}">${sign}${money2(item.amount)}</b></article>`;
  }).join('');
}

function renderToday() {
  const page = document.getElementById('todayPage');
  if (!page) return;
  const day = localDateKey();
  const month = monthKey(day);
  const daySummary = activitySummary(day, true);
  const monthSummary = activitySummary(month, false);
  const now = new Date();
  const dayText = new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const monthText = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(now);
  document.getElementById('todayPageDate').textContent = dayText;
  document.getElementById('todayOverviewDate').textContent = dayText;
  document.getElementById('todayMonthName').textContent = monthText;
  document.getElementById('todayIncome').textContent = money2(daySummary.income);
  document.getElementById('todaySpent').textContent = money2(daySummary.expenses + daySummary.journey);
  document.getElementById('todaySaved').textContent = money2(daySummary.savings);
  document.getElementById('todayPosition').textContent = `${money2(daySummary.left)} ${daySummary.left >= 0 ? 'remaining' : 'over'}`;
  document.getElementById('todayPositionMessage').textContent = daySummary.entries.length ? (daySummary.left >= 0 ? 'Your recorded activity is within today’s income.' : 'Today’s outgoings are above recorded income.') : 'Add income or spending to begin.';
  const pill = document.getElementById('todayStatusPill');
  pill.textContent = daySummary.left >= 0 ? 'On track' : 'Review';
  pill.classList.toggle('negative', daySummary.left < 0);
  document.getElementById('todayActivity').innerHTML = renderActivityRows(allMoneyActivity(), 6);
  document.getElementById('monthIncome').textContent = money2(monthSummary.income);
  document.getElementById('monthExpenses').textContent = money2(monthSummary.expenses);
  document.getElementById('monthJourney').textContent = money2(monthSummary.journey);
  document.getElementById('monthSavings').textContent = money2(monthSummary.savings);
  document.getElementById('monthMoneyLeft').textContent = money2(monthSummary.left);
  const homePosition = document.getElementById('homeTodayPosition');
  if (homePosition) homePosition.textContent = `${money(monthSummary.left)} left`;
  const homeBar = document.getElementById('homeTodayBar');
  if (homeBar) {
    const used = monthSummary.income > 0 ? Math.min(100, Math.max(0, ((monthSummary.expenses + monthSummary.journey + monthSummary.savings) / monthSummary.income) * 100)) : 0;
    homeBar.style.setProperty('--progress', `${used}%`);
  }
}

function todayEntryForm(type) {
  const isIncome = type === 'income';
  const categories = isIncome ? ['Salary', 'Side income', 'Refund', 'Gift', 'Other'] : ['Groceries', 'Fuel', 'Dining', 'Bills', 'Shopping', 'Transport', 'Health', 'Other'];
  openSheet([
    isIncome ? '💰' : '💳',
    isIncome ? 'Add income' : 'Add expense',
    isIncome ? 'Record money coming in.' : 'Record day-to-day spending.',
    `<div class="form-grid" id="todayEntryForm"><label>Amount<input id="todayEntryAmount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00"></label><label>${isIncome ? 'Source' : 'Category'}<select id="todayEntryCategory">${categories.map(item => `<option>${item}</option>`).join('')}</select></label><label>Date<input id="todayEntryDate" type="date" value="${localDateKey()}"></label><label>Note (optional)<input id="todayEntryNote" type="text" maxlength="80" placeholder="${isIncome ? 'Payday' : 'What was it for?'}"></label><div id="todayEntryStatus" class="save-status" role="status"></div><button class="primary-button" type="button" data-save-today-entry="${type}">Save ${isIncome ? 'income' : 'expense'}</button></div>`
  ]);
}

function saveTodayEntry(type) {
  const amount = parseCurrency(document.getElementById('todayEntryAmount')?.value, NaN);
  const category = String(document.getElementById('todayEntryCategory')?.value || 'Other');
  const date = String(document.getElementById('todayEntryDate')?.value || '');
  const note = String(document.getElementById('todayEntryNote')?.value || '').trim();
  const status = document.getElementById('todayEntryStatus');
  if (!Number.isFinite(amount) || amount <= 0) { if (status) { status.textContent = 'Enter an amount greater than $0.'; status.classList.add('error'); } return; }
  if (!date) { if (status) { status.textContent = 'Choose a date.'; status.classList.add('error'); } return; }
  todayEntries().push({ id: 't-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), type, amount, category, title: category, date, note, createdAt: new Date().toISOString() });
  if (!save()) { if (status) { status.textContent = 'Could not save this entry.'; status.classList.add('error'); } return; }
  render();
  closeSheet();
  switchTab('today');
  toast(`${type === 'income' ? '💰' : '💳'} ${type === 'income' ? 'Income' : 'Expense'} saved`);
}

function todayJourneyForm(mode = 'journey') {
  const choices = mode === 'savings' ? state.milestones.filter(m => m.kind === 'savings') : debtMilestones().filter(m => m.balance > 0);
  const fallback = mode === 'savings' ? state.milestones.filter(m => m.kind === 'savings') : debtMilestones();
  const milestones = choices.length ? choices : fallback;
  openSheet([
    mode === 'savings' ? '🌱' : '🚗',
    mode === 'savings' ? 'Transfer to savings' : 'Journey payment',
    mode === 'savings' ? 'Grow your Security fund.' : 'Reduce one of your tracked balances.',
    `<div class="form-grid"><label>${mode === 'savings' ? 'Savings goal' : 'Milestone'}<select id="todayMilestoneId">${milestones.map(m => `<option value="${m.id}">${m.publicName} — ${m.accountName}</option>`).join('')}</select></label><label>Amount<input id="todayMilestoneAmount" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00"></label><label>Date<input id="todayMilestoneDate" type="date" value="${localDateKey()}"></label><div class="today-form-note">This updates Journey, Garden, Home and Today together.</div><div id="todayMilestoneStatus" class="save-status" role="status"></div><button class="primary-button" type="button" data-save-today-milestone="${mode}">Save update</button></div>`
  ]);
}

function persistMilestonePayment(m, amount, date, type) {
  if (!m || !Number.isFinite(amount) || amount <= 0 || !date) throw new Error('Invalid payment');
  if (!Array.isArray(m.payments)) m.payments = [];
  let interest = 0;
  let newBalance = safeNumber(m.balance);
  if (m.kind === 'savings') {
    newBalance = Math.max(0, newBalance - amount);
    m.saved = Math.max(0, safeNumber(m.starting) - newBalance);
  } else {
    const previousDate = m.updatedAt ? new Date(m.updatedAt) : new Date(date + 'T00:00:00');
    const currentDate = new Date(date + 'T00:00:00');
    const days = Math.max(0, Math.round((currentDate - previousDate) / 86400000));
    interest = newBalance * (safeNumber(m.interest) / 100) * (days / 365);
    newBalance = Math.max(0, newBalance + interest - amount);
  }
  const entry = { id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), amount, date, type, interest, balanceAfter: newBalance, createdAt: new Date().toISOString() };
  m.balance = newBalance;
  m.updatedAt = date + 'T12:00:00.000Z';
  m.payments.push(entry);
  const ledger = readPaymentLedger();
  if (!Array.isArray(ledger[m.id])) ledger[m.id] = [];
  ledger[m.id].push(entry);
  if (!save()) throw new Error('State save failed');
  if (!writePaymentLedger(ledger)) throw new Error('Ledger save failed');
  syncLegacyBalance(m);
  return entry;
}

function saveTodayMilestone(mode) {
  const m = state.milestones.find(item => item.id === document.getElementById('todayMilestoneId')?.value);
  const amount = parseCurrency(document.getElementById('todayMilestoneAmount')?.value, NaN);
  const date = String(document.getElementById('todayMilestoneDate')?.value || '');
  const status = document.getElementById('todayMilestoneStatus');
  try {
    persistMilestonePayment(m, amount, date, mode === 'savings' ? 'Savings transfer' : 'Journey payment');
    state = load();
    render();
    closeSheet();
    switchTab('today');
    toast(`${mode === 'savings' ? '🌱 Savings' : '🚗 Payment'} saved`);
  } catch (error) {
    console.error(error);
    if (status) { status.textContent = !Number.isFinite(amount) || amount <= 0 ? 'Enter an amount greater than $0.' : 'Could not save this update.'; status.classList.add('error'); }
  }
}

function openTodayMonthActivity() {
  const month = monthKey(localDateKey());
  const entries = allMoneyActivity().filter(item => monthKey(item.date) === month);
  openSheet(['📅', 'This month', 'All recorded money activity for the current month.', `<div class="today-activity">${renderActivityRows(entries, 100)}</div>`]);
}

function renderMap() {
  const map = document.getElementById('milestoneMap');
  map.innerHTML = '<div class="map-start"><span>🏁</span><div><strong>Start</strong><br><small>Your journey begins</small></div></div>' +
    state.milestones.map(m => {
      const progress = pct(m);
      const completed = m.balance <= 0;
      const attention = !completed && m.due && new Date(m.due) < new Date(Date.now() + 7 * 86400000);
      return `<button class="milestone-card ${completed ? 'completed' : attention ? 'attention' : ''}" data-milestone="${m.id}">
        <span class="milestone-icon">${m.icon}</span>
        <span class="milestone-copy">
          <span class="milestone-title-row"><strong>${m.publicName}</strong><i class="milestone-status-dot"></i></span>
          <b>${progress.toFixed(0)}%</b>
          <span class="bar"><i style="--progress:${progress}%"></i></span>
          <small>${completed ? 'Completed' : money(m.balance) + (m.kind === 'savings' ? ' to goal' : ' left')}</small>
          ${m.payments && m.payments.length ? `<small class="last-payment">Last update: ${money2(m.payments[m.payments.length - 1].amount)}</small>` : ''}
        </span>
        <span class="milestone-next">
          <small>${completed ? 'Well done' : m.kind === 'savings' ? 'Target date' : 'Target payoff'}</small>
          <b>${completed ? '🎉' : formatDate(m.due)}</b>
          <span class="chev">›</span>
        </span>
      </button>`;
    }).join('') +
    '<div class="map-finish"><span>🏆</span><div><strong>Freedom</strong><br><small>The best is yet to come.</small></div></div>';
}

function formatDate(value) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value + 'T00:00:00'));
}

function switchTab(tab) {
  if (!['home', 'journey', 'garden', 'today'].includes(tab)) {
    openSheet(['🔒', 'Coming next', 'This tab will be built after Today is completed.', '']);
    return;
  }
  activeTab = tab;
  const pages = { home: 'homePage', journey: 'journeyPage', garden: 'gardenPage', today: 'todayPage' };
  Object.entries(pages).forEach(([name, id]) => {
    const page = document.getElementById(id);
    page.hidden = name !== tab;
    page.classList.toggle('active-page', name === tab);
  });
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tab);
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (tab === 'garden') renderGarden();
  if (tab === 'today') renderToday();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetSheetScroll(id = 'detailSheet') {
  const panel = document.querySelector(`#${id} .sheet-panel`);
  if (panel) panel.scrollTop = 0;
}

function openSheet(data) {
  document.getElementById('sheetIcon').textContent = data[0];
  document.getElementById('sheetTitle').textContent = data[1];
  document.getElementById('sheetDescription').textContent = data[2] || '';
  document.getElementById('sheetContent').innerHTML = data[3] || '';
  const sheet = document.getElementById('detailSheet');
  sheet.setAttribute('aria-hidden', 'false');
  resetSheetScroll();
  document.body.classList.add('sheet-open');
}

function closeSheet(id = 'detailSheet') {
  const sheet = document.getElementById(id);
  if (!sheet) return;
  sheet.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('sheet-open');
}

function currentNextStop() {
  return debtMilestones().find(m => m.balance > 0) || debtMilestones()[0];
}

function getHomeDetails(key) {
  const next = currentNextStop();
  const details = {
    today: ['☀️', 'Today’s focus', 'A calm overview of what matters next.', ''],
    'next-stop': ['📍', 'Next Stop', 'Your next financial milestone.', next ? `<div class="detail-block"><strong>${next.publicName}</strong><span>${next.accountName} • ${money2(next.balance)} left to go.</span></div>` : ''],
    'next-adventure': ['🌊', 'Next Adventure', 'The next experience you are looking forward to together.', '<div class="detail-block"><strong>Esperance</strong><span>Your planned trip remains separate from the debt balances.</span></div>'],
    garden: ['🌳', 'Garden', 'Your savings and net worth represented as something beautiful growing.', ''],
    dreams: ['⭐', 'Dreams', 'Your shared vision board.', ''],
    memories: ['📖', 'Memories', 'Your shared timeline of photos, trips and milestones.', ''],
    wins: ['🏆', 'Wins', 'Celebrate every meaningful achievement.', ''],
    adventures: ['🧭', 'Adventures', 'Plan your next trip and preserve completed journeys.', '']
  };
  return details[key];
}

function milestoneSheet(id, tab = 'overview') {
  selectedMilestone = state.milestones.find(m => m.id === id);
  if (!selectedMilestone) return;
  activeSheetTab = tab;
  const m = selectedMilestone;
  const progress = pct(m);
  const tabs = `<div class="sheet-tabs">${['overview', 'payments', 'plan', 'notes'].map(name => `<button data-sheet-tab="${name}" class="${name === tab ? 'active' : ''}">${name[0].toUpperCase() + name.slice(1)}</button>`).join('')}</div>`;
  let body = '';

  if (tab === 'overview') {
    body = `<div class="account-reveal"><small>Account behind this milestone</small><strong>${m.accountName}</strong></div>
      <div class="finance-grid">
        <div class="finance-stat"><small>${m.kind === 'savings' ? 'Amount still needed' : 'Current balance'}</small><strong>${money2(m.balance)}</strong></div>
        <div class="finance-stat"><small>Tracked starting amount</small><strong>${money2(m.starting)}</strong></div>
        <div class="finance-stat"><small>Interest rate</small><strong>${safeNumber(m.interest).toFixed(2)}% p.a.</strong></div>
        <div class="finance-stat"><small>Estimated payoff</small><strong>${estimatePayoff(m)}</strong></div>
        <div class="finance-stat"><small>Minimum payment</small><strong>${money2(m.minPayment)} / ${m.frequency}</strong></div>
        <div class="finance-stat"><small>Extra payment</small><strong>${money2(m.extraPayment)} / ${m.frequency}</strong></div>
      </div>
      <div class="detail-block"><strong>💡 Why it matters</strong><span>${m.why}</span></div>
      <button class="primary-button" data-add-payment="${m.id}">${m.kind === 'savings' ? 'Add savings' : 'Make a payment'}</button>`;
  }

  if (tab === 'payments') {
    body = `<div class="payment-list">${m.payments.length ? m.payments.slice().reverse().map(item => `<div class="payment-row"><span>${new Intl.DateTimeFormat('en-AU').format(new Date(item.date + 'T00:00:00'))}<br><small>${item.type || 'Payment'}${item.interest ? ` • ${money2(item.interest)} estimated interest` : ''}</small></span><b>${money2(item.amount)}</b></div>`).join('') : '<div class="detail-block"><strong>No payments yet</strong><span>Your new payment history will appear here. Your previous app’s current balances have already been imported.</span></div>'}</div>
      <button class="secondary-button" data-add-payment="${m.id}">＋ Add payment</button>`;
  }

  if (tab === 'plan') {
    body = `<div class="form-grid"><label>Extra payment<input id="whatIfExtra" type="number" min="0" value="${m.extraPayment || 100}"></label><label>Frequency<select id="whatIfFrequency"><option value="week">per week</option><option value="month">per month</option></select></label><button class="primary-button" data-calc-plan="${m.id}">Calculate impact</button></div><div id="planResult"></div>`;
  }

  if (tab === 'notes') {
    body = `<div class="detail-block"><strong>Account name</strong><span>${m.accountName}</span></div><div class="detail-block"><strong>Why it matters</strong><span>${m.why}</span></div>`;
  }

  openSheet([m.icon, m.publicName, `${progress.toFixed(1)}% complete • ${money2(m.balance)} ${m.kind === 'savings' ? 'to goal' : 'left'}`, tabs + body]);
}

function paymentPerMonth(m, extra = m.extraPayment, frequency = m.frequency) {
  const base = safeNumber(m.minPayment);
  const extraAmount = safeNumber(extra);
  const multiplier = frequency === 'week' ? 52 / 12 : 1;
  return (base + extraAmount) * multiplier;
}

function estimatePayoff(m, extra = m.extraPayment, frequency = m.frequency) {
  if (m.kind === 'savings') {
    const monthly = paymentPerMonth(m, extra, frequency);
    if (monthly <= 0) return m.due ? formatDate(m.due) : 'Not set';
    const months = Math.ceil(m.balance / monthly);
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    return new Intl.DateTimeFormat('en-AU', { month: 'short', year: 'numeric' }).format(date);
  }

  const monthlyPayment = paymentPerMonth(m, extra, frequency);
  if (monthlyPayment <= 0) return 'Not set';
  const monthlyRate = safeNumber(m.interest) / 100 / 12;
  let months;
  if (monthlyRate <= 0) months = Math.ceil(m.balance / monthlyPayment);
  else if (monthlyPayment <= m.balance * monthlyRate) return 'Payment too low';
  else months = Math.ceil(-Math.log(1 - (monthlyRate * m.balance) / monthlyPayment) / Math.log(1 + monthlyRate));
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return new Intl.DateTimeFormat('en-AU', { month: 'short', year: 'numeric' }).format(date);
}

function paymentForm(id) {
  const m = state.milestones.find(item => item.id === id);
  if (!m) return;
  openSheet([m.icon, m.kind === 'savings' ? `Add to ${m.publicName}` : `Pay ${m.publicName}`, 'Record the amount and update your real balance.', `<div id="paymentForm" class="form-grid"><input id="paymentMilestoneId" type="hidden" value="${m.id}"><label>Amount<input id="paymentAmount" type="text" inputmode="decimal" autocomplete="off" placeholder="151.17"></label><label>Date<input id="paymentDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></label><label>Type<select id="paymentType"><option>Minimum payment</option><option>Extra payment</option><option>Minimum + extra</option><option>Statement adjustment</option></select></label><div id="paymentSaveStatus" class="save-status" role="status"></div><button id="savePaymentButton" class="primary-button" type="button" data-save-payment="${m.id}">Save update</button></div>`]);
  setTimeout(() => document.getElementById('paymentAmount')?.focus(), 120);
}

function setPaymentStatus(message, isError = false) {
  const el = document.getElementById('paymentSaveStatus');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', isError);
}

function commitPaymentDirect(milestoneId) {
  const m = state.milestones.find(item => item.id === milestoneId);
  const amountInput = document.getElementById('paymentAmount');
  const dateInput = document.getElementById('paymentDate');
  const typeInput = document.getElementById('paymentType');
  const saveButton = document.getElementById('savePaymentButton');
  const amount = parseCurrency(amountInput?.value, NaN);
  const date = String(dateInput?.value || '');
  const type = String(typeInput?.value || 'Payment');
  if (!m) { setPaymentStatus('Milestone not found.', true); return; }
  if (!Number.isFinite(amount) || amount <= 0) { setPaymentStatus('Enter an amount greater than $0.', true); amountInput?.focus(); return; }
  if (!date) { setPaymentStatus('Choose a payment date.', true); dateInput?.focus(); return; }
  saveButton.disabled = true;
  saveButton.textContent = 'Saving…';
  setPaymentStatus('Saving payment…');
  try {
    if (type === 'Statement adjustment') {
      const oldBalance = m.balance;
      m.balance = Math.max(0, amount);
      m.updatedAt = date + 'T12:00:00.000Z';
      const entry = { id: 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), amount: Math.abs(oldBalance - m.balance), date, type, interest: 0, balanceAfter: m.balance, createdAt: new Date().toISOString() };
      if (!Array.isArray(m.payments)) m.payments = [];
      m.payments.push(entry);
      const ledger = readPaymentLedger();
      if (!Array.isArray(ledger[m.id])) ledger[m.id] = [];
      ledger[m.id].push(entry);
      if (!save() || !writePaymentLedger(ledger)) throw new Error('Save failed');
      syncLegacyBalance(m);
    } else {
      persistMilestonePayment(m, amount, date, type);
    }
    state = load();
    render();
    milestoneSheet(m.id, 'payments');
    toast(`✅ Saved ${money2(amount)}`);
  } catch (error) {
    console.error('Payment save failed', error);
    saveButton.disabled = false;
    saveButton.textContent = 'Save update';
    setPaymentStatus('Could not save this payment. Please try once more.', true);
  }
}

function addMilestoneForm() {
  openSheet(['＋', 'New milestone', 'Add another step to your roadmap.', `<form id="milestoneForm" class="form-grid"><label>Emoji<input name="icon" value="🎯" maxlength="4"></label><label>Milestone name<input name="publicName" required placeholder="New milestone"></label><label>Account name<input name="accountName" required placeholder="The real account or goal"></label><label>Starting amount<input name="starting" type="number" min="1" required inputmode="decimal"></label><label>Current balance<input name="balance" type="number" min="0" required inputmode="decimal"></label><label>Interest rate %<input name="interest" type="number" step="0.01" value="0" inputmode="decimal"></label><label>Minimum payment<input name="minPayment" type="number" min="0" value="0" inputmode="decimal"></label><label>Payment frequency<select name="frequency"><option value="month">Monthly</option><option value="week">Weekly</option></select></label><label>Target date<input name="due" type="date"></label><label>Why it matters<textarea name="why" placeholder="What will this milestone change for your family?"></textarea></label><button class="primary-button" type="submit">Add to journey</button></form>`]);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify({ version: 9, exportedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `homebound-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  state.lastBackup = new Date().toISOString();
  save();
  toast('💾 Backup created');
}

function toast(text) {
  let node = document.querySelector('.success-toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'success-toast';
    document.body.append(node);
  }
  node.textContent = text;
  node.classList.add('show');
  setTimeout(() => node.classList.remove('show'), 2200);
}

document.addEventListener('click', event => {
  const closeDetail = event.target.closest('[data-close-sheet]');
  if (closeDetail) {
    closeSheet();
    return;
  }
  const closeNotifications = event.target.closest('[data-close-notifications]');
  if (closeNotifications) {
    closeSheet('notificationsSheet');
    return;
  }

  const tab = event.target.closest('[data-tab]');
  if (tab) {
    switchTab(tab.dataset.tab);
    return;
  }

  const detail = event.target.closest('[data-detail]');
  if (detail) {
    openSheet(getHomeDetails(detail.dataset.detail));
    return;
  }

  const gardenCard = event.target.closest('[data-garden-card]');
  if (gardenCard) {
    openSheet(gardenDetail(gardenCard.dataset.gardenCard));
    return;
  }

  const milestone = event.target.closest('[data-milestone]');
  if (milestone) {
    milestoneSheet(milestone.dataset.milestone);
    return;
  }

  const sheetTab = event.target.closest('[data-sheet-tab]');
  if (sheetTab && selectedMilestone) {
    milestoneSheet(selectedMilestone.id, sheetTab.dataset.sheetTab);
    return;
  }

  const pay = event.target.closest('[data-add-payment]');
  if (pay) {
    paymentForm(pay.dataset.addPayment);
    return;
  }

  const savePayment = event.target.closest('[data-save-payment]');
  if (savePayment) {
    commitPaymentDirect(savePayment.dataset.savePayment);
    return;
  }

  const calc = event.target.closest('[data-calc-plan]');
  if (calc) {
    const extra = safeNumber(document.getElementById('whatIfExtra').value);
    const frequency = document.getElementById('whatIfFrequency').value;
    const m = state.milestones.find(item => item.id === calc.dataset.calcPlan);
    document.getElementById('planResult').innerHTML = `<div class="calc-result"><div><small>Current payoff</small><strong>${estimatePayoff(m, 0, m.frequency)}</strong></div><div><small>With extra payment</small><strong>${estimatePayoff(m, extra, frequency)}</strong></div></div>`;
    return;
  }

  const todayAdd = event.target.closest('[data-today-add]');
  if (todayAdd) {
    if (todayAdd.dataset.todayAdd === 'income' || todayAdd.dataset.todayAdd === 'expense') todayEntryForm(todayAdd.dataset.todayAdd);
    else todayJourneyForm(todayAdd.dataset.todayAdd);
    return;
  }

  const saveToday = event.target.closest('[data-save-today-entry]');
  if (saveToday) { saveTodayEntry(saveToday.dataset.saveTodayEntry); return; }

  const saveTodayMilestoneButton = event.target.closest('[data-save-today-milestone]');
  if (saveTodayMilestoneButton) { saveTodayMilestone(saveTodayMilestoneButton.dataset.saveTodayMilestone); return; }

  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'backup') exportBackup();
    else if (action.dataset.action === 'payment') {
      const next = currentNextStop();
      if (next) paymentForm(next.id);
    } else {
      openSheet([action.dataset.action === 'memory' ? '📷' : '⭐', action.dataset.action === 'memory' ? 'Add a memory' : 'Add a dream', 'This feature comes after Journey approval.', '']);
    }
  }
});

document.addEventListener('submit', event => {
  if (event.target.id === 'milestoneForm') {
    event.preventDefault();
    const data = new FormData(event.target);
    state.milestones.push({
      id: 'm-' + Date.now(),
      icon: data.get('icon') || '🎯',
      publicName: data.get('publicName'),
      accountName: data.get('accountName'),
      kind: 'debt',
      starting: safeNumber(data.get('starting')),
      balance: safeNumber(data.get('balance')),
      interest: safeNumber(data.get('interest')),
      minPayment: safeNumber(data.get('minPayment')),
      extraPayment: 0,
      frequency: data.get('frequency'),
      due: data.get('due'),
      why: data.get('why') || 'A meaningful step on your road home.',
      updatedAt: null,
      payments: []
    });
    save();
    render();
    closeSheet();
    toast('Milestone added');
  }
});

document.getElementById('addMilestoneButton').addEventListener('click', addMilestoneForm);
document.getElementById('notificationsButton').addEventListener('click', () => {
  document.getElementById('notificationsSheet').setAttribute('aria-hidden', 'false');
  resetSheetScroll('notificationsSheet');
  document.getElementById('notificationBadge').hidden = true;
  document.body.classList.add('sheet-open');
});
document.getElementById('dismissRecovery').addEventListener('click', () => {
  state.recoveryDismissed = true;
  save();
  render();
});

const saveReflectionButton = document.getElementById('saveReflectionButton');
if (saveReflectionButton) {
  saveReflectionButton.addEventListener('click', () => {
    const reflection = document.getElementById('gardenReflection');
    state.garden = state.garden || clone(defaults.garden);
    state.garden.reflection = String(reflection?.value || '').trim();
    state.garden.reflectionDate = new Date().toISOString().slice(0, 10);
    if (save()) {
      renderGarden();
      toast('🌼 Reflection saved');
    } else {
      toast('Could not save reflection');
    }
  });
}

const todayAddButton = document.getElementById('todayAddButton');
if (todayAddButton) todayAddButton.addEventListener('click', () => todayEntryForm('expense'));
const todayViewAllButton = document.getElementById('todayViewAllButton');
if (todayViewAllButton) todayViewAllButton.addEventListener('click', openTodayMonthActivity);

const carousel = document.getElementById('lifeCarousel');
const dots = [...document.querySelectorAll('.carousel-dots i')];
carousel.addEventListener('scroll', () => {
  const max = Math.max(1, carousel.scrollWidth - carousel.clientWidth);
  const index = Math.min(dots.length - 1, Math.round((carousel.scrollLeft / max) * (dots.length - 1)));
  dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
}, { passive: true });

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeSheet();
    closeSheet('notificationsSheet');
  }
});


/* Journey Story + Dreams & Holiday Planner v1 */
const STORY_CHAPTERS = [
  { id:'zip-money', name:'The Beginning', icon:'🏁', theme:'beginning', line:'Every journey starts with a decision.' },
  { id:'zip-plus', name:'Building', icon:'🌱', theme:'building', line:'We’re laying the foundation for our future.' },
  { id:'cc1', name:'Growing', icon:'🌿', theme:'growing', line:'Little by little, we’re getting stronger.' },
  { id:'cc2', name:'Strengthening', icon:'🌳', theme:'strengthening', line:'Our roots run deep. Our future is secure.' },
  { id:'car', name:'Freedom', icon:'🎉', theme:'freedom', line:'The final debt chapter before we become debt-free.' },
  { id:'fund', name:'Security', icon:'🛡️', theme:'security', line:'Building our safety net for life’s surprises.' },
  { id:'home-goal', name:'Our Home', icon:'🏡', theme:'our-home', line:'Every contribution brings our future front door closer.' },
  { id:'welcome-home', name:'Welcome Home', icon:'❤️', theme:'welcome-home', line:'The destination of our journey together.' }
];

function ensureFoundationState(){
  const defaultDreamBoard = [
    {id:'dream-home',icon:'🏡',name:'Our Future Home',subtitle:'Deposit saved',saved:0,target:90000,targetLabel:'Target 2029'},
    {id:'dream-car',icon:'🚙',name:'Next Family Car',subtitle:'Dream fund',saved:0,target:37000,targetLabel:'Someday'},
    {id:'holiday-planner',icon:'🌴',name:'Holiday Planner',subtitle:'Trips, budgets and memories',linked:true},
    {id:'dream-dog',icon:'🐶',name:'First Dog',subtitle:'Planning',saved:0,target:0,targetLabel:'Someday'},
    {id:'dream-renovation',icon:'🛋️',name:'Renovation Ideas',subtitle:'Someday',saved:0,target:0,targetLabel:'Someday'},
    {id:'dream-family',icon:'❤️',name:'Family Goals',subtitle:'Our bigger dreams',saved:0,target:0,targetLabel:'Someday'}
  ];
  state.dreams = state.dreams || { board:[], trips:[], memories:[] };
  state.dreams.board = Array.isArray(state.dreams.board) ? state.dreams.board : [];
  const dreamById = new Map(state.dreams.board.map(d => [d.id, d]));
  defaultDreamBoard.forEach(d => { if (!dreamById.has(d.id)) state.dreams.board.push(clone(d)); });
  state.milestones = normalizeMilestones(state.milestones);
  state.dreams.trips = Array.isArray(state.dreams.trips) ? state.dreams.trips : [];
  state.dreams.memories = Array.isArray(state.dreams.memories) ? state.dreams.memories : [];
  if (!state.milestones.find(m=>m.id==='home-goal')) state.milestones.push({id:'home-goal',icon:'🏡',publicName:'Our Home',accountName:'Home deposit goal',kind:'savings',starting:120000,balance:120000,saved:0,interest:0,minPayment:0,extraPayment:0,frequency:'month',due:'',why:'Every contribution brings your future front door a little closer.',updatedAt:null,payments:[]});
  if (!state.milestones.find(m=>m.id==='welcome-home')) state.milestones.push({id:'welcome-home',icon:'❤️',publicName:'Welcome Home',accountName:'Our forever home',kind:'future',starting:1,balance:1,interest:0,minPayment:0,extraPayment:0,frequency:'month',due:'',why:'You did it. Welcome home.',updatedAt:null,payments:[]});
  STORY_CHAPTERS.forEach(c=>{const m=state.milestones.find(x=>x.id===c.id); if(m){m.publicName=c.name;m.icon=c.icon;m.storyLine=c.line;}});
  save();
}
ensureFoundationState();

function chapterProgress(chapter){
  const m=state.milestones.find(x=>x.id===chapter.id);
  if(!m) return 0;
  if(chapter.id==='welcome-home') return state.milestones.find(x=>x.id==='home-goal')?.balance<=0 ? 100 : 0;
  return pct(m);
}
function chapterStatus(index){
  const progresses=STORY_CHAPTERS.map(chapterProgress);
  const firstIncomplete=progresses.findIndex(v=>v<100);
  if(progresses[index]>=100) return 'completed';
  return index===(firstIncomplete<0?STORY_CHAPTERS.length-1:firstIncomplete)?'current':'upcoming';
}
function renderMap(){
  const map=document.getElementById('milestoneMap'); if(!map)return;
  map.innerHTML=STORY_CHAPTERS.map((c,index)=>{
    const m=state.milestones.find(x=>x.id===c.id); const progress=chapterProgress(c); const status=chapterStatus(index);
    const cleared=m&&m.kind==='debt'?Math.max(0,safeNumber(m.starting)-safeNumber(m.balance)):m&&m.kind==='savings'?Math.max(0,safeNumber(m.starting)-safeNumber(m.balance)):0;
    const amountLabel=c.id==='welcome-home'?'Our final chapter':`${money(cleared)} ${m?.kind==='debt'?'debt cleared':'built'}`;
    return `<button class="story-card ${c.theme} ${status}" data-milestone="${c.id}">
      <span class="story-node">${status==='completed'?'✓':status==='current'?'●':'○'}</span>
      <span class="story-icon">${c.icon}</span><span class="story-copy"><small>CHAPTER ${index+1}</small><strong>${c.name}</strong><p>${c.line}</p><div class="story-card-progress"><i style="width:${progress}%"></i></div><span>${progress.toFixed(0)}% · ${amountLabel}</span></span><b>›</b>
    </button>`;
  }).join('');
}

function storyMilestoneSheet(id,tab='overview'){
  const chapter=STORY_CHAPTERS.find(c=>c.id===id); const m=state.milestones.find(x=>x.id===id); if(!chapter||!m)return;
  if(id==='welcome-home'){
    openSheet(['❤️','Welcome Home','The destination of your journey together.',`<div class="welcome-celebration"><div>🏡</div><h3>You did it.</h3><p>Every payment. Every sacrifice. Every dream brought you here.</p><p>This is just the beginning of your beautiful life together.</p></div>`]); return;
  }
  selectedMilestone=m; activeSheetTab=tab; const progress=pct(m);
  const tabs=`<div class="sheet-tabs">${['overview','payments','plan'].map(x=>`<button data-sheet-tab="${x}" class="${x===tab?'active':''}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div>`;
  let body='';
  if(tab==='overview') body=`<div class="chapter-hero ${chapter.theme}"><span>${chapter.icon}</span><div><small>CURRENT CHAPTER</small><h3>${chapter.name}</h3><p>${chapter.line}</p></div></div><div class="progress-panel"><small>DEBT REDUCTION PROGRESS</small><strong>${progress.toFixed(1)}%</strong><div class="story-progress"><i style="width:${progress}%"></i></div><div class="split-values"><span>Cleared <b>${money2(Math.max(0,m.starting-m.balance))}</b></span><span>Remaining <b>${money2(m.balance)}</b></span></div></div><div class="account-reveal"><small>Account behind this chapter</small><strong>${m.accountName}</strong></div><div class="finance-grid"><div class="finance-stat"><small>Starting balance</small><strong>${money2(m.starting)}</strong></div><div class="finance-stat"><small>Current balance</small><strong>${money2(m.balance)}</strong></div><div class="finance-stat"><small>Interest rate</small><strong>${safeNumber(m.interest).toFixed(2)}% p.a.</strong></div><div class="finance-stat"><small>Target payoff</small><strong>${formatDate(m.due)}</strong></div></div><div class="detail-block"><strong>💡 Why it matters</strong><span>${m.why||chapter.line}</span></div><button class="primary-button" data-add-payment="${m.id}">${m.kind==='savings'?'Add contribution':'Make a payment'}</button>`;
  else if(tab==='payments') body=`<div class="payment-list">${(m.payments||[]).slice().reverse().map(p=>`<article><div><strong>${formatDate(p.date)}</strong><small>${p.type||'Payment'}</small></div><b>${money2(p.amount)}</b></article>`).join('')||'<p class="empty-copy">No payments recorded yet.</p>'}</div><button class="primary-button" data-add-payment="${m.id}">Add payment</button>`;
  else body=`<div class="detail-block"><strong>What if I pay more?</strong><span>Compare an extra payment with your current plan.</span></div><div class="form-grid"><label>Extra payment<input id="whatIfExtra" type="number" min="0" value="100" inputmode="decimal"></label><label>Frequency<select id="whatIfFrequency"><option value="week">Weekly</option><option value="month">Monthly</option></select></label><button class="primary-button" data-calc-plan="${m.id}">Calculate</button></div><div id="planResult"></div>`;
  openSheet([chapter.icon,chapter.name,'Your family story — one debt at a time.',tabs+body]);
}
milestoneSheet=storyMilestoneSheet;

function tripSpent(trip){return (trip.expenses||[]).reduce((s,e)=>s+safeNumber(e.amount),0)}
function tripRemaining(trip){return Math.max(0,safeNumber(trip.budget)-tripSpent(trip))}
function tripPercent(trip){return safeNumber(trip.budget)?Math.min(100,tripSpent(trip)/safeNumber(trip.budget)*100):0}
function daysUntil(date){if(!date)return null;return Math.ceil((new Date(date+'T00:00:00')-new Date())/86400000)}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}

function renderDreams(){
  ensureFoundationState();
  const list=document.getElementById('dreamList'); const trips=document.getElementById('tripList'); if(!list||!trips)return;
  list.innerHTML=state.dreams.board.map(d=>{
    if(d.linked){const active=state.dreams.trips.filter(t=>!t.archived); const next=active.slice().sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)))[0];return `<button class="dream-card holiday-link" data-open-holidays><span>${d.icon}</span><div><strong>${d.name}</strong><small>${active.length} trip${active.length===1?'':'s'} planned</small>${next?`<p>Next: ${escapeHtml(next.name)} · ${daysUntil(next.startDate)} days</p>`:'<p>Plan your next adventure</p>'}</div><b>›</b></button>`}
    const percent=d.target?Math.min(100,safeNumber(d.saved)/safeNumber(d.target)*100):0;return `<button class="dream-card" data-dream-id="${d.id}"><span>${d.icon}</span><div><strong>${escapeHtml(d.name)}</strong><small>${escapeHtml(d.subtitle)}</small>${d.target?`<div class="dream-progress"><i style="width:${percent}%"></i></div><p>${money(d.saved)} / ${money(d.target)}</p>`:'<p>Not started yet</p>'}</div><b>${escapeHtml(d.targetLabel||'›')}</b></button>`;
  }).join('');
  const activeTrips=state.dreams.trips.filter(t=>!t.archived);
  trips.innerHTML=activeTrips.map(t=>`<button class="trip-card" data-trip-id="${t.id}"><div class="trip-cover">${t.coverPhotoId?'<span data-trip-thumb="'+t.coverPhotoId+'"></span>':'🌊'}</div><div><strong>${escapeHtml(t.name)}</strong><small>${escapeHtml(t.destination||'Adventure')}</small><p>${formatDate(t.startDate)}${t.endDate?' – '+formatDate(t.endDate):''}</p><div class="trip-budget-line"><span>Budget remaining</span><b>${money2(tripRemaining(t))}</b></div><div class="dream-progress"><i style="width:${100-tripPercent(t)}%"></i></div></div><b>›</b></button>`).join('')||'<div class="empty-dreams">🌴<strong>No trips planned yet</strong><p>Create a holiday, set a budget and watch the remaining amount update as you spend.</p></div>';
  hydratePhotoThumbnails();
}

function openDreamForm(){openSheet(['⭐','Add Dream','Create something meaningful to work towards.',`<div class="form-grid"><label>Dream name<input id="newDreamName" maxlength="60" placeholder="e.g. Mini Cooper"></label><label>Emoji<input id="newDreamIcon" value="⭐" maxlength="4"></label><label>Target amount (optional)<input id="newDreamTarget" type="number" min="0" inputmode="decimal"></label><label>Target date or note<input id="newDreamDate" placeholder="e.g. 2028 or Someday"></label><button class="primary-button" data-save-dream>Save dream</button></div>`])}
function openTripForm(){openSheet(['🌴','New Holiday','Name it, set the budget and start planning.',`<div class="form-grid"><label>Trip name<input id="tripName" maxlength="70" placeholder="Esperance Escape"></label><label>Destination<input id="tripDestination" maxlength="70" placeholder="Esperance, WA"></label><label>Start date<input id="tripStart" type="date"></label><label>End date<input id="tripEnd" type="date"></label><label>Total budget<input id="tripBudget" type="number" min="0" inputmode="decimal"></label><label>Starting holiday fund<input id="tripFund" type="number" min="0" inputmode="decimal"></label><label>Notes<textarea id="tripNotes" maxlength="400" placeholder="Why this trip matters…"></textarea></label><button class="primary-button" data-save-trip>Create holiday</button></div>`])}
function tripSheet(id){
  const t=state.dreams.trips.find(x=>x.id===id);if(!t)return; window.activeTripId=id;
  const remaining=tripRemaining(t), percent=safeNumber(t.budget)?remaining/safeNumber(t.budget)*100:0;
  const expenses=(t.expenses||[]).slice().reverse().map(e=>`<article><span>${e.icon||'🧾'}</span><div><strong>${escapeHtml(e.category)}</strong><small>${formatDate(e.date)}${e.note?' · '+escapeHtml(e.note):''}</small></div><b>-${money2(e.amount)}</b></article>`).join('')||'<p class="empty-copy">No expenses yet.</p>';
  openSheet(['🌊',t.name,`${formatDate(t.startDate)}${t.endDate?' – '+formatDate(t.endDate):''}`,`<div class="trip-detail-hero"><small>${escapeHtml(t.destination||'Your adventure')}</small><div><span>Total budget <b>${money2(t.budget)}</b></span><span>Budget remaining <b>${money2(remaining)}</b></span></div><div class="story-progress"><i style="width:${percent}%"></i></div></div><div class="trip-action-grid"><button data-trip-action="expense">💵<small>Expenses</small></button><button data-trip-action="itinerary">📅<small>Itinerary</small></button><button data-trip-action="packing">🧳<small>Packing</small></button><button data-trip-action="photos">🖼️<small>Photos</small></button><button data-trip-action="notes">📝<small>Notes</small></button><button data-trip-action="complete">❤️<small>Complete</small></button></div><div class="section-title-row"><h3>Recent expenses</h3><button class="plain-button" data-trip-action="expense">＋ Add</button></div><div class="trip-expenses">${expenses}</div>`]);
}
function tripExpenseForm(id){openSheet(['💵','Add Expense','Every expense reduces the holiday budget immediately.',`<div class="form-grid"><label>Amount<input id="tripExpenseAmount" type="number" min="0.01" step="0.01" inputmode="decimal"></label><label>Category<select id="tripExpenseCategory"><option>Accommodation</option><option>Fuel</option><option>Food</option><option>Activities</option><option>Shopping</option><option>Emergency</option><option>Other</option></select></label><label>Date<input id="tripExpenseDate" type="date" value="${localDateKey()}"></label><label>Note<input id="tripExpenseNote" maxlength="100" placeholder="Optional"></label><button class="primary-button" data-save-trip-expense="${id}">Save expense</button></div>`])}
function simpleTripListEditor(id,type,title,placeholder){const t=state.dreams.trips.find(x=>x.id===id);const items=t[type]||[];openSheet([type==='packing'?'🧳':'📅',title,'Add items one at a time.',`<div class="simple-list">${items.map((x,i)=>`<article><span>${escapeHtml(x)}</span><button data-remove-trip-item="${id}|${type}|${i}">×</button></article>`).join('')||'<p class="empty-copy">Nothing added yet.</p>'}</div><div class="form-grid"><label>${placeholder}<input id="tripListItem" maxlength="120"></label><button class="primary-button" data-add-trip-item="${id}|${type}">Add</button></div>`])}
function tripNotesEditor(id){const t=state.dreams.trips.find(x=>x.id===id);openSheet(['📝','Trip Notes','Keep ideas and favourite moments together.',`<div class="form-grid"><label>Notes<textarea id="tripNotesEditor" maxlength="1200">${escapeHtml(t.notes||'')}</textarea></label><button class="primary-button" data-save-trip-notes="${id}">Save notes</button></div>`])}

function photoDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('homebound_photos_v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('photos'))r.result.createObjectStore('photos',{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function putPhoto(record){const db=await photoDB();return new Promise((res,rej)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put(record);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function getPhoto(id){const db=await photoDB();return new Promise((res,rej)=>{const r=db.transaction('photos').objectStore('photos').get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function compressImage(file){const bmp=await createImageBitmap(file);const max=1200,scale=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);return new Promise(res=>c.toBlob(res,'image/jpeg',.78))}
async function hydratePhotoThumbnails(){for(const node of document.querySelectorAll('[data-trip-thumb]')){try{const rec=await getPhoto(node.dataset.tripThumb);if(rec?.blob){const url=URL.createObjectURL(rec.blob);node.style.backgroundImage=`url(${url})`;node.classList.add('photo-thumb')}}catch{}}}
async function addTripPhotos(id,files){const t=state.dreams.trips.find(x=>x.id===id);if(!t)return;t.photoIds=t.photoIds||[];for(const file of [...files]){const idp='photo-'+Date.now()+'-'+Math.random().toString(36).slice(2);const blob=await compressImage(file);await putPhoto({id:idp,blob,name:file.name,createdAt:new Date().toISOString()});t.photoIds.push(idp);if(!t.coverPhotoId)t.coverPhotoId=idp;}save();toast(`📸 ${files.length} photo${files.length===1?'':'s'} added`);tripPhotosSheet(t.id)}
function tripPhotosSheet(id){const t=state.dreams.trips.find(x=>x.id===id);openSheet(['🖼️','Trip Photos','Choose one or many photos from your gallery.',`<div class="photo-grid" id="tripPhotoGrid">${(t.photoIds||[]).map(pid=>`<span data-photo-id="${pid}"></span>`).join('')||'<p class="empty-copy">No photos yet.</p>'}</div><button class="primary-button" data-pick-trip-photos="${id}">＋ Add Photos from Gallery</button>`]);hydrateFullPhotoGrid()}
async function hydrateFullPhotoGrid(){for(const node of document.querySelectorAll('[data-photo-id]')){try{const rec=await getPhoto(node.dataset.photoId);if(rec?.blob){node.style.backgroundImage=`url(${URL.createObjectURL(rec.blob)})`}}catch{}}}
function completeTrip(id){const t=state.dreams.trips.find(x=>x.id===id);if(!t)return;openSheet(['❤️','Trip Complete!',`${t.name} is ready to become a memory.`,`<div class="trip-complete"><div>✅</div><h3>${escapeHtml(t.name)}</h3><p>Total spent <b>${money2(tripSpent(t))}</b></p><p>You came back with <b>${money2(tripRemaining(t))}</b> remaining.</p><p>All photos, expenses, itinerary, packing list and notes will move together.</p><button class="primary-button" data-move-to-memories="${id}">Move to Memories</button></div>`])}

function switchTab(tab){
  if(!['home','journey','garden','dreams','today'].includes(tab)){openSheet(['🔒','Coming next','This tab will be built in the next stage.','']);return}
  activeTab=tab;const pages={home:'homePage',journey:'journeyPage',garden:'gardenPage',dreams:'dreamsPage',today:'todayPage'};
  Object.entries(pages).forEach(([name,id])=>{const page=document.getElementById(id);if(page){page.hidden=name!==tab;page.classList.toggle('active-page',name===tab)}});
  document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.toggleAttribute('aria-current',b.dataset.tab===tab)});
  if(tab==='garden')renderGarden();if(tab==='today')renderToday();if(tab==='dreams')renderDreams();window.scrollTo({top:0,behavior:'smooth'});
}

render=function(){
  ensureFoundationState();const t=totals();
  const set=(id,v)=>{const n=document.getElementById(id);if(n)n.textContent=v};
  set('clearedTogether',money(t.cleared));set('journeyPercent',`${t.percent.toFixed(1)}%`);const jb=document.getElementById('journeyBar');if(jb)jb.style.setProperty('--progress',`${t.percent}%`);
  const rec=document.getElementById('recoveryBanner');if(rec)rec.hidden=state.recoveryDismissed;
  const next=debtMilestones().find(m=>m.balance>0)||debtMilestones()[0];set('homeNextStopName',next?next.publicName:'Freedom');set('homeNextStopDue',next?`${money(next.balance)} left`:'Completed');
  set('overallJourneyPercent',`${t.percent.toFixed(1)}%`);set('totalCleared',money2(t.cleared));set('totalLeft',money2(t.left));const storyBar=document.getElementById('journeyStoryBar');if(storyBar)storyBar.style.width=`${t.percent}%`;
  renderMap();renderGarden();renderToday();renderDreams();
}

// Dreams / Holiday Planner interactions
let activeDreamPanel='board';
document.addEventListener('click',event=>{
  const dreamTab=event.target.closest('[data-dream-tab]');if(dreamTab){activeDreamPanel=dreamTab.dataset.dreamTab;document.querySelectorAll('[data-dream-tab]').forEach(b=>b.classList.toggle('active',b===dreamTab));document.getElementById('dreamBoardPanel').hidden=activeDreamPanel!=='board';document.getElementById('tripPlannerPanel').hidden=activeDreamPanel!=='trips';return}
  if(event.target.closest('#addDreamButton,#addDreamBottomButton')){openDreamForm();return}
  if(event.target.closest('#addTripButton,[data-open-holidays]')){document.querySelector('[data-dream-tab="trips"]')?.click();if(event.target.closest('#addTripButton'))openTripForm();return}
  const trip=event.target.closest('[data-trip-id]');if(trip){tripSheet(trip.dataset.tripId);return}
  if(event.target.closest('[data-save-dream]')){const name=document.getElementById('newDreamName').value.trim();if(!name)return toast('Enter a dream name');state.dreams.board.splice(state.dreams.board.length-1,0,{id:'dream-'+Date.now(),icon:document.getElementById('newDreamIcon').value||'⭐',name,subtitle:'A new dream',saved:0,target:safeNumber(document.getElementById('newDreamTarget').value),targetLabel:document.getElementById('newDreamDate').value||'Someday'});save();closeSheet();renderDreams();toast('⭐ Dream added');return}
  if(event.target.closest('[data-save-trip]')){const name=document.getElementById('tripName').value.trim();const budget=safeNumber(document.getElementById('tripBudget').value);if(!name||budget<=0)return toast('Add a trip name and budget');state.dreams.trips.push({id:'trip-'+Date.now(),name,destination:document.getElementById('tripDestination').value.trim(),startDate:document.getElementById('tripStart').value,endDate:document.getElementById('tripEnd').value,budget,fund:safeNumber(document.getElementById('tripFund').value),notes:document.getElementById('tripNotes').value.trim(),expenses:[],itinerary:[],packing:[],photoIds:[],archived:false});save();closeSheet();renderDreams();document.querySelector('[data-dream-tab="trips"]')?.click();toast('🌴 Holiday created');return}
  const action=event.target.closest('[data-trip-action]');if(action){const id=window.activeTripId;if(action.dataset.tripAction==='expense')tripExpenseForm(id);if(action.dataset.tripAction==='itinerary')simpleTripListEditor(id,'itinerary','Itinerary','What is the plan?');if(action.dataset.tripAction==='packing')simpleTripListEditor(id,'packing','Packing List','What do you need?');if(action.dataset.tripAction==='photos')tripPhotosSheet(id);if(action.dataset.tripAction==='notes')tripNotesEditor(id);if(action.dataset.tripAction==='complete')completeTrip(id);return}
  const saveExpense=event.target.closest('[data-save-trip-expense]');if(saveExpense){const t=state.dreams.trips.find(x=>x.id===saveExpense.dataset.saveTripExpense);const amount=safeNumber(document.getElementById('tripExpenseAmount').value);if(!t||amount<=0)return toast('Enter an expense amount');const cats={Accommodation:'🏨',Fuel:'⛽',Food:'🍽️',Activities:'🎟️',Shopping:'🛍️',Emergency:'🆘',Other:'🧾'};const cat=document.getElementById('tripExpenseCategory').value;t.expenses.push({id:'te-'+Date.now(),amount,category:cat,icon:cats[cat],date:document.getElementById('tripExpenseDate').value,note:document.getElementById('tripExpenseNote').value.trim()});save();tripSheet(t.id);renderDreams();toast(`Budget remaining ${money2(tripRemaining(t))}`);return}
  const addItem=event.target.closest('[data-add-trip-item]');if(addItem){const [id,type]=addItem.dataset.addTripItem.split('|');const t=state.dreams.trips.find(x=>x.id===id);const value=document.getElementById('tripListItem').value.trim();if(t&&value){t[type]=t[type]||[];t[type].push(value);save();simpleTripListEditor(id,type,type==='packing'?'Packing List':'Itinerary','Add another item')}return}
  const removeItem=event.target.closest('[data-remove-trip-item]');if(removeItem){const [id,type,index]=removeItem.dataset.removeTripItem.split('|');const t=state.dreams.trips.find(x=>x.id===id);if(t){t[type].splice(Number(index),1);save();simpleTripListEditor(id,type,type==='packing'?'Packing List':'Itinerary','Add another item')}return}
  const notes=event.target.closest('[data-save-trip-notes]');if(notes){const t=state.dreams.trips.find(x=>x.id===notes.dataset.saveTripNotes);if(t){t.notes=document.getElementById('tripNotesEditor').value;save();tripSheet(t.id);toast('📝 Notes saved')}return}
  const pick=event.target.closest('[data-pick-trip-photos]');if(pick){window.photoTripId=pick.dataset.pickTripPhotos;document.getElementById('tripPhotoInput').click();return}
  const move=event.target.closest('[data-move-to-memories]');if(move){const t=state.dreams.trips.find(x=>x.id===move.dataset.moveToMemories);if(t){t.archived=true;t.completedAt=new Date().toISOString();state.dreams.memories.push({id:'memory-'+Date.now(),tripId:t.id,name:t.name,destination:t.destination,dates:[t.startDate,t.endDate],budget:t.budget,spent:tripSpent(t),remaining:tripRemaining(t),photoIds:[...(t.photoIds||[])],itinerary:[...(t.itinerary||[])],notes:t.notes||''});save();closeSheet();renderDreams();toast('📖 Trip moved to Memories')}return}
},true);

document.getElementById('tripPhotoInput')?.addEventListener('change',async e=>{if(e.target.files?.length&&window.photoTripId){try{await addTripPhotos(window.photoTripId,e.target.files)}catch(err){console.error(err);toast('Could not add those photos')}e.target.value=''}});

greeting();
render();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
