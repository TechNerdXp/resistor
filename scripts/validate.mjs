/**
 * Pre-upload validation. Catches the things that only surface as a silent failure in
 * Chrome or a rejection from the Chrome Web Store review queue:
 *   - manifest fields that break CWS listing limits
 *   - references to files that do not exist
 *   - permissions we promised not to ship
 *   - debug logging left in production code
 *
 * Run: node scripts/validate.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const errors = [];
const warnings = [];

const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---------------------------------------------------------------- manifest
const manifestPath = join(SRC, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (manifest.name.length > 45) fail(`name is ${manifest.name.length} chars; keep it <= 45`);
if (manifest.description.length > 132) {
  fail(`description is ${manifest.description.length} chars; the store summary caps at 132`);
}
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) fail(`version "${manifest.version}" is not x.y.z`);

// The whole point of the v2 permission model.
const BANNED_PERMISSIONS = ['tabs', 'scripting', 'webRequest', 'webRequestBlocking', 'declarativeNetRequest'];
for (const p of manifest.permissions || []) {
  if (BANNED_PERMISSIONS.includes(p)) {
    fail(`permission "${p}" reintroduces an install-time warning; use the WithHostAccess variant`);
  }
}
if (manifest.host_permissions?.length) {
  fail('host_permissions must stay empty — sites are granted just-in-time via optional_host_permissions');
}
if (!manifest.optional_host_permissions?.length) {
  fail('optional_host_permissions is required for the just-in-time grant flow');
}

// ---------------------------------------------------------- referenced files
const referenced = new Set();

const addRef = (p) => {
  if (p) referenced.add(p.replace(/^\//, ''));
};

addRef(manifest.background?.service_worker);
addRef(manifest.action?.default_popup);
addRef(manifest.options_page);
for (const size of Object.values(manifest.icons || {})) addRef(size);
for (const size of Object.values(manifest.action?.default_icon || {})) addRef(size);
for (const entry of manifest.web_accessible_resources || []) {
  for (const r of entry.resources || []) addRef(r);
}

for (const ref of referenced) {
  if (!existsSync(join(SRC, ref))) fail(`manifest references missing file: src/${ref}`);
}

// ------------------------------------------------- html asset + script links
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(SRC);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const jsFiles = files.filter((f) => f.endsWith('.js'));

const LOCAL_REF = /(?:src|href)\s*=\s*"([^"]+)"/g;

for (const html of htmlFiles) {
  const body = readFileSync(html, 'utf8');
  const rel = relative(ROOT, html).replace(/\\/g, '/');

  for (const [, ref] of body.matchAll(LOCAL_REF)) {
    if (/^(https?:|mailto:|#|data:)/.test(ref)) continue;
    const target = resolve(dirname(html), ref);
    if (!existsSync(target)) fail(`${rel} references missing file: ${ref}`);
  }

  // Inline handlers and inline <script> both violate the MV3 default CSP.
  if (/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/.test(body)) {
    fail(`${rel} contains an inline <script>, which the MV3 CSP blocks`);
  }
  if (/\son(click|load|change|input|submit|mouseover|mouseout)\s*=/.test(body)) {
    fail(`${rel} uses an inline event handler, which the MV3 CSP blocks`);
  }
  if (!/<html lang=/.test(body)) warn(`${rel} has no lang attribute on <html>`);
}

// --------------------------------------------------------------- js hygiene
for (const js of jsFiles) {
  const body = readFileSync(js, 'utf8');
  const rel = relative(ROOT, js).replace(/\\/g, '/');

  if (/\bconsole\.(log|debug|info)\s*\(/.test(body)) {
    fail(`${rel} still has debug console output`);
  }
  if (/\.innerHTML\s*=/.test(body)) {
    fail(`${rel} assigns innerHTML; build nodes instead so the review is unambiguous`);
  }

  // ES module imports must resolve, including the extension — Chrome does not guess.
  for (const [, spec] of body.matchAll(/from\s+'([^']+)'/g)) {
    if (!spec.startsWith('.')) continue;
    if (!existsSync(resolve(dirname(js), spec))) {
      fail(`${rel} imports missing module: ${spec}`);
    }
  }
}

// ------------------------------------------------------------------- report
for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);

if (errors.length) {
  console.error(`\n${errors.length} error(s). Not ready to package.`);
  process.exit(1);
}
console.log(`OK — manifest, ${htmlFiles.length} pages and ${jsFiles.length} scripts validate.`);
console.log(`     name ${manifest.name.length}/45 chars · description ${manifest.description.length}/132 chars`);
