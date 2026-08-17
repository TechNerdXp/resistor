/**
 * Blocklist -> declarativeNetRequest dynamic rules.
 *
 * Why dNR instead of v1's content-script overlay: dNR redirects the *navigation*, so the
 * distracting page is never fetched, parsed, or rendered. No audio starts behind an
 * overlay, there is no DOM node to delete in devtools, and we need neither the
 * "scripting" nor the "tabs" permission — which is what removes the
 * "Read and change all your data on all websites" install warning.
 *
 * Rule layering:
 *   priority 1  block  — redirect main_frame to the interstitial
 *   priority 2  allow  — temporary "let me in" grants, and off-schedule hours
 * A higher-priority allow beats a lower-priority redirect, so lifting a block is one
 * rule addition rather than a teardown of the whole set.
 */

import { patternCoversHost } from './domain.js';
import { getSettings, pruneGrants } from './storage.js';
import { isBlockingActive } from './schedule.js';

const BLOCK_ID_BASE = 1;
const ALLOW_ID_BASE = 10_000;

/** Origins the user has actually granted. Rules for ungranted hosts silently never fire. */
export async function grantedHosts(sites) {
  const { origins = [] } = await chrome.permissions.getAll();
  return new Set(
    sites
      .map((s) => s.host)
      .filter((host) => origins.some((p) => patternCoversHost(p, host)))
  );
}

function buildBlockRule(host, index) {
  // `\0` is the whole matched URL. It is appended last and left unencoded so the
  // interstitial can recover it with a plain indexOf — query-encoding it here would be
  // undone by the browser anyway, and `h=` is a reliable fallback if capture fails.
  const target = `${chrome.runtime.getURL('blocked/blocked.html')}?h=${encodeURIComponent(host)}&u=\\0`;

  return {
    id: BLOCK_ID_BASE + index,
    priority: 1,
    action: { type: 'redirect', redirect: { regexSubstitution: target } },
    condition: {
      regexFilter: '^.*$',
      requestDomains: [host],
      resourceTypes: ['main_frame']
    }
  };
}

function buildAllowRule(hosts, index) {
  return {
    id: ALLOW_ID_BASE + index,
    priority: 2,
    action: { type: 'allow' },
    condition: { requestDomains: hosts, resourceTypes: ['main_frame'] }
  };
}

/**
 * Serialises rule updates. Read-then-write is not atomic across `await`, and a single
 * user action fans out into several triggers within milliseconds — granting origins
 * fires permissions.onAdded, writing the blocklist fires storage.onChanged, and
 * onboarding then sends an explicit 'sync'. Two overlapping syncs both read the same
 * "existing" rule set, so the second one asks Chrome to add ids the first already added
 * and the whole update is rejected with "Rule with id 1 does not have a unique ID".
 * Chaining every sync onto the previous one makes the read-then-write effectively atomic.
 */
let queue = Promise.resolve();

/**
 * Recompute the entire dynamic rule set from storage and apply it atomically.
 * Safe to call as often as you like — it is the single reconciliation point, called on
 * install, startup, settings change, grant, and alarm.
 * @returns {Promise<{blockedHosts: string[], grants: object, active: boolean}>}
 */
export function syncRules() {
  // Run after whatever is in flight, whether it settled or threw: one failed sync must
  // not poison the chain.
  const run = queue.then(applyRules, applyRules);
  queue = run.catch(() => {});
  return run;
}

async function applyRules() {
  const settings = await getSettings();
  const grants = await pruneGrants();
  const granted = await grantedHosts(settings.sites);

  const blockedHosts = settings.sites.map((s) => s.host).filter((h) => granted.has(h));

  const addRules = blockedHosts.map((host, i) => buildBlockRule(host, i));

  let allowIndex = 0;
  if (!isBlockingActive(settings.schedule)) {
    // Outside working hours: lift everything with one rule.
    if (blockedHosts.length) addRules.push(buildAllowRule(blockedHosts, allowIndex++));
  } else {
    const active = Object.keys(grants).filter((h) => blockedHosts.includes(h));
    if (active.length) addRules.push(buildAllowRule(active, allowIndex++));
  }

  // Remove the ids we are about to add as well as the ones we read, so an apply is
  // self-correcting even if the worker was torn down mid-write and our read is stale.
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = [...new Set([...existing.map((r) => r.id), ...addRules.map((r) => r.id)])];

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });

  return { blockedHosts, grants, active: isBlockingActive(settings.schedule) };
}

/** Hosts on the blocklist that we do NOT hold permission for — surfaced in the UI. */
export async function hostsMissingPermission() {
  const settings = await getSettings();
  const granted = await grantedHosts(settings.sites);
  return settings.sites.map((s) => s.host).filter((h) => !granted.has(h));
}
