/* End-to-end smoke test: every route renders without script errors or sideways scroll,
   v3 widgets start, search/progress/quiz/theme work, and the 3D widget runs.
   Usage: npm run build && npx vite preview --port 4173 & node tests/e2e.cjs [baseUrl] */
const { chromium } = require('playwright')
const { runAxe } = require('./axe.cjs')
const path = require('path')
const fs = require('fs')
const manifest = require('../src/content/manifest.json')
const idmap = require('../src/content/idmap.json')
const BASE = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '')
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })

const WIDGETS = ['bpeToks', 'tcK', 'lfK', 'imK', 'nnK', 'tsTbl', 'dpViz', 'msTbl', 'pkKp', 'rcTbl', 'rvOut', 'bgmLog', 'twDb', 'lsK', 'pcK', 'qsK', 'lsdBars', 'ckbT', 'cpWf', 'bwK', 'mgLog', 'bmTbl', 'gdOut', 'kmCan']

;(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const fails = []
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
  const check = async (label) => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (over > 1) fails.push(`${label}: horizontal overflow ${over}px`)
    if (errs.length) fails.push(`${label}: ${errs.splice(0).join(' | ')}`)
  }

  // heading levels never skip one on the way down
  const checkHeadings = async (label) => {
    const skips = await page.$$eval('main :is(h1,h2,h3,h4,h5,h6)', (hs) => {
      const out = []
      let prev = 0
      for (const h of hs) {
        const l = +h.tagName[1]
        if (l > prev + 1) out.push(`h${prev} -> h${l} "${h.textContent.trim().slice(0, 40)}"`)
        prev = l
      }
      return out
    })
    if (skips.length) fails.push(`${label}: heading order: ${skips.join('; ')}`)
  }

  // 1. every route
  const routes = ['/', '/guide', '/paths', '/progress', '/practice', '/does-not-exist']
  for (const c of manifest.chapters) {
    routes.push('/' + c.id)
    if (c.kind === 'chapter') routes.push(`/${c.id}/check`)
    for (const t of c.topics) routes.push(`/${c.id}/${t.id}`)
  }
  for (const r of routes) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(r.split('/').length > 2 ? 350 : 150)
    const h1 = await page.$('main h1')
    if (!h1) fails.push(`${r}: no h1`)
    await checkHeadings(r)
    if (r.split('/').length > 2 && !r.endsWith('/check')) {
      const n = await page.$$eval('.lai-topic > *', (x) => x.length)
      if (!n) fails.push(`${r}: empty topic body`)
    }
    await check(r)
  }
  console.log('routes visited:', routes.length)

  // 2. v3 widgets start on their topic pages
  const empty = []
  for (const id of WIDGETS) {
    const to = idmap[id]
    if (!to) { empty.push(id + '(unmapped)'); continue }
    await page.goto(BASE + to.split('#')[0], { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    const ok = await page.evaluate((id) => {
      const e = document.getElementById(id)
      if (!e) return false
      if (e.tagName === 'CANVAS') { const d = e.getContext('2d').getImageData(0, 0, e.width, e.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false }
      return e.innerHTML.trim().length > 0
    }, id)
    if (!ok) empty.push(id)
  }
  console.log('legacy widgets checked:', WIDGETS.length, 'empty:', empty)
  if (empty.length) fails.push('legacy widgets not started: ' + empty.join(', '))
  await check('widgets')

  // 3. interactions
  await page.goto(BASE + '/c9/c9-3', { waitUntil: 'networkidle' })
  await page.keyboard.press('/')
  await page.fill('.srch-in input', 'idempotency')
  await page.waitForSelector('.srch-hit', { timeout: 15000 })
  const hits = await page.$$eval('.srch-hit', (x) => x.length)
  const first = await page.$eval('.srch-hit b', (x) => x.textContent)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  console.log('search hits:', hits, '| first:', first, '| landed:', new URL(page.url()).pathname)
  if (!hits) fails.push('search returned nothing')

  await page.goto(BASE + '/c1/c1-1', { waitUntil: 'networkidle' })
  await page.click('.studied-toggle')
  const ring = await page.getAttribute('.top-prog', 'title')
  console.log('progress after toggle:', ring)
  if (!/^1 of/.test(ring)) fails.push('studied toggle did not update progress')

  // chapter check page: answer a question, see feedback, score updates
  await page.goto(BASE + '/c5/check#c5-2', { waitUntil: 'networkidle' })
  await page.waitForSelector('.csec.open .opt')
  await page.click('.csec.open .opt')
  const fb = await page.$$eval('.csec.open .mfb', (x) => x.length)
  console.log('check page feedback shown:', fb, '|', (await page.textContent('.ck-score')).trim())
  if (!fb) fails.push('check page: no feedback after answering')

  // example project: switching tabs sets ?project= and changes the note
  await page.goto(BASE + '/c1/c1-1', { waitUntil: 'networkidle' })
  const before = await page.textContent('.pb-body')
  await page.click('.pb-tab:nth-child(3)')
  await page.waitForTimeout(200)
  const after = await page.textContent('.pb-body')
  console.log('project tab ->', new URL(page.url()).search, '| changed:', before !== after)
  if (!page.url().includes('project=bank') || before === after) fails.push('project tab did not switch the practice note')

  // end-of-topic note: a project rated "limited" points to a better one
  await page.goto(BASE + '/c2/c2-3?project=travel', { waitUntil: 'networkidle' })
  await page.waitForSelector('.pb-body')
  const strong = await page.$$eval('.fitnote.strong', (x) => x.length)
  const ds = await page.$$eval('.pb .ds-f', (x) => x.map((a) => a.getAttribute('href')))
  console.log('limited-fit note shown:', strong, '| dataset links:', ds.length)
  if (!strong) fails.push('end-of-topic note missing for a limited-fit project')
  if (!ds.length || !ds[0].includes('/datasets/travel/')) fails.push('practice block has no dataset links for the travel project')
  else {
    const dsStatus = await page.evaluate((u) => fetch(u).then((r) => r.status), ds[0])
    if (dsStatus !== 200) fails.push('dataset file not served: ' + ds[0])
  }

  // practice page: draw a random set
  await page.goto(BASE + '/practice', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !/Loading/.test(document.querySelector('.pf-count')?.textContent || 'Loading'))
  await page.click('.pm-bar .btn.primary')
  const drawn = await page.$$eval('.pm-prog button', (x) => x.length)
  console.log('practice set drawn:', drawn)
  if (!drawn) fails.push('practice page: no random set drawn')
  await checkHeadings('practice page with a drawn set')
  // answer a multiple-choice question wrongly, then find it under Review mistakes
  await page.selectOption('.pf-row label:nth-of-type(1) select', 'mcq')
  await page.click('.pm-bar .btn.primary')
  for (let k = 0; k < 4 && !(await page.$('.pm-card .mcq.wrong')); k++) {
    const again = await page.$('.pm-card .mfb .linkish')
    if (again) await again.click()
    const opts = await page.$$('.pm-card .opt')
    if (opts[k]) await opts[k].click()
  }
  await page.click('.seg.tabs button:nth-child(2)')
  const mistakes = await page.$$eval('.pm .mcq', (x) => x.length)
  console.log('review-mistakes cards:', mistakes)
  if (!mistakes) fails.push('practice page: wrong answer did not appear under Review mistakes')
  await page.goto(BASE + '/c5', { waitUntil: 'networkidle' })
  const themeBefore = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  await page.click('button[aria-label^="Switch to"]')
  const themeAfter = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  console.log('theme:', themeBefore, '->', themeAfter)
  await check('interactions')

  // 4. 3D widget
  await page.goto(BASE + '/c2/c2-3', { waitUntil: 'networkidle' })
  const fig = await page.waitForSelector('.ll', { timeout: 15000 })
  await fig.scrollIntoViewIfNeeded()
  await page.waitForSelector('.ll canvas', { timeout: 15000 }).catch(() => fails.push('3D canvas did not mount'))
  await page.click('.ll-presets button:nth-child(1)')
  await page.click('.ll-btns .btn.primary')
  await page.waitForTimeout(3500)
  const steps = await page.$$eval('.ll-opt-v', (x) => x.map((e) => e.textContent))
  console.log('3D optimizer readout:', steps)
  await fig.screenshot({ path: path.join(OUT, 'loss-landscape.png') })
  await check('3d')

  // 5. screenshots + mobile dark
  for (const [r, f] of [['/', 'home'], ['/c9', 'chapter'], ['/c9/c9-3', 'topic']]) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(OUT, f + '-desktop.png') })
  }
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  m.on('pageerror', (e) => errs.push(e.message))
  for (const [r, f] of [['/', 'home'], ['/c14/c14-3', 'topic'], ['/c8', 'chapter'], ['/c2/c2-3', 'topic3d']]) {
    await m.goto(BASE + r, { waitUntil: 'networkidle' })
    await m.waitForTimeout(600)
    const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    if (over > 1) fails.push(`mobile ${r}: overflow ${over}px`)
    await m.screenshot({ path: path.join(OUT, f + '-mobile.png') })
  }
  if (errs.length) fails.push('mobile: ' + errs.join(' | '))

  // 6. keyboard, focus and contrast (phone width, then desktop)
  const focusIn = (p, sel) => p.evaluate((s) => !!document.activeElement?.closest(s), sel)
  const k = await b.newPage({ viewport: { width: 390, height: 844 } })
  await k.goto(BASE + '/c9/c9-3', { waitUntil: 'networkidle' })

  // the closed drawer is skipped: the page is reached quickly, without entering the sidebar
  await k.keyboard.press('Tab') // skip link
  let presses = 0
  let enteredDrawer = false
  while (presses < 10 && !(await focusIn(k, 'main'))) {
    await k.keyboard.press('Tab')
    presses++
    if (await focusIn(k, '.side')) enteredDrawer = true
  }
  console.log('tabs from skip link to main:', presses, '| entered closed drawer:', enteredDrawer)
  if (enteredDrawer) fails.push('keyboard: Tab entered the closed drawer')
  if (!(await focusIn(k, 'main'))) fails.push('keyboard: 10 Tab presses did not reach main')

  // the open drawer takes focus, keeps it, and gives it back on Escape
  await k.focus('.nav-toggle')
  await k.keyboard.press('Enter')
  if (!(await focusIn(k, '.side-head button'))) fails.push('drawer: focus did not move to the close button')
  await k.keyboard.press('Shift+Tab')
  if (await focusIn(k, '.topbar, .skip, main')) fails.push('drawer: Shift+Tab left the drawer for the page behind it')
  await k.focus('.side-head button')
  for (let n = 0; n < 8; n++) await k.keyboard.press('Tab')
  if (await focusIn(k, '.topbar, .skip, main')) fails.push('drawer: Tab left the drawer for the page behind it')
  await k.keyboard.press('Escape')
  if (await k.$('.side.open')) fails.push('drawer: Escape did not close it')
  if (!(await focusIn(k, '.nav-toggle'))) fails.push('drawer: focus did not return to the menu button')

  // following a drawer link closes it and moves focus to the new page
  await k.click('.nav-toggle')
  await k.waitForTimeout(350) // drawer slide
  await k.click('.side-top[href="/guide"]')
  await k.waitForSelector('main h1')
  await k.waitForTimeout(100)
  if (await k.$('.side.open')) fails.push('drawer: following a link did not close it')
  if (!(await k.evaluate(() => document.activeElement?.id === 'main'))) fails.push('drawer: focus did not move to the new page after following a link')

  // search: no keystroke is lost, Tab stays inside, Escape closes and restores focus
  await k.goto(BASE + '/c9/c9-3', { waitUntil: 'networkidle' })
  await k.keyboard.press('/')
  await k.keyboard.type('bm25')
  const typed = await k.inputValue('.srch-in input')
  if (typed !== 'bm25') fails.push(`search: typed "bm25" right after "/" but the input holds "${typed}"`)
  await k.waitForSelector('.srch-hit', { timeout: 15000 })
  const activeOption = () => k.evaluate(() => {
    const id = document.querySelector('.srch-in input').getAttribute('aria-activedescendant')
    return id && document.getElementById(id)?.getAttribute('aria-selected') === 'true' ? id : null
  })
  const opt0 = await activeOption()
  await k.keyboard.press('ArrowDown')
  const opt1 = await activeOption()
  console.log('search typed:', typed, '| active option:', opt0, '->', opt1)
  if (!opt0 || !opt1 || opt0 === opt1) fails.push('search: aria-activedescendant does not follow the highlighted result')
  await k.keyboard.press('Escape')
  await k.waitForSelector('.srch', { state: 'detached' })

  await k.focus('.search-btn')
  await k.keyboard.press('Enter')
  await k.waitForSelector('.srch-pnl')
  for (let n = 0; n < 6; n++) {
    await k.keyboard.press('Tab')
    if (!(await focusIn(k, '.srch-pnl'))) { fails.push('search: Tab left the dialog'); break }
  }
  await k.keyboard.press('Escape')
  await k.waitForSelector('.srch', { state: 'detached', timeout: 3000 }).catch(() => fails.push('search: Escape did not close the dialog'))
  if (!(await focusIn(k, '.search-btn'))) fails.push('search: focus did not return to the search button')

  // the search dialog closes before the drawer behind it
  await k.click('.nav-toggle')
  await k.keyboard.press('/')
  await k.waitForSelector('.srch-pnl')
  await k.keyboard.press('Escape')
  await k.waitForSelector('.srch', { state: 'detached' })
  if (!(await k.$('.side.open'))) fails.push('Escape in search also closed the drawer')
  await k.keyboard.press('Escape')

  // progress segments have a 24 px target, in a labelled nav that marks the current topic
  const seg = await k.$$eval('nav.t-steps a', (x) => x.map((a) => a.getBoundingClientRect().height))
  if (!seg.length || Math.min(...seg) < 24) fails.push(`progress segments: target height ${Math.min(...seg)}px`)
  if ((await k.$$('nav.t-steps a[aria-current="page"]')).length !== 1) fails.push('progress segments: no single aria-current link')
  await k.close()

  // theme colours used for small text reach AA, on the paper and sunk backgrounds, in both themes
  const contrast = () => {
    const root = getComputedStyle(document.documentElement)
    const rgb = (name) => { const h = root.getPropertyValue(name).trim().slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) }
    const lum = (c) => { const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const out = []
    for (const fg of ['--ink', '--muted', '--accent', '--accent-2', '--sim', '--ok', '--signal', '--bad']) {
      for (const bg of ['--paper', '--sunk']) {
        const [a, c] = [lum(rgb(fg)), lum(rgb(bg))]
        const ratio = (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05)
        if (ratio < 4.5) out.push(`${fg} on ${bg}: ${ratio.toFixed(2)}:1`)
      }
    }
    // sidebar numbers use a text token, not a rule colour
    const num = document.querySelector('.side-ch:not(.current) .side-ch-link .n')
    const probe = document.createElement('i')
    probe.style.color = root.getPropertyValue('--rule-2')
    document.body.append(probe)
    if (getComputedStyle(num).color === getComputedStyle(probe).color) out.push('sidebar numbers use --rule-2')
    probe.remove()
    return out
  }
  for (const colorScheme of ['light', 'dark']) {
    const t = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme })
    await t.goto(BASE + '/c9/c9-3', { waitUntil: 'networkidle' })
    const bad = await t.evaluate(contrast)
    if (bad.length) fails.push(`contrast (${colorScheme}): ${bad.join(', ')}`)
    await t.close()
  }

  // 7. structure and navigation
  const s = await b.newPage({ viewport: { width: 1440, height: 900 } })
  await s.goto(BASE + '/c9/c9-3', { waitUntil: 'networkidle' })
  // content headings changed level but kept their look and the icons the legacy code adds
  const boxIcons = await s.$$eval('.box>:is(h2,h3).as-h5', (x) => x.length && x.every((h) => h.querySelector('.ico svg')))
  if (!boxIcons) fails.push('headings: callout headings lost their icons')
  // the topic crumb appears only after the h1 scrolls away
  const crumb = () => s.$('.crumbs [aria-current="page"]')
  if (await crumb()) fails.push('breadcrumb: topic crumb shown while the h1 is visible')
  await s.evaluate(() => window.scrollTo(0, 900))
  await s.waitForTimeout(200)
  if (!(await crumb())) fails.push('breadcrumb: topic crumb missing after the h1 scrolled away')
  if (await s.isVisible('.t-toc')) fails.push('contents: .t-toc visible beside the rail at 1440 px')
  // arrow keys move focus and selection in the In practice tabs
  await s.focus('.pb-tab.on')
  await s.keyboard.press('ArrowRight')
  await s.waitForTimeout(100)
  const tabState = await s.evaluate(() => ({
    focused: document.activeElement?.classList.contains('on'),
    second: [...document.querySelectorAll('.pb-tab')].indexOf(document.activeElement),
    stops: document.querySelectorAll('.pb-tab[tabindex="0"]').length,
  }))
  if (!tabState.focused || tabState.second !== 1 || tabState.stops !== 1) fails.push('tabs: ArrowRight did not move focus and selection: ' + JSON.stringify(tabState))
  if (!s.url().includes('project=store')) fails.push('tabs: ArrowRight did not switch the project')
  // choosing in the top bar wins over a ?project= override
  await s.click('.topbar .pp-btn')
  await s.click('.pp-opt:nth-of-type(3)')
  await s.waitForTimeout(100)
  if (s.url().includes('project=')) fails.push('picker: the top bar choice did not clear the ?project= override')
  const onTab = await s.textContent('.pb-tab.on')
  if (!/Bank/.test(onTab)) fails.push(`picker: In practice shows "${onTab}" after choosing Bank`)
  await s.click('.topbar .pp-btn')
  await s.click('.pp-opt:nth-of-type(1)')
  // check page: one h2 per section, one picker, arrow keys in the mode switch
  await s.goto(BASE + '/c5/check', { waitUntil: 'networkidle' })
  await s.waitForSelector('.csec')
  const secs = await s.$$eval('.csec', (x) => [x.length, x.filter((e) => e.querySelector(':scope > h2 > button.csec-h')).length])
  if (!secs[0] || secs[0] !== secs[1]) fails.push(`check page: ${secs[1]} of ${secs[0]} sections have an h2`)
  if ((await s.$$('.pp')).length !== 1) fails.push('check page: more than one project picker')
  await s.focus('.ck-bar [role=radio][aria-checked=true]')
  await s.keyboard.press('ArrowRight')
  if ((await s.getAttribute('.ck-bar [role=radio]:nth-child(2)', 'aria-checked')) !== 'true') fails.push('check page: ArrowRight did not switch the mode')
  // practice page: one picker, arrow keys in the mode tabs
  await s.goto(BASE + '/practice', { waitUntil: 'networkidle' })
  if ((await s.$$('.pp')).length !== 1) fails.push('practice page: more than one project picker')
  await s.focus('.seg.tabs [role=tab][aria-selected=true]')
  await s.keyboard.press('End')
  if ((await s.getAttribute('#pm-tab-drill', 'aria-selected')) !== 'true') fails.push('practice page: End did not select the last tab')
  if ((await s.getAttribute('#pm-panel', 'aria-labelledby')) !== 'pm-tab-drill') fails.push('practice page: the panel is not labelled by its tab')
  await s.close()

  // in-page contents below 1240 px
  const c = await b.newPage({ viewport: { width: 1024, height: 900 } })
  await c.goto(BASE + '/c9/c9-3', { waitUntil: 'networkidle' })
  if (!(await c.isVisible('.t-toc'))) fails.push('contents: .t-toc not visible at 1024 px')
  await c.click('.t-toc summary')
  const tocId = (await c.getAttribute('.t-toc ol a', 'href')).slice(1)
  await c.click('.t-toc ol a')
  await c.waitForTimeout(900)
  const tocTop = await c.evaluate((id) => document.getElementById(id).getBoundingClientRect().top, tocId)
  console.log('contents link target top:', Math.round(tocTop))
  if (tocTop < -5 || tocTop > 450) fails.push(`contents: the first link did not scroll to its target (top ${tocTop})`)
  await c.close()

  // phone top bar: fits, names the project, and progress is reachable from the drawer
  for (const width of [390, 320]) {
    const t = await b.newPage({ viewport: { width, height: 800 } })
    await t.goto(BASE + '/c9/c9-3', { waitUntil: 'networkidle' })
    const bar = await t.evaluate(() => ({
      over: document.querySelector('.topbar').scrollWidth - document.querySelector('.topbar').clientWidth,
      short: document.querySelector('.topbar .pp-short').textContent,
      shown: getComputedStyle(document.querySelector('.topbar .pp-short')).display !== 'none',
      ring: getComputedStyle(document.querySelector('.top-prog')).display,
    }))
    if (bar.over > 0) fails.push(`phone top bar at ${width}: overflows by ${bar.over}px`)
    if (!bar.shown || bar.short !== 'Harbor') fails.push(`phone top bar at ${width}: no short project label`)
    if (bar.ring !== 'none') fails.push(`phone top bar at ${width}: progress ring still shown`)
    await t.click('.topbar .pp-btn')
    const menu = await t.$eval('.pp-menu', (m) => { const r = m.getBoundingClientRect(); return [r.left, r.right] })
    if (menu[0] < 0 || menu[1] > width) fails.push(`phone top bar at ${width}: project menu runs off screen (${menu})`)
    await t.goto(BASE + '/', { waitUntil: 'networkidle' })
    await t.click('.pp.inline .pp-btn')
    const inlineMenu = await t.$eval('.pp.inline .pp-menu', (m) => { const r = m.getBoundingClientRect(); return [r.left, r.right] })
    if (inlineMenu[0] < 0 || inlineMenu[1] > width) fails.push(`home at ${width}: inline project menu runs off screen (${inlineMenu})`)
    await t.close()
  }
  const dr = await b.newPage({ viewport: { width: 390, height: 844 } })
  await dr.goto(BASE + '/c9/c9-3', { waitUntil: 'networkidle' })
  await dr.click('.nav-toggle')
  await dr.waitForTimeout(350)
  await dr.click('.side-top[href="/progress"]')
  await dr.waitForSelector('.page-h')
  if (!dr.url().endsWith('/progress')) fails.push('drawer: no link to the progress page')
  await dr.close()

  // 8. readability and consistency
  const r = await b.newPage({ viewport: { width: 1440, height: 900 } })
  // zero state: no empty counter on the home card, and it goes once a topic is studied
  await r.goto(BASE + '/', { waitUntil: 'networkidle' })
  if (!(await r.$('.hp-zero .btn'))) fails.push('home: no call to action at zero progress')
  await r.goto(BASE + '/c1/c1-1', { waitUntil: 'networkidle' })
  await r.click('.studied-toggle')
  await r.goto(BASE + '/', { waitUntil: 'networkidle' })
  if (await r.$('.hp-zero')) fails.push('home: zero state still shown after studying a topic')
  // progress page: 24 px cells whose rows all start at the same x
  await r.goto(BASE + '/progress', { waitUntil: 'networkidle' })
  const hm = await r.$$eval('.hm-cells', (x) => ({
    lefts: new Set(x.map((e) => Math.round(e.getBoundingClientRect().left))).size,
    minCell: Math.min(...[...document.querySelectorAll('.hm-cell')].map((c) => c.getBoundingClientRect().height)),
  }))
  if (hm.lefts !== 1) fails.push(`progress page: heatmap rows start at ${hm.lefts} different positions`)
  if (hm.minCell < 24) fails.push(`progress page: heatmap cell height ${hm.minCell}px`)
  // practice page filter: All and None, with a count; learning paths are still available
  await r.goto(BASE + '/practice', { waitUntil: 'networkidle' })
  const chipCount = () => r.$$eval('.pf-chips .lchip.on', (x) => x.length)
  const allChips = await chipCount()
  await r.click('.pf-row .linkish:text-is("None")')
  if ((await chipCount()) !== 0) fails.push('practice page: None did not clear the chapters')
  if (!(await r.isDisabled('.pm-bar .btn.primary'))) fails.push('practice page: a set can be drawn with no chapters selected')
  await r.click('.pf-row .linkish:text-is("All")')
  if ((await chipCount()) !== allChips) fails.push('practice page: All did not select every chapter')
  await r.selectOption('.pf-row select[aria-label="Learning path"]', { index: 1 })
  if ((await chipCount()) >= allChips) fails.push('practice page: picking a learning path did not narrow the chapters')
  if (await r.$('.pm-foot')) fails.push('practice page: stale coverage sentence is back')
  // check page: hidden interview questions are explained, and the link shows them
  await r.goto(BASE + '/c5/check', { waitUntil: 'networkidle' })
  await r.waitForSelector('.ck-score .linkish')
  await r.click('.ck-score .linkish')
  if (await r.$('.ck-score .linkish')) fails.push('check page: "show them" did not show the hidden questions')
  if (!(await r.isChecked('.ck-bar .tgl input'))) fails.push('check page: "show them" did not tick the toggle')
  // search placeholder comes from the data
  await r.keyboard.press('/')
  const ph = await r.getAttribute('.srch-in input', 'placeholder')
  if (!ph.includes(String(manifest.chapters.filter((c) => c.kind === 'chapter').reduce((n, c) => n + c.topics.length, 0)))) fails.push(`search placeholder count looks wrong: "${ph}"`)
  await r.close()
  if (errs.length) fails.push('readability checks: ' + errs.join(' | '))

  // 9. accessibility: no serious or critical axe violations on the eight review pages, in both themes
  const axeProblems = await runAxe(b, BASE)
  console.log('axe serious or critical violations:', axeProblems.length)
  fails.push(...axeProblems.map((p) => 'axe: ' + p))

  await b.close()
  console.log(fails.length ? 'FAILURES:\n- ' + fails.join('\n- ') : 'ALL CHECKS PASSED')
  process.exit(fails.length ? 1 : 0)
})()
