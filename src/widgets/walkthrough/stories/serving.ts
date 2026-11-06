/**
 * 14.2: one chat request through the serving stack, with the selected project's question and document as the prompt.
 * Token counts use the 1.4 estimator; the timing rates are 14.2's illustrative ones for an 8B model on one datacentre
 * GPU (prefill about 10,000 tokens/s, decode about 60 tokens/s per sequence), and are labelled as such. Pure.
 */
import type { Project } from '../../../data/projects'
import { estimateTokens } from '../../token-estimator/estimate.ts'
import { loadColabSeed, type ColabSeed } from '../../colab-guide/decoding.ts'
import type { Story, WalkStep } from '../story.ts'

export const RATES = { prefillPerSec: 10_000, decodePerSec: 60, queueMs: 40, outputTokens: 150 }

export function systemPrompt(p: Pick<Project, 'company' | 'assistant'>) {
  return `You are ${p.assistant}, the assistant of ${p.company}. Answer only from the documents provided, cite them by id, and say so if they do not answer the question. Keep answers under 120 words.`
}

export function timing(systemTokens: number, restTokens: number, cached: boolean) {
  const prefillTokens = cached ? restTokens : systemTokens + restTokens
  const prefillMs = (prefillTokens / RATES.prefillPerSec) * 1000
  const ttftMs = RATES.queueMs + prefillMs
  const itlMs = 1000 / RATES.decodePerSec
  const totalMs = ttftMs + (RATES.outputTokens - 1) * itlMs
  return { prefillTokens, prefillMs, ttftMs, itlMs, totalMs }
}

const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`)

export const SERVING: Story<ColabSeed> = {
  id: 'serving',
  section: '14.2',
  title: 'One request through the serving stack',
  nodes: [
    { id: 'client', label: 'App', x: 60, y: 150 },
    { id: 'gateway', label: 'Gateway', x: 180, y: 70 },
    { id: 'router', label: 'Router', x: 320, y: 70 },
    { id: 'queue', label: 'Queue', x: 460, y: 70 },
    { id: 'prefill', label: 'Prefill', x: 580, y: 150 },
    { id: 'decode', label: 'Decode', x: 460, y: 230 },
    { id: 'stream', label: 'Stream', x: 320, y: 230 },
    { id: 'meter', label: 'Meter & log', x: 180, y: 230 },
  ],
  edges: [
    { from: 'client', to: 'gateway' }, { from: 'gateway', to: 'router' }, { from: 'router', to: 'queue' }, { from: 'queue', to: 'prefill' },
    { from: 'prefill', to: 'decode' }, { from: 'decode', to: 'stream' }, { from: 'stream', to: 'client' }, { from: 'stream', to: 'meter' },
  ],
  load: loadColabSeed,
  files: (s) => [s.file],
  note: (p) =>
    `The prompt is built from ${p.company}’s question and document, and its tokens are estimated with the 1.4 estimator. Queue wait, prefill and decode rates are 14.2's illustrative ones for an 8B model on one datacentre GPU: measure your own (14.7) before planning capacity.`,
  steps: (p, s): WalkStep[] => {
    const sys = systemPrompt(p)
    const rest = `Document ${s.doc.id}: ${s.doc.title}. ${s.doc.body}\n\nQuestion: ${s.question}`
    const sysT = estimateTokens(sys)
    const restT = estimateTokens(rest)
    const cold = timing(sysT, restT, false)
    const warm = timing(sysT, restT, true)
    return [
      {
        title: 'The app sends the request',
        text: `${p.assistant} sends one chat request: a system prompt (about ${sysT} tokens), ${p.company}’s document ${s.doc.id} and the user's question (about ${restT} tokens together), asking for a streamed answer of up to ${RATES.outputTokens} tokens.`,
        nodes: ['client'],
        detail: { kind: 'code', label: 'The request, in short', text: `stream: true · max_tokens: ${RATES.outputTokens}\nsystem: ${sys}\nuser: ${rest}` },
      },
      {
        title: 'The gateway admits it',
        text: `The model gateway (15.5) checks who is calling and whether ${p.company}'s tenant is within its quota of requests and tokens per minute. It picks the model behind the route, and attaches a request id that every later log line will carry. A caller over quota gets a fast, clear refusal here, rather than a slow timeout later.`,
        nodes: ['gateway'],
        edges: [['client', 'gateway']],
      },
      {
        title: 'The router picks a replica',
        text: 'Among healthy replicas of the model, the router prefers one that has recently served this same system prompt, so its KV blocks are probably still in that replica’s prefix cache (14.3). Prefix-aware routing turns a shared prompt into skipped work.',
        nodes: ['router'],
        edges: [['gateway', 'router']],
      },
      {
        title: 'It waits its turn',
        text: `The engine's scheduler admits new sequences only while there is room in the batch and in the KV cache (admission control, 14.7). Here the request waits about ${RATES.queueMs} ms (illustrative). Under overload this wait, not the model, dominates time to first token.`,
        nodes: ['queue'],
        edges: [['router', 'queue']],
      },
      {
        title: 'Prefill: the whole prompt in one pass',
        text: `All ${cold.prefillTokens} prompt tokens go through the model in one parallel forward pass, filling the KV cache: about ${ms(cold.prefillMs)} at 10,000 tokens/s. With the system prompt already cached, only ${warm.prefillTokens} tokens need computing, about ${ms(warm.prefillMs)}. Prefill is compute-bound, so it grows with prompt length.`,
        nodes: ['prefill'],
        edges: [['queue', 'prefill']],
      },
      {
        title: 'Decode: one token per step, in a shared batch',
        text: `Then the model generates one token per forward pass, about every ${ms(cold.itlMs)} at 60 tokens/s per sequence, while continuous batching runs other users' sequences in the same steps (14.3). Decode is memory-bandwidth-bound: each step reads all the weights for a little arithmetic, which batching shares.`,
        nodes: ['decode'],
        edges: [['prefill', 'decode']],
      },
      {
        title: 'Tokens stream back',
        text: `The first token reaches the user after about ${ms(cold.ttftMs)} (queue + prefill; ${ms(warm.ttftMs)} with the cached prefix), and the rest stream in behind it. A ${RATES.outputTokens}-token answer finishes after about ${ms(cold.totalMs)}: for chat, time to first token is what users notice; for batch jobs, the total.`,
        nodes: ['stream', 'client'],
        edges: [['decode', 'stream'], ['stream', 'client']],
        detail: {
          kind: 'table',
          caption: 'Timing for this request (illustrative rates)',
          head: ['', 'Cold prefix', 'Cached system prompt'],
          rows: [
            ['Tokens to prefill', cold.prefillTokens, warm.prefillTokens],
            ['Time to first token', ms(cold.ttftMs), ms(warm.ttftMs)],
            ['Inter-token latency', ms(cold.itlMs), ms(warm.itlMs)],
            [`Total for ${RATES.outputTokens} tokens`, ms(cold.totalMs), ms(warm.totalMs)],
          ],
        },
      },
      {
        title: 'Meter and log it',
        text: `Finally the stack records input and output tokens (for cost per request, 17.5), time to first token and inter-token latency (for the SLOs of 15.2), the replica and whether the prefix cache hit. Without these per-request records, a slow day cannot be told apart from a bad deploy.`,
        nodes: ['meter'],
        edges: [['stream', 'meter']],
      },
    ]
  },
}
