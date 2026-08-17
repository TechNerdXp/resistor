# Resistor

A Chrome extension that puts distracting websites behind a short, deliberate pause.

Published as **Block Distracting Websites – Resistor**
([Chrome Web Store](https://chromewebstore.google.com/detail/dieinhikppmdlibedenkhjicjajfldcm)) ·
item ID `dieinhikppmdlibedenkhjicjajfldcm`.

Open a blocked site and it does not load. You get a calm screen showing what you tried to
open, your streak, and one question — *what were you about to do?* Then you either go back to
work in one click, or grant yourself timed access that closes itself again.

## What makes it different

**It asks for no host permissions at install.** Most blockers request
*"read and change all your data on all websites"* the moment you install them. Resistor
requests nothing, then asks Chrome for one specific site at the moment you add it — and hands
the permission back when you remove it.

**It actually blocks.** The navigation is stopped by Chrome's own
`declarativeNetRequest` engine before anything is fetched, so no page renders, no video starts
playing underneath, and there is no overlay to delete from developer tools.

## Layout

```
src/            the extension itself — this directory is what gets packaged
  manifest.json MV3; no host_permissions, no scripting, no tabs
  sw.js         service worker; the single reconciliation point for all rule state
  lib/          pure logic: domain parsing, storage schema, dNR rules, schedule, stats
  blocked/      the pause screen (the dNR redirect target)
  onboarding/   first run: pick sites, then one just-in-time permission prompt
  popup/        toolbar popup — today at a glance, "block this site"
  options/      settings and stats
  ui/           app.css (generated) and theme.js (pre-paint theme application)
styles/         Tailwind source for src/ui/app.css
site/           the GitHub Pages landing page, privacy policy and uninstall page
store/          release-kit.md (all release-time copy) and assets/ (generated graphics)
scripts/        validate.mjs, build.mjs, zip.mjs
tests/          node:test unit tests for the pure logic
docs/           decisions log, QA checklist, vocab
```

## Working on it

Requires Node (for tests and packaging only — the extension itself has no build step and no
dependencies).

```sh
npm install       # Tailwind + Heroicons, build-time only
npm test          # unit tests
npm run css       # styles/app.css -> src/ui/app.css
npm run build     # css + validate + test + write dist/resistor-<version>.zip
npm run shots     # regenerate every Web Store graphic from the live UI
```

The UI is Tailwind v4 with Heroicons inlined as SVG, on a warm stone-and-ember palette.
**`src/ui/app.css` is generated — edit `styles/app.css` instead.** Theming does not use
Tailwind's `dark:` variant: there are three states (system / light / dark) and an explicit
choice has to beat the media query, so the palette lives in CSS custom properties that
`@theme` maps onto Tailwind's colour utilities.

`npm run shots` drives a headless Chromium with the extension loaded and realistic seeded
data, captures the real pages, and composes them into caption frames at Google's exact
dimensions. Nothing in `store/assets/` is drawn by hand, so re-running it after a UI change
keeps the listing honest. It finds Playwright's Chromium automatically, or takes a browser
path as its first argument.

Load it in Chrome with **Load unpacked** → `src/`. The published public key is kept in the
manifest, so an unpacked build loads under the real Web Store extension ID — which also means
it collides with the installed store version, so remove that first or use a second profile.

`npm run build` stages `src/`, strips `key` and the `_comment_*` notes (the Web Store rejects
an uploaded manifest containing `key`) and fails if either survives. **Never zip `src/` by
hand.**

`scripts/validate.mjs` runs as part of the build and fails on the things that only surface as
a silent breakage in Chrome or a rejection in review: listing character limits, missing asset
paths, banned permissions creeping back in, inline scripts or handlers that the MV3 CSP
blocks, `innerHTML`, and leftover debug logging.

Before submitting, work through `docs/qa-checklist.md` — section 1 covers the permission
prompt, which no automated test can click.

## Privacy

No servers, no analytics, no account, no third-party code. Settings live in the user's own
Chrome sync storage; counters stay on the device. See [site/privacy.html](site/privacy.html).

Built by [TechNerdXp](https://technerdxp.github.io/resistor/).
