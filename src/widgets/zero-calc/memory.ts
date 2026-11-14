export const STAGES = ['Stage 0 · plain data parallel', 'Stage 1 · shard optimiser state', 'Stage 2 · + shard gradients', 'Stage 3 / FSDP · + shard weights']
export const GPU_COUNTS = [1, 2, 4, 8, 16, 64, 256]
export const MEMORY_GB = [24, 40, 80, 141]

/** Bytes per GPU for mixed-precision Adam (2 weights + 2 gradients + 12 optimiser state per parameter), excluding activations. */
export function perGpu(params: number, gpus: number): number[] {
  return [16 * params, 4 * params + (12 * params) / gpus, 2 * params + (14 * params) / gpus, (16 * params) / gpus]
}
export type Fit = 'fits' | 'tight' | 'no'
export const fitOf = (bytes: number, capacity: number): Fit => (bytes > capacity ? 'no' : bytes > capacity * 0.7 ? 'tight' : 'fits')
/** The first stage that leaves at least 30% of the GPU free for activations, or -1. */
export const firstComfortable = (stages: number[], capacity: number) => stages.findIndex((v) => v <= capacity * 0.7)
