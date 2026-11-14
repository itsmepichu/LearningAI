const REF = 8192
export const D_MODEL = 4096
export const LAYERS = 32
/** KV bytes per token: 2 (K and V) × 32 layers × 8 KV heads × 128 head dim × 2 bytes = 131,072. */
export const KV_BYTES_PER_TOKEN = 131072

export function costs(exp: number) {
  const n = 2 ** exp
  return { n, flops: 4 * n * n * D_MODEL * LAYERS, kv: n * KV_BYTES_PER_TOKEN, attnRatio: (n * n) / (REF * REF), kvRatio: n / REF }
}
/** Both curves relative to their value at 128k tokens, so the shapes (line vs curve) can share a chart. */
export const relative = (exp: number) => ({ linear: 2 ** exp / 2 ** 17, quadratic: (2 ** exp / 2 ** 17) ** 2 })
