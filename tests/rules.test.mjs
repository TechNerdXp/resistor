/**
 * Rule reconciliation, against a stub of the chrome.* surface it touches.
 * Run: node --test tests/
 *
 * These live apart from unit.test.mjs because importing src/lib/rules.js is only safe once
 * globalThis.chrome exists. The stub models the one Chrome behaviour that bit us in the
 * wild: updateDynamicRules rejects the *whole* update if an added id already exists and is
 * not in removeRuleIds ("Rule with id 1 does not have a unique ID").
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { originPattern } from '../src/lib/domain.js';

/** Resolve on a later microtask, so callers genuinely interleave across every await. */
const tick = () => new Promise((r) => setTimeout(r, 0));

let dnrRules = [];
let updateCalls = 0;
let sync = {};
let local = {};
let origins = [];

globalThis.chrome = {
  runtime: { getURL: (p) => `chrome-extension://test/${p}` },
  permissions: {
    getAll: async () => {
      await tick();
      return { origins: [...origins] };
    }
  },
  storage: {
    sync: {
      get: async (key) => {
        await tick();
        return key === null ? { ...sync } : { [key]: sync[key] };
      },
      set: async (patch) => {
        await tick();
        Object.assign(sync, patch);
      }
    },
    local: {
      get: async (key) => {
        await tick();
        return key === null ? { ...local } : { [key]: local[key] };
      },
      set: async (patch) => {
        await tick();
        Object.assign(local, patch);
      }
    }
  },
  declarativeNetRequest: {
    getDynamicRules: async () => {
      await tick();
      return dnrRules.map((r) => ({ ...r }));
    },
    updateDynamicRules: async ({ removeRuleIds = [], addRules = [] }) => {
      await tick();
      updateCalls++;
      const kept = dnrRules.filter((r) => !removeRuleIds.includes(r.id));
      const live = new Set(kept.map((r) => r.id));
      for (const rule of addRules) {
        if (live.has(rule.id)) {
          throw new Error(`Rule with id ${rule.id} does not have a unique ID.`);
        }
        live.add(rule.id);
      }
      dnrRules = [...kept, ...addRules];
    }
  }
};

const { syncRules, hostsMissingPermission } = await import('../src/lib/rules.js');

function reset(hosts, { granted = hosts } = {}) {
  dnrRules = [];
  updateCalls = 0;
  local = {};
  origins = granted.map(originPattern);
  sync = {
    schemaVersion: 2,
    sites: hosts.map((host) => ({ host, tier: null, addedAt: 0 })),
    schedule: { enabled: false, days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' }
  };
}

const blockRules = () => dnrRules.filter((r) => r.action.type === 'redirect');

test('a sync builds one block rule per granted host', async () => {
  reset(['youtube.com', 'reddit.com']);

  const result = await syncRules();

  assert.deepEqual(result.blockedHosts, ['youtube.com', 'reddit.com']);
  assert.deepEqual(
    blockRules().map((r) => r.condition.requestDomains[0]),
    ['youtube.com', 'reddit.com']
  );
  assert.equal(new Set(dnrRules.map((r) => r.id)).size, dnrRules.length);
});

test('hosts without permission get no rule, and are reported as missing', async () => {
  reset(['youtube.com', 'reddit.com'], { granted: ['youtube.com'] });

  await syncRules();

  assert.deepEqual(
    blockRules().map((r) => r.condition.requestDomains[0]),
    ['youtube.com']
  );
  assert.deepEqual(await hostsMissingPermission(), ['reddit.com']);
});

test('concurrent syncs do not collide over rule ids', async () => {
  // Onboarding fires three of these within milliseconds — permissions.onAdded,
  // storage.onChanged and an explicit 'sync' message. Before they were serialised, each
  // one read the rule set before any of the others had written, so the later updates tried
  // to re-add ids that already existed and Chrome rejected them outright.
  reset(['youtube.com', 'reddit.com', 'x.com']);

  const results = await Promise.allSettled([syncRules(), syncRules(), syncRules()]);

  const failed = results.filter((r) => r.status === 'rejected');
  assert.deepEqual(failed.map((r) => r.reason.message), [], 'no sync should be rejected');

  assert.equal(updateCalls, 3, 'each sync applies its own update');
  assert.equal(blockRules().length, 3, 'the final rule set is the whole blocklist, once');
  assert.equal(new Set(dnrRules.map((r) => r.id)).size, dnrRules.length);
});

test('a sync racing a blocklist change still ends on the newer state', async () => {
  reset(['youtube.com', 'reddit.com']);

  const first = syncRules();
  sync.sites = [{ host: 'x.com', tier: null, addedAt: 0 }];
  origins = [originPattern('x.com')];
  const second = syncRules();

  await Promise.all([first, second]);

  assert.deepEqual(
    blockRules().map((r) => r.condition.requestDomains[0]),
    ['x.com']
  );
});

test('a blocklist that grows while syncs overlap does not collide at the new ids', async () => {
  // The pre-fix failure signature when sites are added one at a time: a sync that read the
  // 7-rule state, then wrote after an 8-site sync had landed, removed ids 1..7 and kept id
  // 8 alive — then tried to add id 8 itself. Hence "Rule with id 8 does not have a unique
  // ID" rather than id 1. Growing the list is what moves the collision to the tail.
  const hosts = (n) =>
    Array.from({ length: n }, (_, i) => `site${i}.com`).map((host) => ({
      host,
      tier: null,
      addedAt: 0
    }));

  reset([]);
  sync.sites = hosts(7);
  origins = hosts(7).map((s) => originPattern(s.host));
  await syncRules();

  const errors = [];
  for (const n of [8, 9, 10]) {
    const stale = syncRules(); // reads the pre-growth state
    sync.sites = hosts(n);
    origins = hosts(n).map((s) => originPattern(s.host));
    const fresh = syncRules();

    for (const r of await Promise.allSettled([stale, fresh])) {
      if (r.status === 'rejected') errors.push(r.reason.message);
    }
  }

  assert.deepEqual(errors, []);
  assert.equal(blockRules().length, 10);
  assert.equal(new Set(dnrRules.map((r) => r.id)).size, dnrRules.length);
});

test('re-syncing replaces the rule set rather than appending to it', async () => {
  reset(['youtube.com', 'reddit.com']);
  await syncRules();

  sync.sites = [{ host: 'youtube.com', tier: null, addedAt: 0 }];
  await syncRules();

  assert.equal(blockRules().length, 1);
  assert.equal(new Set(dnrRules.map((r) => r.id)).size, dnrRules.length);
});
