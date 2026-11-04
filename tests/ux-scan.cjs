/* UX report for the eight review pages at desktop and phone width: text under 12 px, targets under 24 px and
   sideways scroll. Figures, widgets and code are skipped. It only reports: nothing here fails yet.
   Usage, against a served build: node tests/ux-scan.cjs [baseUrl] [--shots=name]
   --shots also saves screenshots of each page in both themes to tests/out/ux/<name>, for before-and-after review. */
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const args = process.argv.slice(2)
const BASE = (args.find((a) => !a.startsWith('--')) || 'http://localhost:4173').replace(/\/$/, '')
const shots = args.find((a) => a.startsWith('--shots='))?.split('=')[1]
const OUT = shots && path.join(__dirname, 'out', 'ux', shots)
if (OUT) fs.mkdirSync(OUT, { recursive: true })

const PAGES = [['home', '/'], ['guide', '/guide'], ['chapter', '/c9'], ['topic', '/c9/c9-3'], ['check', '/c5/check'], ['practice', '/practice'], ['progress', '/progress'], ['paths', '/paths']]
const SIZES = [['desktop', 1440, 900], ['phone', 390, 844]]

const scan = () => {
  const SKIP = 'figure,svg,pre,code,.wid,script,style,.sr-only'
  const name = (e) => `${e.tagName.toLowerCase()}${e.classList[0] ? '.' + e.classList[0] : ''}`
  const count = (m, k) => m.set(k, (m.get(k) || 0) + 1)
  const smallText = new Map()
  let textTotal = 0
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    const e = node.parentElement
    if (!node.textContent.trim() || !e || e.closest(SKIP) || e.closest('.side:not(.open)')) continue
    const box = e.getBoundingClientRect()
    const cs = getComputedStyle(e)
    if (!box.width || !box.height || cs.visibility === 'hidden') continue
    textTotal++
    const size = parseFloat(cs.fontSize)
    if (size < 11.95) count(smallText, `${name(e)} ${size.toFixed(1)}px`)
  }
  const smallTargets = new Map()
  for (const e of document.querySelectorAll('main a[href],main button,.topbar a,.topbar button')) {
    const box = e.getBoundingClientRect()
    // links inside a sentence or list item are exempt from the WCAG target size
    if (!box.width || !box.height || e.closest('figure,.wid,p,li') || (box.height >= 24 && box.width >= 24)) continue
    count(smallTargets, `${name(e)} ${Math.round(box.width)}x${Math.round(box.height)}`)
  }
  return {
    textTotal,
    smallText: [...smallText],
    smallTargets: [...smallTargets],
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }
}

const list = (rows) => rows.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${n}x ${k}`).join(' | ')

;(async () => {
  const browser = await chromium.launch()
  for (const colorScheme of OUT ? ['light', 'dark'] : ['light']) {
    for (const [sizeName, width, height] of SIZES) {
      const page = await browser.newPage({ viewport: { width, height }, colorScheme })
      for (const [name, url] of PAGES) {
        await page.goto(BASE + url, { waitUntil: 'networkidle' })
        await page.waitForTimeout(700)
        if (OUT) await page.screenshot({ path: path.join(OUT, `${name}-${sizeName}-${colorScheme}.png`) })
        if (colorScheme !== 'light') continue
        const r = await page.evaluate(scan)
        const small = r.smallText.reduce((n, [, c]) => n + c, 0)
        console.log(`${name} (${sizeName}): text under 12 px ${small}/${r.textTotal}, targets under 24 px ${r.smallTargets.reduce((n, [, c]) => n + c, 0)}, sideways scroll ${r.overflow}px`)
        if (small) console.log('   text: ' + list(r.smallText))
        if (r.smallTargets.length) console.log('   targets: ' + list(r.smallTargets))
      }
      await page.close()
    }
  }
  await browser.close()
})()
