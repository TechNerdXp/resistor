# Resistor

## What this project is
A Chrome extension (Manifest V3) that blocks distracting websites behind a deliberate pause,
published on the Chrome Web Store as **Block Distracting Websites – Resistor**
(`dieinhikppmdlibedenkhjicjajfldcm`). v1 stalled at four users; v2 is a full rebuild aimed at
the reasons why — discoverability, the install-time permission warning, and a blocking
mechanism that did not really block. There is no framework and no build step: the extension is
plain ES modules, and Node is used only for tests and packaging.

## Standing rules for this project
- **Never add `host_permissions`, `scripting`, `tabs`, or plain `declarativeNetRequest`.**
  Zero permissions at install is the product's main advantage and its main growth lever;
  `scripts/validate.mjs` fails the build if any of them reappear. Sites are granted
  just-in-time via `chrome.permissions.request` from a user gesture.
- `src/manifest.json`'s `description` **is** the Web Store summary (132 char cap). If it
  changes, change `store/release-kit.md` in the same commit.
- Store graphics are generated from the live UI by `node scripts/screenshots.mjs`, not drawn
  by hand. If the UI changes, re-run it so the listing never shows a screenshot of something
  that no longer exists.
- **`site/` is the source of truth for the hosted site; publish with `npm run publish:site`.**
  It mirrors `site/` onto the `gh-pages` branch of `TechNerdXp/resistor` (that repo's `main`
  is still v1's source — leave it alone). The Web Store re-checks the homepage, privacy and
  support URLs on every submission and rejects unreachable ones, so never change `site/`
  without republishing. This project's own repo stays off GitHub.
- **`src/ui/app.css` is generated — never edit it.** Source is `styles/app.css` (Tailwind v4);
  rebuild with `npm run css`. `npm run build` rebuilds it automatically before packaging.
- Do **not** use Tailwind's `dark:` variant. Resistor has three theme states (system / light /
  dark) and an explicit choice must beat the media query. The palette lives in CSS custom
  properties that `@theme` maps onto Tailwind's colour utilities — use `bg-surface`,
  `text-muted`, `text-ember` and friends, and they resolve correctly in every state.
- Icons are Heroicons, inlined as SVG. For JS-built markup, clone from a `<template>` in the
  page — never `innerHTML`, which the validator rejects.
- All rule state is reconciled in one place: `reconcile()` in `src/sw.js`. MV3 workers are
  torn down constantly, so never hold state in memory — read storage, rebuild the rule set.
- Run `npm run build` before any submission; work through `docs/qa-checklist.md` for anything
  touching permissions, blocking, or the upgrade path.
- **Never zip `src/` by hand.** It carries `key` (so unpacked dev builds get the real
  extension ID) and the Web Store rejects any uploaded manifest containing it. `build.mjs`
  stages, strips `key` + `_comment_*`, and fails the build if either survives.
- Ship something every couple of months. Web Store ranking treats ~6 months without an update
  as abandoned, which is part of what buried v1.

## Folder meanings
- `src/` — the extension; this directory is exactly what gets packaged.
- `site/` — the GitHub Pages landing page, privacy policy and uninstall page.
- `store/` — Web Store listing copy, asset specs, submission checklist.
- `scripts/` — `validate.mjs` (pre-flight), `build.mjs`, `zip.mjs`.
- `tests/` — `node:test` unit tests for the pure logic in `src/lib/`.
- `docs/` — durable knowledge: decisions, specs, how-tos. If it matters next month, it goes here.
- `dock-in/` — where client materials tie up: everything the client hands over (logos,
  copy, briefs, exports) lands here AS RECEIVED and is never edited in place. It's a
  working drop-zone, not project structure: ingest what's needed into the project
  (copy, then work), and note heavy binaries' source in docs/ if they'd bloat git.
- `labs/` — experiments and spikes. Anything here may be deleted without warning.
- `_cold-storage/` — anything parked out of git and out of Claude's context: heavy
  files, but also retired stuff (e.g. superseded material from `dock-in/`) or
  whatever else just needs to stop being tracked or read. Gitignored and
  claudeignored; treat it as a shelf, not a working folder.
- `scratchpad.md` — daily rough notes. Ideas graduate from here into `docs/`.

## Rules for Claude Code
- Keep `docs/` up to date when decisions are made; don't let knowledge live only in chat.
  Record significant choices in `docs/decisions.md` (what, why, date).
- Small, frequent, conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
- Before adding a dependency or new tool, state the reason in one sentence.

## Evolution — this playbook is a living document
This project started as a generic scaffold, but projects grow in directions no
scaffold predicts: a script becomes a service, a CLI grows a UI, an experiment in
`labs/` becomes the product, a one-off gains a client and a deploy target.
- When the project's direction, stack, or structure changes, update this CLAUDE.md
  **in the same piece of work** — a stale playbook misleads every future session
  and is worse than none.
- The same goes for the rest of the scaffold's references: README ("what it is /
  how to run"), `docs/setup.md`, and folder meanings above must describe the
  project as it IS, not as it was scaffolded.
- Outgrown rules get deleted, not commented out; new standing rules get added here
  the moment they're agreed.
- **Send insights home**: when scaffold friction shows up, or an idea would make
  future projects start better (a missing addon, a template fix, a rule worth
  standardizing), run `kicker feedback "<the insight>"` — it lands in Kicker's
  own scratchpad, so the scaffolder learns from every project it spins up.

## Design culture — "brutally elegant"
- Stack for anything with a UI: **Tailwind CSS**, **Heroicons**, **Headless UI**. No other
  UI/icon/component libraries without a stated reason.
- **Performance first**: measure before and after; no heavy dependencies for small jobs;
  ship the least JavaScript that does the job.
- **SEO**: semantic HTML, proper meta/OG tags, sensible titles and URLs from day one.
- **Accessibility**: keyboard navigable, labelled controls, sufficient contrast —
  Headless UI helps, but verify.
- Best practices over cleverness. Brutally elegant means: nothing decorative that does
  not earn its place, and nothing missing that correctness demands.

## Edubecation (learn-as-you-go — standing rule)
While working, teach in passing:
- When a technical concept, tool, or term comes up that has a proper industry name,
  use the correct term and give a one-line plain-English gloss the first time.
- Gently correct imprecise terminology in my requests (kindly, briefly) so I pick up
  the vocabulary professionals use.
- Append to `docs/vocab.md` (`**term** — plain-English meaning (date)`) ONLY terms I
  misused or clearly haven't met — not well-known terms I already use correctly.
  Never duplicate entries; keep it alphabetical.
