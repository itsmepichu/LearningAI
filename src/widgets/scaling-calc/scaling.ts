export const H100_PEAK = 989e12
export const PRICE = 2.5

/** Maps four 0–100 sliders to a training run: parameters, tokens per parameter, utilisation and GPU count. Order-of-magnitude only. */
export function run(sizeS: number, ratioS: number, mfuPct: number, gpuS: number) {
  const N = 10 ** (-1 + (4 * sizeS) / 100) * 1e9
  const R = 10 ** ((4 * ratioS) / 100)
  const mfu = mfuPct / 100
  const gpus = Math.round(10 ** (0.9 + (4.1 * gpuS) / 100))
  const D = N * R
  const C = 6 * N * D
  const gpuHours = C / (H100_PEAK * mfu) / 3600
  const days = gpuHours / gpus / 24
  return { N, R, D, C, gpus, gpuHours, days, cost: gpuHours * PRICE, chinchilla: 20 * N, state: 16 * N }
}
