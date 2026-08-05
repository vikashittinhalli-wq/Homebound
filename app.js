'use strict';

const STORAGE_KEY = 'homebound_journey_v1';
const SCHEMA_VERSION = 2;
const LEGACY_KEY = 'freedomCountdownData';

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
      icon: '📍',
      publicName: 'Scenic Lookout',
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
      publicName: 'Forest Bend',
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
      icon: '🌉',
      publicName: 'River Crossing',
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
      icon: '⛰️',
      publicName: 'Mountain Pass',
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
      publicName: 'Sunrise Point',
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
      publicName: 'Home Path',
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
  stepsCloser: 287,
  recoveryDismissed: false,
  lastBackup: null,
  milestones: buildMilestonesFromLegacy(LEGACY_DEFAULTS)
};

function looksLikePlaceholderState(candidate) {
  if (!candidate || !Array.isArray(candidate.milestones)) return false;
  const ids = candidate.milestones.map(m => m.id).sort().join('|');
  return ids === ['car-loan', 'emergency', 'home-deposit', 'trip'].sort().join('|');
}

function load() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!stored || stored.schemaVersion !== SCHEMA_VERSION || looksLikePlaceholderState(stored)) {
      const migrated = {
        ...clone(defaults),
        milestones: buildMilestonesFromLegacy(readLegacyData())
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return {
      ...clone(defaults),
      ...stored,
      milestones: Array.isArray(stored.milestones) ? stored.milestones : clone(defaults.milestones)
    };
  } catch {
    return clone(defaults);
  }
}

let state = load();
let activeTab = 'home';
let selectedMilestone = null;
let activeSheetTab = 'overview';

function save() {
  state.schemaVersion = SCHEMA_VERSION;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  return state.milestones.filter(m => m.kind !== 'savings');
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
  document.getElementById('greetingTitle').textContent = `${hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'} ${hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙'}`;
  document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(now);
}

function render() {
  const t = totals();
  document.getElementById('stepsCloser').textContent = state.stepsCloser;
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
  if (!['home', 'journey'].includes(tab)) {
    openSheet(['🔒', 'Coming next', 'This tab will be designed after Journey is approved.', '']);
    return;
  }
  activeTab = tab;
  document.getElementById('homePage').hidden = tab !== 'home';
  document.getElementById('journeyPage').hidden = tab !== 'journey';
  document.getElementById('homePage').classList.toggle('active-page', tab === 'home');
  document.getElementById('journeyPage').classList.toggle('active-page', tab === 'journey');
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tab);
    if (button.dataset.tab === tab) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
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
  openSheet([m.icon, m.kind === 'savings' ? `Add to ${m.publicName}` : `Pay ${m.publicName}`, 'Record the amount and update your real balance.', `<form id="paymentForm" class="form-grid"><input type="hidden" name="id" value="${m.id}"><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required inputmode="decimal"></label><label>Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label><label>Type<select name="type"><option>Minimum payment</option><option>Extra payment</option><option>Minimum + extra</option><option>Statement adjustment</option></select></label><button class="primary-button" type="submit">Save update</button></form>`]);
}

function addMilestoneForm() {
  openSheet(['＋', 'New milestone', 'Add another step to your roadmap.', `<form id="milestoneForm" class="form-grid"><label>Emoji<input name="icon" value="🎯" maxlength="4"></label><label>Milestone name<input name="publicName" required placeholder="New milestone"></label><label>Account name<input name="accountName" required placeholder="The real account or goal"></label><label>Starting amount<input name="starting" type="number" min="1" required inputmode="decimal"></label><label>Current balance<input name="balance" type="number" min="0" required inputmode="decimal"></label><label>Interest rate %<input name="interest" type="number" step="0.01" value="0" inputmode="decimal"></label><label>Minimum payment<input name="minPayment" type="number" min="0" value="0" inputmode="decimal"></label><label>Payment frequency<select name="frequency"><option value="month">Monthly</option><option value="week">Weekly</option></select></label><label>Target date<input name="due" type="date"></label><label>Why it matters<textarea name="why" placeholder="What will this milestone change for your family?"></textarea></label><button class="primary-button" type="submit">Add to journey</button></form>`]);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify({ version: 5, exportedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' });
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

  const calc = event.target.closest('[data-calc-plan]');
  if (calc) {
    const extra = safeNumber(document.getElementById('whatIfExtra').value);
    const frequency = document.getElementById('whatIfFrequency').value;
    const m = state.milestones.find(item => item.id === calc.dataset.calcPlan);
    document.getElementById('planResult').innerHTML = `<div class="calc-result"><div><small>Current payoff</small><strong>${estimatePayoff(m, 0, m.frequency)}</strong></div><div><small>With extra payment</small><strong>${estimatePayoff(m, extra, frequency)}</strong></div></div>`;
    return;
  }

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
  if (event.target.id === 'paymentForm') {
    event.preventDefault();
    const data = new FormData(event.target);
    const m = state.milestones.find(item => item.id === data.get('id'));
    const amount = safeNumber(data.get('amount'));
    const date = String(data.get('date'));
    const type = String(data.get('type'));

    if (m.kind === 'savings') {
      m.balance = Math.max(0, m.balance - amount);
      m.saved = Math.max(0, safeNumber(m.starting) - m.balance);
      m.payments.push({ amount, date, type, interest: 0 });
    } else if (type === 'Statement adjustment') {
      m.balance = Math.max(0, amount);
      m.payments.push({ amount, date, type, interest: 0 });
    } else {
      const previousDate = m.updatedAt ? new Date(m.updatedAt) : new Date(date + 'T00:00:00');
      const currentDate = new Date(date + 'T00:00:00');
      const days = Math.max(0, Math.round((currentDate - previousDate) / 86400000));
      const interest = m.balance * (safeNumber(m.interest) / 100) * (days / 365);
      m.balance = Math.max(0, m.balance + interest - amount);
      m.payments.push({ amount, date, type, interest });
    }

    m.updatedAt = date + 'T12:00:00.000Z';
    state.stepsCloser++;
    save();
    render();
    closeSheet();
    toast('🎉 Another step closer to home');
  }

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

greeting();
render();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
