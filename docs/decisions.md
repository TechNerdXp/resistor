# Resistor — decisions log

> One entry per significant choice. Newest on top.
> Format: date — decision — why (one or two sentences).

## 2026-08-17 — Store assets are captured in light, not dark
Every listing graphic — the five screenshots, both promo tiles and the OG image — now renders
the light palette. Store assets are static PNGs served identically to everyone, so they cannot
follow the viewer the way the product does; they get one look, and it should be the one most
people actually meet. Windows and macOS both ship light and Resistor's default theme is
`system`, so the modal new install opens to a light UI — dark screenshots were advertising a
product the median installer would not recognise on first run.

Two things fell out of the flip. The frame background is deliberately a step deeper than
`--rz-canvas` (`#f4ece1` vs `#fbf9f6`): against an identical background the captured window
dissolved into the frame instead of sitting on it. And every capture is now a fixed 1240×690 —
the old per-shot 520/640 viewports left the window floating with a cut-off bottom edge, which
was invisible against black and obvious against stone.

## 2026-08-17 — No red on black: the dark theme's accent gradient runs to amber
`.text-gradient` (the hostname on the pause screen) ran ember → rose `#e11d48` in both themes.
Warm red on near-black is the universal signal for danger, and Resistor is a habit assistant,
not an alarm — the one moment of expression was quietly telling users they were in trouble.
The far stop is now a per-theme token `--rz-ember-2`: light keeps rose, dark goes amber
`#fbbf24`, so the gradient still reads as flame without reading as blood. `--rz-danger` is
untouched — error text is the one place the alarm is meant.

## 2026-08-17 — Ship no host permissions at install; request each site just-in-time
`declarativeNetRequestWithHostAccess` + `optional_host_permissions` instead of v1's
`<all_urls>` + `scripting` + `tabs`. v1's install dialog read *"Read and change all your data
on all websites"*, which for a free extension from an unknown publisher is where most installs
died. Verified against a live Chromium: `permissions.getAll()` returns `[]` after install.
This is the single highest-leverage change in the rebuild.

## 2026-08-17 — Block by redirecting the navigation, not by covering the page
v1 injected a content script that appended a `<div>` over a fully loaded page, so audio kept
playing behind it and deleting one node in devtools defeated it. dNR stops the request before
anything is fetched, and drops the `scripting` and `tabs` permissions as a side effect.
End-to-end verified: a real navigation to a blocked site lands on the interstitial with the
original URL preserved intact, query string and all.

## 2026-08-17 — Rebuild in place on the existing Web Store item, as v2.0.0
Keeps the item's age and its 5★ rating; name, summary, description and category are all
freely editable on an existing listing. A fresh item would throw away the only social proof
there is and start the ranking cold-start over.

## 2026-08-17 — Title leads with keywords, not the brand
`Block Distracting Websites – Resistor`. Web Store search weights title relevance above
anything else the developer controls and truncates near 35 characters. With four users there
is no brand equity to protect, so the searched phrase gets the visible slot.

## 2026-08-17 — Category moves from Well-being to Workflow & Planning
Google's own description of Workflow & Planning names "tools to stay focused" explicitly, and
it is a far larger category than Well-being ("self-help, mindfulness").

## 2026-08-17 — Daily allowance is measured in minutes granted, not minutes spent on site
Measuring time-on-site would need the `tabs` permission and continuous observation of
browsing. Capping how many minutes of access the user may grant themselves is accountable
purely from our own records, needs no extra permission, and is the same thing in practice.

## 2026-08-17 — Tailwind v4 + Heroicons for the extension UI (supersedes the CSS decision below)
The first pass hand-wrote CSS to avoid a build step. The result was functional but plain, and
the playbook's stack exists precisely for this. Now on Tailwind v4 (`styles/app.css` →
`src/ui/app.css`, built by `npm run css`) with Heroicons inlined as SVG. Palette moved to warm
stone + ember: it suits a product named Resistor, echoes the firekeeping vocabulary used
elsewhere on this machine, and stands out in a category that is almost uniformly blue.

Tailwind's `dark:` variant is deliberately **not** used. Resistor has three theme states and an
explicit choice must beat the media query, which `dark:` cannot express cleanly. The palette
stays in CSS custom properties and `@theme` maps Tailwind's colour utilities onto them, so
`bg-surface` resolves correctly in all three states with no variant gymnastics.

Heroicons are inlined rather than referenced through `<use href>`: external sprite references
have `currentColor` inheritance quirks, and JS-built rows clone from a `<template>` so nothing
needs `innerHTML` and the MV3 CSP is untouched.

## 2026-08-17 — Theme: system by default, with an explicit override
`system` (the default) sets no attribute and lets `prefers-color-scheme` decide; `light`/`dark`
set `data-theme` on `<html>`. `ui/theme.js` is a **classic** script in `<head>`, not a module,
so it runs before first paint — a module would be deferred and the pause screen would flash the
wrong theme every time. chrome.storage is async and useless for that, so the choice is mirrored
into `localStorage` as a paint-time cache and reconciled immediately after. Verified across all
six combinations of OS preference × setting.

## 2026-08-17 — v2 published to `main`; private notes purged from history instead of dodged
`TechNerdXp/resistor` is now 2.0 — the **existing** public repo, not a new one. v2 went on as a
single squashed commit whose parent is v1's tip, so v1's four commits survive underneath it.

The reason for squashing was that `docs/original-brief.md` and `scratchpad.md` sat in the two
earliest local commits, so pushing the full history would have published candid working notes.
The first attempt at protecting them was to configure **no** `origin` at all and publish via
`git commit-tree` plumbing. That was the wrong trade: it made every future release depend on
remembering an obscure incantation, and a single absent-minded `git remote add` + `git push`
would have leaked the notes anyway. Avoiding a loaded gun is not the same as unloading it.

So the risk was removed at the source. `git filter-branch --index-filter` purged both files
from every commit of the pre-publication history, which is kept as the local branch
`archive/pre-publish`; `git log --all -- <those files>` now returns nothing. With nothing
dangerous left in any branch, git is ordinary again: `origin` is configured, `main` tracks
`origin/main`, and `git push` is safe.

Both files remain on disk and are gitignored, alongside `docs/vocab.md`. The rule that matters
going forward is simply: **the repo is public, so nothing private goes in a tracked file.**

Revisited the same day and confirmed. Publishing the source was never a requirement of hosting
the site — the site is served from `gh-pages` and is completely independent of what `main`
holds — so reverting `main` to v1 was on the table and declined. The source stays public: it
is the only off-machine backup of v2, and an auditable source tree is worth something for an
extension whose whole pitch is that it asks for no permissions and collects nothing.

## 2026-08-17 — The landing site is light-only; the extension keeps three themes
`site/style.css` followed `prefers-color-scheme`, so a visitor on a dark desktop got a light
OG preview card and then landed on a dark page. Every other public-facing asset is already
light on purpose — `scripts/screenshots.mjs:57` pins the store screenshots and promo tiles to
light because Windows and macOS both ship light. The site now matches: `color-scheme: light`,
the dark media block deleted, and a `theme-color` meta so mobile browser chrome does not tint
dark around a light page.

This does **not** change the extension UI, which keeps system/light/dark. The distinction is
deliberate: a theme choice is worth offering in software someone keeps open all day, and is
noise on a page they visit once before installing.

## 2026-08-17 — The site is hosted on an orphan `gh-pages` branch, not from this repo
The Web Store rejected the submission with *homepage / privacy policy / support URL is not
reachable*: the URLs had been written into the listing and into `sw.js` before anything was
actually hosted. `TechNerdXp/resistor` already existed and is public. The site went to a
`gh-pages` branch with its own orphan history, so it is independent of whatever `main` holds
and republishing can never touch the source. Pushing a branch named `gh-pages` auto-enables
Pages, so no API call or workflow was needed.

`site/` stays the single source of truth; `npm run publish:site` mirrors it onto the branch
(deleting anything no longer in `site/`) and is a no-op when they already match. All four
pages plus every relative asset verified 200.

## 2026-08-17 — Rule syncs are serialised through a queue
One user action fans out into several reconciliation triggers within milliseconds: granting
origins fires `permissions.onAdded`, writing the blocklist fires `storage.onChanged`, and
onboarding then sends an explicit `'sync'`. `syncRules()` reads the live rule set and then
writes it, and that pair is not atomic across `await` — so overlapping syncs all read the same
"existing" set and the later ones asked Chrome to add ids that already existed. Chrome rejects
the *entire* update with **"Rule with id 1 does not have a unique ID"**, which meant a fresh
install could finish onboarding with no rules applied at all. `syncRules()` now chains onto the
previous call, and each apply also removes the ids it is about to add so it is self-correcting
after a worker teardown. Covered by `tests/rules.test.mjs`, which stubs the `chrome.*` surface
and models Chrome's real rejection behaviour.

Second-order fix: the `onMessage` listener returns `true` to promise an async response, so a
throw anywhere inside it left the channel open and surfaced in the *calling page* as
"A listener indicated an asynchronous response by returning true, but the message channel
closed before a response was received" — pointing at the wrong file entirely. It now always
answers, with `{ ok: false, reason: 'error' }` on failure.

## 2026-08-17 — (superseded) Hand-written CSS instead of Tailwind
Kept for the record: the original reasoning was that four small pages did not repay a build
step. Superseded above once the UI quality mattered more than the toolchain saving.

## 2026-08-17 — Own ZIP writer for packaging
Both Windows zip tools available here (PowerShell `Compress-Archive` and .NET Framework
`ZipFile.CreateFromDirectory`) write entry paths with backslashes, which APPNOTE 4.4.17.1
forbids and which mangles the uploaded package. `scripts/zip.mjs` is ~70 lines of zlib and
makes the build deterministic and cross-platform.

## 2026-08-17 — Keep the published public key in `src/`, strip it at build time
`key` makes an unpacked dev build load under the real Web Store extension ID, so local testing
exercises the production ID. But the Web Store **rejects** an uploaded manifest containing it
(*"key field is not allowed in manifest"*) — an earlier note here wrongly claimed it was
ignored on upload. `scripts/build.mjs` therefore stages `src/`, strips `key` and every
`_comment_*` field, zips the staging copy, and fails the build if either survives. Never zip
`src/` by hand.

## 2026-08-17 — Scaffolded with Kicker
Uniform structure (docs/, labs/, scratchpad.md, CLAUDE.md) across all projects.
