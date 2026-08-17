/**
 * Hostname normalisation and match-pattern helpers.
 *
 * v1 matched with `url.hostname.includes(site)`, which meant a blocklist entry of
 * "youtube.com" also matched "youtube.com.evil.tld". Everything here funnels through
 * a strict validator so that class of bug cannot come back.
 */

// Labels are 1-63 chars, alphanumeric or hyphen, never starting/ending with a hyphen.
// At least two labels, so bare "localhost" is rejected.
const HOST_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/**
 * Accepts anything a user might paste — "https://www.YouTube.com/feed", "youtube.com/",
 * "www.youtube.com:443" — and returns the bare registrable host, or null if unusable.
 * @param {string} input
 * @returns {string|null}
 */
export function normalizeHost(input) {
  let s = String(input ?? '').trim().toLowerCase();
  if (!s) return null;

  if (s.includes('://')) {
    try {
      s = new URL(s).hostname;
    } catch {
      return null;
    }
  } else {
    s = s.split('/')[0];
  }

  s = s.replace(/:\d+$/, '');
  s = s.replace(/^www\./, '');
  s = s.replace(/\.$/, '');

  if (!HOST_RE.test(s)) return null;
  return s;
}

/**
 * Chrome match pattern for a host. `*.example.com` covers example.com itself plus
 * every subdomain, which is what people mean when they block a site.
 * @param {string} host
 * @returns {string}
 */
export function originPattern(host) {
  return `*://*.${host}/*`;
}

/**
 * True when `host` is the granted origin's host or a subdomain of it.
 * @param {string} host
 * @param {string} pattern a match pattern such as `*://*.example.com/*`
 */
export function patternCoversHost(pattern, host) {
  const m = /^\*:\/\/\*\.([^/]+)\/\*$/.exec(pattern);
  if (!m) return false;
  const base = m[1];
  return host === base || host.endsWith(`.${base}`);
}

/** Display form used in the UI. */
export function prettyHost(host) {
  return host;
}
