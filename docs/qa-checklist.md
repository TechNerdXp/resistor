# Manual QA — run before every Web Store submission

Automated coverage lives in `tests/unit.test.mjs` (logic) and `scripts/validate.mjs`
(manifest, asset paths, CSP, hygiene). Both run as part of `npm run build`.

What automation **cannot** cover, because it needs a human to click a browser-chrome dialog:
the permission prompt itself. Everything in section 1 is that gap. The rest is regression
cover for behaviour that has broken before.

### Which build to load

| | ID | Use it for |
|---|---|---|
| **Load unpacked → `src/`** | the real published ID, via the `key` field | day-to-day development |
| **Extract `dist/*.zip`, load that** | a path-derived dev ID | final pre-submission pass — it is byte-for-byte what reviewers get |

⚠️ **`src/` collides with the installed Web Store version.** Both claim
`dieinhikppmdlibedenkhjicjajfldcm`. Before loading `src/` unpacked, either remove Resistor
from that Chrome profile, or use a separate profile. The extracted `dist/` build has its own
ID and never collides, which makes it the safer one to hand to someone else for testing.

⚠️ **Never zip `src/` by hand.** The Web Store rejects a manifest containing `key`.
`npm run build` stages a copy, strips `key` and the `_comment_*` notes, and fails if either
survives.

---

## 1. Permissions — the conversion claim

- [ ] On a **fresh profile**, install and read the dialog. It must **not** say
      "Read and change all your data on all websites", or mention websites at all.
- [ ] `chrome://extensions` → Details → **Site access** shows no sites.
- [ ] Onboarding: tick YouTube + Reddit, click **Block these sites**. Exactly one prompt
      appears, naming only those two sites. Accept it.
- [ ] Site access now lists only those two.
- [ ] Decline the prompt on a third site: the site is added to the list but shows
      **needs access**, with a working **Grant** button.
- [ ] Remove a site in settings → its permission disappears from Site access.

## 2. Blocking actually blocks

- [ ] Open `youtube.com`. The pause screen appears and **the page never renders**.
- [ ] Start a YouTube video, then open it again in a new tab — **no audio plays** behind the
      pause screen. (This is the v1 failure the rebuild exists to fix.)
- [ ] Open a deep link, e.g. a specific video URL with `?v=` and `&t=`. After granting access
      you land on **that exact URL**, not the site root.
- [ ] `m.youtube.com` is blocked; `notyoutube.com` is **not**.
- [ ] Nothing is blocked that you did not add.

## 3. The pause screen

- [ ] **Gentle**: 3-second hold, reflection box optional, Continue enables on its own.
- [ ] **Focused**: 10-second hold, Continue stays disabled until the reason is ≥15 characters
      *and* the hold has elapsed.
- [ ] **Locked**: no "Let me in" button at all; the locked notice and Open settings show.
- [ ] **Back to work** with an empty destination closes the tab (or goes back).
- [ ] **Back to work** with a URL set navigates there.
- [ ] Streak pill and "turned back N times today" update as you use it.

## 4. Timed access and the allowance

- [ ] Grant 5 minutes → the site opens.
- [ ] The popup shows **open 5m** against that site.
- [ ] Wait it out → the site blocks again by itself, with no interaction.
- [ ] Restart the browser mid-grant → the grant still expires correctly (alarms survive).
- [ ] Set the daily allowance to 5, spend it, then try again → blocked with the
      "daily limit reached" message.

## 5. Schedules

- [ ] Enable a window covering now → sites block.
- [ ] Enable a window that excludes now → sites open.
- [ ] Set a window crossing midnight (22:00–06:00) → correct on both sides of midnight.
- [ ] Cross a boundary with the browser open → state flips without a manual reload.

## 6. Persistence and migration

- [ ] Settings survive a browser restart.
- [ ] Settings appear on a second machine signed into the same Chrome profile.
- [ ] Leave the browser idle ~5 minutes so the service worker is torn down, then open a
      blocked site → still blocked.
- [ ] **Upgrade path**: install v1.1.0, set a blocklist and difficulty, then load v2 over it.
      The blocklist carries across, difficulty maps to the matching tier, and the sites show
      **needs access** until confirmed. The old `upwork.com` default must **not** appear as
      the back-to-work URL.

## 7. Theme

- [ ] Default is **Match my system** — with no setting touched, the UI follows the OS.
- [ ] Switch the OS between light and dark with a page open → the UI follows immediately.
- [ ] Choose **Always light** on a dark OS → stays light. And the reverse.
- [ ] Change the theme in settings with the popup open → both repaint.
- [ ] Open a blocked site with an explicit theme set → the pause screen appears in that theme
      with **no flash** of the other one. (This is the reason `ui/theme.js` is a classic
      head script backed by a localStorage cache; a regression here shows as a visible flash.)

## 8. Presentation

- [ ] Every page is legible in both light and dark mode.
- [ ] Keyboard only: tab through onboarding, the pause screen and settings; focus is always
      visible and every control is reachable.
- [ ] No errors in the console on any page, and none in the service worker.
- [ ] Options page is usable at a narrow window width.

## 9. Package

- [ ] `npm run build` is clean and writes `dist/resistor-<version>.zip`.
- [ ] The zip has `manifest.json` at its root and forward-slash paths throughout.
- [ ] Extract the zip and load *that* — it behaves identically to loading `src/`.
