/**
 * 14.7 and the chapter 14 lab: serve a small model with vLLM on one Colab GPU, sweep concurrency with vLLM's own
 * benchmark, plot throughput and per-token latency as two charts, then measure what prefix caching does to time to first
 * token, using the selected project's documents as the shared prompt prefix.
 */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { loadCorpus } from '../bm25/corpus.ts'
import { COMPARE } from '../retriever-compare/scenarios.ts'
import { loadLabelled } from '../text-classifier/examples.ts'
import { py, withSetup, type GuideDef, type GuideStep } from './notebook.ts'

/**
 * Pinned: newer wheels target CUDA 13, which Colab's runtime did not provide when this was written (it had CUDA 12.8),
 * and the benchmark's flags and result fields change between versions. Checked against v0.19.0's source.
 */
export const VLLM_VERSION = '0.19.0'
export const VLLM_MODEL = 'Qwen/Qwen3-1.7B'
export const VLLM_MODEL_CARD = 'https://huggingface.co/Qwen/Qwen3-1.7B'
export const CONCURRENCY = [1, 2, 4, 8, 16, 32]
/** The inter-token latency target drawn on the chart, the same 50 ms as the figure in 14.7. */
export const ITL_SLO_MS = 50
/** About 1,500 tokens of shared prefix: long enough that prefill time is easy to see. */
const PREFIX_CHARS = 6000

export interface VllmSeed {
  files: string[]
  question: string
  /** Documents, then recent messages as examples, joined into one long shared context. */
  context: string
  docIds: string[]
  /** How many recent messages were added after the documents, and what they are. */
  examples: number
  noun: string
}

/** The project's documents, topped up with its recent messages until the prefix is about 1,500 tokens. */
export async function loadVllmSeed(p: Project, read: DataReader): Promise<VllmSeed> {
  const corpus = await loadCorpus(p, read)
  const parts: string[] = []
  const ids: string[] = []
  let size = 0
  for (const d of corpus.docs) {
    if (size >= PREFIX_CHARS) break
    const part = `${d.title}: ${d.body}`
    parts.push(part)
    ids.push(d.id)
    size += part.length
  }
  const labelled = await loadLabelled(p, read)
  const recent: string[] = []
  for (const r of labelled.rows) {
    if (size >= PREFIX_CHARS) break
    recent.push(`- ${r.text}`)
    size += r.text.length + 3
  }
  const context = parts.join('\n\n') + (recent.length ? `\n\nRecent ${labelled.noun}, for tone and context:\n${recent.join('\n')}` : '')
  const files = recent.length ? [corpus.file, labelled.file] : [corpus.file]
  return { files, question: COMPARE[p.id].query, context, docIds: ids, examples: recent.length, noun: labelled.noun }
}

export function vllmSteps(p: Pick<Project, 'company' | 'assistant'>, seed: VllmSeed): GuideStep[] {
  return withSetup(
    [
      {
        title: 'Install vLLM',
        text: `This installs vLLM ${VLLM_VERSION}, the version this guide was checked against, with its own PyTorch. It is a large download: expect three to five minutes. Warnings about conflicting versions of packages vLLM does not use are harmless. If Colab offers to restart the session, you can decline: the server runs as its own program, not inside this notebook.`,
        code: `!pip install -q vllm==${VLLM_VERSION} openai matplotlib
!vllm --version`,
        expect: VLLM_VERSION,
      },
      {
        title: 'Start the server',
        text: `This starts vLLM’s OpenAI-compatible server in the background with ${VLLM_MODEL}, and waits until it answers. float16 because a T4 has no fast bfloat16; a 4,096-token context limit and 85% of GPU memory leave room for the KV cache. Startup downloads about 4 GB and prepares the GPU, so give it a few minutes. Everything the server prints goes to vllm.log.`,
        code: `import subprocess, time, urllib.request

MODEL = ${py(VLLM_MODEL)}
log = open("vllm.log", "w")
server = subprocess.Popen(
    ["vllm", "serve", MODEL, "--dtype", "half", "--max-model-len", "4096",
     "--gpu-memory-utilization", "0.85", "--port", "8000"],
    stdout=log, stderr=subprocess.STDOUT)

for _ in range(120):
    if server.poll() is not None:
        print("The server stopped. The end of vllm.log says why:")
        break
    try:
        urllib.request.urlopen("http://localhost:8000/health", timeout=2)
        print("Server ready")
        break
    except Exception:
        time.sleep(5)
else:
    print("Not ready after 10 minutes. The end of vllm.log says why:")
!tail -n 5 vllm.log
!grep -E "KV cache|Maximum concurrency" vllm.log`,
        expect: 'Server ready, then lines giving the KV cache size in tokens and the maximum concurrency it allows at the full context length: that is the paged KV cache of 14.3, measured on this GPU.',
      },
      {
        title: `Ask it one question as ${p.assistant}`,
        text: `One request through the same API your application would use, with ${p.company}’s question. The chat_template_kwargs line turns off this model’s reasoning block, so the answer comes straight back.`,
        code: `from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="not-needed")
QUESTION = ${py(seed.question)}
reply = client.chat.completions.create(
    model=MODEL, max_tokens=80, temperature=0,
    messages=[{"role": "user", "content": QUESTION}],
    extra_body={"chat_template_kwargs": {"enable_thinking": False}})
print(reply.choices[0].message.content)
print(reply.usage)`,
        expect: 'An answer, which may well be invented since the model has no documents yet, and the prompt and completion token counts.',
      },
      {
        title: 'Sweep concurrency with vLLM’s benchmark',
        text: `vllm bench serve sends random prompts of 512 tokens and asks for 128 tokens back, keeping a fixed number of requests in flight. Running it at ${CONCURRENCY.join(', ')} concurrent requests traces the curve in the 14.7 figure on this GPU. ITL, inter-token latency, is the gap between streamed tokens that each user feels; TTFT is the wait for the first token. Expect a few minutes in all.`,
        code: `import json

CONCURRENCY = ${JSON.stringify(CONCURRENCY)}
results = []
for c in CONCURRENCY:
    run = subprocess.run(
        ["vllm", "bench", "serve", "--model", MODEL, "--dataset-name", "random",
         "--random-input-len", "512", "--random-output-len", "128", "--ignore-eos",
         "--num-prompts", str(max(16, 4 * c)), "--max-concurrency", str(c), "--seed", "0",
         "--percentile-metrics", "ttft,tpot,itl", "--metric-percentiles", "50,99",
         "--save-result", "--result-dir", "bench", "--result-filename", f"c{c}.json"],
        capture_output=True, text=True)
    if run.returncode != 0:
        print(run.stderr[-2000:])
        break
    r = json.load(open(f"bench/c{c}.json"))
    results.append({"concurrency": c, "throughput": r["output_throughput"], "itl_p50": r["median_itl_ms"],
                    "itl_p99": r["p99_itl_ms"], "ttft_p50": r["median_ttft_ms"]})
    print(f"{c:>3} in flight: {r['output_throughput']:7.0f} output tokens/s · ITL median {r['median_itl_ms']:5.1f} ms, "
          f"p99 {r['p99_itl_ms']:5.1f} ms · TTFT median {r['median_ttft_ms']:6.0f} ms")`,
        expect: 'Throughput rising steeply at first and then flattening, while ITL creeps up and then climbs. Your numbers are for this GPU, this model and this prompt shape only.',
      },
      {
        title: 'Plot throughput and latency',
        text: `Two charts, because they have different units. On the right, the dashed line is a ${ITL_SLO_MS} ms ITL target: the best operating point is the highest concurrency whose p99 stays under it. That is the number admission control (max_num_seqs) should protect.`,
        code: `import matplotlib.pyplot as plt

SLO_MS = ${ITL_SLO_MS}
xs = [r["concurrency"] for r in results]
fig, (left, right) = plt.subplots(1, 2, figsize=(11, 4))
left.plot(xs, [r["throughput"] for r in results], marker="o")
left.set(xscale="log", xlabel="requests in flight", ylabel="output tokens per second", title="Throughput")
left.set_xticks(xs, [str(x) for x in xs])
right.plot(xs, [r["itl_p50"] for r in results], marker="o", label="median")
right.plot(xs, [r["itl_p99"] for r in results], marker="o", label="p99")
right.axhline(SLO_MS, linestyle="--", color="gray", label=f"{SLO_MS} ms target")
right.set(xscale="log", xlabel="requests in flight", ylabel="ms between tokens", title="Inter-token latency")
right.set_xticks(xs, [str(x) for x in xs])
right.legend()
plt.tight_layout()
plt.show()

ok = [r for r in results if r["itl_p99"] <= SLO_MS]
if ok:
    best = max(ok, key=lambda r: r["concurrency"])
    print(f"Best concurrency within the target: {best['concurrency']}, at {best['throughput']:.0f} tokens/s")
else:
    print("No concurrency met the target on this GPU")`,
        expect: 'Two charts and a best operating point. Compare their shape with the 14.7 figure, which uses illustrative constants for a larger GPU and model.',
      },
      {
        title: 'Measure prefix caching',
        text: `Each request below starts with the same long system prompt: ${p.assistant}’s instructions and ${seed.docIds.length} of ${p.company}’s documents${seed.examples ? ` and ${seed.examples} recent ${seed.noun} as examples` : ''}, about 1,500 tokens. vLLM caches the KV blocks of a prefix it has seen, so after the first request it can skip most of the prefill. The second run puts a different number at the very start of each prompt, which breaks the match, so every request pays for the full prefill. Compare the time to first token.`,
        code: `import random, statistics

CONTEXT = ${py(seed.context)}
SYSTEM = ("You are ${p.assistant}, the assistant of ${p.company}, a fictional company. "
          "Answer in one sentence using only these documents.\\n\\n" + CONTEXT)
QUESTIONS = [QUESTION] + [f"{QUESTION} (asked again, variant {i})" for i in range(1, 12)]

def ttft(system, question):
    start = time.perf_counter()
    stream = client.chat.completions.create(
        model=MODEL, max_tokens=16, temperature=0, stream=True,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": question}],
        extra_body={"chat_template_kwargs": {"enable_thinking": False}})
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            first = time.perf_counter() - start
            break
    for _ in stream:
        pass
    return first * 1000

shared = [ttft(SYSTEM, q) for q in QUESTIONS]
unique = [ttft(f"Request {random.randrange(10**9)}. " + SYSTEM, q) for q in QUESTIONS]
print(f"Shared prefix: first request {shared[0]:.0f} ms, then median {statistics.median(shared[1:]):.0f} ms")
print(f"Unique prefix: median {statistics.median(unique):.0f} ms")`,
        expect: 'The first shared-prefix request about as slow as the unique ones, and the later ones much faster. That gap is the prefill that prefix caching saved.',
      },
      {
        title: 'Stop the server',
        text: 'This ends vLLM and frees the GPU memory it held.',
        code: `server.terminate()
server.wait()
print("Server stopped")`,
      },
    ],
    { torch: false, kept: 'Save the charts (right-click, Save image) and copy the printed numbers into your lab notes first.' },
  )
}

export const VLLM_BENCH: GuideDef<VllmSeed> = {
  id: 'vllm-bench',
  section: '14.7',
  title: 'Benchmark vLLM on a GPU',
  fileStem: 'vllm-benchmark',
  load: loadVllmSeed,
  source: (seed) => ({
    files: seed.files,
    note: `The prefix-caching step uses this question, ${seed.docIds.length} documents${seed.examples ? ` and ${seed.examples} recent ${seed.noun}` : ''} as its shared prompt.`,
  }),
  steps: vllmSteps,
  limits: (p) =>
    `You will measure a real serving engine: throughput, per-token latency and the effect of prefix caching, on one GPU. It does not tell you what ${p.company} would need in production: a T4 is a small, older GPU, the prompts are random or repeated, one replica has no failover, and a different model, GPU or vLLM version gives different numbers. Use the results for their shape, and plan capacity from a load test on your own hardware.`,
  links: [
    { label: 'vLLM documentation', href: 'https://docs.vllm.ai/' },
    { label: 'vllm bench serve', href: 'https://docs.vllm.ai/en/latest/cli/bench/serve/' },
    { label: `${VLLM_MODEL} model card`, href: VLLM_MODEL_CARD },
  ],
}
