/**
 * Generates every Chrome Web Store graphic from the real extension UI.
 *
 * Nothing here is mocked up in a design tool: the screenshots are captures of the actual
 * pages running in Chromium with realistic seeded data, composed into caption frames at
 * Google's exact required dimensions. Re-run it whenever the UI changes and the store
 * assets stay honest.
 *
 * Usage: node scripts/screenshots.mjs [path-to-chromium]
 * Output: store/assets/*.png
 */

import { spawn } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  cpSync,
  readdirSync
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'store', 'assets');
const WORK = join(tmpdir(), 'resistor-shots');
const PORT = 9412;

const CHROMIUM =
  process.argv[2] ||
  findChromium() ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function findChromium() {
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(base)) return null;
  for (const dir of readdirSync(base)) {
    if (!dir.startsWith('chromium-')) continue;
    for (const sub of ['chrome-win64', 'chrome-win']) {
      const bin = join(base, dir, sub, 'chrome.exe');
      if (existsSync(bin)) return bin;
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- brand tokens
// Mirrors the LIGHT half of the ember palette in styles/app.css so the frame and the captured
// UI read as one image rather than two designs stapled together.
//
// Light, not dark, on purpose: Windows and macOS both ship light, Resistor's default theme is
// "system", and store assets are static PNGs served identically to everyone. So the listing has
// to show what the majority actually sees on the day they install it.
// `bg` is deliberately a step deeper than --rz-canvas (#fbf9f6): the captured UI paints its own
// near-white canvas, and on an identical background the screenshot would dissolve into the frame
// instead of reading as a window sitting on it.
const T = {
  bg: '#f4ece1',
  line: '#ded2c2',
  text: '#1c1917', // --rz-ink
  dim: '#78716c', // --rz-muted
  accent: '#c2410c', // --rz-ember
  font: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
};

// ------------------------------------------------------------ demo seed data
const SEED_HOSTS = ['youtube.com', 'reddit.com', 'x.com', 'netflix.com'];

const SEED = `
  (async () => {
    await chrome.storage.sync.set({
      schemaVersion: 2,
      sites: [
        { host: 'youtube.com', tier: null,      addedAt: Date.now() },
        { host: 'reddit.com',  tier: 'focused', addedAt: Date.now() },
        { host: 'x.com',       tier: 'gentle',  addedAt: Date.now() },
        { host: 'netflix.com', tier: 'locked',  addedAt: Date.now() }
      ],
      defaultTier: 'focused',
      grantMinutes: 5,
      dailyBudgetMinutes: 30,
      backToWorkUrl: '',
      schedule: { enabled: true, days: [1,2,3,4,5], start: '09:00', end: '17:00' }
    });
    const today = (() => { const d=new Date(); const p=n=>String(n).padStart(2,'0');
      return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); })();
    await chrome.storage.local.set({ stats: {
      totalResists: 412, totalPasses: 63, streakDays: 12, lastResistDay: today,
      byDay: { [today]: { resists: 7, passes: 2, grantedMinutes: 10 } }
    }});
    return 'seeded';
  })()`;

// --------------------------------------------------------------- CDP plumbing
function rpc(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  return (method, params = {}) =>
    new Promise((res) => {
      const myId = ++id;
      pending.set(myId, res);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
}

const targets = () => fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());

async function attach(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const send = rpc(ws);
  await send('Runtime.enable');
  const evaluate = async (expression) => {
    const { result } = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result?.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description?.split('\n')[0]);
    }
    return result?.result?.value;
  };
  return { ws, send, evaluate };
}

/** Opens a fresh tab, sizes it exactly, runs optional setup, and returns a PNG buffer. */
async function shootOnce({ url, width, height, scale = 2, scheme = 'light', setup, settle = 1400 }) {
  // Two shots share blocked.html, so matching on URL alone can attach to the previous
  // tab before Chromium has finished closing it. Only a target that did not exist a
  // moment ago counts as ours.
  const before = new Set((await targets()).map((t) => t.id));
  await fetch(`http://127.0.0.1:${PORT}/json/new?${url}`, { method: 'PUT' });

  const prefix = url.split('?')[0];
  let target;
  for (let i = 0; i < 40 && !target; i += 1) {
    await sleep(250);
    const all = await targets().catch(() => []);
    target = all.find(
      (t) => t.type === 'page' && !before.has(t.id) && t.url.startsWith(prefix)
    );
  }
  if (!target) throw new Error(`page never opened: ${url}`);

  const page = await attach(target);
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: false
  });
  // The extension's default theme is "system", so this media override is what decides which
  // palette the captured UI paints in. The frame pages hard-code their colours and ignore it.
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: scheme }]
  });

  await sleep(settle);
  if (setup) await page.evaluate(setup);

  const { result } = await page.send('Page.captureScreenshot', { format: 'png' });
  page.ws.close();
  await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`).catch(() => {});
  if (!result?.data) throw new Error(`capture returned no data for ${url}`);
  return Buffer.from(result.data, 'base64');
}

/** Headless capture is occasionally racy; one retry keeps asset regeneration repeatable. */
async function shoot(spec) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await shootOnce(spec);
    } catch (err) {
      lastError = err;
      await sleep(800);
    }
  }
  throw lastError;
}

// ------------------------------------------------------------ frame templates
const shell = (w, h, body, extra = '') => `<!doctype html><html><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{font-family:${T.font};background:${T.bg};color:${T.text};
       -webkit-font-smoothing:antialiased}
  .glow{position:absolute;inset:0;
        background:radial-gradient(1100px 520px at 50% -8%, ${T.accent}2e, transparent 62%),
                   radial-gradient(700px 400px at 100% 0%, ${T.accent}1a, transparent 65%)}
  ${extra}
</style></head><body>${body}</body></html>`;

function screenshotFrame({ caption, sub, png, w = 1280, h = 800 }) {
  const data = `data:image/png;base64,${png.toString('base64')}`;
  return shell(
    w,
    h,
    `<div class="glow"></div>
     <div class="wrap">
       <h1>${caption}</h1>
       <p>${sub}</p>
       <div class="shot"><img src="${data}" alt=""></div>
     </div>`,
    `.wrap{position:relative;height:100%;display:flex;flex-direction:column;
           align-items:center;padding:56px 64px 0;text-align:center}
     h1{font-size:52px;font-weight:700;letter-spacing:-0.025em;line-height:1.1}
     p{margin-top:14px;font-size:22px;color:${T.dim};font-weight:450;max-width:900px}
     /* No inset highlight here: lifting a dark edge needed one, a white window on warm stone
        separates on its border and shadow alone. */
     .shot{margin-top:38px;width:100%;border-radius:14px 14px 0 0;overflow:hidden;
           border:1px solid ${T.line};border-bottom:0;
           box-shadow:0 2px 6px rgba(28,25,23,.06), 0 28px 60px -18px rgba(28,25,23,.30)}
     .shot img{display:block;width:100%}`
  );
}

function tile({ w, h, title, sub, scale = 1 }) {
  const logo = `data:image/png;base64,${readFileSync(join(SRC, 'icons', 'icon128.png')).toString('base64')}`;
  return shell(
    w,
    h,
    `<div class="glow"></div>
     <div class="t">
       <img src="${logo}" alt="">
       <div>
         <h1>${title}</h1>
         <p>${sub}</p>
       </div>
     </div>`,
    `.t{position:relative;height:100%;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:${20 * scale}px;
        text-align:center;padding:0 ${40 * scale}px}
     /* The mark must not outgrow the wordmark on the large canvases. */
     .t img{width:${76 * Math.min(scale, 1.5)}px;height:${76 * Math.min(scale, 1.5)}px}
     h1{font-size:${34 * scale}px;font-weight:700;letter-spacing:-0.02em;line-height:1.15}
     p{margin-top:${10 * scale}px;font-size:${16 * scale}px;color:${T.dim};line-height:1.45}`
  );
}

// ------------------------------------------------------------------- specs
const VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

const SHOTS = [
  {
    file: 'screenshot-1-pause.png',
    caption: 'The page never loads.',
    sub: 'No overlay to close. No video playing underneath. Nothing is fetched at all.',
    page: `blocked/blocked.html?h=youtube.com&u=${VIDEO}`
  },
  {
    file: 'screenshot-2-access.png',
    caption: 'Let yourself in &mdash; it closes itself.',
    sub: 'Grant five minutes without disabling anything. The block returns on its own.',
    page: `blocked/blocked.html?h=reddit.com&u=https://www.reddit.com/r/productivity/`,
    setup: `
      (async () => {
        document.getElementById('revealBtn').click();
        await new Promise(r => setTimeout(r, 2200));
        const t = document.getElementById('reason');
        t.value = 'looking up one thread on deep work, then straight back';
        t.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 200));
      })()`
  },
  {
    file: 'screenshot-3-permissions.png',
    caption: 'It asks for nothing at install.',
    sub: 'Chrome grants access to the sites you pick &mdash; and to nothing else on the web.',
    page: 'onboarding/welcome.html',
    setup: `
      (async () => {
        for (const h of ['youtube.com','reddit.com','x.com','netflix.com']) {
          const cb = [...document.querySelectorAll('#presets input')].find(i => i.value === h);
          if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
        }
        await new Promise(r => setTimeout(r, 150));
      })()`
  },
  {
    file: 'screenshot-4-levels.png',
    caption: 'Three levels of resistance.',
    sub: 'Gentle for a nudge, Focused to make you write why, Locked for no way through.',
    page: 'options/options.html',
    setup: `document.querySelector('#sites').scrollIntoView({block:'center'}); true`
  },
  {
    file: 'screenshot-5-schedule.png',
    caption: 'Block only during work hours.',
    sub: 'Set your window and your daily allowance. Evenings and weekends stay yours.',
    page: 'options/options.html',
    setup: `document.getElementById('scheduleEnabled').closest('section').scrollIntoView({block:'center'}); true`
  }
];

// --------------------------------------------------------------------- main
async function main() {
  // Screenshot build: the demo hosts are pre-granted so no "needs access" tags appear.
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  const build = join(WORK, 'ext');
  cpSync(SRC, build, { recursive: true });
  const manifest = JSON.parse(readFileSync(join(build, 'manifest.json'), 'utf8'));
  manifest.host_permissions = SEED_HOSTS.map((h) => `*://*.${h}/*`);
  writeFileSync(join(build, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const profile = join(WORK, 'profile');
  const chrome = spawn(
    CHROMIUM,
    [
      `--user-data-dir=${profile}`,
      `--load-extension=${build}`,
      `--remote-debugging-port=${PORT}`,
      '--headless=new',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  try {
    let sw;
    for (let i = 0; i < 60 && !sw; i += 1) {
      await sleep(500);
      sw = (await targets().catch(() => []))?.find?.((t) => t.url.endsWith('/sw.js'));
    }
    if (!sw) throw new Error('extension service worker never appeared');

    const worker = await attach(sw);
    const extId = await worker.evaluate('chrome.runtime.id');
    console.log(`extension ${extId}`);
    console.log(`seed: ${await worker.evaluate(SEED)}`);
    await sleep(900);
    worker.ws.close();

    mkdirSync(OUT, { recursive: true });

    for (const spec of SHOTS) {
      // 1240x690 is not arbitrary: scaled to the frame's 1152px content width it stands 641px
      // tall, which fills the 603px left under the caption. Anything shorter leaves the window
      // floating with a cut-off bottom edge — invisible against black, obvious against stone.
      const raw = await shoot({
        url: `chrome-extension://${extId}/${spec.page}`,
        width: 1240,
        height: 690,
        setup: spec.setup
      });
      const html = join(WORK, `${spec.file}.html`);
      writeFileSync(html, screenshotFrame({ caption: spec.caption, sub: spec.sub, png: raw }));
      const framed = await shoot({
        url: pathToFileURL(html).href,
        width: 1280,
        height: 800,
        scale: 1,
        settle: 700
      });
      writeFileSync(join(OUT, spec.file), framed);
      console.log(`  ${spec.file}  1280x800`);
    }

    const tiles = [
      {
        file: 'promo-small-440x280.png',
        w: 440,
        h: 280,
        scale: 1,
        title: 'Block Distracting Websites',
        sub: 'A deliberate pause before you open them.'
      },
      {
        file: 'promo-marquee-1400x560.png',
        w: 1400,
        h: 560,
        scale: 2.4,
        title: 'Block Distracting Websites',
        sub: 'Focus timers, schedules and streaks. No account, no tracking.'
      },
      {
        file: 'og-1200x630.png',
        w: 1200,
        h: 630,
        scale: 2.1,
        title: 'Resistor',
        sub: 'Put distracting sites behind a moment of thought.'
      }
    ];

    for (const t of tiles) {
      const html = join(WORK, `${t.file}.html`);
      writeFileSync(html, tile(t));
      const png = await shoot({
        url: pathToFileURL(html).href,
        width: t.w,
        height: t.h,
        scale: 1,
        settle: 500
      });
      writeFileSync(join(OUT, t.file), png);
      console.log(`  ${t.file}  ${t.w}x${t.h}`);
    }

    console.log(`\nWrote ${SHOTS.length + tiles.length} assets to store/assets/`);
  } finally {
    chrome.kill();
  }
}

main().catch((err) => {
  console.error('screenshots failed:', err.stack || err.message);
  process.exit(1);
});
