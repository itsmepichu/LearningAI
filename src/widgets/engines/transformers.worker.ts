/// <reference lib="es2023" />
/**
 * Runs Transformers.js off the main thread. The library comes from a pinned CDN URL when this worker starts, and this
 * worker only starts after the reader opts in, so no reader pays for it before then and it never enters a page bundle.
 */
import { serve } from '../kit/download.ts'
import { trainSoftmax } from '../text-classifier/softmax.ts'
import { RUNTIME_BYTES, TRANSFORMERS_URL } from './specs.ts'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Emit = (event: unknown) => void

let library: Promise<any> | null = null
function loadLibrary(): Promise<any> {
  library ??= (import(/* @vite-ignore */ TRANSFORMERS_URL) as Promise<any>).then((tf) => {
    // Otherwise it looks for models on this site first, and the site answers unknown paths with a page.
    tf.env.allowLocalModels = false
    return tf
  })
  library.catch(() => {
    library = null
  })
  return library
}

/** Downloads the WebAssembly runtime up front, so the bar can say so. The library's own fetch then hits the HTTP cache. */
async function fetchRuntime(tf: any, emit: Emit) {
  emit({ stage: 'Downloading the runtime' })
  const url = tf.env.backends?.onnx?.wasm?.wasmPaths?.wasm
  if (typeof url === 'string') {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Could not download the runtime (HTTP ${res.status}).`)
    await res.arrayBuffer()
  }
  emit({ file: 'runtime', loaded: RUNTIME_BYTES, total: RUNTIME_BYTES })
}

/** Turns Transformers.js download events into the gate's progress events. */
const modelProgress = (emit: Emit) => (p: any) => {
  if (p.status === 'progress' && p.file) emit({ file: p.file, loaded: p.loaded, total: p.total })
  else if (p.status === 'done' && String(p.file).endsWith('.onnx')) emit({ stage: 'Starting the model' })
}

let embedder: any = null
let tokenizers: any[] = []

serve(self as unknown as Parameters<typeof serve>[0], {
  async loadEmbedder({ model }: { model: string }, emit) {
    const tf = await loadLibrary()
    await fetchRuntime(tf, emit)
    embedder = await tf.pipeline('feature-extraction', model, { dtype: 'q8', device: 'wasm', progress_callback: modelProgress(emit) })
    return { model }
  },

  /** Unit-length mean-pooled vectors. Reports each batch, so a long corpus shows progress. */
  async embed({ texts }: { texts: string[] }, emit) {
    const out: number[][] = []
    for (let i = 0; i < texts.length; i += 8) {
      const batch = texts.slice(i, i + 8)
      const tensor = await embedder(batch, { pooling: 'mean', normalize: true })
      out.push(...(tensor.tolist() as number[][]))
      emit({ done: out.length, total: texts.length })
    }
    return out
  },

  /** Training is arithmetic, not inference, but 400 rows of 384 numbers should not run on the page's thread either. */
  trainSoftmax({ x, y }: { x: number[][]; y: string[] }) {
    return trainSoftmax(x, y)
  },

  async loadTokenizers({ models }: { models: string[] }, emit) {
    const tf = await loadLibrary()
    tokenizers = await Promise.all(
      models.map((model) =>
        tf.AutoTokenizer.from_pretrained(model, {
          // Each tokenizer has a file with the same name, so the model tells them apart in the running total.
          progress_callback: (p: any) => {
            if (p.status === 'progress' && p.file) emit({ file: `${model}/${p.file}`, loaded: p.loaded, total: p.total })
          },
        }),
      ),
    )
    return { models }
  },

  /** For each tokenizer, for each text: what each token decodes to. No special tokens, so counts are the text's own. */
  tokenize({ texts }: { texts: string[] }) {
    return tokenizers.map((t) =>
      texts.map((text) => ({
        pieces: (t.encode(text, { add_special_tokens: false }) as number[]).map((id) => t.decode([id], { skip_special_tokens: false }) as string),
      })),
    )
  },
})
