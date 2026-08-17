/**
 * Streaks and counters.
 *
 * A "resist" is landing on the interstitial and choosing to go back to work.
 * A "pass" is granting yourself timed access. The daily budget is measured in granted
 * minutes, which we can account for exactly from our own grants — no "tabs" permission
 * and no time-on-site tracking required.
 */

import { getStats, setStats, todayKey } from './storage.js';

/** Keep ~90 days of history; sync/local both stay small and the stats page stays fast. */
const MAX_DAYS = 90;

function emptyDay() {
  return { resists: 0, passes: 0, grantedMinutes: 0 };
}

function trim(byDay) {
  const keys = Object.keys(byDay).sort();
  while (keys.length > MAX_DAYS) delete byDay[keys.shift()];
  return byDay;
}

function dayBefore(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return todayKey(dt);
}

async function mutateToday(fn) {
  const stats = await getStats();
  const key = todayKey();
  stats.byDay[key] = { ...emptyDay(), ...(stats.byDay[key] || {}) };
  fn(stats, key);
  trim(stats.byDay);
  await setStats(stats);
  return stats;
}

export async function recordResist() {
  return mutateToday((stats, key) => {
    stats.byDay[key].resists += 1;
    stats.totalResists += 1;

    if (stats.lastResistDay !== key) {
      stats.streakDays = stats.lastResistDay === dayBefore(key) ? stats.streakDays + 1 : 1;
      stats.lastResistDay = key;
    }
  });
}

export async function recordPass(minutes) {
  return mutateToday((stats, key) => {
    stats.byDay[key].passes += 1;
    stats.byDay[key].grantedMinutes += minutes;
    stats.totalPasses += 1;
  });
}

/** Minutes of access already granted today. */
export async function grantedMinutesToday() {
  const stats = await getStats();
  return stats.byDay[todayKey()]?.grantedMinutes || 0;
}

/**
 * A streak only survives if you resisted today or yesterday; otherwise it is stale and
 * should read as 0 rather than showing a number the user has not earned.
 */
export async function currentStreak() {
  const stats = await getStats();
  if (!stats.lastResistDay) return 0;
  const today = todayKey();
  if (stats.lastResistDay === today || stats.lastResistDay === dayBefore(today)) {
    return stats.streakDays;
  }
  return 0;
}

export async function summary() {
  const stats = await getStats();
  const today = stats.byDay[todayKey()] || emptyDay();
  return {
    streak: await currentStreak(),
    todayResists: today.resists,
    todayPasses: today.passes,
    todayGrantedMinutes: today.grantedMinutes,
    totalResists: stats.totalResists,
    totalPasses: stats.totalPasses,
    byDay: stats.byDay
  };
}
