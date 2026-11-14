export interface Shape { d: number; heads: number; kv: number; layers: number; ffn: number; vocab: number; ffnMats: 2 | 3; tied: boolean; learnedPositions: boolean; seq: number; batch: number }

/** Presets as [d_model, heads, KV heads, layers, FFN width, vocabulary, FFN matrices, tied embeddings]. Real model families, rounded. */
export const PRESETS = {
  l8: { name: 'Llama-3-8B-like', d: 4096, heads: 32, kv: 8, layers: 32, ffn: 14336, vocab: 128256, ffnMats: 3, tied: false, learnedPositions: false },
  l3: { name: '3B-like', d: 3072, heads: 24, kv: 8, layers: 28, ffn: 8192, vocab: 128256, ffnMats: 3, tied: true, learnedPositions: false },
  l70: { name: '70B-like', d: 8192, heads: 64, kv: 8, layers: 80, ffn: 28672, vocab: 128256, ffnMats: 3, tied: false, learnedPositions: false },
  g2: { name: 'GPT-2 small', d: 768, heads: 12, kv: 12, layers: 12, ffn: 3072, vocab: 50257, ffnMats: 2, tied: true, learnedPositions: true },
} as const
export type PresetId = keyof typeof PRESETS

/** Exact parameter arithmetic for a pre-norm decoder block with grouped-query attention, ignoring biases and norm weights. */
export function trace(s: Shape) {
  const heads = Math.max(1, s.heads)
  const kv = Math.max(1, Math.min(heads, s.kv))
  const dh = Math.round(s.d / heads)
  const q = s.d * heads * dh
  const k = s.d * kv * dh
  const o = heads * dh * s.d
  const attn = q + 2 * k + o
  const ffn = s.ffnMats * s.d * s.ffn
  const block = attn + ffn
  const emb = s.vocab * s.d
  const head = s.tied ? 0 : s.vocab * s.d
  const pos = s.learnedPositions ? 1024 * s.d : 0
  const total = s.layers * block + emb + head + pos
  const sh = (a: number[]) => `[${a.map((n) => n.toLocaleString('en-US')).join(' × ')}]`
  const { batch: B, seq: S, d, ffn: F, vocab: V } = s
  const rows = [
    { step: 'Token embeddings', op: 'lookup', shape: sh([B, S, d]), params: emb },
    { step: 'Q projection', op: 'x · W_Q', shape: sh([B, S, heads, dh]), params: q },
    { step: 'K and V projections (each)', op: 'x · W_K, x · W_V', shape: sh([B, S, kv, dh]), params: 2 * k, both: true },
    { step: 'Attention scores per layer', op: 'Q · Kᵀ / √d_h', shape: sh([B, heads, S, S]), params: 0 },
    { step: 'Attention output', op: 'weights · V → W_O', shape: sh([B, S, d]), params: o },
    { step: `FFN up${s.ffnMats === 3 ? ' + gate' : ''}`, op: 'x · W_up', shape: sh([B, S, F]), params: (s.ffnMats - 1) * d * F },
    { step: 'FFN down', op: 'h · W_down', shape: sh([B, S, d]), params: d * F },
    { step: 'Logits (LM head)', op: 'x · W_out', shape: sh([B, S, V]), params: head, tied: s.tied },
  ]
  return { dh, divisible: s.d % heads === 0, attn, ffn, block, total, scoreElements: B * heads * S * S, rows }
}
