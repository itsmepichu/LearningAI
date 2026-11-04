# UI improvements plan

A review of the LearningAI app's page structure, components and UI/UX, with the code changes it suggests.

**Status:** all four phases are implemented (see the notes at the start of each). The full e2e suite, including the axe check, passes on the four phases. It has not been rerun since the two small CSS fixes listed at the start of phase A.

- **Reviewed:** branch `phase-3-rollout` at commit d229907, built and served with `vite preview`.
- **Method:** the ui-ux-pro-max design skill (UX guideline and React stack searches) and the design-critique framework.
- **Evidence:** screenshots and scripted Playwright checks of eight pages:
  - pages: home, guide, chapter, topic, chapter check, practice, progress and learning paths
  - sizes: 1440 × 900 desktop and 390 × 844 phone
  - themes: light for every page, dark for home and topic
- **Checks run:** heading order, unlabelled controls, target sizes, text sizes, horizontal scroll, contrast of the theme tokens (WCAG formula), and keyboard behaviour of the drawer and the search dialog.

**What this review does not cover:**
- It is not a full WCAG audit.
- No screen-reader testing (NVDA, VoiceOver).
- No checks inside the v3 legacy widgets, which phase 4 rebuilds.
- Contrast was computed for the token pairs, not for every rendered element.

---

## 1. Design critique

### Overall impression

The app reads like a well-made technical manual:
- a calm palette
- strong typography (IBM Plex Sans, Plex Sans Condensed, JetBrains Mono)
- a clear Part → Chapter → Topic hierarchy
- a dark theme that holds up

The biggest opportunities are not visual. They are keyboard and small-screen behaviour (§2.1), and a layer of very small, low-contrast labels that make the interface feel denser than it needs to be (§2.3).

### What works well

- **One reading column with a sticky "On this page" rail.** At 1440 px the topic page has a clear reading order: kicker → title → meta → progress segments → body.
- **Consistent evidence colours.** Accent, simulation, signal, OK and bad colours mean the same thing on every page. Both themes are defined as tokens, and dark mode passes contrast for every text token (muted text is 7.0:1 on surface).
- **The In practice block.** Tabs per project, a ★ for the best fit, three clearly coloured rows, and dataset downloads. It is one of the best-designed components in the app.
- **Reduced motion is respected globally:** `MotionConfig reducedMotion="user"` plus a CSS override.
- **Good basics.** There is a skip link, and the search dialog has an ARIA role and arrow-key navigation. No page scrolls horizontally at 390 px, and every page has exactly one `h1`.

### First impression (2 seconds)

- **Home:** the eye lands on the "ENTERPRISE AI FIELD MANUAL" display title, then the primary "Start with chapter 1" button. That is correct. The progress card on the right competes slightly. At zero progress it shows an empty ring and a large "0", which reads as a loading placeholder rather than an invitation.
- **Topic:** the title and the 9.3 badge dominate, which is right. The breadcrumb in the top bar repeats the full title in a truncated form ("9.3 Keyword search, inverted indexes, BM25, dense embeddings and spars…"), adding noise just above the real `h1`.
- **Chapter check:** two "Example: Harbor" pickers are visible at once, one in the top bar and one in the page toolbar. They make it unclear which one controls the page.

---

## 2. Findings

Severity: 🔴 critical (blocks or breaks a task, or fails WCAG AA), 🟡 moderate, 🟢 minor.

### 2.1 Keyboard and focus

| ID | Finding | Evidence | Severity |
|---|---|---|---|
| K1 | On phones and tablets (≤ 1024 px) the closed sidebar is moved off screen with `transform` but stays focusable. Keyboard users tab through every chapter link before reaching the page. | Playwright, 390 px, topic page: 40 Tab presses did not reach `main`; 33 of them landed inside the closed drawer. | 🔴 |
| K2 | Escape does not close the open drawer. Focus is not moved into the drawer on open or back to the menu button on close. | Opened drawer, pressed Escape: `.side.open` still set. | 🔴 |
| K3 | The search dialog does not trap focus. Escape only works while focus is inside the panel, so after two Tab presses the dialog can no longer be closed from the keyboard. | Tab, Tab, Escape: dialog still open; four Tab presses left the dialog. | 🔴 |
| K4 | The first character typed after `/` or Ctrl K is lost, because the input is focused in a `setTimeout(…, 30)`. | Pressed `/`, then typed "bm25": the input held "m25". | 🟡 |
| K5 | Focus is not returned to the trigger when search closes. | Code: `SearchDialog.tsx` has no focus restore. | 🟡 |
| K6 | Tab lists (In practice project tabs, the Practice/Check mode switch, the Practice page mode tabs) have `role="tab"` but no arrow-key navigation or roving `tabIndex`, which the ARIA tabs pattern expects. | Code: `Practice.tsx` has no `onKeyDown`. | 🟡 |
| K7 | The search results list uses `role="listbox"`/`option`, but the input has no `aria-activedescendant`, so screen readers do not announce the highlighted result. | Code: `SearchDialog.tsx` line 126 onwards. | 🟡 |

### 2.2 Structure and navigation

| ID | Finding | Evidence | Severity |
|---|---|---|---|
| S1 | Topic pages have no `h2`. Content sub-headings are `h5` (for example "Example: where each method wins"), so screen-reader heading navigation sees `h1 → h5`. The guide page jumps `h1 → h3 → h5`. | Heading dump: topic `H1, H5`; guide `H1, H3, H5, …`. | 🟡 |
| S2 | Chapter-check sections have no heading. Each section title sits inside a `button`, and the first heading below `h1` is an `h3` ("Choose the answer"). Users cannot jump between the 7–10 sections by heading. | Heading dump: check page `H1, H3, H4…`. | 🟡 |
| S3 | The "On this page" rail disappears below 1240 px with no replacement. Tablet and phone readers have no in-page table of contents and no quick route to the lab or "Check this section". | CSS: `@media (max-width:1240px){.t-rail{display:none}}`. | 🟡 |
| S4 | The project picker appears twice on the chapter check and Practice pages (top bar plus page toolbar). | Screenshots `check-desk-light`, `practice-desk-light`. | 🟢 |
| S5 | On phones the top bar has six icon-only controls. The project picker shows only an icon and a chevron, and the progress ring at zero is an empty circle that looks broken. | Screenshot `topic-phone-light`. | 🟡 |
| S6 | The top-bar breadcrumb repeats the topic title, truncated, directly above the `h1`. | Screenshot `topic-desk-light`. | 🟢 |

### 2.3 Readability and contrast

| ID | Finding | Evidence | Severity |
|---|---|---|---|
| R1 | Chapter and topic numbers in the sidebar use `--rule-2` as text colour: 1.41:1 on paper in light mode and 1.76:1 in dark mode (AA needs 4.5:1). | Token contrast calculation. | 🔴 |
| R2 | In light mode, `--ok` (#2B8A3E) is 4.07:1 on paper and 3.85:1 on `--sunk`. It is used for small text such as the "Try it with … data" label and the studied ticks. `--signal` (#B35C00) is 4.40:1 and 4.16:1. Both fail AA for small text. | Token contrast calculation. | 🔴 |
| R3 | A large share of visible text is below 12 px: uppercase mono kickers, part labels, rail headings, chips and counters set at 0.60–0.72 rem (9.6–11.5 px). On the home page, 108 of 226 visible text elements are under 12 px. | Playwright text-size scan; CSS uses 0.60–0.68 rem in 20 rules. | 🟡 |
| R4 | Uppercase mono labels with 0.1 em letter spacing at 10 px are the hardest text to read, and they label navigation (sidebar part headers, "On this page"). | Screenshots. | 🟢 |

### 2.4 Targets and touch

The WCAG 2.2 AA web minimum is 24 × 24 CSS px, per the guidelines search; the 44 pt and 48 dp figures are native-app guidance.

| ID | Finding | Evidence | Severity |
|---|---|---|---|
| T1 | The topic progress segments (`.t-steps a`) are links 5 px tall. | Target scan: `a.cur` 122 × 5 at 1440 px, 48 × 5 at 390 px. | 🔴 |
| T2 | The progress heatmap cells are 22 × 22 px links, and there are 135 of them. | Target scan. | 🟡 |
| T3 | The sidebar expand buttons are 26 × 26 px. That passes AA, but they are small for touch next to the chapter links on phones. | Target scan. | 🟢 |
| T4 | Radio and checkbox inputs in checks are 16 × 16 px. This is acceptable because the whole option row is clickable, but the focus ring sits on the tiny input rather than the row. | Target scan and screenshot. | 🟢 |

### 2.5 Consistency, copy and empty states

| ID | Finding | Evidence | Severity |
|---|---|---|---|
| C1 | The Practice page still says "Questions so far cover 01, 02, …, 18. More chapters are added as their checks are written." This is stale now that phase 3 is complete. | `PracticePage.tsx:280`. | 🟡 |
| C2 | The search placeholder says "Search 143 topics" (hard-coded) while the rest of the app says 135 topics. The 143 includes the appendices and capstone. | `SearchDialog.tsx:130`. | 🟢 |
| C3 | On the chapter check page, the header says "56 interview questions" but the counter says "0/49 interview practised". The missing 7 are framed for other projects and hidden, and nothing explains the difference. | Screenshot `check-desk-light`. | 🟡 |
| C4 | At zero progress, the progress rings (top bar, home card, progress page) render as empty grey circles, which read as loading placeholders. | Screenshots. | 🟡 |
| C5 | On the progress page, the heatmap rows do not line up: the counts column ("0/60 · 0/48" vs "0/100 · 0/80") has no fixed width, so each row's cells start at a different x position. | Screenshot `progress-desk-light`. | 🟢 |
| C6 | The Practice page filter repeats itself: an "All chapters with questions" select sits above 18 chapter chips that are all filled, so "everything selected" looks like a wall of solid teal. | Screenshot `practice-desk-light`. | 🟢 |
| C7 | Home: when the line wraps, the helper text starts with a stray "·" ("· change it any time; …"). | Screenshot `home-desk-light`. | 🟢 |
| C8 | z-index values are ad hoc (30, 45, 50, 100) and the type sizes are ad hoc (about 20 distinct rem values), with no scale tokens. | CSS. | 🟢 |

---

## 3. Plan

Four phases, ordered by impact. Each item names the files to change, gives the suggested code, and lists the check that proves it.

### Phase A: keyboard, focus and contrast (fixes every 🔴)

**Status: implemented.** The snippets below are the original suggestions. The code differs from them where a snippet would not have worked:

- **Drawer (A1):**
  - The top bar and skip link are inert too, not only `main`. Otherwise Shift+Tab leaves the drawer for controls behind the scrim.
  - `role="dialog"` sits on a `div` inside the `aside`, because ARIA in HTML does not allow that role on `aside`.
  - Following a drawer link moves focus to `main`, so the reader does not have to tab through the top bar again. Other ways of closing return focus to the menu button.
- **Search (A2):**
  - Focus moves in a layout effect instead of through `autoFocus`. With `autoFocus`, the suggested effect reads `document.activeElement` after focus has moved, so it records the input as the opener and never restores focus. The restore itself stays in a passive effect, because React refocuses the input straight after layout cleanups run.
  - Results are not Tab stops (`tabIndex={-1}`), as the combobox pattern expects. This also fixes a bug where Enter on a tabbed-to result opened the highlighted result instead.
  - The input is `type="text"` with `inputMode="search"`, because ARIA in HTML does not allow `role="combobox"` on `type="search"`.
  - `role="listbox"` is set only while there are results, because the hint text is not a valid listbox child.
  - The dialog marks the Escape it handles, so one press closes the dialog and not the drawer behind it.

**Found while implementing, since fixed:**

- **`--accent-2` in light mode:** link hover text was 4.05:1 on paper and white text on a hovered primary button was 4.35:1, both below AA. The token is now `#095C6B`: 7.10:1 and 7.62:1.
- **Search input ring:** the global `input:focus` rule drew a ring around the input inside the search panel. The panel's divider line now shows focus instead.
- **Playwright (fixed in phase D):** `tests/e2e.cjs` needed it, but it was not listed in `package.json`.

**A1. Make the mobile drawer a real modal drawer (K1, K2).** In `src/components/Layout.tsx`:

```tsx
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

function useMedia(q: string) {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(q); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => matchMedia(q).matches,
    () => false,
  )
}

// inside Layout()
const isDrawer = useMedia('(max-width: 1024px)')
const toggleRef = useRef<HTMLButtonElement>(null)
const closeRef = useRef<HTMLButtonElement>(null)

useEffect(() => {
  if (!isDrawer) return
  if (navOpen) closeRef.current?.focus()
  else if (document.activeElement?.closest('.side')) toggleRef.current?.focus()
}, [navOpen, isDrawer])

// in the existing keydown handler, before the search shortcut
if (e.key === 'Escape' && navOpen) { setNavOpen(false); return }
```

```tsx
<button ref={toggleRef} className="icon-btn nav-toggle" … />
<aside
  className={'side' + (navOpen ? ' open' : '')}
  aria-label="Contents"
  inert={isDrawer && !navOpen}
  {...(isDrawer && navOpen ? { role: 'dialog', 'aria-modal': true } : {})}
>
  …<button ref={closeRef} className="icon-btn" aria-label="Close contents" …>
</aside>
<main id="main" className="main" tabIndex={-1} inert={isDrawer && navOpen}>
```

React 19 supports the boolean `inert` prop. Making `main` inert while the drawer is open keeps focus inside the drawer without a hand-written trap. The Escape handler must be added to the effect's dependency list (`[navOpen]`).

**A2. Fix the search dialog (K3, K4, K5, K7).** In `src/components/SearchDialog.tsx`:

```tsx
// 1. Focus synchronously, so no keystroke is lost (replaces the setTimeout select)
<input ref={input} autoFocus … />
useEffect(() => { if (open) { loadIndex().then(setIdx); input.current?.select() } }, [open])

// 2. Escape works wherever focus is, and Tab stays inside the panel
useEffect(() => {
  if (!open) return
  const opener = document.activeElement as HTMLElement | null
  const onDoc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    if (e.key === 'Tab') {
      const f = panelRef.current?.querySelectorAll<HTMLElement>('input,a[href],button:not([disabled])')
      if (!f?.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }
  document.addEventListener('keydown', onDoc)
  return () => { document.removeEventListener('keydown', onDoc); opener?.focus?.() }   // 3. restore focus
}, [open, onClose])

// 4. Announce the highlighted result
<input … role="combobox" aria-expanded={results.length > 0} aria-autocomplete="list"
       aria-activedescendant={results[sel] ? `srch-opt-${sel}` : undefined} />
<button id={`srch-opt-${i}`} role="option" aria-selected={i === sel} …>
```

Also:
- Keep `onKeyDown` on the panel for the arrow keys and Enter only.
- Add `panelRef` to the `motion.div`.
- Make `onClose` stable (`useCallback` in `Layout`) so the effect does not re-run on every render.

**A3. Fix contrast tokens (R1, R2).** In `src/styles/content.css` (light theme only; the dark values already pass):

```css
--ok:#1F7330;      /* was #2B8A3E: 5.51:1 on paper, 5.21:1 on sunk */
--signal:#9C5000;  /* was #B35C00: 5.49:1 on paper, 5.20:1 on sunk */
```

In `src/styles/app.css`:

```css
.side-ch-link .n,.side-topics .n{color:var(--muted)}   /* was var(--rule-2): 5.09:1 light, 7.63:1 dark */
```

`--ok` is also used for fills (heatmap cells, the progress-ring stroke, the sidebar bar gradient). The darker green still reads as "done" there. Check the gradient visually after the change.

**A4. Make the progress segments real targets (T1).** In `src/styles/app.css`, keep the 5 px visual bar but give each link a 24 px hit area:

```css
.t-steps{gap:4px;margin-top:10px}
.t-steps a{position:relative;height:24px;background:none;display:flex;align-items:center}
.t-steps a::before{content:"";display:block;width:100%;height:5px;border-radius:3px;background:var(--sunk);transition:background .2s}
.t-steps a.done::before{background:color-mix(in srgb,var(--ok) 70%,transparent)}
.t-steps a.cur::before{background:var(--accent)}
.t-steps a:hover::before{background:var(--accent-2)}
```

Also give `.t-steps` a visible label for screen readers: wrap it in `<nav aria-label="Topics in this chapter">` and set `aria-current="page"` on the current link. Today the `aria-label` sits on a plain `div`, where it is ignored.

**Checks for phase A:** add these to `tests/e2e.cjs`.
- At 390 px, the first Tab after the skip link lands on a top-bar control, and within 10 presses focus reaches `main`.
- The drawer opens and focus is on "Close contents". Escape closes it and focus returns to the menu button.
- Pressing `/` and then typing "bm25" yields "bm25" in the search input.
- Tab ×6 keeps focus inside the dialog, Escape closes it, and focus returns to the search button.
- Contrast: assert the computed colour of `.side-ch-link .n` is not `--rule-2`. For full coverage, see phase D (axe).

### Phase B: structure and navigation (S1–S6, K6)

**Status: implemented.** The snippets below are the original suggestions. The code differs from them where a snippet would not have worked or the review had missed something:

- **Headings (B1):**
  - Levels come from an outline walk, not a relative shift. A shift turns the 14 topics that mix `h3` and `h5` into `h1 → h4`.
  - Changed headings get an `as-hN` class, and the stylesheets style `hN` and `.as-hN` alike.
  - Normalising runs before the legacy widgets mount, so their `.box>h5` and `.tools>h3` lookups, which add the icons, now match both forms.
  - Labels that legacy widgets inject into their own output are now `div.as-h5`, because they are not part of the page outline.
  - The review had also missed two skipped levels: the chapter page's What/Why/Where panels and the Practice page's question cards. Both now use `h2` with the same look. `tests/e2e.cjs` checks heading order on every route, and on the Practice page with a drawn set.
- **Contents (B3):** the summary counts "items", because the list holds figures and notes as well as sections. No hook was needed, because both renderings read the same `marks` state.
- **One picker (B4):** choosing in the top bar now clears a `?project=` override. Otherwise the override hid the new choice, and the top bar would have looked broken as the only control.
- **Phone top bar (B5):**
  - `projects.json` gains a `short` label, because the full labels "Online store" and "Travel booking" do not fit.
  - The brand text hides below 480 px so the bar fits at 320 px.
  - The project menus (top bar and home page) now stay on screen on phones. They ran off the left edge at 390 px.
- **Progress ring (B5):** the top-bar ring grows from 30 to 34 px so a 12 px percentage fits inside it.
- **Arrow keys (B7):** one `onRovingKeyDown` handler clicks the next item, so each list keeps its own selection logic. The check page's mode switch is a radio group, so it also takes the up and down arrows.

**B1. Normalise heading levels in rendered content (S1).** Shift headings once when topic HTML is rendered, instead of editing 135 content files: the body's first heading level becomes `h2`, and the rest follow relative to it. In `src/components/HtmlContent.tsx`, after the HTML is parsed into the container:

```ts
function normaliseHeadings(root: HTMLElement, top = 2) {
  const hs = [...root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')]
  if (!hs.length) return
  const min = Math.min(...hs.map((h) => +h.tagName[1]))
  for (const h of hs) {
    const lvl = Math.min(6, +h.tagName[1] - min + top)
    if (lvl === +h.tagName[1]) continue
    const n = document.createElement('h' + lvl)
    for (const a of h.attributes) n.setAttribute(a.name, a.value)
    n.classList.add('h' + h.tagName[1])     // keep the old look: style .h5 like h5
    n.append(...h.childNodes)
    h.replaceWith(n)
  }
}
```

- Add `h2.h5, h3.h5 { /* copy the existing h5 rules */ }` to `content.css` so nothing changes visually.
- Apply the same idea to the guide page, or simply change its `h3.sub-h` to `h2`.
- Run before widgets mount, so the legacy widget id guards are unaffected.
- Run it once per mount and keep it idempotent.

**B2. Give chapter-check sections real headings (S2).** In `src/components/Checks.tsx`, use the ARIA disclosure pattern with the button inside a heading:

```tsx
<section className={'csec' + (open ? ' open' : '')} id={id} aria-labelledby={`${id}-h`}>
  <h2 className="csec-hh">
    <button type="button" className="csec-h" aria-expanded={open} onClick={onToggle}>…</button>
  </h2>
```

"Choose the answer" and "Interview questions" stay `h3` and question titles stay `h4`: with the new `h2` above them, the order becomes valid with no other change. Add `.csec-hh{margin:0;font:inherit}`.

**B3. In-page contents on tablet and phone (S3).** In `src/pages/Topic.tsx`, render the rail's links a second time as a collapsible block under the header. It is visible only below 1240 px:

```tsx
<details className="t-toc">
  <summary>On this page · {railItems.length} sections</summary>
  <ol>{railItems.map((r) => <li key={r.id}><a href={`#${r.id}`}>{r.label}</a></li>)}</ol>
  <p><Link to={`/${chapter.id}#lab`}>Chapter {chapter.num} lab</Link> · <Link to={`/${chapter.id}/check#${topic.id}`}>Check this section</Link></p>
</details>
```

```css
.t-toc{display:none;margin:0 0 20px;border:1px solid var(--rule);border-radius:var(--r-2);background:var(--surface)}
.t-toc summary{padding:12px 14px;min-height:44px;cursor:pointer;font-weight:500}
@media (max-width:1240px){.t-toc{display:block}}
```

Extract the rail's item list into a `useRailItems()` hook so both renderings share it.

**B4. One project picker (S4).** Keep the top-bar picker as the single control at every width. B5 gives it a visible label on phones. On the chapter check and Practice pages, replace the second picker with a sentence:

```tsx
<span className="muted small">Questions framed for <b>{p.label}</b>. Change the example in the top bar.</span>
```

**B5. A lighter phone top bar (S5).**
- **Project picker:** in `ProjectPicker.tsx`, add a `compact` variant that shows the project's short label ("Harbor", "Store", "Bank", "Travel") next to the icon instead of only a chevron.
- **Progress ring at 0%:** below 760 px, hide `.top-prog` (progress is one tap away in the drawer: add a "Your progress" link to `Sidebar.tsx` under "Practice"). Everywhere else, show a text percentage inside the ring once progress is above 0.

**B6. Shorter breadcrumb (S6).** In `Layout.tsx`, show only the chapter crumb on topic pages. Show the topic crumb only after the `h1` scrolls out of view:

```tsx
const [titleHidden, setTitleHidden] = useState(false)
useEffect(() => {
  const h = document.querySelector('main h1'); if (!h) return
  const io = new IntersectionObserver(([e]) => setTitleHidden(!e.isIntersecting), { rootMargin: '-60px 0px 0px 0px' })
  io.observe(h); return () => io.disconnect()
}, [loc.pathname])
// render the topic crumb only when titleHidden
```

**B7. Arrow-key tabs (K6).** Add a small shared hook in `src/components/common.tsx` and use it in the three tab lists:

```tsx
export function useRovingTabs(count: number, index: number, onSelect: (i: number) => void) {
  return (e: React.KeyboardEvent) => {
    const k = e.key
    const next = k === 'ArrowRight' ? (index + 1) % count : k === 'ArrowLeft' ? (index - 1 + count) % count
      : k === 'Home' ? 0 : k === 'End' ? count - 1 : -1
    if (next < 0) return
    e.preventDefault(); onSelect(next)
    ;(e.currentTarget.querySelectorAll<HTMLElement>('[role=tab]')[next])?.focus()
  }
}
// tab buttons: tabIndex={selected ? 0 : -1} aria-controls={panelId}; panel: id={panelId} aria-labelledby={tabId}
```

**Checks for phase B:**
- e2e asserts the topic heading order starts `h1, h2` and that a check page has one `h2` per section.
- At 1024 px, `.t-toc` is visible and its first link scrolls to its target.
- On the In practice tabs, ArrowRight moves focus and selection.

### Phase C: readability and visual consistency (R3, R4, T2, T3, C1–C8)

**Status: implemented.** The snippets below are the original suggestions. The code differs from them in these places:

- **Type scale (C1):**
  - Sizes below 12 px now use `--fs-2xs`, and `.mono` has a 12 px minimum.
  - Dense figure internals (`.flow`, `.ctl .count`, `.bars .val`, `.kpi span`, `.heat`), the rail's small markers and the sizes inside legacy widget code keep their old sizes.
  - Literal sizes of 12 px and above were not moved onto the scale, so the ad hoc sizes in C8 are only partly addressed.
- **Zero rings (C3):** the ring draws thin as well as dashed at zero, because a dash on the thick home ring looked like a row of spikes. The call to action goes to the reader's last topic if they have one, and otherwise to 1.1.
- **Progress page (C5):** `.hm-check` was already in its own grid cell, so only the column width changed. The counts and topic links also get a 24 px minimum height.
- **Practice filter (C6):** the select stays, renamed "Any learning path". The review read it as a repeat of the chips, but it picks chapters by learning path, and removing it would have lost that feature.
- **Interview count pill:** fixed here too. `.pill.iv` was picking up the `.iv` card's padding and left border.

**Checked:** typecheck, build, screenshots of the eight pages at both sizes and themes, and a script for the new behaviour. Outside figures and code, the scan now finds no text under 12 px on any of the eight pages at either size (home at 1440 px was 116 of 210 text elements) and no sideways scroll.

**Not fixed:** a few standalone text links are 22–23 px tall, just under the 24 px minimum (`.hp-link`, `.ck-back`, `.iv-toggle`). They have clear space around them, which WCAG allows.

**C1. A type scale with a 12 px floor (R3, R4).** Add size tokens to `:root` in `content.css`, then replace the 0.60–0.72 rem literals in the three stylesheets:

```css
--fs-2xs:.75rem;   /* 12px: the floor for labels, chips, counters */
--fs-xs:.8125rem;  /* 13px: meta, rail links, sidebar topics */
--fs-sm:.875rem;   /* 14px: secondary text */
--fs-md:1rem;
```

- Uppercase mono labels: `font-size:var(--fs-2xs); letter-spacing:.06em`. Today it is `.64rem` at `.1em`; the wider spacing at 10 px is what makes these labels hard to read.
- Sidebar part headers: consider sentence-case `--fs-xs` in the body font instead of uppercase mono. They label navigation, so legibility matters more than style there.
- Verify by re-running the text-size scan. The target is no visible text below 12 px outside figures and code.

**C2. Targets (T2, T3).**
- `.hm-cell` becomes 24 × 24 px.
- Add `@media (pointer:coarse){.side-exp{width:36px;height:36px}.side-topics a{padding:8px}}`.
- In checks, move the focus ring from the 16 px input to the whole option row: `.opt:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}`.

**C3. Empty and zero states (C4).**
- In `ProgressRing` (`Icons.tsx`), draw a dashed track when the value is 0:
  ```tsx
  <circle className="ring-bg" strokeDasharray={v === 0 ? '3 5' : undefined} … />
  ```
- On the home progress card, replace the big "0" with a call to action at zero: "Not started yet. Start with 1.1 What is AI…" plus a button. On the progress page, show the same message above the empty rings.

**C4. Copy fixes (C1, C2, C3, C7).**
- **Practice page (`PracticePage.tsx:280`):** remove the "Questions so far cover … More chapters are added …" sentence, or replace it with "Questions cover all 18 chapters."
- **Search (`SearchDialog.tsx:130`):** build the placeholder from data: `` `Search ${courseTopics.length} topics and the appendices — e.g. …` ``.
- **Chapter check (`ChapterCheck.tsx:90`):** when some interview questions are hidden, say so after the counter: "· 7 framed for other projects are hidden (show them)". Make "show them" a link that ticks the existing toggle.
- **Home (`Home.tsx:46`):** drop the leading "·" and put the helper on its own line as `<p className="muted small">`.

**C5. Progress page alignment (C5).** Give the counts column a fixed width and use tabular figures:

```css
.hm-row{grid-template-columns:minmax(0,300px) 9.5rem 1fr}
.hm-check{font-variant-numeric:tabular-nums;white-space:nowrap}
```

`.hm-check` currently sits inside the first column, so move it into its own grid cell in `Misc.tsx`.

**C6. Practice filter (C6).**
- Remove the "All chapters with questions" select.
- Above the chips, add two text buttons ("All" and "None") and a count ("18 of 18 chapters").
- Style selected chips as outlined with an accent tick, not solid fills, so the default state does not look like a wall of filled teal.

**C7. Scale tokens (C8).** Add `--z-bar:30; --z-scrim:45; --z-drawer:50; --z-dialog:60; --z-skip:100` and use them in place of literals. The type scale is covered in C1.

**C8. Best-fit marker.** In `Practice.tsx`, the ★ on a project tab is an `<i>` with only a `title`. Add `<span className="sr-only">best fit for this topic</span>` so screen readers announce it.

### Phase D: guard against regressions

**Status: implemented.**

- **axe:** `tests/axe.cjs` runs inside `tests/e2e.cjs`, and can also run alone with `node tests/axe.cjs`. It covers the eight pages in both themes at 1280 px, and fails on serious or critical violations. It does not cover other routes, phone width, or hover and focus states.
- **Violations fixed:** a top-bar link and the project button had names that did not match their visible text, and the BM25 widget dimmed rows with opacity, leaving their text at 2.9:1.
- **Dependencies:** `@axe-core/playwright` and `playwright` are now dev dependencies. Playwright was added because installing axe would otherwise remove the unlisted copy the tests need. The browser still needs `npx playwright install chromium`, as the README now says.
- **UX scan:** `node tests/ux-scan.cjs` reports text under 12 px, targets under 24 px and sideways scroll, and fails on nothing. `--shots=name` also saves the screenshots for before-and-after review.
- **Widget checklist:** added to `CLAUDE.md`, along with a note on how to style content headings.

- **Automated accessibility checks:** add `@axe-core/playwright` as a dev dependency (a new dependency; needs your approval). Run axe in `tests/e2e.cjs` on the eight pages in both themes, and fail on `serious` or `critical` violations. This catches contrast, label and ARIA issues on every future change, including the phase 4 React widgets.
- **Keep the UX scripts:** move the target-size and text-size scans used for this review into `tests/ux-scan.cjs`. Print a short report, with no failing thresholds at first.
- **Widget checklist:** add one line to `CLAUDE.md`: every new widget meets the 24 px target minimum, the 12 px text floor and the contrast tokens above.

---

## 4. Order of work and effort

| Phase | Items | Effort (rough) | Fixes |
|---|---|---|---|
| A | Drawer, search dialog, contrast tokens, progress segments | 0.5–1 day | All 🔴 findings: K1–K5, K7, R1, R2, T1 |
| B | Headings, check-page headings, tablet/phone contents, one picker, phone top bar, breadcrumb, arrow-key tabs | 1–1.5 days | S1–S6, K6 |
| C | Type scale, targets, empty states, copy, alignment, Practice filter, tokens | 1 day | R3, R4, T2, T3, C1–C8 |
| D | axe in e2e, UX scan script, widget checklist | 0.5 day | Prevents regressions |

**Recommendations:**
- Do phase A first and on its own, because it fixes real keyboard dead ends.
- Phase C's type-scale change touches many rules, so review it with before-and-after screenshots of the eight pages in both themes. The audit script used for this review can produce them.
- Phase 4 of the roadmap (rebuilding widgets in React) should adopt the C1 tokens and the phase D axe checks from the start.

Effort figures are estimates, not measurements.
