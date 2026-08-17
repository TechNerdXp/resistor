/**
 * Packages src/ into a Chrome Web Store upload zip.
 *
 * Validation and tests run first and a failure aborts the build — a package that would be
 * rejected in review should never reach the dashboard.
 *
 * src/ is staged before zipping rather than archived directly, because the two differ:
 *   - `key` is kept in src/ so an unpacked dev build loads under the real Web Store ID, but
 *     the Web Store REJECTS an uploaded manifest containing it ("key field is not allowed
 *     in manifest"), so it is stripped here.
 *   - `_comment_*` notes are stripped too; Chrome warns about unrecognized manifest keys.
 *
 * manifest.json must sit at the zip root, so the staged directory's *contents* are archived.
 */

import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  cpSync,
  readdirSync
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipDirectory } from './zip.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const STAGE = join(DIST, 'stage');

/** Manifest fields that are development-only and must not ship. */
const DEV_ONLY_FIELDS = ['key'];

// Rebuild the stylesheet first: src/ui/app.css is generated from styles/app.css, and shipping
// a stale one would mean the package looks different from the source it was built from.
// Invoke the CLI's JS entry directly rather than through npx: since Node 20, spawning a
// Windows .cmd shim without a shell fails with EINVAL, and enabling a shell here would mean
// quoting paths by hand.
execFileSync(
  process.execPath,
  [
    join(ROOT, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'),
    '-i',
    join(ROOT, 'styles', 'app.css'),
    '-o',
    join(SRC, 'ui', 'app.css'),
    '--minify'
  ],
  { cwd: ROOT, stdio: 'inherit' }
);

execFileSync(process.execPath, [join(ROOT, 'scripts', 'validate.mjs')], { stdio: 'inherit' });
// Every test file, not a hard-coded one: this used to name unit.test.mjs alone, so tests added
// later silently sat outside the gate the header above promises. Enumerated rather than
// globbed because execFileSync has no shell to expand a pattern.
const TESTS = join(ROOT, 'tests');
const testFiles = readdirSync(TESTS)
  .filter((f) => f.endsWith('.test.mjs'))
  .map((f) => join(TESTS, f));

if (!testFiles.length) throw new Error('No test files found — refusing to package untested code.');

execFileSync(process.execPath, ['--test', ...testFiles], { stdio: 'inherit' });

const { version } = JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8'));
const out = join(DIST, `resistor-${version}.zip`);

mkdirSync(DIST, { recursive: true });
rmSync(STAGE, { recursive: true, force: true });
if (existsSync(out)) rmSync(out);

cpSync(SRC, STAGE, { recursive: true });

const stagedPath = join(STAGE, 'manifest.json');
const manifest = JSON.parse(readFileSync(stagedPath, 'utf8'));
const stripped = [];

for (const field of DEV_ONLY_FIELDS) {
  if (field in manifest) {
    delete manifest[field];
    stripped.push(field);
  }
}
for (const field of Object.keys(manifest)) {
  if (field.startsWith('_comment')) {
    delete manifest[field];
    stripped.push(field);
  }
}

writeFileSync(stagedPath, `${JSON.stringify(manifest, null, 2)}\n`);

const names = zipDirectory(STAGE, out);

// Belt and braces: whatever the staging step did, the shipped manifest must be clean.
const shipped = JSON.parse(readFileSync(stagedPath, 'utf8'));
for (const field of DEV_ONLY_FIELDS) {
  if (field in shipped) {
    console.error(`ERROR "${field}" survived into the package — the Web Store will reject it.`);
    process.exit(1);
  }
}

rmSync(STAGE, { recursive: true, force: true });

const size = (readFileSync(out).length / 1024).toFixed(0);
console.log(`\nPackaged ${out.replace(ROOT, '.')} — ${names.length} files, ${size} KB.`);
if (stripped.length) console.log(`Stripped for upload: ${stripped.join(', ')}`);
console.log(`Ready to upload as v${version}.`);
