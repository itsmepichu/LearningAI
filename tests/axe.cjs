/* Accessibility check with axe: the review pages and the topic pages with a React widget, as whole pages, in both themes. Fails on serious or critical violations.
   Part of tests/e2e.cjs. To run it alone, against a served build: node tests/axe.cjs [baseUrl] */
const { chromium } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')

const PAGES = ['/', '/guide', '/c9', '/c9/c9-3', '/c5/check', '/practice', '/progress']
// Topic pages with a React widget from src/widgets/kit beside v3 flow steppers, code blocks and tables.
const WIDGET_PAGES = ['/c9/c9-2', '/c9/c9-7', '/c7/c7-4', '/c11/c11-6']

async function runAxe(browser, base) {
  const problems = []
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme, reducedMotion: 'reduce' })
    const page = await context.newPage()
    for (const url of [...PAGES, ...WIDGET_PAGES]) {
      await page.goto(base + url, { waitUntil: 'networkidle' })
      // Sections that fade in on scroll must finish, or axe measures them part-way through.
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 60))
        }
        window.scrollTo(0, 0)
      })
      await page.waitForTimeout(700)
      const builder = new AxeBuilder({ page })
      const { violations } = await builder.analyze()
      for (const v of violations) {
        if (v.impact !== 'serious' && v.impact !== 'critical') continue
        const where = [...new Set(v.nodes.map((n) => n.target.join(' ')))]
        problems.push(`${url} (${colorScheme}) ${v.impact} ${v.id}, ${where.length} element${where.length === 1 ? '' : 's'}: ${where.slice(0, 4).join(' | ')}`)
      }
    }
    await context.close()
  }
  return problems
}

module.exports = { runAxe }

if (require.main === module) {
  const base = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '')
  ;(async () => {
    const browser = await chromium.launch()
    const problems = await runAxe(browser, base)
    await browser.close()
    console.log(problems.length ? problems.join('\n') : 'axe: no serious or critical violations')
    process.exit(problems.length ? 1 : 0)
  })()
}
