'use strict';

const STORAGE_KEY = 'homebound_new_v1';
const defaultState = {
  stepsCloser: 287,
  journeyPercent: 72,
  savings: 11250,
  lastBackup: null,
  recoveryDismissed: false,
  memories: [],
  dreams: []
};

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...defaultState };
  }
}

let state = loadState();
const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setGreeting() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greetingTitle').innerHTML = `${greeting},<br>welcome home <span>👋</span>`;
  document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(now);
}

function renderState() {
  document.getElementById('stepsCloser').textContent = state.stepsCloser;
  document.getElementById('journeyPercent').textContent = `${state.journeyPercent}%`;
  document.getElementById('savingsValue').textContent = money.format(state.savings);
  const banner = document.getElementById('recoveryBanner');
  banner.hidden = state.recoveryDismissed || !localStorage.getItem(`${STORAGE_KEY}_snapshot`);
}

const detailMap = {
  today: {
    icon: '☀️', title: 'Today', description: 'A gentle overview of what deserves your attention today.',
    content: '<div class="detail-block"><strong>Scenic Lookout step</strong><span>Planned for two days from now. Add or edit reminders when we connect the full Journey screen.</span></div><div class="detail-block"><strong>Esperance adventure</strong><span>Your trip countdown and checklist will live here.</span></div>'
  },
  journey: {
    icon: '🚗', title: 'Journey', description: 'Your financial roadmap, expressed as positive destinations rather than account names.',
    content: '<div class="detail-block"><strong>72% complete</strong><span>Your car moves forward as real progress is recorded.</span></div><div class="detail-block"><strong>Next destination</strong><span>Scenic Lookout — tap through later to see the private account details.</span></div>'
  },
  garden: {
    icon: '🌳', title: 'Garden', description: 'Your savings and net worth grow a living world.',
    content: '<div class="detail-block"><strong>Savings Grove</strong><span>Represents your savings balance and regular contributions.</span></div><div class="detail-block"><strong>Home Path</strong><span>Represents progress toward your future home.</span></div>'
  },
  dreams: {
    icon: '⭐', title: 'Dreams', description: 'A shared vision board for the life you are building together.',
    content: '<div class="detail-block"><strong>Dream Home</strong><span>Track a target, notes, checklist and inspiration.</span></div><div class="detail-block"><strong>Mini Cooper</strong><span>Your wife’s future car dream.</span></div>'
  },
  together: {
    icon: '💞', title: 'Together', description: 'A warm record of the life, goals and memories you share.',
    content: '<div class="detail-block"><strong>1,420 days together</strong><span>This value can later be set from your actual anniversary date.</span></div><div class="detail-block"><strong>Shared progress</strong><span>Trips, dreams, memories and wins will all contribute.</span></div>'
  },
  'journey-preview': {
    icon: '🛣️', title: 'Your Journey', description: 'The approved scenic-road concept brought into the Home screen.',
    content: '<div class="detail-block"><strong>Scenic Lookout → Forest Bend → Sunrise Point → Home</strong><span>The main Journey tab will make each location fully tappable.</span></div>'
  }
};

function openSheet(config) {
  const sheet = document.getElementById('detailSheet');
  document.getElementById('sheetIcon').textContent = config.icon;
  document.getElementById('sheetTitle').textContent = config.title;
  document.getElementById('sheetDescription').textContent = config.description;
  document.getElementById('sheetContent').innerHTML = config.content || '';
  sheet.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeSheet(id = 'detailSheet') {
  document.getElementById(id).setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function exportBackup() {
  const snapshot = { version: 1, exportedAt: new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `homebound-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  state.lastBackup = new Date().toISOString();
  saveState();
  openSheet({ icon:'💾', title:'Backup created', description:'Your Homebound data has been exported as a portable JSON file.', content:'<div class="detail-block"><strong>Keep it somewhere safe</strong><span>Save it to iCloud Drive, Google Drive or another trusted location.</span></div>' });
}

function quickAction(action) {
  if (action === 'backup') return exportBackup();
  const configs = {
    payment: {icon:'➕', title:'Add a step', description:'This prototype demonstrates the visual flow. Financial entry fields will connect after the Home screen is approved.', content:'<div class="sheet-actions"><button class="primary-btn" id="demoStep">Record demo step</button><button class="secondary-btn" id="cancelDemo">Cancel</button></div>'},
    memory: {icon:'📸', title:'Add a memory', description:'Photos and notes will be stored locally on your phone in the complete app.', content:'<div class="detail-block"><strong>Coming after Home approval</strong><span>We will add photo compression, captions and a memory timeline.</span></div>'},
    dream: {icon:'⭐', title:'Add a dream', description:'Create a shared goal with a target, date, notes and checklist.', content:'<div class="detail-block"><strong>Home screen prototype</strong><span>The full Dreams form will be built after this screen is approved.</span></div>'}
  };
  openSheet(configs[action]);
  if (action === 'payment') {
    setTimeout(() => {
      document.getElementById('demoStep')?.addEventListener('click', () => {
        localStorage.setItem(`${STORAGE_KEY}_snapshot`, JSON.stringify(state));
        state.stepsCloser += 1;
        state.journeyPercent = Math.min(100, state.journeyPercent + 1);
        saveState();
        renderState();
        closeSheet();
      });
      document.getElementById('cancelDemo')?.addEventListener('click', () => closeSheet());
    });
  }
}

document.addEventListener('click', (event) => {
  const tappable = event.target.closest('[data-detail]');
  if (tappable) openSheet(detailMap[tappable.dataset.detail]);

  const action = event.target.closest('[data-action]');
  if (action) quickAction(action.dataset.action);

  const nav = event.target.closest('[data-tab]');
  if (nav && nav.dataset.tab !== 'home') {
    openSheet({ icon: nav.querySelector('span').textContent, title: `${nav.querySelector('small').textContent} is next`, description: 'We are building one approved screen at a time. This tab will be implemented only after you approve Home.', content:'<div class="detail-block"><strong>Home first</strong><span>This keeps the project faithful to the approved sketch.</span></div>' });
  }
});

document.querySelectorAll('[data-detail]').forEach(el => {
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSheet(detailMap[el.dataset.detail]);
    }
  });
});

document.getElementById('sheetBackdrop').addEventListener('click', () => closeSheet());
document.getElementById('sheetClose').addEventListener('click', () => closeSheet());
document.getElementById('notificationsButton').addEventListener('click', () => {
  document.getElementById('notificationsSheet').setAttribute('aria-hidden','false');
  document.getElementById('notificationDot').hidden = true;
  document.body.style.overflow = 'hidden';
});
document.querySelectorAll('[data-close-notifications]').forEach(el => el.addEventListener('click', () => closeSheet('notificationsSheet')));
document.getElementById('dismissRecovery').addEventListener('click', () => {
  state.recoveryDismissed = true;
  saveState();
  renderState();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSheet();
    closeSheet('notificationsSheet');
  }
});

setGreeting();
renderState();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
