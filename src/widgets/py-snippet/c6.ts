/** Chapter 6 snippets: compute per training stage, deduplication, scaling, chat templates and masks, preferences, parallel memory. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { fromMessages, neutral, projectLabelled, type Snippet, type SnippetBundle } from './common.ts'

// ---- 6.1 Where the compute goes -------------------------------------------------------------------------------------

const STAGE_COMPUTE = String.raw`# Training compute is about 6 x parameters x tokens (2 for the forward pass, 4 for the backward pass).
# Illustrative token counts for an 8B model; change them and run again.
PARAMS = 8e9
STAGES = {
    "pretraining":            15e12,           # tokens of web, books, code
    "continued pretraining":  100e9,           # optional: domain text
    "supervised fine-tuning": 100_000 * 600,   # conversations x tokens each
    "preference tuning":      50_000 * 1_200 * 4,  # pairs x tokens x extra passes (two answers, reference model)
}
GPU_FLOPS = 989e12 * 0.40                       # an H100-class GPU at 40% of its peak

total = sum(6 * PARAMS * t for t in STAGES.values())
print(f"{'stage':24} {'tokens':>12} {'GPU-hours':>12} {'share':>8}")
shares = {}
for stage, tokens in STAGES.items():
    flops = 6 * PARAMS * tokens
    shares[stage] = flops / total
    print(f"{stage:24} {tokens:12.2e} {flops / GPU_FLOPS / 3600:12,.0f} {shares[stage]:8.3%}")
print("\nEverything after pretraining is a rounding error in compute, which is why adapting a model is affordable.")
`

// ---- 6.2 Exact and near-duplicate detection with MinHash ------------------------------------------------------------

const DEDUP = String.raw`import json, hashlib, itertools, random, string

rows = json.load(open("messages.json", encoding="utf-8"))
texts = [r["text"] for r in rows]

# 1. Exact duplicates: hash the normalised text and keep the first of each hash.
NO_PUNCT = str.maketrans(string.punctuation, " " * len(string.punctuation))
def normalise(t):
    return " ".join(t.lower().translate(NO_PUNCT).split())      # lower-case, ASCII punctuation to spaces
seen, exact_dupes = set(), 0
for t in texts:
    h = hashlib.sha1(normalise(t).encode()).hexdigest()
    exact_dupes += h in seen
    seen.add(h)
unique = list(dict.fromkeys(normalise(t) for t in texts))
print(f"{len(texts)} messages, {exact_dupes} exact repeats (after lower-casing and dropping punctuation)")
print(f"{len(unique)} different messages remain")

# 2. Near duplicates: compare sets of 3-word shingles. MinHash estimates their overlap from 64 small numbers.
def shingles(t, n=3):
    w = t.split()
    return {" ".join(w[i:i + n]) for i in range(max(1, len(w) - n + 1))}
NUM_HASHES = 64
random.seed(0)
salts = [random.getrandbits(32) for _ in range(NUM_HASHES)]
def minhash(s):
    return [min(int(hashlib.md5(f"{salt}:{x}".encode()).hexdigest()[:8], 16) for x in s) for salt in salts]

sigs = [minhash(shingles(t)) for t in unique]
THRESHOLD = 0.6
pairs = []
for i, j in itertools.combinations(range(min(len(unique), 150)), 2):     # the first 150, to keep it quick
    estimate = sum(a == b for a, b in zip(sigs[i], sigs[j])) / NUM_HASHES
    if estimate >= THRESHOLD:
        a, b = shingles(unique[i]), shingles(unique[j])
        pairs.append((estimate, len(a & b) / len(a | b), unique[i], unique[j]))
print(f"Near-duplicate pairs above {THRESHOLD} among the first 150 different messages: {len(pairs)}")
for est, true, a, b in sorted(pairs, reverse=True)[:4]:
    print(f"  estimated {est:.2f}, exact {true:.2f}:\n    {a[:70]!r}\n    {b[:70]!r}")
`

// ---- 6.3 Scaling and compute --------------------------------------------------------------------------------------

const SCALING = String.raw`# Compute, tokens and cost for a few model sizes. All prices and rates are illustrative.
GPU_PEAK = 989e12          # dense BF16 FLOPs per second, H100-class
MFU = 0.40                 # share of peak a well-tuned run achieves
PRICE_PER_GPU_HOUR = 2.50
GPUS = 1024

print(f"Days are on {GPUS:,} GPUs.")
print(f"{'model':>6} {'tokens':>10} {'tokens/param':>13} {'GPU-hours':>12} {'days':>8} {'cost':>12}")
runs = {}
for params, tokens in ((1e9, 20e9), (8e9, 160e9), (8e9, 15e12), (70e9, 15e12)):
    flops = 6 * params * tokens
    gpu_hours = flops / (GPU_PEAK * MFU) / 3600
    runs[(params, tokens)] = gpu_hours
    print(f"{params / 1e9:5.0f}B {tokens:10.1e} {tokens / params:13,.0f} {gpu_hours:12,.0f} "
          f"{gpu_hours / GPUS / 24:8.1f} {'$' + format(gpu_hours * PRICE_PER_GPU_HOUR, ',.0f'):>12}")
print("\n20 tokens per parameter is the compute-optimal (Chinchilla) point; models served to many users train far longer,")
print("because a smaller model that trained longer costs less every time it answers.")
`

// ---- 6.4 A chat template with a loss mask --------------------------------------------------------------------------

const CHAT_TEMPLATE = String.raw`import json, re, random

rows = json.load(open("labelled.json", encoding="utf-8"))
random.seed(0)
examples = random.sample(rows, 3)

SYSTEM = "Classify the message. Reply with JSON only."
def template(messages):
    """A generic ChatML-style template: each turn is wrapped in role markers. Real models each have their own."""
    return "".join(f"<|im_start|>{m['role']}\n{m['content']}<|im_end|>\n" for m in messages)

def tokens(text):          # a stand-in tokenizer: special markers, words and punctuation
    return re.findall(r"<\|im_(?:start|end)\|>|\w+|[^\w\s]|\n", text)

trained = masked = 0
for ex in examples:
    convo = [{"role": "system", "content": SYSTEM},
             {"role": "user", "content": ex["text"]},
             {"role": "assistant", "content": json.dumps({"label": ex["label"]})}]
    prompt_part = template(convo[:2]) + "<|im_start|>assistant\n"
    full = template(convo)
    n_prompt, n_full = len(tokens(prompt_part)), len(tokens(full))
    labels = [-100] * n_prompt + tokens(full)[n_prompt:]      # -100 means "no loss here"
    trained += n_full - n_prompt
    masked += n_prompt
print("One templated example:\n")
print(full)
print("Tokens with a loss (the assistant's reply and its end marker):", labels[n_prompt:])
print(f"\nOver {len(examples)} examples: {trained} tokens trained, {masked} masked ({masked / (trained + masked):.0%} masked)")
`

async function chatTemplate(p: Project, read: DataReader): Promise<SnippetBundle> {
  const { rows, sources } = await projectLabelled(p, read)
  return { code: CHAT_TEMPLATE, files: { 'labelled.json': JSON.stringify(rows) }, sources }
}

// ---- 6.5 A reward model from preferences, and reward hacking ----------------------------------------------------------

const PREFERENCES = String.raw`import numpy as np

# Simulated answers to customer questions, each described by three features:
#   follows the policy (0/1), cites a source (0/1), length in hundreds of words.
rng = np.random.default_rng(3)
N = 2000
def answers(n):
    return np.column_stack([rng.integers(0, 2, n), rng.integers(0, 2, n), rng.uniform(0.5, 4, n)])
A, B = answers(N), answers(N)

# The raters' real taste (hidden from the learner): policy matters most, citations help, length barely counts.
# LENGTH_BIAS > 0 means raters were also swayed by long answers. Try 0.0 and 1.0.
LENGTH_BIAS = 0.6
true_w = np.array([3.0, 1.0, 0.1 + LENGTH_BIAS])
prob_A = 1 / (1 + np.exp(-(A - B) @ true_w))
prefer_A = rng.random(N) < prob_A                         # which answer the rater picked

# Train a reward model: one score per answer, so that the preferred answer scores higher (Bradley-Terry).
w = np.zeros(3)
for _ in range(2000):
    p = 1 / (1 + np.exp(-(A - B) @ w))
    w += 0.5 * (A - B).T @ (prefer_A - p) / N
print("Learned reward weights:  policy {:.2f}   citation {:.2f}   length {:.2f}".format(*w))

# Reward hacking: how much more reward a longer answer gets, with nothing else changed.
short, long = np.array([1, 1, 1.0]), np.array([1, 1, 4.0])
print(f"Same answer padded from 100 to 400 words: reward {short @ w:.2f} -> {long @ w:.2f}")
print("A policy optimised against this reward learns to pad, unless a KL penalty or a length control stops it.")

# GRPO: sample a group of answers to one prompt, score them, and push up the better-than-average ones.
group_rewards = np.array([1, 0, 0, 1, 1, 0, 0, 0], dtype=float)    # e.g. unit tests passed or not
advantage = group_rewards - group_rewards.mean()
print("\nGRPO advantages for a group of 8 answers:", advantage.round(2).tolist())
`

// ---- 6.6 Memory per GPU under data parallelism and ZeRO --------------------------------------------------------------

const PARALLEL = String.raw`# Mixed-precision Adam needs about 16 bytes per parameter: 2 weights + 2 gradients + 12 optimiser state.
PARAMS = 8e9
GPUS = 8
GPU_MEMORY_GB = 80

def per_gpu(stage):
    w, g, o = 2 * PARAMS, 2 * PARAMS, 12 * PARAMS
    if stage >= 1: o /= GPUS                 # ZeRO-1: split the optimiser state
    if stage >= 2: g /= GPUS                 # ZeRO-2: and the gradients
    if stage >= 3: w /= GPUS                 # ZeRO-3 / FSDP: and the weights
    return (w + g + o) / 1e9

print(f"{PARAMS / 1e9:.0f}B parameters on {GPUS} GPUs of {GPU_MEMORY_GB} GB (activations not included):")
memory = {}
for stage, name in enumerate(["plain data parallel", "ZeRO-1", "ZeRO-2", "ZeRO-3 / FSDP"]):
    memory[stage] = per_gpu(stage)
    fits = "fits" if memory[stage] < GPU_MEMORY_GB else "does not fit"
    print(f"  {name:20} {memory[stage]:7.1f} GB per GPU   {fits}")

# Pipeline parallelism: with S stages and M micro-batches, part of the time GPUs wait.
STAGES = 4
for micro in (1, 4, 16):
    idle = (STAGES - 1) / (micro + STAGES - 1)
    print(f"Pipeline with {STAGES} stages and {micro:2} micro-batches: GPUs idle {idle:.0%} of the time")
`

export const C6 = {
  'stage-compute': {
    title: 'Where the training compute goes',
    brief: 'Works out the GPU-hours of pretraining, continued pretraining, fine-tuning and preference tuning for an 8B model, and each stage’s share of the total.',
    proves:
      'Pretraining dominates compute by orders of magnitude. The token counts and GPU speed are illustrative, and the estimate leaves out experiments, failed runs and evaluation, so it is not a real budget.',
    neutral: true,
    build: neutral(STAGE_COMPUTE),
    check: `assert shares["pretraining"] > 0.95\nassert abs(sum(shares.values()) - 1) < 1e-9`,
  },
  dedup: {
    title: 'Exact and near-duplicate detection',
    brief: 'Finds exact repeats among your example project’s messages with a hash, then near-duplicates with MinHash, and compares MinHash’s estimate with the exact overlap.',
    proves:
      'MinHash estimates overlap from a short signature, which is what lets deduplication scale to billions of documents. Comparing every pair, as here, does not scale; real pipelines add locality-sensitive hashing so only likely pairs are compared.',
    build: fromMessages(DEDUP),
    check: `assert exact_dupes >= 0\nassert all(0 <= p[1] <= 1 for p in pairs)`,
  },
  scaling: {
    title: 'Compute, tokens and cost by model size',
    brief: 'Works out training GPU-hours, days and cost for four model sizes and token budgets, from the 6 × parameters × tokens estimate.',
    proves:
      'Cost grows with both model size and data, and training past the compute-optimal point costs more up front. Prices, utilisation and GPU counts are illustrative, not quotes.',
    neutral: true,
    build: neutral(SCALING),
    check: `assert runs[(70e9, 15e12)] > runs[(8e9, 15e12)] > runs[(8e9, 160e9)]`,
  },
  'chat-template': {
    title: 'A chat template and its loss mask',
    brief: 'Turns three of your example project’s labelled messages into fine-tuning conversations, applies a ChatML-style template, and marks which tokens are trained and which are masked.',
    proves:
      'Only the assistant’s reply teaches the model. The template is generic and the tokenizer is a stand-in that splits on words, not a real model’s, so the counts are not real token counts.',
    build: chatTemplate,
    check: `assert trained > 0 and masked > trained\nassert labels[:n_prompt] == [-100] * n_prompt`,
  },
  preferences: {
    title: 'A reward model, and how it gets gamed',
    brief: 'Learns a reward model from 2,000 simulated preference pairs, shows how a length bias in the raters turns into reward for padding, and computes GRPO advantages for a group of answers.',
    proves:
      'A reward model copies the raters’ biases, and optimising against it exploits them. The answers and preferences are simulated with a seed, so the weights are not from real data.',
    neutral: true,
    build: neutral(PREFERENCES),
    check: `assert w[0] > w[1] > 0\nassert abs(advantage.sum()) < 1e-9`,
  },
  'parallel-memory': {
    title: 'Memory per GPU, and the pipeline bubble',
    brief: 'Works out the memory each GPU needs to train an 8B model under plain data parallelism and the three ZeRO stages, and how long pipeline GPUs sit idle.',
    proves:
      'Sharding removes the copies that plain data parallelism keeps on every GPU. The figures do not include activations or temporary buffers, so a run needs more memory than shown.',
    neutral: true,
    build: neutral(PARALLEL),
    check: `assert memory[0] == 128\nassert memory[3] == 16`,
  },
} satisfies Record<string, Snippet>
