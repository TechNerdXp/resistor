/**
 * Toolbar popup: today at a glance, plus the fastest path to blocking the site you are
 * currently staring at. Reading the active tab's URL relies on "activeTab", which is
 * granted only while the user has the popup open and carries no install-time warning.
 */

import { normalizeHost, originPattern } from '../lib/domain.js';

const el = {
  streak: document.getElementById('streak'),
  streakText: document.getElementById('streakText'),
  blockCurrentLabel: document.getElementById('blockCurrentLabel'),
  resists: document.getElementById('resists'),
  budget: document.getElementById('budget'),
  sites: document.getElementById('sites'),
  empty: document.getElementById('empty'),
  blockCurrent: document.getElementById('blockCurrent'),
  currentNote: document.getElementById('currentNote'),
  settings: document.getElementById('settings')
};

const send = (msg) => chrome.runtime.sendMessage(msg);

function minutesLeftLabel(settings, stats) {
  const budget = Number(settings.dailyBudgetMinutes) || 0;
  if (!budget) return '∞';
  return String(Math.max(0, budget - stats.todayGrantedMinutes));
}

async function currentHost() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? normalizeHost(tab.url) : null;
}

function renderSites(state, grants) {
  el.sites.replaceChildren();
  const sites = state.settings.sites;
  el.empty.hidden = sites.length > 0;

  const TAG = 'rounded-full px-2 py-0.5 text-[0.6875rem] font-bold';
  const now = Date.now();

  for (const site of sites) {
    const li = document.createElement('li');
    li.className =
      'flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-[0.8125rem]';

    const host = document.createElement('span');
    host.className = 'flex-1 truncate';
    host.textContent = site.host;
    li.append(host);

    const grant = grants[site.host];
    if (grant && grant.until > now) {
      const left = Math.max(1, Math.round((grant.until - now) / 60000));
      const tag = document.createElement('span');
      tag.className = `${TAG} bg-ember-soft text-ember`;
      tag.textContent = `open ${left}m`;
      li.append(tag);
    } else if (state.missing.includes(site.host)) {
      const tag = document.createElement('span');
      tag.className = `${TAG} bg-danger/10 text-danger`;
      tag.textContent = 'needs access';
      li.append(tag);
    }

    el.sites.append(li);
  }
}

async function init() {
  const state = await send({ type: 'state' });
  if (!state) return;

  if (state.stats.streak > 0) {
    el.streak.hidden = false;
    el.streakText.textContent = `${state.stats.streak}d streak`;
  }
  el.resists.textContent = String(state.stats.todayResists);
  el.budget.textContent = minutesLeftLabel(state.settings, state.stats);

  renderSites(state, state.grants);

  const host = await currentHost();
  const already = host && state.settings.sites.some((s) => s.host === host);

  if (host && !already) {
    el.blockCurrent.classList.remove('hidden');
    el.blockCurrentLabel.textContent = `Block ${host}`;
    el.blockCurrent.addEventListener('click', () => blockHost(host));
  } else if (already) {
    el.currentNote.textContent = `${host} is already blocked.`;
  }
}

async function blockHost(host) {
  el.blockCurrent.disabled = true;
  const granted = await chrome.permissions.request({ origins: [originPattern(host)] });
  if (!granted) {
    el.blockCurrent.disabled = false;
    el.currentNote.textContent = 'Permission declined — that site cannot be blocked.';
    return;
  }

  const { sites = [] } = await chrome.storage.sync.get('sites');
  if (!sites.some((s) => s.host === host)) {
    sites.push({ host, tier: null, addedAt: Date.now() });
  }
  await chrome.storage.sync.set({ sites, schemaVersion: 2 });
  await send({ type: 'sync' });

  el.blockCurrent.classList.add('hidden');
  el.currentNote.textContent = `${host} is now blocked.`;
  const state = await send({ type: 'state' });
  renderSites(state, state.grants);
}

el.settings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

init();
