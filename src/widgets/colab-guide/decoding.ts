/** 5.6: decoding settings on a real model, with the selected project's question and the document retrieval would find. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { loadCorpus } from '../bm25/corpus.ts'
import { COMPARE } from '../retriever-compare/scenarios.ts'
import { py, withSetup, type GuideDef, type GuideStep } from './notebook.ts'

export const MODEL = 'Qwen/Qwen3-0.6B'
export const MODEL_CARD = 'https://huggingface.co/Qwen/Qwen3-0.6B'

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

export function guideSteps(p: Pick<Project, 'company' | 'assistant'>, seed: ColabSeed): GuideStep[] {
  return withSetup(
    [
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
    ],
    { torch: true },
  )
}

export const DECODING: GuideDef<ColabSeed> = {
  id: 'decoding',
  section: '5.6',
  title: 'Decoding on a real GPU',
  fileStem: 'decoding-on-a-gpu',
  load: loadColabSeed,
  source: (seed) => ({ files: [seed.file], note: `The code below uses this question and document (${seed.doc.id}).` }),
  steps: guideSteps,
  limits: (p) =>
    `You will see how decoding settings change the output of a real model, and roughly what a GPU buys you on one prompt. It does not show that this model’s answers can be trusted, what serving it would cost, or how another GPU would perform: Colab’s hardware varies. ${p.company} and its documents are invented.`,
  links: [{ label: `${MODEL} model card`, href: MODEL_CARD }],
}
