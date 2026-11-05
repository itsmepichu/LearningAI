/**
 * The GPU work this course does not run in the browser: a step-by-step Google Colab guide and the same code as a
 * notebook. Each project's question and document go into the code. Plain, so a test can check the notebook and run its Python.
 */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { loadCorpus } from '../bm25/corpus.ts'
import { COMPARE } from '../retriever-compare/scenarios.ts'

export const MODEL = 'Qwen/Qwen3-0.6B'
export const MODEL_CARD = 'https://huggingface.co/Qwen/Qwen3-0.6B'
export const COLAB_URL = 'https://colab.research.google.com/'
export const COLAB_FAQ = 'https://research.google.com/colaboratory/faq.html'

export interface ColabSeed {
  file: string
  question: string
  doc: { id: string; title: string; body: string }
}

/** The project's comparison query and the document graded most relevant to it. */
export async function loadColabSeed(p: Project, read: DataReader): Promise<ColabSeed> {
  const corpus = await loadCorpus(p, read)
  const scenario = COMPARE[p.id]
  const best = Object.entries(scenario.grades).sort((a, b) => b[1] - a[1])[0][0]
  const doc = corpus.docs.find((d) => d.id === best)!
  return { file: corpus.file, question: scenario.query, doc: { id: doc.id, title: doc.title, body: doc.body } }
}

export interface GuideStep {
  title: string
  /** What to do and why, as plain text. */
  text: string
  /** A code cell to paste and run. Steps without one happen in Colab's menus. */
  code?: string
  /** What the reader should see, so they know the step worked. */
  expect?: string
}

/** A Python string literal. JSON's escapes are valid Python, and non-ASCII text stays readable. */
const py = (s: string) => JSON.stringify(s)

export function guideSteps(p: Pick<Project, 'company' | 'assistant'>, seed: ColabSeed): GuideStep[] {
  return [
    {
      title: 'Open Colab and create a notebook',
      text: 'Go to colab.research.google.com and sign in with a Google account. Choose File, then New notebook. Or download the notebook from this page and choose File, then Upload notebook, which saves you pasting each cell. Colab then warns that the notebook was not written by Google: read the code, then choose Run anyway.',
    },
    {
      title: 'Turn on the GPU',
      text: 'Choose Runtime, then Change runtime type. Under Hardware accelerator pick a GPU, such as T4 GPU on the free tier, then Save. The names on offer change over time. If Colab says no GPU is available, try again later: free access is limited and not guaranteed. The code below still runs on a CPU, only much more slowly.',
    },
    {
      title: 'Learn how to run a cell',
      text: 'Choose + Code to add a cell, paste the code in, then press Shift+Enter or the round play button at its left. Run the cells in order, top to bottom. A cell has finished when its play button comes back, and a green tick then appears beside it. Variables stay in memory between cells until the runtime restarts.',
    },
    {
      title: 'Check that you have a GPU',
      text: 'The first line lists the GPU, if there is one. The rest shows that PyTorch can use it.',
      code: `!nvidia-smi --query-gpu=name,memory.total --format=csv

import torch
device = "cuda" if torch.cuda.is_available() else "cpu"
print("Using:", device, torch.cuda.get_device_name(0) if device == "cuda" else "(no GPU: go back to step 2)")`,
      expect: 'Using: cuda and the GPU’s name. If it says cpu, go back to step 2. Changing the runtime type clears memory, so run this cell again afterwards.',
    },
    {
      title: 'Load a small open model',
      text: `This downloads ${MODEL}, about 1.5 GB, to Colab’s machine rather than yours, and takes a minute or two. A warning that HF_TOKEN does not exist is harmless: this model needs no account. Do not paste a real token into a shared notebook.`,
      code: `!pip install -q --upgrade "transformers>=4.56"

from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = ${py(MODEL)}
tokenizer = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForCausalLM.from_pretrained(MODEL, dtype="auto").to(device)
print("Loaded", MODEL, "with", round(model.num_parameters() / 1e6), "million parameters on", model.device)`,
      expect: 'Loaded, with about 600 million parameters, on cuda:0.',
    },
    {
      title: 'Write a function that asks the model',
      text: `This is ${p.assistant}, ${p.company}’s assistant, in a few lines. It builds the prompt from a system message, optionally with a retrieved document in it, then decodes with the settings you pass. enable_thinking=False asks this model for the answer without a reasoning block.`,
      code: `import time

QUESTION = ${py(seed.question)}
DOCUMENT = ${py(`${seed.doc.title}: ${seed.doc.body}`)}

def ask(question=QUESTION, document=None, temperature=0.7, top_p=0.9, top_k=40, max_new_tokens=96):
    system = "You are ${p.assistant}, the assistant of ${p.company}, a fictional company. Answer in one or two short sentences."
    if document:
        system += " Use only this document. If it does not hold the answer, say so.\\n\\nDocument: " + document
    messages = [{"role": "system", "content": system}, {"role": "user", "content": question}]
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    # Temperature 0 means greedy decoding: always the likeliest token.
    sampling = dict(do_sample=True, temperature=temperature, top_p=top_p, top_k=top_k) if temperature > 0 else dict(do_sample=False, temperature=None, top_p=None, top_k=None)
    start = time.perf_counter()
    output = model.generate(**inputs, **sampling, max_new_tokens=max_new_tokens, pad_token_id=tokenizer.eos_token_id)
    seconds = time.perf_counter() - start
    new_tokens = output[0][inputs["input_ids"].shape[1]:]
    print(f"[{len(new_tokens)} tokens, {len(new_tokens) / seconds:.1f} per second]")
    print(tokenizer.decode(new_tokens, skip_special_tokens=True).strip())

ask()`,
      expect: 'An answer and a speed. Check the answer against the document: it was given none here, so anything specific is invented.',
    },
    {
      title: 'Give it the document',
      text: 'The same question, now with the document retrieval would have found. Compare the two answers. This is what grounding changes, and it still does not guarantee a correct answer.',
      code: `ask(document=DOCUMENT)`,
    },
    {
      title: 'Compare decoding settings',
      text: 'Greedy decoding twice, then high and low temperatures, then a narrow top-k. Watch which answers repeat and which fall apart. These are the controls from this section, on real logits.',
      code: `print("Greedy, twice. On one machine these usually match:")
ask(document=DOCUMENT, temperature=0)
ask(document=DOCUMENT, temperature=0)

print("\\nHigh temperature, twice. Expect them to differ:")
ask(document=DOCUMENT, temperature=1.5, top_p=1.0, top_k=0)
ask(document=DOCUMENT, temperature=1.5, top_p=1.0, top_k=0)

print("\\nTop-k 1 samples from one token, so it behaves like greedy:")
ask(document=DOCUMENT, temperature=1.0, top_k=1)`,
    },
    {
      title: 'Compare the GPU with the CPU',
      text: 'One short generation on the CPU, then the same one on the GPU, for a sense of what the GPU buys you. The CPU run may take a minute.',
      code: `model.to("cpu")
ask(document=DOCUMENT, temperature=0, max_new_tokens=24)
model.to(device)
ask(document=DOCUMENT, temperature=0, max_new_tokens=24)`,
      expect: 'Two speeds, on the same model and prompt. The first is the CPU.',
    },
    {
      title: 'Finish, and give the GPU back',
      text: 'Choose Runtime, then Disconnect and delete runtime, which frees your GPU quota. Your notebook stays in Google Drive, but the machine, the model and every variable are deleted. Idle runtimes are also stopped for you, so a later session starts again from step 4.',
    },
  ]
}

const lines = (s: string) => s.split('\n').map((l, i, all) => (i < all.length - 1 ? l + '\n' : l))

/** The steps as a notebook, in the format Colab opens: one text cell per step, then its code. */
export function toNotebook(p: Pick<Project, 'company'>, steps: GuideStep[]): string {
  const cells = [
    { cell_type: 'markdown', metadata: {}, source: lines(`# Decoding on a real GPU\n\nA guide from the Enterprise AI Field Manual, section 5.6, using ${p.company}, a fictional company with invented data.\n\nBefore running anything, choose **Runtime, Change runtime type** and pick a GPU.`) },
    ...steps.flatMap((s, i) => [
      { cell_type: 'markdown', metadata: {}, source: lines(`## ${i + 1}. ${s.title}\n\n${s.text}${s.expect ? `\n\n**You should see:** ${s.expect}` : ''}`) },
      ...(s.code ? [{ cell_type: 'code', execution_count: null, metadata: {}, outputs: [], source: lines(s.code) }] : []),
    ]),
  ]
  return (
    JSON.stringify(
      {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: { accelerator: 'GPU', colab: { gpuType: 'T4' }, kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' }, language_info: { name: 'python' } },
        cells: cells.map((c, i) => ({ id: `cell-${i}`, ...c })),
      },
      null,
      1,
    ) + '\n'
  )
}
