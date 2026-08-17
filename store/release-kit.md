# Resistor v2.0.0 — release kit

Everything you need to paste at release time, in one place. Nothing here needs to be
rewritten on the day.

**Update the existing Web Store item** — `dieinhikppmdlibedenkhjicjajfldcm`. It keeps the
item's age and its 5★ rating, and the name, summary, description and category are all freely
editable on an existing listing. Do **not** create a new item.

Package to upload: `dist/resistor-2.0.0.zip` (regenerate with `npm run build`).

> **Do not zip `src/` yourself.** It contains a `key` field so unpacked dev builds get the
> real extension ID, and the Web Store rejects any uploaded manifest containing `key`
> (*"key field is not allowed in manifest"*). `npm run build` strips it; the zip it produces
> is verified clean.

---

## 1. Store listing fields

### Item name — 37 / 45 characters

```
Block Distracting Websites – Resistor
```

Keyword-first on purpose. Web Store search weights title relevance above anything else you
control and truncates near 35 characters, so the phrase people actually type sits inside the
visible part. "Resistor" alone ranked for nothing — nobody searches it looking for a blocker,
and the word belongs to the electronics component.

### Summary — 123 / 132 characters

```
Block distracting sites behind a mindful pause. Focus timers, schedules, daily limits and streaks. No account, no tracking.
```

This is pulled from `src/manifest.json` → `description`. If you change one, change both.

### Category

**Workflow & Planning** — changed from Well-being. Google's own description of Workflow &
Planning names "tools to stay focused" explicitly, and it is a far larger category than
Well-being ("self-help, mindfulness").

### Language

English (United States).

### Detailed description

```
Some sites are not worth the argument you have with yourself every time you open them.

Resistor puts them behind a short, deliberate pause. Open a blocked site and it does not
load — you get a calm screen instead, showing what you tried to open, how many times you
have turned back today, and one question: what were you about to do?

Then you choose. Back to work in one click, or let yourself in for a few minutes. Either
way it was a decision instead of a reflex.

HOW IT WORKS

1. Pick your sites. Choose from the usual time sinks or add your own.
2. Meet the pause. The page is stopped before it loads, so nothing renders and no video
   starts playing underneath.
3. Choose on purpose. Go back to work, or grant yourself timed access that closes itself.

WHAT YOU GET

• Timed access that re-blocks itself — let yourself in for five minutes without disabling
  anything. When the timer ends the block returns on its own.
• Three levels of resistance — Gentle for a nudge, Focused to make you write why you are
  there, Locked when you want no way through at all. Set it per site.
• Work-hours schedules — block only during the hours that matter, so evenings and weekends
  stay yours.
• Daily allowance — cap how many minutes a day you can spend letting yourself through.
• Streaks and counters — see how often you turned back, and keep the run going.
• It actually blocks — the request is stopped by Chrome itself, not hidden under an overlay
  you can close from developer tools.

THE PERMISSIONS DIFFERENCE

Most website blockers ask to "read and change all your data on all websites" the moment you
install them. Resistor asks for nothing at install.

When you add a site, Chrome asks whether Resistor may access that one site — and that is the
only access it ever holds. Remove the site later and the permission is handed straight back.
You can verify all of this yourself on the chrome://extensions page.

PRIVACY

Resistor collects nothing. There are no servers, no analytics, no account, and no third-party
code. Your settings live in your own Chrome sync storage; your counters stay on your device.
Whatever you type into the reflection box is never stored or sent anywhere — it exists only
on screen, then it is gone.

Free, with every feature included. No paid tier, no upsell inside the extension.

FREQUENTLY ASKED

Is it really free?
Yes. Every feature, no account, no subscription.

Can I get past a block if I genuinely need to?
Yes, unless you chose Locked. Gentle and Focused both allow timed access, and it closes
itself again automatically.

Does it work in Incognito?
Only if you enable Resistor for Incognito on the chrome://extensions page. Chrome keeps
extensions off in Incognito by default.

Will it block other browsers or apps?
No. A Chrome extension can only govern Chrome. For machine-wide blocking you want a
system-level tool.

What happens when I uninstall it?
Everything goes with it — Chrome revokes the site permissions and clears the storage.

Built by TechNerdXp. Privacy policy and support:
https://technerdxp.github.io/resistor/
```

**Keyword coverage** — present at least once in ordinary sentences: *block distracting
websites, website blocker, block sites, distraction, focus, productivity, schedules, daily
limit, streaks, timed access, Incognito, privacy*. Google suspends listings for keyword spam,
so do **not** add a keyword list, competitor names, "best extension", or any claim of an award
or Editor's Choice.

### URLs

All three are live and verified 200 (2026-08-17). The Web Store re-checks them on every
submission and rejects unreachable ones, so re-verify after any change to `site/`.

| Field | Value |
|---|---|
| Website | `https://technerdxp.github.io/resistor/` |
| Support | `https://technerdxp.github.io/resistor/` |
| Privacy policy | `https://technerdxp.github.io/resistor/privacy.html` |

The uninstall page (`src/sw.js`'s `UNINSTALL_URL`) is not a listing field but is served from
the same place: `https://technerdxp.github.io/resistor/goodbye.html`.

Hosting: the `gh-pages` branch of `TechNerdXp/resistor`, mirrored from `site/` by
`npm run publish:site`. That branch has its own history — `main` there is still the v1
extension source, and this project's repo is not on GitHub.

---

## 2. Privacy tab

**Single purpose**

```
Resistor blocks websites the user has chosen, by redirecting them to a pause screen that
prompts a deliberate choice before continuing.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `declarativeNetRequestWithHostAccess` | Used to register the blocking rules for the sites the user selected. Chrome applies the rules itself; the extension never observes network traffic. |
| `storage` | Stores the user's own settings (blocked sites, difficulty, schedule, daily allowance) and local counters such as streaks. Nothing is transmitted. |
| `alarms` | Restores a block when a user-granted access period expires, and switches blocking on and off at the user's scheduled hours. |
| `activeTab` | Lets the "Block this site" button in the toolbar popup identify the site the user is currently viewing. Applies only while the popup is open. |
| Host permissions (optional, per site) | Requested at runtime only for the specific sites the user adds to their blocklist, and released when a site is removed. No host access is requested at install. |

**Data usage** — tick **nothing**. Resistor collects no user data in any listed category. Then
affirm all three certifications: not sold to third parties; not used or transferred for
purposes unrelated to the single purpose; not used to determine creditworthiness or for
lending.

---

## 3. Graphic assets

All generated from the live UI by `node scripts/screenshots.mjs`, at Google's exact required
dimensions. Re-run it whenever the interface changes.

Captured in the **light** palette on purpose — a store asset is one static PNG shown to
everyone, and both Windows and macOS ship light, so this is what the median installer opens to.
See the decisions log before regenerating in dark.

| File in `store/assets/` | Size | Upload as |
|---|---|---|
| `screenshot-1-pause.png` | 1280×800 | Screenshot 1 — *The page never loads.* |
| `screenshot-2-access.png` | 1280×800 | Screenshot 2 — *Let yourself in — it closes itself.* |
| `screenshot-3-permissions.png` | 1280×800 | Screenshot 3 — *It asks for nothing at install.* |
| `screenshot-4-levels.png` | 1280×800 | Screenshot 4 — *Three levels of resistance.* |
| `screenshot-5-schedule.png` | 1280×800 | Screenshot 5 — *Block only during work hours.* |
| `promo-small-440x280.png` | 440×280 | Small promo tile |
| `promo-marquee-1400x560.png` | 1400×560 | Marquee (needed for homepage carousel eligibility) |
| `og-1200x630.png` | 1200×630 | Not a store asset — already copied to `site/og.png` |

Store icon stays as-is: `src/icons/icon128.png`.

**Ordering note.** Screenshot 3 carries the strongest differentiator (no permissions at
install). If the listing underperforms after a few weeks, try promoting it to position 1 —
the first screenshot is the one most people actually see.

---

## 4. Release notes

For the dashboard's version notes, and for the GitHub release if you publish one.

```
v2.0.0 — a full rebuild.

• Resistor no longer asks for access to your browsing. It installs with no site permissions
  at all, and asks only about the specific sites you choose to block.
• Blocking now stops the page before it loads. Previously the site loaded behind a cover,
  so videos kept playing and the cover could be dismissed.
• New: let yourself in for a few minutes, and it re-blocks itself automatically.
• New: three difficulty levels — Gentle, Focused and Locked — settable per site.
• New: work-hours schedules and a daily allowance.
• New: streaks and counters for how often you turned back.
• Site list changes now apply immediately instead of needing an extension reload.
• Fixed: sites with lookalike addresses could be matched by mistake.

Your existing blocked sites carry over. Because this version no longer holds blanket access,
Chrome will ask you to confirm the sites you want blocked.
```

---

## 5. Submission checklist

- [ ] `npm run build` clean → `dist/resistor-2.0.0.zip`
- [ ] `docs/qa-checklist.md` worked through in real Chrome (section 1 especially — the
      permission prompt is the one thing no automated test can click)
- [x] `site/` published to GitHub Pages at `technerdxp.github.io/resistor` — re-run
      `npm run publish:site` if `site/` changed since 2026-08-17
- [ ] Upload the zip to the **existing** item
- [ ] Name, summary, description pasted from section 1
- [ ] Category switched to **Workflow & Planning**
- [ ] All 5 screenshots + both promo tiles uploaded
- [ ] Website, support and privacy URLs set
- [ ] Privacy tab completed per section 2; data-collection boxes left unticked
- [ ] Version notes pasted from section 4
- [ ] Submit for review

---

## 6. After it is live

### Featured badge nomination

Nominate through the Chrome Web Store One Stop support page. Eligibility — all true for
Resistor: it is an extension, you own it, it has English support, it is published and public,
it has no active policy violations, and its core features are free without credentials or
payment. Reviews take about 7 days, up to 30 when busy. It cannot be paid for.

Reviewers weigh an enjoyable and intuitive experience, use of current platform APIs, respect
for user privacy, and a clear, well-illustrated listing page. The per-site permission model is
the strongest thing to point at.

### Keep it fresh

Ranking treats roughly six months without an update as abandoned. v1 sat at ten months, which
suppressed it on its own. Ship something small every couple of months.

### Launch posts

Chrome Web Store search will not lift a four-user item from a standing start. The first ~50
installs and ~10 honest reviews are what move it out of the cold-start tier.

**Product Hunt — tagline (60 chars)**

```
Block distracting sites behind a moment of thought
```

**Product Hunt — description**

```
I got tired of blockers that demand access to every website you visit just to block four of
them. Resistor installs asking for nothing, and requests permission only for the specific
sites you choose.

It also actually blocks: the page is stopped before it loads, so nothing renders and no video
plays underneath a cover you can dismiss.

The pause screen asks one question — what were you about to do? — and the wait runs while you
answer it, so the friction and the honesty are the same few seconds rather than a punishment.

Free, no account, collects nothing. I would genuinely like to hear where the difficulty
levels feel wrong.
```

**Reddit** — r/productivity, r/getdisciplined, r/ADHD. Lead with the problem, not the product;
disclose that you built it; do not cross-post the same text on the same day.

```
I kept uninstalling website blockers because they either demanded access to my entire
browsing history, or were so annoying to get past that I removed them within a week.

So I rebuilt mine around two rules: ask for permission only for the sites you actually block,
and make the pause short enough that you do not come to resent it. The wait runs while you
type what you were about to do, which for me is the part that actually works — it is hard to
type "nothing, just avoiding the hard task" and then keep going.

It is free and collects nothing. Happy to answer anything about how the blocking works.
```

**X**

```
Rebuilt Resistor from scratch.

Most site blockers want to "read and change all your data on all websites" before they will
block YouTube for you.

This one installs asking for nothing, and requests access only to the sites you pick.

Free, no tracking:
```

### Support reply templates

**"It is not blocking a site"**

```
Most often this is the per-site permission. Open chrome://extensions, find Resistor, click
Details, and check Site access — the site needs to be listed there. If it is not, open
Resistor's settings and use the Grant button next to that site.

If it is listed and still not blocking, tell me the exact address and I will take a look.
```

**"How do I get past it in an emergency?"**

```
Unless the site is set to Locked, the pause screen has a "Let me in anyway" button — write a
line about what you need, wait out the short hold, and you get five minutes before it blocks
itself again. If a site is set to Locked, that is deliberate: change it in settings.
```
