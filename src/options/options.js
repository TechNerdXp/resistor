/**
 * Settings page.
 *
 * Site rows carry their own permission state: a site can be on the blocklist while
 * Chrome has not granted access to it (the user declined, or revoked it later from
 * chrome://extensions). Rather than failing silently — v1's habit — those rows say so
 * and offer a one-click grant.
 */

import { normalizeHost, originPattern } from '../lib/domain.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIER_LABELS = {
  '': 'Use default',
  gentle: 'Gentle',
  focused: 'Focused',
  locked: 'Locked'
};

const el = {
  statStreak: document.getElementById('statStreak'),
  statToday: document.getElementById('statToday'),
  statTotal: document.getElementById('statTotal'),
  statPasses: document.getElementById('statPasses'),
  newSite: document.getElementById('newSite'),
  addSite: document.getElementById('addSite'),
  addError: document.getElementById('addError'),
  sites: document.getElementById('sites'),
  noSites: document.getElementById('noSites'),
  defaultTier: document.getElementById('defaultTier'),
  grantMinutes: document.getElementById('grantMinutes'),
  dailyBudget: document.getElementById('dailyBudget'),
  backToWork: document.getElementById('backToWork'),
  theme: document.getElementById('theme'),
  scheduleEnabled: document.getElementById('scheduleEnabled'),
  days: document.getElementById('days'),
  start: document.getElementById('start'),
  end: document.getElementById('end'),
  save: document.getElementById('save'),
  saved: document.getElementById('saved')
};

const send = (msg) => chrome.runtime.sendMessage(msg);

let state = null;

for (let i = 0; i < DAYS.length; i += 1) {
  const label = document.createElement('label');
  label.className = 'day';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = String(i);
  label.append(input, document.createTextNode(DAYS[i]));
  el.days.append(label);
}

/** Clones the trash glyph from the page's <template>, avoiding innerHTML entirely. */
function trashIcon() {
  return document.getElementById('tplTrash').content.cloneNode(true);
}

function renderStats(stats) {
  el.statStreak.textContent = String(stats.streak);
  el.statToday.textContent = String(stats.todayResists);
  el.statTotal.textContent = String(stats.totalResists);
  el.statPasses.textContent = String(stats.totalPasses);
}

function renderSites() {
  el.sites.replaceChildren();
  el.noSites.hidden = state.settings.sites.length > 0;

  for (const site of state.settings.sites) {
    const li = document.createElement('li');
    li.className =
      'flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-canvas px-3 py-2.5';

    const host = document.createElement('span');
    host.className = 'flex-1 basis-40 break-all text-[0.9375rem] font-semibold';
    host.textContent = site.host;
    li.append(host);

    if (state.missing.includes(site.host)) {
      const tag = document.createElement('span');
      tag.className = 'rounded-full bg-danger/10 px-2.5 py-1 text-[0.6875rem] font-bold text-danger';
      tag.textContent = 'needs access';
      li.append(tag);

      const grant = document.createElement('button');
      grant.className = 'btn px-3 py-2 text-[0.8125rem]';
      grant.type = 'button';
      grant.textContent = 'Grant';
      grant.addEventListener('click', () => grantSite(site.host));
      li.append(grant);
    }

    const select = document.createElement('select');
    select.className = 'input w-auto min-w-36 py-2 text-[0.875rem]';
    select.setAttribute('aria-label', `Difficulty for ${site.host}`);
    for (const [value, label] of Object.entries(TIER_LABELS)) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      if ((site.tier || '') === value) opt.selected = true;
      select.append(opt);
    }
    select.addEventListener('change', () => {
      site.tier = select.value || null;
    });
    li.append(select);

    const remove = document.createElement('button');
    remove.className = 'btn btn-quiet px-2.5 py-2';
    remove.type = 'button';
    remove.title = `Remove ${site.host}`;
    remove.setAttribute('aria-label', `Remove ${site.host}`);
    remove.append(trashIcon());
    remove.addEventListener('click', () => removeSite(site.host));
    li.append(remove);

    el.sites.append(li);
  }
}

function renderSettings() {
  const s = state.settings;
  el.defaultTier.value = s.defaultTier;
  el.grantMinutes.value = s.grantMinutes;
  el.dailyBudget.value = s.dailyBudgetMinutes;
  el.backToWork.value = s.backToWorkUrl || '';
  el.theme.value = s.theme || 'system';
  el.scheduleEnabled.checked = Boolean(s.schedule.enabled);
  el.start.value = s.schedule.start;
  el.end.value = s.schedule.end;

  for (const input of el.days.querySelectorAll('input')) {
    input.checked = s.schedule.days.includes(Number(input.value));
  }
}

async function refresh() {
  state = await send({ type: 'state' });
  renderStats(state.stats);
  renderSites();
  renderSettings();
}

async function grantSite(host) {
  const granted = await chrome.permissions.request({ origins: [originPattern(host)] });
  if (granted) {
    await send({ type: 'sync' });
    await refresh();
  }
}

async function addSite() {
  el.addError.textContent = '';
  const host = normalizeHost(el.newSite.value);
  if (!host) {
    el.addError.textContent = 'That does not look like a website address.';
    return;
  }
  if (state.settings.sites.some((s) => s.host === host)) {
    el.addError.textContent = `${host} is already on the list.`;
    return;
  }

  const granted = await chrome.permissions.request({ origins: [originPattern(host)] });
  state.settings.sites.push({ host, tier: null, addedAt: Date.now() });
  el.newSite.value = '';

  await persist();
  if (!granted) {
    el.addError.textContent = `Added, but Chrome has not granted access to ${host} yet.`;
  }
}

async function removeSite(host) {
  state.settings.sites = state.settings.sites.filter((s) => s.host !== host);
  await persist();

  // Hand the permission back — keeping access to a site we no longer block would be
  // exactly the kind of quiet over-reach this rebuild exists to remove.
  chrome.permissions.remove({ origins: [originPattern(host)] });
}

async function persist() {
  const days = [...el.days.querySelectorAll('input:checked')].map((i) => Number(i.value));

  const settings = {
    schemaVersion: 2,
    sites: state.settings.sites,
    defaultTier: el.defaultTier.value,
    grantMinutes: Math.max(1, Math.min(Number(el.grantMinutes.value) || 5, 120)),
    dailyBudgetMinutes: Math.max(0, Math.min(Number(el.dailyBudget.value) || 0, 600)),
    backToWorkUrl: el.backToWork.value.trim(),
    theme: el.theme.value,
    schedule: {
      enabled: el.scheduleEnabled.checked,
      days,
      start: el.start.value || '09:00',
      end: el.end.value || '17:00'
    }
  };

  await chrome.storage.sync.set(settings);
  await send({ type: 'sync' });
  await refresh();
}

// Applied immediately rather than on Save: a theme you cannot see until you commit it is a
// guess. ui/theme.js is listening on storage.onChanged and repaints every open page.
el.theme.addEventListener('change', () => {
  chrome.storage.sync.set({ theme: el.theme.value });
});

el.addSite.addEventListener('click', addSite);
el.newSite.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addSite();
});

el.save.addEventListener('click', async () => {
  await persist();
  el.saved.textContent = 'Saved';
  setTimeout(() => {
    el.saved.textContent = '';
  }, 2000);
});

refresh();
