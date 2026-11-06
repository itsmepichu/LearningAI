/**
 * 6.6: memory per GPU under data parallelism and the three ZeRO stages, for mixed-precision Adam: 2 bytes of weights,
 * 2 of gradients and 12 of optimiser state per parameter (an fp32 master copy, momentum and variance), as in the ZeRO
 * paper and the 2D figure above. Activations are left out. GPUs go across, the stage is the third axis and memory is
 * height, so the scene shows every GPU holding a full copy until the stages split it. Pure.
 */
import type { BarView, SceneStep, Tone, Vec3 } from '../scene3d/tensor.ts'

export const BYTES = { weights: 2, grads: 2, optimizer: 12 } as const
export type Part = keyof typeof BYTES

export const STAGES = [
  { name: 'Plain data parallel', short: 'DDP', shards: [] as Part[] },
  { name: 'ZeRO-1: shard the optimiser state', short: 'ZeRO-1', shards: ['optimizer'] as Part[] },
  { name: 'ZeRO-2: also shard the gradients', short: 'ZeRO-2', shards: ['optimizer', 'grads'] as Part[] },
  { name: 'ZeRO-3 / FSDP: also shard the weights', short: 'ZeRO-3', shards: ['optimizer', 'grads', 'weights'] as Part[] },
]

/** Bytes per GPU for each part, at one stage. A sharded part is split evenly over the GPUs. */
export function perGpu(stage: number, params: number, gpus: number): Record<Part, number> {
  const sharded = new Set(STAGES[stage].shards)
  const part = (p: Part) => (BYTES[p] * params) / (sharded.has(p) ? gpus : 1)
  return { weights: part('weights'), grads: part('grads'), optimizer: part('optimizer') }
}
export const total = (m: Record<Part, number>) => m.weights + m.grads + m.optimizer

/**
 * Communication per step, in parameters' worth of data, from the ZeRO paper: stages 1 and 2 move as much as plain data
 * parallel (2Ψ, a reduce-scatter and an all-gather), stage 3 adds an all-gather of the weights (3Ψ, 1.5×).
 */
export const commVolume = (stage: number) => (stage === 3 ? 3 : 2)

export const gb = (bytes: number) => {
  const v = bytes / 1e9
  return Number.isInteger(v) || v >= 100 ? `${Math.round(v)} GB` : `${v.toFixed(1)} GB`
}
const TONE: Record<Part, Tone> = { weights: 'accent', grads: 'signal', optimizer: 'sim' }
const PART_NAME: Record<Part, string> = { weights: 'weights', grads: 'gradients', optimizer: 'optimiser state' }

export interface ZeroInput {
  /** Parameters, such as 7e9. */
  params: number
  gpus: number
  /** Memory per GPU, in bytes. */
  capacity: number
}

const ROW = 2
const TALLEST = 3.2

export function zeroSteps({ params, gpus, capacity }: ZeroInput): SceneStep[] {
  const ddp = total(perGpu(0, params, gpus))
  const scale = TALLEST / Math.max(ddp, capacity)
  const width = Math.min(0.55, 5.4 / gpus)
  const gap = Math.min(0.9, 6.4 / gpus)
  const x0 = (-(gpus - 1) * gap) / 2
  // Later stages come towards you: each is shorter than the last, so none hides the one in front of it.
  const z = (stage: number) => (stage - 3) * ROW
  const capH = capacity * scale

  const barsFor = (stage: number, faded: boolean): BarView[] => {
    const m = perGpu(stage, params, gpus)
    return Array.from({ length: gpus }, (_, g) => {
      let y = 0
      return (['weights', 'grads', 'optimizer'] as Part[]).map((p): BarView => {
        const h = m[p] * scale
        const bar: BarView = { id: `s${stage}-g${g}-${p}`, at: [x0 + g * gap, y, z(stage)], size: [width, h, width], tone: TONE[p], faded }
        y += h
        return bar
      })
    }).flat()
  }
  const capLine = (stage: number) => ({
    id: `cap-${stage}`,
    points: [[x0 - gap * 0.7, capH, z(stage)], [x0 + (gpus - 1) * gap + gap * 0.7, capH, z(stage)]] as Vec3[],
    tone: 'bad' as Tone,
    label: stage === 0 ? `${gb(capacity)} per GPU` : undefined,
  })
  const rowNote = (stage: number) => ({ id: `row-${stage}`, at: [x0 - gap * 0.8 - 0.3, 0.2, z(stage)] as Vec3, text: STAGES[stage].short })

  const table = {
    caption: `Memory per GPU for ${(params / 1e9).toLocaleString('en-US')}B parameters on ${gpus} GPUs (activations not included)`,
    head: ['Stage', 'Weights', 'Gradients', 'Optimiser state', 'Total per GPU', `Fits in ${gb(capacity)}?`],
    rows: STAGES.map((st, i) => {
      const m = perGpu(i, params, gpus)
      return [st.short, gb(m.weights), gb(m.grads), gb(m.optimizer), gb(total(m)), total(m) <= capacity ? 'yes' : 'no']
    }),
  }

  return STAGES.map((st, stage): SceneStep => {
    const m = perGpu(stage, params, gpus)
    const t = total(m)
    const fits = t <= capacity
    const sharded = st.shards.map((p) => PART_NAME[p]).join(', ')
    const text =
      stage === 0
        ? `Each of the ${gpus} GPUs holds a full copy of everything: ${gb(m.weights)} of weights, ${gb(m.grads)} of gradients and ${gb(m.optimizer)} of optimiser state, ${gb(t)} per GPU, before any activations. ${fits ? `That fits in ${gb(capacity)}.` : `That does not fit in ${gb(capacity)}: the red line.`} Adding GPUs adds speed, not room.`
        : `Each GPU now keeps only 1/${gpus} of the ${sharded}, so it holds ${gb(t)}, ${Math.round((1 - t / ddp) * 100)}% less than plain data parallel. ${fits ? `It fits in ${gb(capacity)}.` : `It still does not fit in ${gb(capacity)}.`} ${stage === 3 ? `The cost: weights are gathered from the other GPUs just before each layer runs, about 1.5× the communication of plain data parallel.` : 'Communication stays the same as plain data parallel.'}`
    return {
      title: st.name,
      text,
      tensors: [],
      bars: STAGES.flatMap((_, s) => (s <= stage ? barsFor(s, s !== stage) : [])),
      paths: STAGES.map((_, s) => capLine(s)).filter((_, s) => s <= stage),
      notes: STAGES.map((_, s) => rowNote(s)).filter((_, s) => s <= stage),
      target: [0, TALLEST / 2.5, z(stage) / 1.5],
      distance: 9 + Math.min(gpus, 8) * 0.2,
      table,
    }
  })
}
