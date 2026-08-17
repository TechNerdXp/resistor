/**
 * Applies the user's theme choice before the page paints.
 *
 * Loaded as a CLASSIC script in <head> — not a module, and not deferred — so it runs before
 * first paint. A module would be deferred to after parsing and the page would flash the wrong
 * theme on every open, which on the pause screen is the first thing anyone sees.
 *
 * chrome.storage is asynchronous and therefore useless for avoiding that flash, so the choice
 * is mirrored into localStorage, which extension pages can read synchronously. chrome.storage
 * remains the source of truth (it syncs across devices); localStorage is only a paint-time
 * cache and is reconciled a moment later.
 *
 * "system" means: set no attribute at all, and let the prefers-color-scheme media query in
 * base.css decide. That is the default.
 */
(() => {
  const CACHE_KEY = 'resistor.theme';

  function apply(theme) {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
  }

  function cache(theme) {
    try {
      localStorage.setItem(CACHE_KEY, theme);
    } catch {
      /* storage may be unavailable; the async read below still corrects the theme */
    }
  }

  // Synchronous, pre-paint: whatever we knew last time.
  try {
    apply(localStorage.getItem(CACHE_KEY) || 'system');
  } catch {
    apply('system');
  }

  // Authoritative, a moment later: it may have changed on another device.
  chrome.storage.sync.get('theme', ({ theme }) => {
    const resolved = theme || 'system';
    cache(resolved);
    apply(resolved);
  });

  // Live updates while a page is open (e.g. changing it in settings with the popup showing).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.theme) return;
    const resolved = changes.theme.newValue || 'system';
    cache(resolved);
    apply(resolved);
  });
})();
