/** A rough token count, and what a request costs and how long it takes. Pure. */

/** A heuristic: about 4 characters per token for Latin text, fewer for digits and other scripts. */
export function estimateTokens(text: string): number {
  let latin = 0
  let digits = 0
  let other = 0
  let spaces = 0
  for (const ch of text) {
    if (/\s/.test(ch)) spaces++
    else if (/[0-9]/.test(ch)) digits++
    else if (/[\x21-\x7e]/.test(ch)) latin++
    else other++
  }
  return Math.max(1, Math.round(latin / 4 + digits / 2 + other / 1.4 + spaces * 0.05))
}

export interface RequestShape {
  inputTokens: number
  outputTokens: number
  requestsPerDay: number
  /** Dollars per million tokens. */
  inputPrice: number
  outputPrice: number
  /** Output tokens per second. */
  decodeSpeed: number
}

const NETWORK_S = 0.08
const PREFILL_TOKENS_PER_S = 10000

export function requestCost(r: RequestShape) {
  const input = (r.inputTokens / 1e6) * r.inputPrice
  const output = (r.outputTokens / 1e6) * r.outputPrice
  const perRequest = input + output
  const ttft = NETWORK_S + r.inputTokens / PREFILL_TOKENS_PER_S
  return {
    perRequest,
    perDay: perRequest * r.requestsPerDay,
    perMonth: perRequest * r.requestsPerDay * 30,
    outputShare: output / perRequest,
    ttft,
    total: ttft + (r.outputTokens - 1) / r.decodeSpeed,
  }
}

/** The input slider's value for a counted text: nearest 100, within the slider's range. */
export const asInputTokens = (tokens: number) => Math.min(20000, Math.max(100, Math.round(tokens / 100) * 100))

