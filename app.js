'use strict';

const STORAGE_KEY = 'pomodoro_history';
const SETTINGS_KEY = 'pomodoro_settings';
const CIRCUMFERENCE = 2 * Math.PI * 148; // r=148

const el = {
  app: document.getElementById('app'),
  timeDisplay: document.getElementById('timeDisplay'),
  modeLabel: document.getElementById('modeLabel'),
  modeDot: document.getElementById('modeDot'),
  modeName: document.getElementById('modeName'),
  sessionTag: document.getElementById('sessionTag'),
  ringProgress: document.getElementById('ringProgress'),
  startPauseBtn: document.getElementById('startPauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  skipBtn: document.getElementById('skipBtn'),
  iconPlay: document.querySelector('.icon-play'),
  iconPause: document.querySelector('.icon-pause'),
  historyList: document.getElementById('historyList'),
  settingsToggle: document.getElementById('settingsToggle'),
  settingsPanel: document.getElementById('settingsPanel'),
  closeSettings: document.getElementById('closeSettings'),
  overlay: document.getElementById('overlay'),
  focusInput: document.getElementById('focusInput'),
  breakInput: document.getElementById('breakInput'),
  applySettings: document.getElementById('applySettings'),
  completionFlash: document.getElementById('completionFlash'),
  flashText: document.getElementById('flashText'),
};

let settings = { focus: 25, break: 5 };
let state = {
  mode: 'focus',
  running: false,
  remaining: 0,
  total: 0,
  session: 1,
};
let ticker = null;
let audioCtx = null;

// ── Audio ──────────────────────────────────────────────
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playDone(type) {
  const ctx = getAudioCtx();
  const notes = type === 'focus'
    ? [523.25, 659.25, 783.99]
    : [659.25, 523.25];

  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = ctx.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.start(t);
    osc.stop(t + 0.52);
  });
}

// ── Settings ───────────────────────────────────────────
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (saved && saved.focus && saved.break) {
      settings = saved;
    }
  } catch (_) {}
  el.focusInput.value = settings.focus;
  el.breakInput.value = settings.break;
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ── History ────────────────────────────────────────────
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw && raw.date === todayKey()) {
      return raw.sessions || [];
    }
  } catch (_) {}
  return [];
}

function saveHistory(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    date: todayKey(),
    sessions,
  }));
}

function addHistoryEntry(durationMin) {
  const sessions = loadHistory();
  const now = new Date();
  const h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const displayH = ((h + 11) % 12 + 1);
  sessions.push({
    duration: durationMin,
    time: `${displayH}:${m}${ampm}`,
    ts: Date.now(),
  });
  saveHistory(sessions);
  renderHistory(sessions);
}

function renderHistory(sessions) {
  const countEl = document.getElementById('historyCount');
  if (!sessions.length) {
    el.historyList.innerHTML = '<p class="empty-state">No sessions yet. Start focusing.</p>';
    if (countEl) countEl.textContent = '';
    return;
  }
  if (countEl) countEl.textContent = `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`;
  el.historyList.innerHTML = '';
  sessions.slice().reverse().forEach((s) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <span class="history-check" aria-hidden="true">✓</span>
      <span class="history-detail"><strong>${s.duration}:00</strong> focus</span>
      <span class="history-time">${s.time}</span>
    `;
    el.historyList.appendChild(item);
  });
}

// ── Timer logic ────────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateRing(remaining, total) {
  const frac = total > 0 ? remaining / total : 1;
  const offset = CIRCUMFERENCE * (1 - frac);
  el.ringProgress.style.strokeDasharray = CIRCUMFERENCE;
  el.ringProgress.style.strokeDashoffset = offset;
}

function updateDisplay() {
  el.timeDisplay.textContent = formatTime(state.remaining);
  updateRing(state.remaining, state.total);
  document.title = `${formatTime(state.remaining)} — ${state.mode === 'focus' ? 'Focus' : 'Break'}`;
}

function initTimer(mode) {
  state.mode = mode;
  state.running = false;
  const mins = mode === 'focus' ? settings.focus : settings.break;
  state.remaining = mins * 60;
  state.total = mins * 60;
  document.body.className = mode === 'break' ? 'break-mode' : '';
  el.modeName.textContent = mode === 'focus' ? 'Focus' : 'Break';
  el.sessionTag.textContent = mode === 'focus'
    ? `Session ${state.session}`
    : `Break`;
  el.modeDot.classList.remove('paused');
  el.modeDot.classList.remove('running');
  setPlayIcon();
  updateDisplay();
}

function setPlayIcon() {
  if (state.running) {
    el.iconPlay.classList.add('hidden');
    el.iconPause.classList.remove('hidden');
    el.startPauseBtn.setAttribute('aria-label', 'Pause timer');
  } else {
    el.iconPlay.classList.remove('hidden');
    el.iconPause.classList.add('hidden');
    el.startPauseBtn.setAttribute('aria-label', 'Start timer');
  }
}

function start() {
  if (state.running) return;
  state.running = true;
  document.body.classList.remove('paused');
  el.modeDot.classList.remove('paused');
  el.modeDot.classList.add('running');
  setPlayIcon();
  tick();
}

function pause() {
  if (!state.running) return;
  state.running = false;
  clearTimeout(ticker);
  document.body.classList.add('paused');
  el.modeDot.classList.remove('running');
  el.modeDot.classList.add('paused');
  setPlayIcon();
}

function tick() {
  if (!state.running) return;
  state.remaining--;
  updateDisplay();
  if (state.remaining <= 0) {
    onPhaseComplete();
    return;
  }
  ticker = setTimeout(tick, 1000);
}

function onPhaseComplete() {
  state.running = false;
  clearTimeout(ticker);
  const completedMode = state.mode;
  playDone(completedMode);

  if (completedMode === 'focus') {
    addHistoryEntry(settings.focus);
    el.flashText.textContent = 'Focus session complete';
    el.flashText.style.setProperty('--accent', 'var(--focus-color)');
  } else {
    el.flashText.textContent = 'Break over — back to it';
    state.session++;
  }

  showCompletionFlash();

  setTimeout(() => {
    const next = completedMode === 'focus' ? 'break' : 'focus';
    initTimer(next);
    start();
  }, 2200);
}

function showCompletionFlash() {
  el.completionFlash.classList.remove('active');
  void el.completionFlash.offsetWidth;
  el.completionFlash.classList.add('active');
  setTimeout(() => el.completionFlash.classList.remove('active'), 2100);
}

function reset() {
  clearTimeout(ticker);
  initTimer(state.mode);
  document.body.classList.remove('paused');
}

function skip() {
  clearTimeout(ticker);
  if (state.mode === 'focus') {
    const next = 'break';
    initTimer(next);
  } else {
    state.session++;
    initTimer('focus');
  }
  document.body.classList.remove('paused');
}

// ── Settings panel ──────────────────────────────────────
function openSettings() {
  el.settingsPanel.removeAttribute('hidden');
  el.overlay.classList.add('active');
  el.overlay.removeAttribute('aria-hidden');
  el.closeSettings.focus();
}

function closeSettings() {
  el.settingsPanel.setAttribute('hidden', '');
  el.overlay.classList.remove('active');
  el.overlay.setAttribute('aria-hidden', 'true');
  el.settingsToggle.focus();
}

el.settingsToggle.addEventListener('click', openSettings);
el.closeSettings.addEventListener('click', closeSettings);
el.overlay.addEventListener('click', closeSettings);

el.applySettings.addEventListener('click', () => {
  const f = parseInt(el.focusInput.value, 10);
  const b = parseInt(el.breakInput.value, 10);
  if (f >= 1 && f <= 90 && b >= 1 && b <= 30) {
    settings.focus = f;
    settings.break = b;
    saveSettings();
    clearTimeout(ticker);
    initTimer('focus');
    state.session = 1;
    document.body.className = '';
    closeSettings();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !el.settingsPanel.hasAttribute('hidden')) {
    closeSettings();
  }
  if (e.key === ' ' && e.target === document.body) {
    e.preventDefault();
    if (state.running) pause(); else start();
  }
});

// ── Button handlers ─────────────────────────────────────
el.startPauseBtn.addEventListener('click', () => {
  if (state.running) pause(); else start();
});

el.resetBtn.addEventListener('click', reset);
el.skipBtn.addEventListener('click', skip);

// ── Init ────────────────────────────────────────────────
loadSettings();
initTimer('focus');
renderHistory(loadHistory());
