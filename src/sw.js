/**
 * Service worker: the single owner of rule state.
 *
 * MV3 service workers are torn down aggressively, so nothing is held in memory. Every
 * entry point does the same thing — read storage, reconcile the dNR rule set — which
 * makes the worker's lifetime irrelevant to correctness.
 */

import { syncRules, hostsMissingPermission } from './lib/rules.js';
import {
  getSettings,
  setSettings,
  getGrants,
  setGrants,
  pruneGrants,
  migrateFromV1,
  tierForHost
} from './lib/storage.js';
import { recordResist, recordPass, grantedMinutesToday, summary } from './lib/stats.js';
import { nextScheduleBoundary } from './lib/schedule.js';

const GRANT_ALARM = 'grant:';
const SCHEDULE_ALARM = 'schedule';
const UNINSTALL_URL = 'https://technerdxp.github.io/resistor/goodbye.html';

chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.runtime.setUninstallURL(UNINSTALL_URL);

  // Onboarding is best-effort; rules must be reconciled either way, so a failure to open
  // the tab must not skip the reconcile below.
  try {
    if (details.reason === 'install') {
      await chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/welcome.html') });
    } else if (details.reason === 'update') {
      const stored = await chrome.storage.sync.get(null);
      if (stored && stored.schemaVersion !== 2) {
        // Existing v1 users keep their blocklist; their sites become permission-pending
        // until they confirm, because v1's <all_urls> grant is revoked by this update.
        await setSettings(migrateFromV1(stored));
        await chrome.tabs.create({
          url: chrome.runtime.getURL('onboarding/welcome.html?migrated=1')
        });
      }
    }
  } catch (err) {
    console.error('Resistor: onboarding on', details.reason, 'failed', err);
  }

  await reconcileSafely(`install:${details.reason}`);
});

/**
 * Every event entry point goes through this.
 *
 * A rejected promise left behind by an event listener is reported as "Uncaught (in promise)"
 * against the *listener's* line — so a failure deep inside rule building surfaced as an
 * anonymous error at the closing brace of reconcile(), naming neither the trigger nor the
 * cause. Swallowing it here and logging with context is the difference between a debuggable
 * error and a riddle.
 */
function reconcileSafely(trigger) {
  return reconcile().catch((err) => {
    console.error(`Resistor: reconcile failed after ${trigger}`, err);
  });
}

chrome.runtime.onStartup.addListener(() => reconcileSafely('startup'));
chrome.permissions.onAdded.addListener(() => reconcileSafely('permissions.onAdded'));
chrome.permissions.onRemoved.addListener(() => reconcileSafely('permissions.onRemoved'));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' || changes.grants) reconcileSafely(`storage.${area}`);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name.startsWith(GRANT_ALARM)) {
      const host = alarm.name.slice(GRANT_ALARM.length);
      const grants = await getGrants();
      delete grants[host];
      await setGrants(grants);
    }
  } catch (err) {
    console.error('Resistor: expiring a grant failed', alarm.name, err);
  }
  await reconcileSafely(`alarm ${alarm.name}`);
});

/** Reconcile rules and re-arm the schedule alarm. */
async function reconcile() {
  await pruneGrants();
  await syncRules();

  const settings = await getSettings();
  if (settings.schedule?.enabled) {
    chrome.alarms.create(SCHEDULE_ALARM, { when: nextScheduleBoundary(settings.schedule) });
  } else {
    chrome.alarms.clear(SCHEDULE_ALARM);
  }
}

/**
 * Grant timed access to one host.
 * Returns { ok: false, reason } when the daily budget is spent or the tier forbids it.
 */
async function grantAccess(host, requestedMinutes) {
  const settings = await getSettings();
  if (!settings.sites.some((s) => s.host === host)) {
    return { ok: false, reason: 'not-blocked' };
  }

  if (tierForHost(settings, host) === 'locked') {
    return { ok: false, reason: 'locked' };
  }

  const minutes = Math.max(1, Math.min(Number(requestedMinutes) || settings.grantMinutes, 120));
  const budget = Number(settings.dailyBudgetMinutes) || 0;

  if (budget > 0) {
    const used = await grantedMinutesToday();
    if (used + minutes > budget) {
      return { ok: false, reason: 'budget', used, budget };
    }
  }

  const until = Date.now() + minutes * 60_000;
  const grants = await getGrants();
  grants[host] = { host, until };
  await setGrants(grants);

  chrome.alarms.create(`${GRANT_ALARM}${host}`, { when: until });
  await recordPass(minutes);
  await syncRules();

  return { ok: true, until, minutes };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case 'state': {
          const [settings, stats, missing, grants] = await Promise.all([
            getSettings(),
            summary(),
            hostsMissingPermission(),
            getGrants()
          ]);
          sendResponse({ settings, stats, missing, grants });
          break;
        }
        case 'grant':
          sendResponse(await grantAccess(msg.host, msg.minutes));
          break;
        case 'resist':
          await recordResist();
          sendResponse({ ok: true });
          break;
        case 'sync':
          await reconcile();
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, reason: 'unknown' });
      }
    } catch (err) {
      // Answer even on failure. Returning true below promises the caller a response, and
      // an unanswered channel surfaces as an unhandled rejection in *their* page rather
      // than as the worker error it actually is.
      console.error('Resistor: message handler failed', msg?.type, err);
      sendResponse({ ok: false, reason: 'error', error: String(err?.message || err) });
    }
  })();
  return true; // keep the message channel open for the async response
});
