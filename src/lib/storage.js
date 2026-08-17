/**
 * Storage schema, defaults, and the v1 -> v2 migration.
 *
 * Settings live in chrome.storage.sync so they follow the user across devices.
 * Stats and temporary grants live in chrome.storage.local: they are high-churn and
 * device-specific, and sync has a hard 8KB-per-item / 100KB-total budget we must not
 * spend on history.
 */

import { normalizeHost } from './domain.js';

export const TIERS = ['gentle', 'focused', 'locked'];

export const DEFAULT_SETTINGS = {
  schemaVersion: 2,
  /** @type {{host: string, tier: string, addedAt: number}[]} */
  sites: [],
  defaultTier: 'focused',
  /** Minutes of self-granted access allowed per day, across all sites. 0 = unlimited. */
  dailyBudgetMinutes: 30,
  /** Length of a single "let me in" grant, in minutes. */
  grantMinutes: 5,
  schedule: {
    enabled: false,
    days: [1, 2, 3, 4, 5], // 0=Sun .. 6=Sat
    start: '09:00',
    end: '17:00'
  },
  /** Where "Back to work" sends you. Empty string = the browser's new tab page. */
  backToWorkUrl: '',
  /** 'system' follows the OS setting via prefers-color-scheme. See ui/theme.js. */
  theme: 'system'
};

export const THEMES = ['system', 'light', 'dark'];

export const DEFAULT_STATS = {
  totalResists: 0,
  totalPasses: 0,
  streakDays: 0,
  lastResistDay: null, // 'YYYY-MM-DD'
  /** @type {Record<string, {resists:number, passes:number, grantedMinutes:number}>} */
  byDay: {}
};

/** Local day key. Uses local time deliberately — a "day" is the user's day, not UTC's. */
export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getSettings() {
  const stored = await chrome.storage.sync.get(null);
  if (!stored || stored.schemaVersion !== 2) {
    return { ...DEFAULT_SETTINGS, ...migrateFromV1(stored) };
  }
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    schedule: { ...DEFAULT_SETTINGS.schedule, ...(stored.schedule || {}) }
  };
}

export async function setSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch, schemaVersion: 2 };
  await chrome.storage.sync.set(next);
  return next;
}

/**
 * v1 stored: blockedSites: string[], difficulty: 'easy'|'medium'|'hard', redirectUrl: string.
 * The existing install base is small but real — they must not lose their blocklist.
 * @param {Record<string, unknown>} old
 */
export function migrateFromV1(old) {
  if (!old || typeof old !== 'object') return {};

  const tierFromDifficulty = { easy: 'gentle', medium: 'focused', hard: 'locked' };
  const patch = { schemaVersion: 2 };

  if (Array.isArray(old.blockedSites)) {
    const now = Date.now();
    const seen = new Set();
    patch.sites = old.blockedSites
      .map(normalizeHost)
      .filter((h) => h && !seen.has(h) && seen.add(h))
      .map((host) => ({ host, tier: null, addedAt: now }));
  }

  if (typeof old.difficulty === 'string' && tierFromDifficulty[old.difficulty]) {
    patch.defaultTier = tierFromDifficulty[old.difficulty];
  }

  // v1 shipped upwork.com as the default redirect. That was the developer's own
  // interest baked into a stranger's browser; only carry it over if they changed it.
  if (typeof old.redirectUrl === 'string') {
    const url = old.redirectUrl.trim();
    if (url && !/^https?:\/\/(www\.)?upwork\.com\/?$/i.test(url)) {
      patch.backToWorkUrl = url;
    }
  }

  return patch;
}

export async function getStats() {
  const { stats } = await chrome.storage.local.get('stats');
  return { ...DEFAULT_STATS, ...(stats || {}) };
}

export async function setStats(stats) {
  await chrome.storage.local.set({ stats });
}

/** @returns {Promise<Record<string, {until:number, host:string}>>} */
export async function getGrants() {
  const { grants } = await chrome.storage.local.get('grants');
  return grants || {};
}

export async function setGrants(grants) {
  await chrome.storage.local.set({ grants });
}

/** Drops expired grants and returns the live ones. */
export async function pruneGrants(now = Date.now()) {
  const grants = await getGrants();
  let changed = false;
  for (const [host, g] of Object.entries(grants)) {
    if (!g || g.until <= now) {
      delete grants[host];
      changed = true;
    }
  }
  if (changed) await setGrants(grants);
  return grants;
}

/** Resolve the effective tier for a host (per-site override, else the global default). */
export function tierForHost(settings, host) {
  const site = settings.sites.find((s) => s.host === host);
  const tier = site?.tier || settings.defaultTier;
  return TIERS.includes(tier) ? tier : 'focused';
}
