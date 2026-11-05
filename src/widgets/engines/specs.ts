/**
 * Every opt-in download in the course: what it fetches and how big it is. Sizes were measured from the hosts' response
 * headers; the bytes are what crosses the network, so compressed sizes for the CDN files.
 * Versions are pinned so a stated size stays true. Bump `version` with them.
 */
import type { DownloadFile, DownloadSpec } from '../kit/download.ts'

const JSDELIVR = 'cdn.jsdelivr.net'
const HF = 'huggingface.co'

export const TRANSFORMERS_VERSION = '4.3.2'
/** The bundled browser build: this one file imports nothing else. */
export const TRANSFORMERS_URL = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${TRANSFORMERS_VERSION}/dist/transformers.min.js`
export const TRANSFORMERS_DOCS = { label: 'Transformers.js documentation', href: 'https://huggingface.co/docs/transformers.js' }

const LIBRARY: DownloadFile = { label: 'Transformers.js library', bytes: 141_000, host: JSDELIVR }
const ONNX_RUNTIME: DownloadFile = { label: 'ONNX Runtime WebAssembly', bytes: 5_570_000, host: JSDELIVR }
/** What the worker reports as one step, because ONNX Runtime gives no byte progress of its own. */
export const RUNTIME_BYTES = LIBRARY.bytes + ONNX_RUNTIME.bytes

export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'
export const EMBEDDING_NAME = 'all-MiniLM-L6-v2'
export const EMBEDDING_DIMS = 384

export const EMBEDDINGS: DownloadSpec = {
  id: 'embeddings',
  version: `${TRANSFORMERS_VERSION}-minilm-q8`,
  what: `the ${EMBEDDING_NAME} embedding model`,
  files: [
    LIBRARY,
    ONNX_RUNTIME,
    { label: `${EMBEDDING_NAME} weights, 8-bit quantised`, bytes: 22_972_370, host: HF },
    { label: 'Its tokenizer and configuration', bytes: 720_000, host: HF },
  ],
  needs: ['worker', 'wasm'],
  docs: TRANSFORMERS_DOCS,
  load: { op: 'loadEmbedder', args: { model: EMBEDDING_MODEL } },
}

export const TOKENIZER_MODELS = [
  { id: 'Xenova/gpt2', name: 'GPT-2', algorithm: 'byte-level BPE, trained on English web text', bytes: 2_107_653 },
  { id: 'Xenova/bert-base-multilingual-cased', name: 'BERT multilingual', algorithm: 'WordPiece, trained across 100 or so languages', bytes: 2_919_362 },
  { id: 'Xenova/xlm-roberta-base', name: 'XLM-R', algorithm: 'Unigram (SentencePiece), trained across 100 or so languages', bytes: 17_082_660 },
]

export const TOKENIZERS: DownloadSpec = {
  id: 'tokenizers',
  version: `${TRANSFORMERS_VERSION}-gpt2-bert-xlmr`,
  what: 'three real tokenizers',
  files: [LIBRARY, ...TOKENIZER_MODELS.map((m) => ({ label: `${m.name} vocabulary`, bytes: m.bytes, host: HF }))],
  needs: ['worker'],
  docs: TRANSFORMERS_DOCS,
  load: { op: 'loadTokenizers', args: { models: TOKENIZER_MODELS.map((m) => m.id) } },
}
