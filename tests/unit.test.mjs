/**
 * Unit tests for the pure logic — the parts where v1 actually had bugs.
 * Run: node --test tests/
 *
 * chrome.* is only ever touched inside functions, so these modules import cleanly under
 * plain node without a browser stub.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeHost, originPattern, patternCoversHost } from '../src/lib/domain.js';
import { isBlockingActive, nextScheduleBoundary } from '../src/lib/schedule.js';
import {
  migrateFromV1,
  tierForHost,
  todayKey,
  DEFAULT_SETTINGS,
  THEMES
} from '../src/lib/storage.js';
import { parseBlockedTarget, safeUrlFor } from '../src/lib/target.js';

test('normalizeHost accepts the many shapes a user might paste', () => {
  assert.equal(normalizeHost('youtube.com'), 'youtube.com');
  assert.equal(normalizeHost('  YouTube.COM  '), 'youtube.com');
  assert.equal(normalizeHost('https://www.youtube.com/feed/subscriptions'), 'youtube.com');
  assert.equal(normalizeHost('www.youtube.com'), 'youtube.com');
  assert.equal(normalizeHost('youtube.com/'), 'youtube.com');
  assert.equal(normalizeHost('youtube.com:443'), 'youtube.com');
  assert.equal(normalizeHost('news.ycombinator.com'), 'news.ycombinator.com');
});

test('normalizeHost rejects things that are not hosts', () => {
  for (const bad of ['', '   ', 'localhost', 'not a domain', '-bad.com', 'bad-.com', '..', 'http://']) {
    assert.equal(normalizeHost(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('v1 substring matching bug does not survive: lookalike hosts are distinct', () => {
  // v1 did `url.hostname.includes(site)`, so this evil host matched a "youtube.com" entry.
  const evil = normalizeHost('youtube.com.evil.tld');
  assert.equal(evil, 'youtube.com.evil.tld');
  assert.notEqual(evil, 'youtube.com');
  assert.equal(patternCoversHost(originPattern('youtube.com'), evil), false);
});

test('originPattern covers the host and its subdomains only', () => {
  const p = originPattern('youtube.com');
  assert.equal(p, '*://*.youtube.com/*');
  assert.equal(patternCoversHost(p, 'youtube.com'), true);
  assert.equal(patternCoversHost(p, 'www.youtube.com'), true);
  assert.equal(patternCoversHost(p, 'm.youtube.com'), true);
  assert.equal(patternCoversHost(p, 'notyoutube.com'), false);
  assert.equal(patternCoversHost(p, 'youtube.com.evil.tld'), false);
});

test('schedule: disabled means always blocking', () => {
  assert.equal(isBlockingActive({ enabled: false }), true);
});

test('schedule: ordinary daytime window', () => {
  const sched = { enabled: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' };
  const wedAt10 = new Date(2026, 7, 19, 10, 0);
  const wedAt18 = new Date(2026, 7, 19, 18, 0);
  const sunAt10 = new Date(2026, 7, 16, 10, 0);

  assert.equal(wedAt10.getDay(), 3);
  assert.equal(isBlockingActive(sched, wedAt10), true);
  assert.equal(isBlockingActive(sched, wedAt18), false);
  assert.equal(isBlockingActive(sched, sunAt10), false);
});

test('schedule: window crossing midnight', () => {
  const sched = { enabled: true, days: [5], start: '22:00', end: '06:00' };
  const friAt23 = new Date(2026, 7, 21, 23, 0); // Friday evening
  const satAt02 = new Date(2026, 7, 22, 2, 0); // small hours, belongs to Friday
  const satAt08 = new Date(2026, 7, 22, 8, 0);

  assert.equal(friAt23.getDay(), 5);
  assert.equal(isBlockingActive(sched, friAt23), true);
  assert.equal(isBlockingActive(sched, satAt02), true);
  assert.equal(isBlockingActive(sched, satAt08), false);
});

test('schedule: a malformed window fails safe by keeping blocking on', () => {
  assert.equal(isBlockingActive({ enabled: true, days: [0, 1, 2, 3, 4, 5, 6], start: 'x', end: 'y' }), true);
});

test('nextScheduleBoundary lands on the next start or end', () => {
  const sched = { enabled: true, days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' };
  const at10 = new Date(2026, 7, 19, 10, 30);
  const boundary = new Date(nextScheduleBoundary(sched, at10));
  assert.equal(boundary.getHours(), 17);
  assert.equal(boundary.getMinutes(), 0);

  const at18 = new Date(2026, 7, 19, 18, 0);
  const next = new Date(nextScheduleBoundary(sched, at18));
  assert.equal(next.getDate(), 20);
  assert.equal(next.getHours(), 9);
});

test('v1 migration keeps the blocklist and maps difficulty to tiers', () => {
  const patch = migrateFromV1({
    blockedSites: ['youtube.com', 'https://www.facebook.com/', 'facebook.com', 'nonsense host'],
    difficulty: 'hard',
    redirectUrl: 'https://www.upwork.com'
  });

  assert.deepEqual(patch.sites.map((s) => s.host), ['youtube.com', 'facebook.com']);
  assert.equal(patch.defaultTier, 'locked');
  // upwork.com was v1's baked-in default, not a user choice — it must not carry over.
  assert.equal(patch.backToWorkUrl, undefined);
});

test('v1 migration keeps a redirect the user actually chose', () => {
  const patch = migrateFromV1({ blockedSites: [], redirectUrl: 'https://notion.so' });
  assert.equal(patch.backToWorkUrl, 'https://notion.so');
});

test('v1 migration tolerates junk', () => {
  assert.deepEqual(migrateFromV1(null), {});
  assert.deepEqual(migrateFromV1(undefined), {});
  assert.deepEqual(migrateFromV1({}), { schemaVersion: 2 });
});

test('tierForHost prefers the per-site override, then the default', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    defaultTier: 'gentle',
    sites: [
      { host: 'youtube.com', tier: 'locked' },
      { host: 'reddit.com', tier: null }
    ]
  };
  assert.equal(tierForHost(settings, 'youtube.com'), 'locked');
  assert.equal(tierForHost(settings, 'reddit.com'), 'gentle');
  assert.equal(tierForHost(settings, 'unknown.com'), 'gentle');
});

test('interstitial recovers a blocked URL that carries its own query string', () => {
  // The dNR redirect appends the original URL raw, so the nested `&` must not truncate it.
  const { host, url } = parseBlockedTarget(
    '?h=youtube.com&u=https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s'
  );
  assert.equal(host, 'youtube.com');
  assert.equal(url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s');
});

test('interstitial falls back to the host root when no URL was captured', () => {
  assert.deepEqual(parseBlockedTarget('?h=reddit.com'), {
    host: 'reddit.com',
    url: 'https://reddit.com/'
  });
});

test('interstitial accepts subdomains of the blocked host', () => {
  const { url } = parseBlockedTarget('?h=youtube.com&u=https://m.youtube.com/feed');
  assert.equal(url, 'https://m.youtube.com/feed');
});

test('interstitial refuses to navigate anywhere dangerous', () => {
  const cases = [
    // Lookalike host — the v1 substring bug, now at the navigation boundary.
    ['?h=youtube.com&u=https://youtube.com.evil.tld/', 'https://youtube.com/'],
    // Script and data URLs must never reach location.replace.
    ['?h=youtube.com&u=javascript:alert(1)', 'https://youtube.com/'],
    ['?h=youtube.com&u=data:text/html,<h1>x', 'https://youtube.com/'],
    // A different site entirely.
    ['?h=youtube.com&u=https://evil.example/steal', 'https://youtube.com/'],
    // Garbage.
    ['?h=youtube.com&u=not a url', 'https://youtube.com/']
  ];
  for (const [search, expected] of cases) {
    assert.equal(parseBlockedTarget(search).url, expected, `for ${search}`);
  }
});

test('interstitial copes with an empty or malformed query', () => {
  assert.deepEqual(parseBlockedTarget(''), { host: '', url: '' });
  assert.deepEqual(parseBlockedTarget('?'), { host: '', url: '' });
  assert.deepEqual(parseBlockedTarget(undefined), { host: '', url: '' });
});

test('safeUrlFor is strict about scheme and host', () => {
  // Suffix-only lookalikes must fail: "notexample.com" ends with "example.com" as a
  // string but is a different site, which is precisely the v1 bug class.
  assert.equal(safeUrlFor('https://notexample.com/x', 'example.com'), '');
  assert.equal(safeUrlFor('https://sub.example.com/x', 'example.com'), 'https://sub.example.com/x');
  assert.equal(safeUrlFor('http://example.com/', 'example.com'), 'http://example.com/');
  assert.equal(safeUrlFor('ftp://example.com/', 'example.com'), '');
  assert.equal(safeUrlFor('', 'example.com'), '');
  assert.equal(safeUrlFor('https://example.com/', ''), '');
});

test('the default theme follows the system, and light/dark are the only overrides', () => {
  // The promise is "respects your system preference unless you say otherwise" — if this
  // default ever flips, the extension starts imposing a look it was never asked to.
  assert.equal(DEFAULT_SETTINGS.theme, 'system');
  assert.deepEqual(THEMES, ['system', 'light', 'dark']);
});

test('todayKey is a local-time YYYY-MM-DD', () => {
  assert.equal(todayKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(todayKey(new Date(2026, 11, 31)), '2026-12-31');
});
