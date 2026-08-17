/**
 * The interstitial.
 *
 * Design intent, and the main departure from v1: the wait is never dead time. The hold
 * counts down *while* you write what you were about to do, so the friction and the
 * moment of honesty are the same few seconds rather than three minutes of countdowns.
 */

import { parseBlockedTarget } from '../lib/target.js';

const TIER_GATE = {
  gentle: { holdSeconds: 3, reasonRequired: false },
  focused: { holdSeconds: 10, reasonRequired: true },
  locked: null
};

const MIN_REASON = 15;

const el = {
  host: document.getElementById('host'),
  context: document.getElementById('context'),
  streakPill: document.getElementById('streakPill'),
  streakText: document.getElementById('streakText'),
  backBtn: document.getElementById('backBtn'),
  revealBtn: document.getElementById('revealBtn'),
  gate: document.getElementById('gate'),
  locked: document.getElementById('locked'),
  lockedSettings: document.getElementById('lockedSettings'),
  reason: document.getElementById('reason'),
  reasonLabel: document.getElementById('reasonLabel'),
  gateHint: document.getElementById('gateHint'),
  proceedBtn: document.getElementById('proceedBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  gateError: document.getElementById('gateError')
};

const send = (msg) => chrome.runtime.sendMessage(msg);

const target = parseBlockedTarget(location.search);
let tier = 'focused';
let grantMinutes = 5;

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

async function init() {
  el.host.textContent = target.host || 'this site';
  document.title = target.host ? `Paused — ${target.host}` : 'Paused — Resistor';

  const state = await send({ type: 'state' });
  if (!state) return;

  const site = state.settings.sites.find((s) => s.host === target.host);
  tier = site?.tier || state.settings.defaultTier || 'focused';
  grantMinutes = state.settings.grantMinutes || 5;

  const streak = state.stats.streak;
  if (streak > 0) {
    el.streakPill.hidden = false;
    el.streakText.textContent = `${plural(streak, 'day')} streak`;
  }

  const resists = state.stats.todayResists;
  el.context.textContent = resists
    ? `You have turned back ${plural(resists, 'time')} today. That is the habit forming.`
    : 'You chose to put this site behind a moment of thought.';

  if (!TIER_GATE[tier]) {
    el.revealBtn.hidden = true;
    el.locked.hidden = false;
  }

  const budget = Number(state.settings.dailyBudgetMinutes) || 0;
  if (budget > 0) {
    const left = Math.max(0, budget - state.stats.todayGrantedMinutes);
    el.gateHint.textContent = `${plural(left, 'minute')} of access left today (of ${budget}).`;
  } else {
    el.gateHint.textContent = `Access is granted for ${plural(grantMinutes, 'minute')}, then it re-blocks itself.`;
  }
}

function backToWork() {
  send({ type: 'resist' });
  chrome.storage.sync.get('backToWorkUrl', ({ backToWorkUrl }) => {
    if (backToWorkUrl) {
      location.replace(backToWorkUrl);
    } else if (history.length > 1) {
      history.back();
    } else {
      chrome.tabs.getCurrent((tab) => tab && chrome.tabs.remove(tab.id));
    }
  });
}

let holdTimer = null;

function openGate() {
  const gate = TIER_GATE[tier];
  if (!gate) return;

  el.revealBtn.hidden = true;
  el.gate.hidden = false;

  if (!gate.reasonRequired) {
    el.reasonLabel.textContent = 'What were you about to do? (optional)';
  }

  let remaining = gate.holdSeconds;

  const validate = () => {
    const reasonOk = !gate.reasonRequired || el.reason.value.trim().length >= MIN_REASON;
    el.proceedBtn.disabled = remaining > 0 || !reasonOk;
  };

  const tick = () => {
    el.proceedBtn.textContent = remaining > 0 ? `Continue (${remaining})` : 'Continue';
    validate();
    if (remaining <= 0) clearInterval(holdTimer);
    remaining -= 1;
  };
  tick();
  holdTimer = setInterval(tick, 1000);

  el.reason.addEventListener('input', validate);
  el.reason.focus();
}

function closeGate() {
  clearInterval(holdTimer);
  el.gate.hidden = true;
  el.revealBtn.hidden = false;
  el.gateError.textContent = '';
}

async function proceed() {
  el.proceedBtn.disabled = true;
  const res = await send({ type: 'grant', host: target.host, minutes: grantMinutes });

  if (res?.ok) {
    location.replace(target.url);
    return;
  }

  el.proceedBtn.disabled = false;
  if (res?.reason === 'budget') {
    el.gateError.textContent = `Daily limit reached — you have used all ${plural(res.budget, 'minute')} today.`;
  } else if (res?.reason === 'locked') {
    el.gateError.textContent = 'This site is locked.';
  } else {
    el.gateError.textContent = 'Could not grant access. Try reloading the page.';
  }
}

el.backBtn.addEventListener('click', backToWork);
el.revealBtn.addEventListener('click', openGate);
el.cancelBtn.addEventListener('click', closeGate);
el.proceedBtn.addEventListener('click', proceed);
el.lockedSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());

init();
