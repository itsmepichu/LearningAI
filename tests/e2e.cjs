/* End-to-end smoke test: every route renders without script errors or sideways scroll,
   v3 widgets start, search/progress/quiz/theme work, and the 3D widget runs.
   Usage: npm run build && npx vite preview --port 4173 & node tests/e2e.cjs [baseUrl] */
const { chromium } = require('playwright')
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

  // 1. every route
  const routes = ['/', '/guide', '/paths', '/progress', '/does-not-exist']
  for (const c of manifest.chapters) {
    routes.push('/' + c.id)
    for (const t of c.topics) routes.push(`/${c.id}/${t.id}`)
  }
  for (const r of routes) {
    await page.goto(BASE + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(r.split('/').length > 2 ? 350 : 150)
    const h1 = await page.$('main h1')
    if (!h1) fails.push(`${r}: no h1`)
    if (r.split('/').length > 2) {
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
  await page.waitForSelector('.srch-hit', { timeout: 5000 })
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

  await page.goto(BASE + '/c5', { waitUntil: 'networkidle' })
  await page.click('.qq2 label:nth-child(2)')
  console.log('quiz:', (await page.textContent('.quiz-score')).trim())
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

  await b.close()
  console.log(fails.length ? 'FAILURES:\n- ' + fails.join('\n- ') : 'ALL CHECKS PASSED')
  process.exit(fails.length ? 1 : 0)
})()
