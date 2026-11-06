/**
 * Typesets the TeX in a content fragment with KaTeX. Content marks math as `<span class="math">` (inline) or
 * `<div class="math">` (display). KaTeX and its stylesheet are loaded only when a page has math, so other pages do not
 * pay for them. The output includes MathML, which screen readers read; the visible layout is KaTeX's HTML.
 * The content checker parses every formula at build time, so a TeX error fails the build rather than the page.
 */
export async function renderMath(root: HTMLElement): Promise<void> {
  const els = [...root.querySelectorAll<HTMLElement>('.math:not([data-tex])')]
  if (!els.length) return
  const [{ default: katex }] = await Promise.all([import('katex'), import('katex/dist/katex.min.css')])
  const display: HTMLElement[] = []
  for (const el of els) {
    if (!el.isConnected || el.dataset.tex !== undefined) continue
    const tex = el.textContent ?? ''
    el.dataset.tex = tex
    katex.render(tex, el, { displayMode: el.tagName === 'DIV', throwOnError: false, output: 'htmlAndMathml' })
    if (el.tagName === 'DIV') display.push(el)
  }
  // A formula wider than the column scrolls sideways (on a phone, say); it then takes a tab stop so the keyboard can scroll it.
  if (!display.length || typeof ResizeObserver === 'undefined') return
  const fit = (el: HTMLElement) => {
    if (el.scrollWidth > el.clientWidth + 1) {
      el.tabIndex = 0
      el.setAttribute('role', 'group')
      el.setAttribute('aria-label', 'Formula, scrolls sideways')
    } else {
      el.removeAttribute('tabindex')
      el.removeAttribute('role')
      el.removeAttribute('aria-label')
    }
  }
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      if (!e.target.isConnected) ro.unobserve(e.target)
      else fit(e.target as HTMLElement)
    }
  })
  for (const el of display) ro.observe(el)
}
