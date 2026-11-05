/** Pattern-based redaction: a baseline that catches regular formats and misses names. Pure. */
import type { ProjectId } from '../../data/projects'

export type PiiKind = 'IBAN' | 'CARD' | 'EMAIL' | 'PHONE'
export interface Piece {
  text: string
  /** Set when this piece is a replacement tag. */
  tag?: string
}
export interface Redaction {
  pieces: Piece[]
  counts: Partial<Record<PiiKind, number>>
}

/** The Luhn checksum that card numbers carry, which keeps most other long numbers from being called cards. */
export function luhn(s: string): boolean {
  const d = s.replace(/\D/g, '')
  if (d.length < 13) return false
  let sum = 0
  let alt = false
  for (let i = d.length - 1; i >= 0; i--) {
    let n = +d[i]
    if (alt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

/** Most specific first, so an IBAN or a card number is not read as a phone number. */
const RULES: { kind: PiiKind; re: RegExp; test?: (m: string) => boolean }[] = [
  { kind: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/g },
  { kind: 'CARD', re: /\b(?:\d[ -]?){12,18}\d\b/g, test: luhn },
  { kind: 'EMAIL', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'PHONE', re: /\+?\d[\d\s().-]{7,}\d/g },
]

export function redact(input: string): Redaction {
  const counts: Partial<Record<PiiKind, number>> = {}
  let pieces: Piece[] = [{ text: input }]
  for (const { kind, re, test } of RULES) {
    pieces = pieces.flatMap((piece) => {
      if (piece.tag) return [piece]
      const out: Piece[] = []
      let last = 0
      for (const m of piece.text.matchAll(re)) {
        if (test && !test(m[0])) continue
        if (m.index > last) out.push({ text: piece.text.slice(last, m.index) })
        counts[kind] = (counts[kind] ?? 0) + 1
        const tag = `[${kind}_${counts[kind]}]`
        out.push({ text: tag, tag })
        last = m.index + m[0].length
      }
      if (last < piece.text.length) out.push({ text: piece.text.slice(last) })
      return out
    })
  }
  return { pieces, counts }
}

/** Invented people and test values: `example.com`, a phone number no one can hold, and the standard test card number. */
export const SAMPLES: Record<ProjectId, string> = {
  harbor: 'Hi, I’m Dana Whitfield (dana.whitfield@example.com, +1 415 555 0134). Please refund card 4111 1111 1111 1111; my IBAN is DE89 3704 0044 0532 0130 00.',
  store: 'Hi, this is Anaya Rao (anaya.rao@example.com, +91 00000 12345). I paid with card 4111 1111 1111 1111. Please deliver to 14 Example Lane, Pune.',
  bank: 'Kiran Menon here (kiran.menon@example.com, +91 00000 12345). Card 4111 1111 1111 1111 was charged twice, and my UPI ID kiran@examplebank was debited.',
  travel: 'Traveller Ishaan Varma (ishaan.varma@example.com, +91 00000 12345), passport Z0000000. Please rebook me and charge card 4111 1111 1111 1111.',
}
