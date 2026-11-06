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

const WIDGETS = ['lfK', 'nnK', 'tsTbl', 'dpViz', 'pkKp', 'rvOut', 'bgmLog', 'lsK', 'lsdBars', 'mgLog', 'kmCan']
// React widgets from src/widgets, and the page each is embedded on
const KIT_WIDGETS = [
  ['chunking', '/c9/c9-2'],
  ['bm25', '/c9/c9-3'],
  ['retrieval-metrics', '/c9/c9-7'],
  ['retriever-compare', '/c9/c9-7'],
  ['streaming', '/c7/c7-4'],
  ['saga', '/c11/c11-6'],
  ['context-assembler', '/c7/c7-3'],
  ['memory-sim', '/c7/c7-5'],
  ['timeout-write', '/c11/c11-6'],
  ['budget', '/c11/c11-7'],
  ['injection', '/c16/c16-2'],
  ['cache-key', '/c16/c16-4'],
  ['isolation-grid', '/c16/c16-4'],
  ['pii-redact', '/c16/c16-5'],
  ['agent-loop', '/c11/c11-2'],
  ['token-estimator', '/c1/c1-4'],
  ['class-imbalance', '/c3/c3-3'],
  ['rrf', '/c9/c9-5'],
  ['vector-search', '/c9/c9-3'],
  ['vector-quant', '/c9/c9-4'],
  ['trace-waterfall', '/c17/c17-2'],
  ['critical-path', '/c17/c17-2'],
  ['cost-attribution', '/c17/c17-5'],
  ['py-lab', '/app-a/app-a-run'],
  ['py-snippet', '/c5/c5-1'],
  ['py-snippet', '/c5/c5-2'],
  ['py-snippet', '/c5/c5-5'],
  ['py-snippet', '/c5/c5-6'],
  ['py-snippet', '/c4/c4-4'],
  ['py-snippet', '/c4/c4-5'],
  ['py-snippet', '/c4/c4-6'],
  ['py-snippet', '/c6/c6-2'],
  ['py-snippet', '/c6/c6-4'],
  ['py-snippet', '/c7/c7-1'],
  ['py-snippet', '/c7/c7-2'],
  ['py-snippet', '/c7/c7-3'],
  ['py-snippet', '/c7/c7-4'],
  ['py-snippet', '/c1/c1-1'],
  ['py-snippet', '/c1/c1-3'],
  ['py-snippet', '/c1/c1-4'],
  ['py-snippet', '/c1/c1-5'],
  ['py-snippet', '/c2/c2-1'],
  ['py-snippet', '/c2/c2-2'],
  ['py-snippet', '/c2/c2-4'],
  ['py-snippet', '/c2/c2-5'],
  ['py-snippet', '/c3/c3-1'],
  ['py-snippet', '/c3/c3-2'],
  ['py-snippet', '/c3/c3-3'],
  ['py-snippet', '/c3/c3-4'],
  ['py-snippet', '/c3/c3-5'],
  ['py-snippet', '/c3/c3-6'],
  ['colab-guide', '/c5/c5-6'],
  ['colab-guide', '/c13/c13-3'],
  ['colab-guide', '/c14/c14-7'],
  ['bpe', '/c5/c5-1'],
  ['tokenizer-compare', '/c5/c5-1'],
  ['text-classifier', '/c3/c3-2'],
  // These show no example data, so they look the same for every project.
  ['attention', '/c5/c5-2', 'neutral'],
  ['multihead', '/c5/c5-2', 'neutral'],
  ['transformer-block', '/c5/c5-3', 'neutral'],
  ['embedding-space', '/c9/c9-3'],
  ['hnsw-layers', '/c9/c9-4', 'neutral'],
  ['zero-sharding', '/c6/c6-6', 'neutral'],
  ['paged-kv-3d', '/c14/c14-3', 'neutral'],
  ['failover-globe', '/c15/c15-7'],
  ['walkthrough', '/c9/c9-1'],
  ['walkthrough', '/c11/c11-2'],
  ['walkthrough', '/c14/c14-2'],
  ['walkthrough', '/c6/c6-4'],
  ['colab-guide', '/c6/c6-7', 'neutral'],
  ['hnsw', '/c9/c9-4', 'neutral'],
  ['gradient-descent', '/c2/c2-3', 'neutral'],
  ['threshold-roc', '/c3/c3-5', 'neutral'],
  ['reliability', '/c3/c3-5', 'neutral'],
  ['batching', '/c14/c14-3', 'neutral'],
  ['paged-kv', '/c14/c14-3', 'neutral'],
  ['prefix-cache', '/c14/c14-3', 'neutral'],
  ['throughput-latency', '/c14/c14-7', 'neutral'],
  ['queue-sim', '/c15/c15-1', 'neutral'],
  ['burn-rate', '/c17/c17-8', 'neutral'],
  ['py-snippet', '/c5/c5-3', 'neutral'],
  ['py-snippet', '/c5/c5-4', 'neutral'],
  ['py-snippet', '/c5/c5-7', 'neutral'],
  ['py-snippet', '/c4/c4-1', 'neutral'],
  ['py-snippet', '/c4/c4-2', 'neutral'],
  ['py-snippet', '/c4/c4-3', 'neutral'],
  ['py-snippet', '/c6/c6-1', 'neutral'],
  ['py-snippet', '/c6/c6-3', 'neutral'],
  ['py-snippet', '/c6/c6-5', 'neutral'],
  ['py-snippet', '/c6/c6-6', 'neutral'],
  ['py-snippet', '/c7/c7-5', 'neutral'],
  ['py-snippet', '/c7/c7-6', 'neutral'],
  ['py-snippet', '/c7/c7-7', 'neutral'],
  ['py-snippet', '/c1/c1-2', 'neutral'],
  ['py-snippet', '/c1/c1-6', 'neutral'],
  ['py-snippet', '/c2/c2-3', 'neutral'],
  ['py-snippet', '/c2/c2-6', 'neutral'],
]
const PROJECTS = require('../src/content/projects.json').projects

;(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const fails = []
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  // Nothing may download until a reader opts in, and no test opts in for real.
  page.on('request', (r) => {
    if (/huggingface\.co|hf\.co|jsdelivr\.net|pyodide/.test(r.url())) fails.push(`downloaded without an opt-in: ${r.url()}`)
  })
  page.on('worker', (w) => fails.push(`a worker started without an opt-in: ${w.url()}`))
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
  const routes = ['/', '/guide', '/progress', '/practice', '/glossary', '/flashcards', '/does-not-exist']
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

  // 2b. React widgets: each loads every project's data and meets the 12 px and 24 px floors
  const kitSel = (name) => `[data-kit-widget="${name}"]`
  for (const [name, route, neutral] of KIT_WIDGETS) {
    for (const p of neutral ? PROJECTS.slice(0, 1) : PROJECTS) {
      const label = `${name} (${p.id})`
      await page.goto(`${BASE}${route}?project=${p.id}`, { waitUntil: 'networkidle' })
      const ready = await page.waitForSelector(neutral ? kitSel(name) : `${kitSel(name)} .wk-src`, { timeout: 15000 }).catch(() => null)
      if (!ready) {
        fails.push(`${label}: its data did not load`)
        continue
      }
      if (!neutral) {
        const source = await page.textContent(`${kitSel(name)} .wk-src-co`)
        if (source !== p.company) fails.push(`${label}: shows data for "${source}"`)
      }
      const problems = await page.$eval(kitSel(name), (root) => {
        const out = []
        for (const e of root.querySelectorAll('*')) {
          const box = e.getBoundingClientRect()
          if (!box.width || !box.height) continue
          const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
          if (hasText && parseFloat(getComputedStyle(e).fontSize) < 12) out.push(`${e.tagName.toLowerCase()} text under 12 px: "${e.textContent.trim().slice(0, 30)}"`)
          // a checkbox's target includes its label
          const target = e.matches('button,select,input:not([type=checkbox]),label')
          if (target && (box.width < 24 || box.height < 24)) out.push(`${e.tagName.toLowerCase()} target ${Math.round(box.width)}x${Math.round(box.height)}: "${e.textContent.trim().slice(0, 30)}"`)
        }
        return [...new Set(out)]
      })
      problems.forEach((x) => fails.push(`${label}: ${x}`))
      await check(label)
    }
  }
  // The same pages at phone width: nothing in a widget may widen the page
  {
    const ctx = await b.newContext({ viewport: { width: 360, height: 800 } })
    const phone = await ctx.newPage()
    for (const route of [...new Set(KIT_WIDGETS.map((w) => w[1]))]) {
      await phone.goto(BASE + route, { waitUntil: 'networkidle' })
      await phone.waitForSelector('[data-kit-widget]')
      await phone.waitForTimeout(200)
      const over = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (over > 1) fails.push(`${route} at 360 px: the page overflows by ${over}px`)
    }
    await ctx.close()
  }

  const kitPy = (p, sel) => p.$eval(`${sel} .kpi b`, (e) => e.textContent)

  // 2c. Opt-in downloads, with Worker stubbed so nothing is fetched. A stub stands in for each engine, by the worker's name.
  {
    const THIRD_PARTY = /huggingface\.co|hf\.co|jsdelivr\.net|pyodide/
    const stubWorker = ({ failFirst }) => {
      window.__workers = []
      const vector = (text) => {
        const v = new Array(32).fill(0)
        for (const w of text.toLowerCase().split(/\W+/)) if (w) v[[...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 32] += 1
        const n = Math.hypot(...v) || 1
        return v.map((x) => x / n)
      }
      const later = (ms) => new Promise((r) => setTimeout(r, ms))
      window.Worker = class {
        constructor(url, options) {
          this.name = options.name
          this.terminated = false
          window.__workers.push(this)
        }
        terminate() {
          this.terminated = true
        }
        reply(m) {
          if (!this.terminated) this.onmessage?.({ data: m })
        }
        async postMessage({ id, op, args }) {
          const emit = (progress) => this.reply({ id, type: 'progress', progress })
          const done = (result) => this.reply({ id, type: 'result', result })
          if (/^load/.test(op)) {
            // Slow enough for the test to see the loading state, and to cancel it.
            for (const percent of [10, 40, 70]) {
              await later(window.__holdLoad ? 4000 : 120)
              emit({ file: 'stub.bin', loaded: percent * 1e5, total: 1e7 })
            }
            // Only the first load in this tab fails, across page loads.
            if (failFirst && !sessionStorage.getItem('stub-failed')) {
              sessionStorage.setItem('stub-failed', '1')
              return this.reply({ id, type: 'error', message: 'Stubbed network failure.' })
            }
            return done({ stub: true })
          }
          if (op === 'embed') {
            emit({ done: args.texts.length, total: args.texts.length })
            return done(args.texts.map(vector))
          }
          if (op === 'trainSoftmax') {
            const classes = [...new Set(args.y)].sort()
            return done({ classes, weights: classes.map((_, c) => new Array(33).fill(0).map((__, j) => (j === c ? 2 : 0))) })
          }
          if (op === 'tokenize') return done([0, 1, 2].map(() => args.texts.map((t) => ({ pieces: t.split(' ') }))))
          if (op === 'run') {
            if (args.code.includes('while True')) return
            emit({ out: 'stubbed output\n' })
            return done({ checks: [{ name: 'A check that passes', pass: true, detail: 'stub' }, { name: 'A check that fails', pass: false, detail: 'stub' }], ms: 120 })
          }
          this.reply({ id, type: 'error', message: `The stub has no ${op}` })
        }
      }
    }
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
    await ctx.addInitScript(stubWorker, { failFirst: true })
    const g = await ctx.newPage()
    const gErrs = []
    const fetched = []
    g.on('pageerror', (e) => gErrs.push(e.message))
    g.on('request', (r) => THIRD_PARTY.test(r.url()) && fetched.push(r.url()))
    const rc = kitSel('retriever-compare')
    const notes = () => g.$$eval(`${rc} .wk-cols small`, (x) => x.map((e) => e.textContent))
    const heads = () => g.$$eval(`${rc} .wk-cols .wk-col-h`, (x) => x.map((e) => e.textContent))

    // Before the opt-in: the illustration, labelled as one, the size shown, and no worker
    await g.goto(`${BASE}/c9/c9-7?project=bank`, { waitUntil: 'networkidle' })
    await g.waitForSelector(`${rc} [data-gate="idle"]`)
    const offer = await g.textContent(`${rc} [data-gate="idle"]`)
    if (!/about 29 MB/.test(offer) || !/Nothing has been downloaded/.test(offer)) fails.push(`gate: the offer should state the size first: "${offer.slice(0, 120)}"`)
    if ((await g.textContent(`${rc} [data-gate="idle"] .btn.primary`)) !== 'Download 29 MB') fails.push('gate: the button should name the size')
    if (!(await g.$(`${rc} [data-gate="idle"] details`))) fails.push('gate: it should list what it downloads')
    if ((await notes()).filter((n) => n === 'fixed illustration').length !== 2) fails.push(`gate: dense and hybrid should start as labelled illustrations: ${await notes()}`)
    if (await g.evaluate(() => window.__workers.length)) fails.push('gate: a worker started before the opt-in')

    // Yes: progress, then a failure the reader can retry
    await g.click(`${rc} [data-gate="idle"] .btn.primary`)
    await g.waitForSelector(`${rc} [data-gate="loading"] [role=progressbar]`)
    await g.waitForFunction((s) => +document.querySelector(`${s} [role=progressbar]`)?.getAttribute('aria-valuenow') > 0, rc)
    if ((await notes()).filter((n) => n === 'fixed illustration').length !== 2) fails.push('gate: labels should not change while it downloads')
    await g.waitForSelector(`${rc} [data-gate="failed"] [role=alert]`)
    if (!/Stubbed network failure/.test(await g.textContent(`${rc} [data-gate="failed"]`))) fails.push('gate: a failure should say what went wrong')
    if (!(await g.evaluate(() => window.__workers[0].terminated))) fails.push('gate: a failed worker should be ended')
    if ((await notes()).filter((n) => n === 'fixed illustration').length !== 2) fails.push('gate: a failure should leave the illustration in place')
    await g.click(`${rc} [data-gate="failed"] .btn.primary`)

    // Ready: the labels change with what is showing, and the reader can switch back
    await g.waitForFunction((s) => [...document.querySelectorAll(`${s} .wk-cols small`)].some((e) => e.textContent.startsWith('real:')), rc)
    const real = await notes()
    if (!/^real: all-MiniLM-L6-v2/.test(real[1]) || (await heads())[2] !== 'Hybrid (RRF, no reranker)') fails.push(`gate: real results need real labels: ${real} / ${await heads()}`)
    await g.click(`${rc} .wk-chip:has-text("Fixed illustration")`)
    if ((await notes()).filter((n) => n === 'fixed illustration').length !== 2 || (await heads())[2] !== 'Hybrid + rerank') fails.push('gate: switching back should restore the illustration and its labels')
    await g.click(`${rc} .wk-chip:has-text("Real model")`)

    // A later visit: it remembers, and still waits for the reader
    await g.goto(`${BASE}/c9/c9-5?project=bank`, { waitUntil: 'networkidle' })
    await g.waitForSelector(`${kitSel('rrf')} [data-gate="idle"]`)
    if ((await g.textContent(`${kitSel('rrf')} [data-gate="idle"] .btn.primary`)) !== 'Load it' || !/load from its cache/.test(await g.textContent(`${kitSel('rrf')} [data-gate="idle"]`))) fails.push('gate: a later visit should say it comes from the cache')
    if (!/fixed illustration/.test(await g.textContent(`${kitSel('rrf')} .wk-cols .card:nth-child(2) small`))) fails.push('rrf: the dense list should say it is an illustration')
    await g.click(`${kitSel('rrf')} [data-gate="idle"] .btn.primary`)
    await g.waitForFunction((s) => document.querySelector(`${s} .wk-cols .card:nth-child(2) small`).textContent.startsWith('real:'), kitSel('rrf'))
    if (!/all computed live/.test(await g.textContent(`${kitSel('rrf')} .wk-src`))) fails.push('rrf: the source line should say all three are live')

    // Cancel returns to the offer and ends the worker
    await g.goto(`${BASE}/c5/c5-1?project=travel`, { waitUntil: 'networkidle' })
    const tc = kitSel('tokenizer-compare')
    await g.waitForSelector(`${tc} [data-gate="idle"]`)
    await g.evaluate(() => (window.__holdLoad = true))
    await g.click(`${tc} [data-gate="idle"] .btn.primary`)
    await g.click(`${tc} [data-gate="loading"] .btn`)
    await g.waitForSelector(`${tc} [data-gate="idle"]`)
    if (!(await g.evaluate(() => window.__workers.at(-1).terminated))) fails.push('gate: cancel should end the worker')
    await g.evaluate(() => (window.__holdLoad = false))

    // Each figure works once the stub is loaded
    await g.click(`${tc} [data-gate="idle"] .btn.primary`)
    await g.waitForSelector(`${tc} tbody tr`)
    if ((await g.$$eval(`${tc} tbody tr`, (x) => x.length)) !== 4) fails.push('tokenizer comparison: Travel should show 4 languages')
    if ((await g.$$eval(`${tc} [data-tokenizer]`, (x) => x.length)) !== 3) fails.push('tokenizer comparison: expected 3 tokenizers')

    await g.goto(`${BASE}/c9/c9-3?project=harbor`, { waitUntil: 'networkidle' })
    await g.click(`${kitSel('vector-search')} [data-gate="idle"] .btn.primary`)
    await g.waitForSelector(`${kitSel('vector-search')} tbody tr td code`)
    if (!/Real, and limited/.test(await g.textContent(kitSel('vector-search')))) fails.push('vector search: it should say what the result does not prove')

    await g.goto(`${BASE}/c9/c9-4?project=harbor`, { waitUntil: 'networkidle' })
    await g.click(`${kitSel('vector-quant')} [data-gate="idle"] .btn.primary`)
    await g.waitForSelector(`${kitSel('vector-quant')} tbody tr`)
    if ((await g.$$eval(`${kitSel('vector-quant')} tbody tr`, (x) => x.length)) !== 4) fails.push('quantisation: expected 4 codes')

    await g.goto(`${BASE}/c3/c3-2?project=bank`, { waitUntil: 'networkidle' })
    await g.click(`${kitSel('text-classifier')} [data-gate="idle"] .btn.primary`)
    await g.waitForSelector(`${kitSel('text-classifier')} .kpi`)
    if (!/invented data/.test(await g.textContent(kitSel('text-classifier')))) fails.push('classifier: it should say the data is invented')

    // A Python lab: the code survives Stop, which restarts the worker
    const py = kitSel('py-lab')
    await g.goto(`${BASE}/c2/c2-5?project=store`, { waitUntil: 'networkidle' })
    await g.waitForSelector(`${py} [data-gate="idle"]`)
    if (!/orders\.csv/.test(await g.textContent(`${py} .wk-q`))) fails.push('python lab: the brief should use the project dataset')
    await g.click(`${py} [data-gate="idle"] .btn.primary`)
    await g.waitForSelector(`${py} textarea`)
    if (!/orders\.csv/.test(await g.inputValue(`${py} textarea`))) fails.push('python lab: the code should read the project dataset')
    await g.click(`${py} .btn.primary`)
    await g.waitForSelector(`${py} .wk-ev`)
    if ((await g.$$eval(`${py} .wk-ev.ok`, (x) => x.length)) !== 1 || (await g.$$eval(`${py} .wk-ev.bad`, (x) => x.length)) !== 1) fails.push('python lab: each check should show pass or not yet')
    if ((await kitPy(g, py)) !== '1 of 2') fails.push('python lab: the count of passed checks is wrong')
    await g.fill(`${py} textarea`, 'while True:\n    pass')
    const before = await g.evaluate(() => window.__workers.length)
    await g.click(`${py} .btn.primary`)
    await g.click(`${py} .btn:has-text("Stop")`)
    await g.waitForFunction((s) => /Stopped/.test(document.querySelector(`${s}`).textContent) && document.querySelector(`${s} textarea`), py)
    if ((await g.inputValue(`${py} textarea`)) !== 'while True:\n    pass') fails.push('python lab: Stop should keep the code')
    if ((await g.evaluate(() => window.__workers.length)) !== before + 1) fails.push('python lab: Stop should replace the worker')

    // A runnable snippet: the project's data in its files, output shown, Reset restores the code
    const sn = kitSel('py-snippet')
    await g.goto(`${BASE}/c5/c5-1?project=bank`, { waitUntil: 'networkidle' })
    await g.waitForSelector(`${sn} [data-gate="idle"]`)
    if (!/disputes\.csv/.test(await g.textContent(`${sn} .wk-src`))) fails.push('snippet: the source line should name the project dataset')
    await g.click(`${sn} [data-gate="idle"] .btn.primary`)
    await g.waitForSelector(`${sn} textarea`)
    const original = await g.inputValue(`${sn} textarea`)
    if (!/messages\.json/.test(original)) fails.push('snippet: the code should read the project messages')
    await g.click(`${sn} .btn.primary`)
    await g.waitForSelector(`${sn} .wk-output`)
    if (!/stubbed output/.test(await g.textContent(`${sn} .wk-output`))) fails.push('snippet: the output is not shown')
    if (!/ran in/.test(await g.textContent(`${sn} .ctl`))) fails.push('snippet: the run time is not shown')
    await g.fill(`${sn} textarea`, 'print(1)')
    await g.click(`${sn} .btn:has-text("Reset the code")`)
    if ((await g.inputValue(`${sn} textarea`)) !== original) fails.push('snippet: Reset should restore the code')

    if (gErrs.length) fails.push('gate: ' + gErrs.join(' | '))
    if (fetched.length) fails.push(`gate: stubbed checks fetched ${fetched[0]}`)
    await ctx.close()

    // Not supported here: says so, keeps the illustration, downloads nothing
    const none = await b.newContext({ viewport: { width: 1280, height: 900 } })
    await none.addInitScript(() => { delete window.Worker })
    const n = await none.newPage()
    await n.goto(`${BASE}/c9/c9-7?project=travel`, { waitUntil: 'networkidle' })
    await n.waitForSelector(`${rc} [data-gate="unsupported"]`)
    const why = await n.textContent(`${rc} [data-gate="unsupported"]`)
    if (!/Not supported here/.test(why) || !/Web Workers/.test(why) || !/Nothing was downloaded/.test(why)) fails.push(`gate: the unsupported state is unclear: "${why.slice(0, 120)}"`)
    if (await n.$(`${rc} [data-gate="unsupported"] .btn.primary`)) fails.push('gate: an unsupported browser should not be offered the download')
    await none.close()

    // Reduced motion: the bar does not animate
    const calm = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
    await calm.addInitScript(stubWorker, { failFirst: false })
    const c = await calm.newPage()
    await c.goto(`${BASE}/c9/c9-7`, { waitUntil: 'networkidle' })
    await c.evaluate(() => (window.__holdLoad = true))
    await c.click(`${rc} [data-gate="idle"] .btn.primary`)
    await c.waitForSelector(`${rc} .wk-bar i`)
    if ((await c.$eval(`${rc} .wk-bar i`, (e) => getComputedStyle(e).transitionDuration)) !== '0s') fails.push('gate: the progress bar should not animate with reduced motion')
    await calm.close()

    // The Colab guides: real steps, the project's data in the code (unless neutral), and a notebook that opens
    const dl = await b.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true })
    const d = await dl.newPage()
    const cg = kitSel('colab-guide')
    const COLAB = [
      { route: '/c5/c5-6', file: 'decoding-on-a-gpu-travel.ipynb', code: 'nvidia-smi', project: true },
      { route: '/c6/c6-7', file: 'train-a-small-gpt.ipynb', code: 'git checkout -q', project: false },
      { route: '/c13/c13-3', file: 'qlora-fine-tune-travel.ipynb', code: 'load_in_4bit=True', project: true },
      { route: '/c14/c14-7', file: 'vllm-benchmark-travel.ipynb', code: 'vllm==', project: true },
    ]
    for (const g of COLAB) {
      await d.goto(`${BASE}${g.route}?project=travel`, { waitUntil: 'networkidle' })
      await d.waitForSelector(`${cg} .wk-guide li`)
      const guide = await d.textContent(cg)
      if (!/Change runtime type/.test(guide) || !/Disconnect and delete runtime/.test(guide)) fails.push(`colab guide ${g.route}: it should cover GPU setup and giving the GPU back`)
      if (g.project !== /Safarnova/.test(guide)) fails.push(`colab guide ${g.route}: ${g.project ? 'the code should use the selected project' : 'a neutral guide should not name a project'}`)
      const [nbFile] = await Promise.all([d.waitForEvent('download'), d.click(`${cg} .btn:has-text("Download the notebook")`)])
      if (nbFile.suggestedFilename() !== g.file) fails.push(`colab guide ${g.route}: notebook named ${nbFile.suggestedFilename()}`)
      const nb = JSON.parse(fs.readFileSync(await nbFile.path(), 'utf8'))
      if (nb.nbformat !== 4 || !nb.cells.some((x) => x.cell_type === 'code' && x.source.join('').includes(g.code))) fails.push(`colab guide ${g.route}: the notebook is not as expected`)
    }
    await dl.close()
  }

  const kpi = (name, re) =>
    page.$$eval(`${kitSel(name)} .kpi`, (ks, src) => {
      const k = ks.find((x) => new RegExp(src).test(x.querySelector('span').textContent))
      return k ? k.querySelector('b').textContent : null
    }, re)

  // BM25 runs for real over the project's documents
  const chip = (t) => page.click(`${kitSel('bm25')} .wk-chip:has-text("${t}")`)
  const topHit = () => page.textContent(`${kitSel('bm25')} tbody tr:first-child code`)
  await page.goto(BASE + '/c9/c9-3', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('bm25')} .wk-chip`)
  await chip('HTTP 429')
  if ((await topHit()) !== 'HP-013' || (await kpi('bm25', 'with a match')) !== '1') fails.push('bm25: an exact code should find one document, HP-013')
  await chip('cannot log in')
  if ((await topHit()) !== 'HP-014') fails.push('bm25: "cannot log in" should show the vocabulary mismatch (only the audit log)')
  // switching project without a reload swaps the documents and the queries
  await page.click('.pb-tab:nth-child(2)')
  await page.waitForSelector(`${kitSel('bm25')} .wk-src-co:has-text("Bazrova")`)
  await chip('BZ-FOO-1130')
  if ((await topHit()) !== 'BZ-FOO-1130') fails.push('bm25: an exact SKU should rank first for the store project')
  await check('bm25')

  // chunking: strategy and size change the result
  await page.goto(BASE + '/c9/c9-2', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('chunking')} .wk-chunk`)
  if ((await kpi('chunking', 'mix sections')) === '0') fails.push('chunking: 40-word fixed chunks should mix sections')
  const before9 = await kpi('chunking', '^chunks$')
  await page.selectOption(`${kitSel('chunking')} select`, 'section')
  if ((await kpi('chunking', 'mix sections')) !== '0') fails.push('chunking: paragraph-aware chunks should not mix sections')
  if (!(await page.$(`${kitSel('chunking')} .wk-chunk-h`))) fails.push('chunking: paragraph-aware chunks should show their header')
  await page.selectOption(`${kitSel('chunking')} select`, 'fixed')
  await page.locator(`${kitSel('chunking')} input[type=range]`).first().fill('15')
  if (+(await kpi('chunking', '^chunks$')) <= +before9) fails.push('chunking: a smaller chunk size should make more chunks')
  await check('chunking')

  // retrieval metrics: moving the best result to rank 1 raises RR and nDCG, and recall stays the same
  await page.goto(BASE + '/c9/c9-7', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('retrieval-metrics')} .wk-row`)
  const m0 = { recall: await kpi('retrieval-metrics', '^Recall'), rr: await kpi('retrieval-metrics', 'Reciprocal'), ndcg: await kpi('retrieval-metrics', 'nDCG') }
  for (const rank of [4, 3, 2]) await page.click(`${kitSel('retrieval-metrics')} li:nth-child(${rank}) .wk-up`)
  const firstRow = await page.textContent(`${kitSel('retrieval-metrics')} li:first-child .wk-row`)
  if (!firstRow.includes('grade 3')) fails.push(`retrieval metrics: the grade 3 result did not move to rank 1: "${firstRow}"`)
  const m1 = { recall: await kpi('retrieval-metrics', '^Recall'), rr: await kpi('retrieval-metrics', 'Reciprocal'), ndcg: await kpi('retrieval-metrics', 'nDCG') }
  console.log('retrieval metrics:', JSON.stringify(m0), '->', JSON.stringify(m1))
  if (m1.recall !== m0.recall || +m1.rr <= +m0.rr || +m1.ndcg <= +m0.ndcg) fails.push(`retrieval metrics: expected same recall, higher RR and nDCG: ${JSON.stringify([m0, m1])}`)
  if (!(await page.$(`${kitSel('retrieval-metrics')} svg polyline`))) fails.push('retrieval metrics: no chart')
  await page.hover(`${kitSel('retrieval-metrics')} .wk-chart svg rect`)
  if (!(await page.$(`${kitSel('retrieval-metrics')} .wk-tip`))) fails.push('retrieval metrics: chart has no tooltip on hover')
  // retriever comparison: a table row for each retriever, and live metrics
  const rcRows = await page.$$eval(`${kitSel('retriever-compare')} tbody tr`, (x) => x.length)
  if (rcRows !== 3) fails.push(`retriever comparison: expected 3 rows, got ${rcRows}`)
  const rcPrecision = () => page.textContent(`${kitSel('retriever-compare')} tbody tr:first-child td:nth-child(3)`)
  const rc5 = await rcPrecision()
  await page.locator(`${kitSel('retriever-compare')} input[type=range]`).fill('1')
  if ((await page.textContent(`${kitSel('retriever-compare')} thead th:nth-child(2)`)) !== 'Recall@1' || (await rcPrecision()) === rc5) fails.push('retriever comparison: the cutoff did not change the metrics')
  await check('retriever comparison')

  // streaming: plays near the viewport, paints its canvas, and redraws on a theme change
  const canvasHash = () => page.$eval(`${kitSel('streaming')} canvas`, (c) => c.toDataURL())
  const blank = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.every((v) => v === 0)
  await page.goto(BASE + '/c7/c7-4', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('streaming')} canvas`)
  await page.locator(`${kitSel('streaming')} canvas`).scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  const tPlayed = +(await page.inputValue(`${kitSel('streaming')} label:has-text("Time") >> nth=2 >> input`).catch(() => '0'))
  if (!(tPlayed > 0)) fails.push('streaming: did not start playing near the viewport')
  if (await page.$eval(`${kitSel('streaming')} canvas`, blank)) fails.push('streaming: the canvas is blank')
  await page.locator(`${kitSel('streaming')} label:has-text("Time") >> nth=2 >> input`).fill('1')
  const light = await canvasHash()
  await page.click('button[aria-label^="Switch to"]')
  await page.waitForTimeout(150)
  if ((await canvasHash()) === light) fails.push('streaming: the canvas did not redraw on a theme change')
  await page.click('button[aria-label^="Switch to"]')
  await check('streaming')

  // saga: steps forward, and compensates in reverse order
  await page.goto(BASE + '/c11/c11-6?project=travel', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('saga')} .wk-ev`)
  const sagaLog = () => page.$$eval(`${kitSel('saga')} .wk-ev`, (x) => x.map((e) => e.textContent))
  if ((await sagaLog()).length !== 1) fails.push('saga: should start on the first event')
  await page.click(`${kitSel('saga')} .btn.primary`)
  if ((await sagaLog()).length !== 2) fails.push('saga: Next did not add an event')
  if (!/SN-\d+/.test((await sagaLog())[0])) fails.push('saga: the idempotency key should use a booking from the dataset')
  for (let i = 0; i < 12 && (await page.isEnabled(`${kitSel('saga')} .btn.primary`)); i++) await page.click(`${kitSel('saga')} .btn.primary`)
  const undo = (await sagaLog()).filter((t) => t.startsWith('Compensated')).map((t) => +t.match(/Step (\d)/)[1])
  if (undo.join() !== '2,1') fails.push(`saga: compensations should run in reverse order, got ${undo}`)
  await page.selectOption(`${kitSel('saga')} select`, '-1')
  if ((await sagaLog()).length !== 1) fails.push('saga: changing the failure should restart the run')
  await check('saga')

  // context assembler: a small budget drops items, and an oversized reserve drops even must-haves
  const range = (name, n) => page.locator(`${kitSel(name)} input[type=range]`).nth(n)
  await page.goto(BASE + '/c7/c7-3', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('context-assembler')} .wk-stack`)
  const dropped8000 = +(await kpi('context-assembler', '^items dropped'))
  await range('context-assembler', 0).fill('3000')
  if (+(await kpi('context-assembler', '^items dropped')) <= dropped8000) fails.push('context assembler: a smaller budget should drop more items')
  await page.check(`${kitSel('context-assembler')} input[type=checkbox]`)
  if (!(await page.textContent(`${kitSel('context-assembler')} table`)).includes('(from ')) fails.push('context assembler: compression should show the original sizes')
  await range('context-assembler', 0).fill('2000')
  await range('context-assembler', 1).fill('4000')
  if ((await kpi('context-assembler', 'must-have')) === '0') fails.push('context assembler: an oversized reserve should drop must-have items')
  await check('context assembler')

  // memory simulator: a small window loses early facts, and the fact store misses a field it has no slot for
  await page.goto(BASE + '/c7/c7-5?project=travel', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('memory-sim')} table`)
  await range('memory-sim', 0).fill('24')
  await range('memory-sim', 1).fill('2')
  const memRow = (t) => page.$$eval(`${kitSel('memory-sim')} tbody tr`, (rows, x) => [...rows.find((r) => r.textContent.includes(x)).children].map((c) => c.textContent), t)
  const kavya = await memRow('Kavya')
  if (kavya[1] !== '✓ kept' || kavya[2] !== '✗ lost' || kavya[3] !== '◐ gist only' || kavya[4] !== '✗ lost') fails.push(`memory simulator: unexpected row for the last fact: ${kavya}`)
  if ((await memRow('Hindi'))[2] !== '✗ lost') fails.push('memory simulator: a small window should lose an early fact')
  await range('memory-sim', 1).fill('10')
  if ((await memRow('Kavya'))[2] !== '✓ kept') fails.push('memory simulator: a large window should keep a recent fact')
  await check('memory simulator')

  // timeout after a write: the key decides whether the retry makes a duplicate
  await page.goto(BASE + '/c11/c11-6?project=bank', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('timeout-write')} .wk-ev`)
  const twNext = `${kitSel('timeout-write')} .btn.primary`
  const twEnd = async () => {
    while (await page.isEnabled(twNext)) await page.click(twNext)
    return page.$$eval(`${kitSel('timeout-write')} tbody tr`, (x) => x.map((r) => r.textContent))
  }
  if ((await twEnd()).length !== 1) fails.push('timeout write: with a key there should be one record')
  await page.uncheck(`${kitSel('timeout-write')} input[type=checkbox]`)
  if ((await twEnd()).length !== 2) fails.push('timeout write: without a key the retry should create a duplicate')
  await check('timeout write')

  // budget: the approval limit and the budget both change how the run ends
  await page.goto(BASE + '/c11/c11-7', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('budget')} .wk-ev`)
  const bgLog = () => page.$$eval(`${kitSel('budget')} .wk-ev`, (x) => x.map((e) => e.textContent))
  let bg = await bgLog()
  if (!bg.some((t) => t.startsWith('Paused')) || !bg.at(-1).startsWith('Task complete')) fails.push('budget: $80 should pause for approval, then complete')
  await range('budget', 1).fill('40')
  if ((await bgLog()).some((t) => t.startsWith('Paused'))) fails.push('budget: $40 should not need approval')
  await range('budget', 0).fill('0.1')
  bg = await bgLog()
  if (!bg.at(-1).startsWith('Budget exhausted')) fails.push(`budget: $0.10 should stop the task, got "${bg.at(-1)}"`)
  await check('budget')

  // injection: the store's attack is its dataset's review, and a capability limit stops it
  await page.goto(BASE + '/c16/c16-2?project=store', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('injection')} .wk-hidden`)
  if (!(await page.textContent(`${kitSel('injection')} .wk-hidden`)).includes('email the full order history')) fails.push('injection: the store should show the review from its dataset')
  const piLast = () => page.$$eval(`${kitSel('injection')} .wk-ev`, (x) => x[x.length - 1].textContent)
  if (!(await piLast()).includes('exfiltrated')) fails.push('injection: with no defences the data should leave')
  await page.check(`${kitSel('injection')} label:has-text("Read-only tools") input`)
  if (!(await piLast()).includes('prevented')) fails.push('injection: read-only tools should stop the attack')
  await check('injection')

  // cache key: security fields are flagged until present, and each field lowers the hit rate
  await page.goto(BASE + '/c16/c16-4', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('cache-key')} table`)
  if ((await kpi('cache-key', 'unsafe')) !== '6 of 6' || (await kpi('cache-key', 'hit rate')) !== '30.0%') fails.push('cache key: should start with only the question text')
  const ckBoxes = `${kitSel('cache-key')} input[type=checkbox]:not([disabled])`
  for (const box of await page.$$(ckBoxes)) await box.check()
  if ((await kpi('cache-key', 'unsafe')) !== '0 of 6' || (await kpi('cache-key', 'security')) !== 'present') fails.push('cache key: all fields should leave no unsafe scenario')
  if (parseFloat(await kpi('cache-key', 'hit rate')) >= 30) fails.push('cache key: more fields should lower the hit rate')
  if ((await page.$$(`${kitSel('isolation-grid')} tbody .wk-c-fail`)).length !== 1) fails.push('isolation grid: the example state has one failing test')
  await check('cache key')

  // PII: live redaction of the project's message, and names get through
  await page.goto(BASE + '/c16/c16-5?project=bank', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('pii-redact')} .wk-redacted`)
  const piiOut = () => page.textContent(`${kitSel('pii-redact')} .wk-redacted`)
  const pii0 = await piiOut()
  if (!/\[EMAIL_1\]/.test(pii0) || !/\[CARD_1\]/.test(pii0) || !/\[PHONE_1\]/.test(pii0) || pii0.includes('4111') || !pii0.includes('Kiran')) fails.push(`pii: unexpected redaction: "${pii0}"`)
  await page.fill(`${kitSel('pii-redact')} textarea`, 'Write to a@example.com or b@example.com')
  if (!(await piiOut()).includes('[EMAIL_2]')) fails.push('pii: editing the text should redact again')
  await check('pii')

  // agent loop: the limit and the injected failure each end the run early
  const events = (name) => page.$$eval(`${kitSel(name)} .wk-ev`, (x) => x.map((e) => e.textContent))
  await page.goto(BASE + '/c11/c11-2', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('agent-loop')} .wk-ev`)
  if (!(await events('agent-loop')).at(-1).startsWith('Step 6, Final answer')) fails.push('agent loop: the default run should reach its final answer')
  await range('agent-loop', 0).fill('3')
  if (!(await events('agent-loop')).at(-1).startsWith('Step limit')) fails.push('agent loop: a limit of 3 should stop the run')
  await range('agent-loop', 0).fill('10')
  await page.check(`${kitSel('agent-loop')} input[type=checkbox]`)
  if (!(await events('agent-loop')).at(-1).startsWith('Step 5, Stopped')) fails.push('agent loop: a failing tool should end in escalation')
  await check('agent loop')

  // token estimator: real messages per language, feeding the cost figures
  await page.goto(BASE + '/c1/c1-4?project=store', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('token-estimator')} .wk-chip`)
  const tkCount = () => page.textContent(`${kitSel('token-estimator')} .wk-count-l`)
  const tk0 = await tkCount()
  await page.click(`${kitSel('token-estimator')} .wk-chip:has-text("Hindi")`)
  if ((await tkCount()) === tk0 || !/[\u0900-\u097F]/.test(await page.inputValue(`${kitSel('token-estimator')} textarea`))) fails.push('token estimator: the Hindi chip should load a Hindi message')
  const costBefore = await kpi('token-estimator', 'cost per day')
  await page.click(`${kitSel('token-estimator')} .btn:has-text("Use as input tokens")`)
  if ((await kpi('token-estimator', 'cost per day')) === costBefore) fails.push('token estimator: using the text as input should change the cost')
  await check('token estimator')

  // class imbalance: starts at the project's real rate, and weights raise recall
  await page.goto(BASE + '/c3/c3-3?project=bank', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('class-imbalance')} canvas`)
  if (!(await page.textContent(`${kitSel('class-imbalance')} select option:first-child`)).includes('1.4%')) fails.push('class imbalance: the bank’s fraud rate should be 1.4%')
  const recall0 = parseFloat(await kpi('class-imbalance', '^recall'))
  await page.check(`${kitSel('class-imbalance')} input[type=checkbox]`)
  if (parseFloat(await kpi('class-imbalance', '^recall')) <= recall0) fails.push('class imbalance: class weights should raise recall')
  await check('class imbalance')

  // RRF: a document found by both rankings is marked, and k changes the scores
  await page.goto(BASE + '/c9/c9-5', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('rrf')} .wk-cols`)
  const fused = () => page.$$eval(`${kitSel('rrf')} .card:last-child li`, (x) => x.map((l) => l.textContent))
  const f60 = await fused()
  if (!f60[0].includes('both')) fails.push('rrf: a document both rankings found should lead')
  await range('rrf', 0).fill('1')
  if ((await fused()).join() === f60.join()) fails.push('rrf: k should change the scores')
  await check('rrf')

  // trace and critical path
  await page.goto(BASE + '/c17/c17-2?project=travel', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('trace-waterfall')} button.wk-tb-r`)
  await page.click(`${kitSel('trace-waterfall')} button.wk-tb-r:has-text("execute_tool")`)
  if (!/booking_id = SN-\d+/.test(await page.textContent(`${kitSel('trace-waterfall')} .out`))) fails.push('trace waterfall: the tool span should show its booking')
  if ((await kpi('critical-path', 'end to end')) !== '5.25 s') fails.push('critical path: the default total should be 5.25 s')
  await range('critical-path', 1).fill('300')
  if ((await kpi('critical-path', 'end to end')) !== '5.49 s' || (await kpi('critical-path', 'off the critical')) !== 'vector search') fails.push('critical path: a slower BM25 should join the path')
  await page.check(`${kitSel('critical-path')} input[type=checkbox]`)
  if ((await kpi('critical-path', 'end to end')) !== '7.49 s') fails.push('critical path: the retry should add 2 s')
  await check('trace and critical path')

  // cost attribution: three groupings of one month
  await page.goto(BASE + '/c17/c17-5?project=store', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('cost-attribution')} .bars`)
  await page.click(`${kitSel('cost-attribution')} .btn:has-text("By tenant")`)
  if (!(await page.textContent(`${kitSel('cost-attribution')} .bars`)).includes('31.0%')) fails.push('cost attribution: one tenant should be 31% of spend')
  await check('cost attribution')

  // BPE: merges apply, and it can train on the project's text
  await page.goto(BASE + '/c5/c5-1', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('bpe')} .wk-chip`)
  const bpeBtn = (t) => `${kitSel('bpe')} .btn:has-text("${t}")`
  await page.click(bpeBtn('Apply next merge'))
  if (!/^Merge 1:/.test(await page.textContent(`${kitSel('bpe')} .wk-one-line`))) fails.push('bpe: the first merge should be described')
  await page.click(bpeBtn('Run 12 merges'))
  if (!(await page.$(`${kitSel('bpe')} .wk-tok.made`))) fails.push('bpe: merged tokens should be marked')
  await page.click(`${kitSel('bpe')} .wk-chip:has-text("Tidewell")`)
  if (!/^Initial state/.test(await page.textContent(`${kitSel('bpe')} .wk-one-line`))) fails.push('bpe: new text should restart training')
  await check('bpe')

  // attention: the mask and a selected row
  await page.goto(BASE + '/c5/c5-2', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('attention')} table`)
  const masked = () => page.$$eval(`${kitSel('attention')} .wk-c-na`, (x) => x.length)
  if ((await masked()) !== 10) fails.push('attention: the causal mask should hide 10 cells')
  await page.uncheck(`${kitSel('attention')} input[type=checkbox]`)
  if ((await masked()) !== 0) fails.push('attention: without the mask no cell is hidden')
  await page.click(`${kitSel('attention')} .wk-rowpick:has-text("server")`)
  if (!(await page.textContent(`${kitSel('attention')} .out`)).startsWith('“server”')) fails.push('attention: selecting a row should describe it')
  await check('attention')

  // HNSW and gradient descent: canvases that paint and respond
  const painted = (name) => page.$eval(`${kitSel(name)} canvas`, (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v) => v !== 0))
  await page.goto(BASE + '/c9/c9-4', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('hnsw')} canvas`)
  await page.waitForTimeout(200)
  if (!(await painted('hnsw'))) fails.push('hnsw: the canvas is blank')
  if (!/distance computations/.test(await page.textContent(`${kitSel('hnsw')} .count`))) fails.push('hnsw: should report its distance computations')
  await page.click(`${kitSel('hnsw')} .btn:has-text("Step")`)
  if (!/^Step 0 of/.test(await page.textContent(`${kitSel('hnsw')} .count`))) fails.push('hnsw: Step after a finished search should start a new one')
  await page.goto(BASE + '/c2/c2-3', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('gradient-descent')} canvas`)
  await page.waitForTimeout(200)
  if (!(await painted('gradient-descent'))) fails.push('gradient descent: the canvas is blank')
  await page.click(`${kitSel('gradient-descent')} .btn:has-text("One step")`)
  if (!/^Step 1:/.test(await page.textContent(`${kitSel('gradient-descent')} .count`))) fails.push('gradient descent: One step should advance')
  await page.click(`${kitSel('gradient-descent')} .btn:has-text("Reset")`)
  if (!/^Step 0:/.test(await page.textContent(`${kitSel('gradient-descent')} .count`))) fails.push('gradient descent: Reset should return to the start')

  // 3D scenes: mount near the viewport, step through, turn with the keyboard, and show the same step in 2D
  for (const [name, route] of [['multihead', '/c5/c5-2'], ['transformer-block', '/c5/c5-3'], ['hnsw-layers', '/c9/c9-4'], ['zero-sharding', '/c6/c6-6'], ['paged-kv-3d', '/c14/c14-3'], ['embedding-space', '/c9/c9-3'], ['failover-globe', '/c15/c15-7']]) {
    const sel = kitSel(name)
    await page.goto(BASE + route, { waitUntil: 'networkidle' })
    await page.locator(sel).scrollIntoViewIfNeeded()
    const gl = await page.waitForSelector(`${sel} .s3-canvas canvas`, { timeout: 15000 }).catch(() => null)
    if (!gl) {
      fails.push(`${name}: the 3D view did not mount`)
      continue
    }
    const first = await page.textContent(`${sel} .s3-text`)
    let steps = 1
    if (await page.$(`${sel} .wk-player`)) {
      while (!(await page.isDisabled(`${sel} .wk-player .btn.primary`)) && steps < 40) {
        await page.click(`${sel} .wk-player .btn.primary`)
        steps++
      }
    } else {
      // embedding-space has two views instead of a player
      await page.click(`${sel} [role=radio]:has-text("All points")`)
      steps = 2
    }
    if (first === (await page.textContent(`${sel} .s3-text`))) fails.push(`${name}: stepping should change the description`)
    if ((await page.$$eval(`${sel} .s3-all li`, (l) => l.length)) !== steps) fails.push(`${name}: the description in words should cover all ${steps} steps`)
    await page.focus(`${sel} .s3-canvas`)
    for (const key of ['ArrowRight', 'ArrowUp', '+', '0']) await page.keyboard.press(key)
    await page.click(`${sel} [role=radio]:has-text("2D view")`)
    if (!(await page.$$eval(`${sel} :is(.s3-grid, .s3-map, .s3-table table)`, (g) => g.length))) fails.push(`${name}: the 2D view shows nothing`)
    if (await page.$(`${sel} canvas`)) fails.push(`${name}: the 2D view should replace the 3D canvas`)
    await page.click(`${sel} [role=radio]:has-text("3D view")`)
    await page.waitForSelector(`${sel} .s3-canvas canvas`, { timeout: 15000 }).catch(() => fails.push(`${name}: the 3D view did not come back`))
    await check(name)
  }

  // Walkthroughs: the pinned diagram follows the step in the middle of the screen, on every story
  for (const [route, id] of [['/c9/c9-1', 'rag'], ['/c11/c11-2', 'agent'], ['/c14/c14-2', 'serving'], ['/c6/c6-4', 'training']]) {
    const sel = `#walk-${id} ${kitSel('walkthrough')}`
    await page.goto(BASE + route, { waitUntil: 'networkidle' })
    await page.waitForSelector(`${sel} .wt-steps li`)
    const n = await page.$$eval(`${sel} .wt-steps li`, (l) => l.length)
    await page.$eval(`${sel} .wt-steps li:nth-child(4)`, (el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForFunction((s) => /^Step [3-5] of/.test(document.querySelector(`${s} .wt-now`)?.textContent ?? ''), sel, { timeout: 5000 }).catch(() => {})
    const now = await page.textContent(`${sel} .wt-now`)
    if (!/^Step [3-5] of/.test(now)) fails.push(`walkthrough ${id}: scrolling to step 4 should move the diagram there, got "${now}"`)
    if (!(await page.$(`${sel} .wt-node.on`))) fails.push(`walkthrough ${id}: no stage is highlighted`)
    if (n < 6) fails.push(`walkthrough ${id}: only ${n} steps`)
    const top = await page.$eval(`${sel} .wt-fig`, (el) => el.getBoundingClientRect().top)
    if (top < 0 || top > 120) fails.push(`walkthrough ${id}: the diagram should stay pinned near the top, at ${Math.round(top)}px`)
    await check(`walkthrough ${id}`)
  }
  await check('hnsw and gradient descent')

  // threshold and reliability
  await page.goto(BASE + '/c3/c3-5', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('threshold-roc')} svg`)
  const recall50 = parseFloat(await kpi('threshold-roc', '^recall'))
  await range('threshold-roc', 0).fill('0.2')
  if (parseFloat(await kpi('threshold-roc', '^recall')) <= recall50) fails.push('threshold: a lower threshold should raise recall')
  if ((await page.$$(`${kitSel('threshold-roc')} svg`)).length !== 2) fails.push('threshold: there should be two curves')
  if (!(await page.textContent(`${kitSel('reliability')} svg`)).includes('ECE')) fails.push('reliability: the diagram should state its ECE')
  await check('threshold and reliability')

  // inference serving on 14.3
  await page.goto(BASE + '/c14/c14-3', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('batching')} canvas`)
  const decodeSteps = () => kpi('batching', 'decode steps')
  const continuous = +(await decodeSteps())
  await page.selectOption(`${kitSel('batching')} select`, 'static')
  if (+(await decodeSteps()) <= continuous) fails.push('batching: static should take more steps than continuous')
  const blocks = () => page.$$eval(`${kitSel('paged-kv')} .wk-block:not(.free)`, (x) => x.length)
  if ((await blocks()) !== 6) fails.push('paged KV: sharing should start with 6 blocks')
  await page.uncheck(`${kitSel('paged-kv')} input[type=checkbox]`)
  if ((await blocks()) !== 10) fails.push('paged KV: without sharing it should start with 10 blocks')
  await page.click(`${kitSel('paged-kv')} .btn.primary`)
  if (!(await page.textContent(`${kitSel('paged-kv')} .count`)).startsWith('Step 1')) fails.push('paged KV: the step should advance')
  const ttft = await kpi('prefix-cache', 'average first token')
  if (ttft !== '280 ms') fails.push(`prefix cache: the default average should be 280 ms, got ${ttft}`)
  await range('prefix-cache', 2).fill('0.2')
  if ((await kpi('prefix-cache', 'average first token')) !== '640 ms') fails.push('prefix cache: a 20% hit rate should give 640 ms')
  await check('serving widgets')

  // throughput vs latency
  await page.goto(BASE + '/c14/c14-7', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('throughput-latency')} svg`)
  if ((await kpi('throughput-latency', 'largest batch')) !== '184') fails.push('throughput: the largest batch under 50 ms should be 184')
  await range('throughput-latency', 0).fill('200')
  const itlOver = await page.$(`${kitSel('throughput-latency')} .kpi.bad`)
  if (!itlOver) fails.push('throughput: batch 200 should break the latency target')
  await check('throughput')

  // queue simulation
  await page.goto(BASE + '/c15/c15-1', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('queue-sim')} canvas`)
  const wait0 = await kpi('queue-sim', 'mean wait')
  await page.click(`${kitSel('queue-sim')} .btn.primary`)
  if ((await kpi('queue-sim', 'mean wait')) === wait0) fails.push('queue: running again should give a new run')
  await range('queue-sim', 0).fill('12')
  if (!(await kpi('queue-sim', '^state')).startsWith('unstable')) fails.push('queue: 150% utilisation should be unstable')
  await check('queue')

  // burn rate: a slow leak never pages fast
  await page.goto(BASE + '/c17/c17-8', { waitUntil: 'networkidle' })
  await page.waitForSelector(`${kitSel('burn-rate')} canvas`)
  if ((await kpi('burn-rate', 'first fast page')) === 'none') fails.push('burn rate: a sharp incident should page')
  await page.selectOption(`${kitSel('burn-rate')} select >> nth=0`, 'leak')
  if ((await kpi('burn-rate', 'first fast page')) !== 'none') fails.push('burn rate: a slow leak should not trip the fast rule')
  await check('burn rate')

  // reduced motion: end states appear at once, and Play jumps to the end
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
    const rm = await ctx.newPage()
    await rm.goto(BASE + '/c7/c7-4', { waitUntil: 'networkidle' })
    await rm.waitForSelector(`${kitSel('streaming')} .wk-stream`)
    const outs = await rm.$$eval(`${kitSel('streaming')} .wk-stream`, (x) => x.map((e) => e.textContent))
    if (outs[0] !== outs[1] || outs[0].includes('waiting')) fails.push('reduced motion: streaming should show the finished answer in both panes')
    await rm.goto(BASE + '/c11/c11-6', { waitUntil: 'networkidle' })
    await rm.waitForSelector(`${kitSel('saga')} .wk-ev`)
    await rm.click(`${kitSel('saga')} .btn:has-text("Play")`)
    const last = await rm.$$eval(`${kitSel('saga')} .wk-ev`, (x) => x[x.length - 1].textContent)
    if (!last.startsWith('Saga ended')) fails.push(`reduced motion: Play should jump to the last event, got "${last}"`)
    await ctx.close()
  }

  // a dataset that fails to load shows a message and can be retried
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } })
    const off = await ctx.newPage()
    await off.route('**/datasets/**', (r) => r.abort())
    await off.goto(BASE + '/c9/c9-3', { waitUntil: 'networkidle' })
    await off.waitForSelector(`${kitSel('bm25')} [role=alert]`)
    await off.unroute('**/datasets/**')
    await off.click(`${kitSel('bm25')} [role=alert] .btn`)
    const back = await off.waitForSelector(`${kitSel('bm25')} .wk-chip`, { timeout: 15000 }).catch(() => null)
    if (!back) fails.push('widget data: Try again did not recover after a failed load')
    await ctx.close()
  }

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
  // progress counts the chapters and the capstone, not the appendices
  const required = manifest.chapters.filter((c) => c.kind !== 'appendix')
  const requiredTopics = required.reduce((n, c) => n + c.topics.length, 0)
  if (!ring.includes(`of ${requiredTopics} topics`)) fails.push(`progress total should be ${requiredTopics}: "${ring}"`)
  const capstoneTopic = manifest.chapters.find((c) => c.kind === 'capstone').topics[0].id
  await page.goto(`${BASE}/capstone/${capstoneTopic}`, { waitUntil: 'networkidle' })
  await page.click('.studied-toggle')
  if (!/^2 of/.test(await page.getAttribute('.top-prog', 'title'))) fails.push('a capstone topic did not count towards progress')
  await page.click('.studied-toggle')

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
  // the wrong answer joined the flashcard deck; review it once
  await page.goto(BASE + '/flashcards', { waitUntil: 'networkidle' })
  await page.waitForSelector('.fc-card')
  const dueBefore = +(await page.textContent('.fc-stats li:nth-child(2) b'))
  await page.keyboard.press(' ')
  await page.waitForSelector('.fc-back')
  const grades = await page.$$eval('.fc-grades .btn small', (x) => x.map((e) => e.textContent))
  if (grades.length !== 4) fails.push('flashcards: expected four grade buttons with their waits')
  await page.keyboard.press('3')
  await page.waitForTimeout(150)
  const dueAfter = +(await page.textContent('.fc-stats li:nth-child(2) b'))
  console.log('flashcards due:', dueBefore, '->', dueAfter)
  if (!(dueBefore >= 1 && dueAfter === dueBefore - 1)) fails.push(`flashcards: grading should take the card out of "due now" (${dueBefore} -> ${dueAfter})`)
  await checkHeadings('flashcards with a card')

  // glossary: a term in the text shows its card, and its link opens the glossary entry
  await page.goto(BASE + '/c5/c5-1', { waitUntil: 'networkidle' })
  await page.hover('a.gl[href="#gl-bpe"]')
  await page.waitForSelector('#gl-tip')
  if (!/Byte-pair encoding/.test(await page.textContent('#gl-tip'))) fails.push('glossary: the hover card does not show the term')
  if ((await page.getAttribute('a.gl[href="#gl-bpe"]', 'aria-describedby')) !== 'gl-tip') fails.push('glossary: the term is not described by its card')
  await page.keyboard.press('Escape')
  await page.click('a.gl[href="#gl-bpe"]')
  await page.waitForSelector('#gl-bpe.hit')
  if (!page.url().endsWith('/glossary#gl-bpe')) fails.push(`glossary: the term link went to ${page.url()}`)
  // the topic's parts lead its contents
  await page.goto(BASE + '/c5/c5-2', { waitUntil: 'networkidle' })
  const rail = await page.$$eval('.t-rail a.rk-part', (x) => x.map((a) => a.textContent))
  if (rail.join() !== 'Intuition,Mechanism,The numbers,Code,Primary sources') fails.push(`topic parts in the rail: ${rail.join(', ')}`)

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
  const hmRows = await r.$$eval('.hm-row', (x) => x.map((e) => ({ href: e.querySelector('.hm-ch').getAttribute('href'), check: e.querySelector('a.hm-check')?.getAttribute('href') })))
  const hmCap = hmRows.find((x) => x.href.endsWith('/capstone'))
  if (!hmCap) fails.push('progress page: no capstone row')
  else if (hmCap.check) fails.push('progress page: capstone row links to a check page that does not exist')
  if (hmRows.some((x) => /\/app-/.test(x.href))) fails.push('progress page: an appendix has a row')
  // practice page filter: All and None, with a count
  await r.goto(BASE + '/practice', { waitUntil: 'networkidle' })
  const chipCount = () => r.$$eval('.pf-chips .lchip.on', (x) => x.length)
  const allChips = await chipCount()
  await r.click('.pf-row .linkish:text-is("None")')
  if ((await chipCount()) !== 0) fails.push('practice page: None did not clear the chapters')
  if (!(await r.isDisabled('.pm-bar .btn.primary'))) fails.push('practice page: a set can be drawn with no chapters selected')
  await r.click('.pf-row .linkish:text-is("All")')
  if ((await chipCount()) !== allChips) fails.push('practice page: All did not select every chapter')
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
  if (!ph.includes(String(manifest.chapters.filter((c) => c.kind !== 'appendix').reduce((n, c) => n + c.topics.length, 0)))) fails.push(`search placeholder count looks wrong: "${ph}"`)
  await r.close()
  if (errs.length) fails.push('readability checks: ' + errs.join(' | '))

  // 9. keyboard: v3 regions that scroll sideways take a tab stop, those that fit do not, at desktop and phone widths
  for (const width of [1280, 375]) {
    const k = await b.newPage({ viewport: { width, height: 900 } })
    for (const route of ['/c7/c7-4', '/c11/c11-6']) {
      await k.goto(BASE + route, { waitUntil: 'networkidle' })
      await k.waitForTimeout(400)
      const wrong = await k.evaluate(() => [...document.querySelectorAll('pre, .flow .track, .tw')].filter((el) => !el.closest('[data-kit-widget]') && (el.scrollWidth > el.clientWidth) !== el.hasAttribute('tabindex')).map((el) => el.className || el.tagName))
      if (wrong.length) fails.push(`keyboard ${route} at ${width}: tab stop does not match overflow on ${wrong.join(', ')}`)
    }
    await k.close()
  }

  // 10. accessibility: no serious or critical axe violations on the review pages and the topic pages with a React widget, in both themes
  const axeProblems = await runAxe(b, BASE)
  console.log('axe serious or critical violations:', axeProblems.length)
  fails.push(...axeProblems.map((p) => 'axe: ' + p))

  await b.close()
  console.log(fails.length ? 'FAILURES:\n- ' + fails.join('\n- ') : 'ALL CHECKS PASSED')
  process.exit(fails.length ? 1 : 0)
})()
