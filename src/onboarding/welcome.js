/**
 * First run.
 *
 * The whole point of this screen is that Resistor installs with *no* host permissions.
 * The user picks their sites here and Chrome asks once, for exactly those origins — which
 * is why the install dialog no longer says "read and change all your data on all websites".
 */

import { normalizeHost, originPattern } from '../lib/domain.js';

const PRESETS = [
  'youtube.com',
  'facebook.com',
  'instagram.com',
  'x.com',
  'reddit.com',
  'tiktok.com',
  'netflix.com',
  'linkedin.com'
];

const el = {
  presets: document.getElementById('presets'),
  custom: document.getElementById('custom'),
  continueBtn: document.getElementById('continueBtn'),
  count: document.getElementById('count'),
  error: document.getElementById('error'),
  done: document.getElementById('done'),
  optionsBtn: document.getElementById('optionsBtn'),
  migrated: document.getElementById('migrated')
};

if (new URLSearchParams(location.search).has('migrated')) {
  el.migrated.hidden = false;
}

for (const host of PRESETS) {
  const label = document.createElement('label');
  label.className = 'choice';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.value = host;
  input.addEventListener('change', updateCount);
  label.append(input, document.createTextNode(host));
  el.presets.append(label);
}

/** Pre-tick anything already on the blocklist (migrated v1 users land here). */
chrome.storage.sync.get('sites', ({ sites }) => {
  const existing = new Set((sites || []).map((s) => s.host));
  if (!existing.size) return updateCount();

  for (const input of el.presets.querySelectorAll('input')) {
    if (existing.has(input.value)) input.checked = true;
  }
  const extra = [...existing].filter((h) => !PRESETS.includes(h));
  if (extra.length) el.custom.value = extra.join('\n');
  updateCount();
});

function chosenHosts() {
  const picked = [...el.presets.querySelectorAll('input:checked')].map((i) => i.value);
  const custom = el.custom.value
    .split('\n')
    .map(normalizeHost)
    .filter(Boolean);
  return [...new Set([...picked, ...custom])];
}

function updateCount() {
  const n = chosenHosts().length;
  el.count.textContent = n ? `${n} site${n === 1 ? '' : 's'} selected` : 'Nothing selected yet';
  el.continueBtn.disabled = n === 0;
}

el.custom.addEventListener('input', updateCount);
updateCount();

el.continueBtn.addEventListener('click', async () => {
  el.error.textContent = '';
  const hosts = chosenHosts();
  if (!hosts.length) return;

  // One prompt for every origin at once — asking eight times in a row would be its own
  // reason to uninstall.
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: hosts.map(originPattern) });
  } catch (err) {
    el.error.textContent = 'Chrome refused the permission request. Try again from settings.';
    return;
  }

  if (!granted) {
    el.error.textContent =
      'Without permission for those sites Resistor cannot block them. Nothing else on the web is touched.';
    return;
  }

  const now = Date.now();
  const { sites: previous = [] } = await chrome.storage.sync.get('sites');
  const byHost = new Map(previous.map((s) => [s.host, s]));
  const sites = hosts.map((host) => byHost.get(host) || { host, tier: null, addedAt: now });

  await chrome.storage.sync.set({ sites, schemaVersion: 2 });

  // The write above already wakes the worker through storage.onChanged; this only asks it
  // to finish before we say "done". If the worker is mid-restart the message can fail, and
  // that must not strand the user on a screen that never advances.
  try {
    await chrome.runtime.sendMessage({ type: 'sync' });
  } catch {
    /* reconciliation still happens via storage.onChanged */
  }

  el.done.hidden = false;
  el.done.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

el.optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
