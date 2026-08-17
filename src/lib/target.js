/**
 * Recovering the blocked URL from the interstitial's query string.
 *
 * The dNR rule appends the whole original URL raw, as the last parameter:
 *   blocked.html?h=<host>&u=https://www.youtube.com/watch?v=x&t=42s
 * That tail is not URL-encoded (dNR's `\0` substitutes the match verbatim), so
 * URLSearchParams would stop at the first nested `&` and hand back a truncated URL.
 * Everything after the first `&u=` is therefore taken by position instead.
 *
 * This is also a trust boundary: whatever comes back is fed to location.replace, so it
 * must be an http(s) URL on the host we actually blocked — never javascript:, never a
 * lookalike host.
 */

const MARKER = '&u=';

/**
 * @param {string} search the raw location.search, including the leading '?'
 * @returns {{host: string, url: string}} url is '' when nothing safe could be recovered
 */
export function parseBlockedTarget(search) {
  const raw = String(search || '');
  const at = raw.indexOf(MARKER);

  const head = at === -1 ? raw : raw.slice(0, at);
  const host = new URLSearchParams(head).get('h') || '';
  const candidate = at === -1 ? '' : raw.slice(at + MARKER.length);

  return { host, url: safeUrlFor(candidate, host) || fallbackFor(host) };
}

/** Only an http(s) URL on the blocked host (or a subdomain of it) may be navigated to. */
export function safeUrlFor(candidate, host) {
  if (!candidate || !host) return '';
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return '';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';

  const h = parsed.hostname.toLowerCase();
  const base = host.toLowerCase();
  if (h !== base && !h.endsWith(`.${base}`)) return '';

  return parsed.href;
}

function fallbackFor(host) {
  return host ? `https://${host}/` : '';
}
