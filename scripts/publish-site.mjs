/**
 * Publish site/ to GitHub Pages.
 *
 * The Pages site lives on the `gh-pages` branch of TechNerdXp/resistor, which has its own
 * orphan history: `main` there is still the v1 extension source, and this project's repo is
 * deliberately not on GitHub. So there is no shared history to push — the branch is simply
 * a mirror of site/, rewritten each time.
 *
 * site/ stays the single source of truth. The Chrome Web Store re-checks the homepage,
 * privacy and support URLs on every submission, so a stale or broken site is a submission
 * blocker; run this whenever site/ changes.
 *
 * Usage: npm run publish:site  [--dry]
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, cpSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const REMOTE = 'https://github.com/TechNerdXp/resistor.git';
const BRANCH = 'gh-pages';
const BASE_URL = 'https://technerdxp.github.io/resistor/';
const DRY = process.argv.includes('--dry');

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

let work;
try {
  work = mkdtempSync(join(tmpdir(), 'resistor-site-'));

  execFileSync('git', ['clone', '--depth', '1', '--branch', BRANCH, REMOTE, work], {
    stdio: 'pipe'
  });

  // Mirror, don't merge: anything dropped from site/ must disappear from the live site too.
  for (const entry of readdirSync(work)) {
    if (entry !== '.git') rmSync(join(work, entry), { recursive: true, force: true });
  }
  cpSync(SITE, work, { recursive: true });

  // Tells Pages to serve the files as-is rather than running them through Jekyll.
  writeFileSync(join(work, '.nojekyll'), '');

  git(work, 'add', '-A');
  const staged = git(work, 'status', '--porcelain');

  if (!staged) {
    console.log('Already published — site/ matches the live site. Nothing to do.');
    process.exit(0);
  }

  console.log('Changes to publish:');
  console.log(staged);

  if (DRY) {
    console.log('\n--dry: stopping before commit.');
    process.exit(0);
  }

  git(work, 'commit', '-m', 'Update the published site from site/');
  git(work, 'push', 'origin', BRANCH);

  console.log(`\nPushed. Pages rebuilds in ~1 min:\n  ${BASE_URL}`);
} catch (err) {
  console.error('Publish failed:', err.stderr?.toString() || err.message);
  process.exit(1);
} finally {
  if (work) rmSync(work, { recursive: true, force: true });
}
