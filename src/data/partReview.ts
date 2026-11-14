/** The part review: a fixed-size mixed set drawn across a part's chapters, core questions first. Plain logic, no React. */
export const PART_REVIEW_SIZE = 20
/** How many of the set are interview questions; the rest are choose-the-answer. */
export const PART_REVIEW_INTERVIEW = 4

export interface ReviewItem {
  type: 'mcq' | 'iv'
  ch: string
  q: { id: string; tier?: string; level?: string }
}

function shuffled<T>(a: T[], rand: () => number): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

/** Take `n` items in turn from each chapter's list, so no chapter dominates. */
function roundRobin<T extends ReviewItem>(lists: T[][], n: number): T[] {
  const out: T[] = []
  for (let i = 0; out.length < n; i++) {
    let any = false
    for (const l of lists) {
      if (i < l.length) {
        any = true
        if (out.length < n) out.push(l[i])
      }
    }
    if (!any) break
  }
  return out
}

/**
 * Draw the review: choose-the-answer questions first from the core tier of each chapter in turn, then from the rest;
 * plus a few interview questions at fundamentals or applied level (system design stays behind the Interview prep switch).
 */
export function pickPartReview<T extends ReviewItem>(items: T[], chapters: string[], rand: () => number = Math.random): T[] {
  const mcqLists = chapters.map((c) => {
    const mine = shuffled(items.filter((i) => i.type === 'mcq' && i.ch === c), rand)
    return [...mine.filter((i) => i.q.tier === 'core'), ...mine.filter((i) => i.q.tier !== 'core')]
  })
  const ivLists = chapters.map((c) => shuffled(items.filter((i) => i.type === 'iv' && i.ch === c && i.q.level !== 'system-design'), rand))
  const iv = roundRobin(ivLists, PART_REVIEW_INTERVIEW)
  const mcq = roundRobin(mcqLists, PART_REVIEW_SIZE - iv.length)
  // interleave: mostly choose-the-answer, an interview question after each fourth
  const out: T[] = []
  let k = 0
  for (const m of mcq) {
    out.push(m)
    if (out.length % 5 === 4 && k < iv.length) out.push(iv[k++])
  }
  while (k < iv.length) out.push(iv[k++])
  return out
}
