/** Illustrative open-weight sizes: parameters, layers, KV heads, head dimension. */
export const MODELS = [
  { name: '0.5B (24 layers, 2 KV heads × 64)', params: 0.49e9, layers: 24, kvHeads: 2, headDim: 64 },
  { name: '1B (16 layers, 8 KV heads × 64)', params: 1.24e9, layers: 16, kvHeads: 8, headDim: 64 },
  { name: '3B (28 layers, 8 KV heads × 128)', params: 3.2e9, layers: 28, kvHeads: 8, headDim: 128 },
  { name: '8B (32 layers, 8 KV heads × 128)', params: 8.03e9, layers: 32, kvHeads: 8, headDim: 128 },
  { name: '14B (48 layers, 8 KV heads × 128)', params: 14.7e9, layers: 48, kvHeads: 8, headDim: 128 },
  { name: '70B (80 layers, 8 KV heads × 128)', params: 70.6e9, layers: 80, kvHeads: 8, headDim: 128 },
]
/** Bytes per parameter, including the scales that quantised formats store. */
export const FORMATS = [
  { name: 'FP16 / BF16', bytes: 2 },
  { name: 'Q8_0 (≈ 8.5 bits)', bytes: 1.06 },
  { name: 'Q5_K_M (≈ 5.5 bits)', bytes: 0.69 },
  { name: 'Q4_K_M (≈ 4.5 bits)', bytes: 0.56 },
]
export const RUNTIME_BYTES = 0.4e9

export interface FitInput { model: number; format: number; ramGb: number; osGb: number; ctxExp: number; bandwidthGb: number }

export function fit(i: FitInput) {
  const m = MODELS[i.model]
  const weights = m.params * FORMATS[i.format].bytes
  const ctx = 2 ** i.ctxExp
  const kv = 2 * m.layers * m.kvHeads * m.headDim * 2 * ctx
  const need = weights + kv + RUNTIME_BYTES
  const ram = i.ramGb * 1e9
  const os = i.osGb * 1e9
  const free = ram - os - need
  const speed = (i.bandwidthGb * 1e9) / (weights + kv * 0.5)
  const verdict: 'comfortable' | 'tight' | 'no' = free > 2e9 ? 'comfortable' : free > 0 ? 'tight' : 'no'
  return { weights, kv, need, free, speed, ctx, verdict, ram, os }
}
