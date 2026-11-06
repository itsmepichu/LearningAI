/* Accessibility check with axe: the review pages and the topic pages with a React widget, as whole pages, in both themes. Fails on serious or critical violations.
   Part of tests/e2e.cjs. To run it alone, against a served build: node tests/axe.cjs [baseUrl] */
const { chromium } = require('playwright')
const { AxeBuilder } = require('@axe-core/playwright')

// /c8/c8-3 is here for the number inputs in its v3 kappa figure.
const PAGES = ['/', '/guide', '/c9', '/c9/c9-3', '/c8/c8-3', '/c5/check', '/practice', '/progress', '/glossary', '/flashcards']
// Topic pages with a React widget from src/widgets/kit beside v3 flow steppers, code blocks and tables.
const WIDGET_PAGES = ['/c15/c15-7', '/c14/c14-2', '/c9/c9-1', '/c6/c6-4', '/app-a/app-a-run', '/c1/c1-4', '/c2/c2-1', '/c2/c2-3', '/c2/c2-5', '/c3/c3-2', '/c3/c3-3', '/c3/c3-5', '/c5/c5-1', '/c5/c5-2', '/c5/c5-3', '/c5/c5-4', '/c5/c5-5', '/c5/c5-6', '/c5/c5-7', '/c6/c6-6', '/c6/c6-7', '/c7/c7-3', '/c7/c7-4', '/c7/c7-5', '/c9/c9-2', '/c9/c9-3', '/c9/c9-4', '/c9/c9-5', '/c9/c9-7', '/c11/c11-2', '/c11/c11-6', '/c11/c11-7', '/c13/c13-3', '/c14/c14-3', '/c14/c14-7', '/c15/c15-1', '/c16/c16-2', '/c16/c16-4', '/c16/c16-5', '/c17/c17-2', '/c17/c17-5', '/c17/c17-8', '/c1/c1-1', '/c1/c1-2', '/c1/c1-3', '/c1/c1-5', '/c1/c1-6', '/c2/c2-2', '/c2/c2-4', '/c2/c2-6', '/c3/c3-1', '/c3/c3-4', '/c3/c3-6', '/c4/c4-1', '/c4/c4-2', '/c4/c4-3', '/c4/c4-4', '/c4/c4-5', '/c4/c4-6', '/c6/c6-1', '/c6/c6-2', '/c6/c6-3', '/c6/c6-5', '/c7/c7-1', '/c7/c7-2', '/c7/c7-6', '/c7/c7-7', '/c8/c8-1', '/c8/c8-2', '/c8/c8-3', '/c8/c8-4', '/c8/c8-5', '/c8/c8-6', '/c8/c8-7', '/c8/c8-8', '/c9/c9-6', '/c10/c10-1', '/c10/c10-2', '/c10/c10-3', '/c10/c10-4', '/c10/c10-5', '/c10/c10-6', '/c10/c10-7', '/c10/c10-8', '/c10/c10-9', '/c11/c11-1', '/c11/c11-3', '/c11/c11-4', '/c11/c11-5', '/c11/c11-8', '/c12/c12-1', '/c12/c12-2', '/c12/c12-3', '/c12/c12-4', '/c12/c12-5', '/c12/c12-6', '/c12/c12-7', '/c12/c12-8', '/c13/c13-1', '/c13/c13-2', '/c13/c13-4', '/c13/c13-5', '/c13/c13-6', '/c13/c13-7', '/c14/c14-1', '/c14/c14-4', '/c14/c14-5', '/c14/c14-6', '/c14/c14-8', '/c15/c15-2', '/c15/c15-3', '/c15/c15-4', '/c15/c15-5', '/c15/c15-6', '/c15/c15-8', '/c15/c15-9', '/c15/c15-10', '/c16/c16-1', '/c16/c16-3', '/c16/c16-6', '/c16/c16-7', '/c16/c16-8', '/c17/c17-1', '/c17/c17-3', '/c17/c17-4', '/c17/c17-6', '/c17/c17-7', '/c17/c17-9', '/c17/c17-10', '/c18/c18-1', '/c18/c18-2', '/c18/c18-3', '/c18/c18-4', '/c18/c18-5', '/c18/c18-6', '/c18/c18-7', '/capstone/app-c-ms', '/capstone/app-c-int']

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
