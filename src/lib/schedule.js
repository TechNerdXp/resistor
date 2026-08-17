/**
 * Work-hours scheduling.
 *
 * When a schedule is enabled, blocking is only active inside the window. Outside it,
 * a single high-priority allow rule lifts every block at once rather than tearing
 * down and rebuilding the whole rule set.
 */

/** Minutes since local midnight for a 'HH:MM' string. */
function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Is blocking active right now?
 * A window whose end is <= its start is treated as crossing midnight (e.g. 22:00-06:00).
 * @param {{enabled:boolean, days:number[], start:string, end:string}} schedule
 * @param {Date} now
 */
export function isBlockingActive(schedule, now = new Date()) {
  if (!schedule?.enabled) return true;

  const start = toMinutes(schedule.start);
  const end = toMinutes(schedule.end);
  if (start === null || end === null) return true; // malformed schedule fails safe: keep blocking

  const days = Array.isArray(schedule.days) ? schedule.days : [];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  const yesterday = (today + 6) % 7;

  if (end > start) {
    return days.includes(today) && nowMin >= start && nowMin < end;
  }

  // Crosses midnight: the evening part belongs to today, the small hours to yesterday.
  if (nowMin >= start) return days.includes(today);
  if (nowMin < end) return days.includes(yesterday);
  return false;
}

/**
 * Next moment the active/inactive state flips, so the service worker can set a single
 * alarm instead of polling.
 * @returns {number} epoch ms
 */
export function nextScheduleBoundary(schedule, now = new Date()) {
  if (!schedule?.enabled) return now.getTime() + 60 * 60 * 1000;

  const candidates = [toMinutes(schedule.start), toMinutes(schedule.end)].filter(
    (v) => v !== null
  );
  if (!candidates.length) return now.getTime() + 60 * 60 * 1000;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const upcoming = candidates.filter((c) => c > nowMin).sort((a, b) => a - b);

  const next = new Date(now);
  next.setSeconds(0, 0);
  if (upcoming.length) {
    next.setHours(0, upcoming[0], 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(0, Math.min(...candidates), 0, 0);
  }
  return next.getTime();
}
