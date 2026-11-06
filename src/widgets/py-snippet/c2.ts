/** Chapter 2 snippets: similarity, base rates and sampling, gradient descent, entropy, vectorised Python, number formats. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { NUMBER_COLUMNS, fromMessages, neutral, projectLabelled, type Snippet, type SnippetBundle } from './common.ts'

// ---- 2.1 Dot product and cosine similarity on word counts -------------------------------------------------------------

const SIMILARITY = String.raw`import json, re
import numpy as np

rows = json.load(open("messages.json", encoding="utf-8"))
texts = list(dict.fromkeys(r["text"] for r in rows if r["language"] == "en"))   # English, without repeats

# Turn each message into a vector: one position per word, holding how often the word appears.
vocab = sorted({w for t in texts for w in re.findall(r"[a-z']+", t.lower())})
index = {w: i for i, w in enumerate(vocab)}
X = np.zeros((len(texts), len(vocab)))
for row, t in enumerate(texts):
    for w in re.findall(r"[a-z']+", t.lower()):
        X[row, index[w]] += 1
print(f"{len(texts)} messages became vectors of {len(vocab)} numbers each")

QUERY = 0                       # which message to compare with the others: change it and run again
q = X[QUERY]
dot = X @ q                                                     # one dot product per message, in one step
cosine = dot / (np.linalg.norm(X, axis=1) * np.linalg.norm(q))  # the same, ignoring length
dot[QUERY] = cosine[QUERY] = -1                                 # leave out the message itself

print(f"\nQuery: {texts[QUERY]!r}")
print("\nClosest by dot product (favours long messages):")
for i in np.argsort(-dot)[:3]:
    print(f"  {dot[i]:5.1f}  {texts[i][:70]!r}")
print("\nClosest by cosine similarity (only the direction counts):")
for i in np.argsort(-cosine)[:3]:
    print(f"  {cosine[i]:5.2f}  {texts[i][:70]!r}")

doubled = q * 2                                                 # the query with every word said twice
print(f"\nSaying the query twice doubles its dot product with itself ({q @ q:.0f} -> {doubled @ q:.0f}),")
print(f"but its cosine stays {doubled @ q / (np.linalg.norm(doubled) * np.linalg.norm(q)):.2f}.")
`

// ---- 2.2 Base rates, by counting, and how much a sample wobbles --------------------------------------------------------

const EVENTS: Record<string, { file: string; column: string; what: string; positive: (r: Record<string, string>) => boolean }> = {
  harbor: { file: 'tickets.csv', column: 'category', what: 'security tickets', positive: (r) => r.category === 'security' },
  store: { file: 'orders.csv', column: 'returned', what: 'returned orders', positive: (r) => r.returned === '1' },
  bank: { file: 'transactions.csv', column: 'fraud', what: 'fraudulent transactions', positive: (r) => r.fraud === '1' },
  travel: { file: 'bookings.csv', column: 'cancelled', what: 'cancelled bookings', positive: (r) => r.cancelled === '1' },
}

const BASE_RATES = String.raw`import json
import numpy as np

data = json.load(open("events.json", encoding="utf-8"))
events = np.array(data["events"])          # 1 = the event happened, 0 = it did not
WHAT = data["what"]
base_rate = events.mean()
print(f"{events.sum():,} {WHAT} out of {len(events):,} rows: a base rate of {base_rate:.1%}")

# A detector that catches 95% of real cases and wrongly flags 2% of the rest. Change both and run again.
RECALL, FALSE_ALARMS = 0.95, 0.02
N = 10_000
real = round(N * base_rate)
caught = round(real * RECALL)
wrongly_flagged = round((N - real) * FALSE_ALARMS)
print(f"\nOut of {N:,} rows: {real:,} real cases, {caught:,} of them flagged,")
print(f"plus {wrongly_flagged:,} of the other {N - real:,} flagged by mistake.")
print(f"So a flagged row is a real case {caught / (caught + wrongly_flagged):.0%} of the time.")

# Sampling: measure the rate on 100 random rows, 1,000 times over, and see how much it moves.
rng = np.random.default_rng(42)
SAMPLE = 100
rates = np.array([rng.choice(events, SAMPLE).mean() for _ in range(1000)])
low, high = np.percentile(rates, [2.5, 97.5])
print(f"\nMeasured on {SAMPLE} rows at a time, 95% of the measurements fall between {low:.0%} and {high:.0%}.")
print("Try SAMPLE = 400: the range shrinks to about half, because four times the data halves the wobble.")
`

async function baseRates(p: Project, read: DataReader): Promise<SnippetBundle> {
  const e = EVENTS[p.id]
  const rows = (await read.csv(e.file)) as unknown as Record<string, string>[]
  const events = rows.map((r) => (e.positive(r) ? 1 : 0))
  return { code: BASE_RATES, files: { 'events.json': JSON.stringify({ what: e.what, events }) }, sources: [e.file] }
}

// ---- 2.3 Gradient descent by hand ----------------------------------------------------------------------------------

const DESCENT = String.raw`# Fit y = w * x to a few points by gradient descent. The best w is 3.
xs = [1.0, 2.0, 3.0, 4.0]
ys = [3.1, 5.9, 9.2, 11.8]

def loss(w):                     # how wrong w is: the average squared miss
    return sum((w * x - y) ** 2 for x, y in zip(xs, ys)) / len(xs)

def slope(w):                    # which way the loss goes as w grows, measured by nudging w a tiny bit
    h = 1e-6
    return (loss(w + h) - loss(w - h)) / (2 * h)

results = {}
for LEARNING_RATE in (0.01, 0.05, 0.13):     # try 0.14: the steps overshoot and grow
    w = 0.0
    print(f"learning rate {LEARNING_RATE}")
    for step in range(8):
        w = w - LEARNING_RATE * slope(w)       # step downhill
        print(f"  step {step + 1}: w = {w:7.3f}   loss = {loss(w):9.3f}")
    results[LEARNING_RATE] = w
    print()
`

// ---- 2.4 Entropy, cross-entropy and KL on the label mix -------------------------------------------------------------

const ENTROPY = String.raw`import json, collections, math

rows = json.load(open("labelled.json", encoding="utf-8"))
counts = collections.Counter(r["label"] for r in rows)
total = sum(counts.values())
p = {label: n / total for label, n in counts.items()}        # the real mix of labels
print("Label mix:", ", ".join(f"{k} {v:.0%}" for k, v in sorted(p.items(), key=lambda kv: -kv[1])))

def surprise(prob):                       # in bits: a 50/50 outcome is 1 bit of surprise
    return -math.log2(prob)

entropy = sum(p[k] * surprise(p[k]) for k in p)
print(f"\nEntropy: {entropy:.2f} bits. An even mix of {len(p)} labels would be {math.log2(len(p)):.2f} bits.")

# Two guessers. Cross-entropy is their average surprise when the real labels arrive.
even = {k: 1 / len(p) for k in p}                 # knows nothing: every label equally likely
smart = p                                         # knows the real mix
for name, q in (("even guess", even), ("knows the mix", smart)):
    cross = sum(p[k] * surprise(q[k]) for k in p)
    print(f"{name:14}: cross-entropy {cross:.2f} bits, extra surprise over the best (KL) {cross - entropy:.2f} bits")

# One confident wrong guess costs a lot: 99% on the wrong label leaves 1% for the right one.
print(f"\nGiving the right answer 90% costs {surprise(0.9):.2f} bits; giving it 1% costs {surprise(0.01):.2f} bits.")
`

async function entropy(p: Project, read: DataReader): Promise<SnippetBundle> {
  const { rows, sources } = await projectLabelled(p, read)
  return { code: ENTROPY, files: { 'labelled.json': JSON.stringify(rows) }, sources }
}

// ---- 2.5 Vectorisation and a reproducible run ------------------------------------------------------------------------


const VECTORISE = String.raw`import json, time, hashlib
import numpy as np

data = json.load(open("column.json", encoding="utf-8"))
values = np.array(data["values"], dtype=float)
print(f"{len(values):,} values of {data['what']}")

big = np.tile(values, 1_000_000 // len(values) + 1)[:1_000_000]   # a million values, to make timing visible

start = time.perf_counter()
total = 0.0
for v in big:                         # a plain Python loop, one value at a time
    total += v * v
loop = time.perf_counter() - start

start = time.perf_counter()
total2 = big @ big                    # the same sum of squares, as one NumPy operation
vectorised = time.perf_counter() - start
print(f"Python loop {loop:.3f} s, NumPy {vectorised:.4f} s: about {loop / vectorised:,.0f} times faster")
print("Same answer:", np.isclose(total, total2))

# Reproducible: a seeded generator gives the same sample every run. Change SEED and the sample changes.
SEED = 42
sample = np.random.default_rng(SEED).choice(values, 5, replace=False)
print(f"\nFive random values with seed {SEED}: {sample}")
config = {"seed": SEED, "column": data["what"], "rows": len(values)}
print("Config fingerprint:", hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest()[:12])
`

async function vectorise(p: Project, read: DataReader): Promise<SnippetBundle> {
  const { file, column, what } = NUMBER_COLUMNS[p.id]
  const rows = (await read.csv(file)) as unknown as Record<string, string>[]
  const values = rows.map((r) => Number(r[column])).filter((v) => Number.isFinite(v))
  return { code: VECTORISE, files: { 'column.json': JSON.stringify({ what, values }) }, sources: [file] }
}

// ---- 2.6 Number formats and memory ---------------------------------------------------------------------------------

const PRECISION = String.raw`import numpy as np

def bf16(x):
    """BF16 keeps a float32's top 16 bits (its range) and drops the rest (some precision)."""
    bits = np.array(x, dtype=np.float32).view(np.uint32)
    return (bits & np.uint32(0xFFFF0000)).view(np.float32)

np.seterr(over="ignore")                 # float16 overflows on purpose below
for value in (0.1, 3.14159265, 70_000.0, 1e-8):
    print(f"{value:>14}: float32 {np.float32(value)!s:>14}  float16 {np.float16(value)!s:>10}  bf16 {bf16(value)!s:>14}")
print("float16 cannot hold 70,000 (it tops out at 65,504) and rounds 1e-8 to 0; bf16 keeps both, with fewer digits.")

# Memory for the weights alone: parameters x bytes per parameter.
FORMATS = {"FP32": 4, "BF16": 2, "INT8": 1, "4-bit": 0.5}
print(f"\n{'model':>6} " + " ".join(f"{f:>8}" for f in FORMATS))
for billions in (1, 8, 70):
    print(f"{billions:>5}B " + " ".join(f"{billions * b:>6.1f}GB" for b in FORMATS.values()))

# Generating one token reads every weight once, so memory speed caps tokens per second.
BANDWIDTH = 100            # GB per second: a typical laptop; a datacentre GPU has several thousand
for fmt, b in FORMATS.items():
    print(f"8B model in {fmt:5}: at most {BANDWIDTH / (8 * b):5.1f} tokens per second at {BANDWIDTH} GB/s")
`

export const C2 = {
  similarity: {
    title: 'Dot product and cosine similarity',
    brief: 'Turns your English messages into word-count vectors and finds the closest messages to one of them, first by dot product, then by cosine similarity.',
    proves:
      'Cosine similarity compares direction and ignores length; the dot product rewards long messages. Word counts do not capture meaning, so "invoice" and "bill" stay unrelated here; embeddings (9.3) fix that.',
    build: fromMessages(SIMILARITY),
    check: `assert cosine.max() <= 1.0001\nassert X.shape[0] == len(texts)`,
  },
  'base-rates': {
    title: 'Base rates, by counting',
    brief: 'Measures how often an event happens in your example project’s data, works out how many alarms from a 95%-recall detector are real, and shows how much a 100-row sample wobbles.',
    proves:
      'A rare event makes most alarms false even for a good detector, and small samples give unsteady numbers. The detector is imaginary (its recall and false-alarm rate are set by hand), so this is not a measured result.',
    build: baseRates,
    check: `assert 0 < base_rate < 0.5\nassert low <= base_rate + 0.05 and high >= base_rate - 0.05`,
  },
  descent: {
    title: 'Gradient descent by hand',
    brief: 'Fits a single number to four points by stepping downhill on the loss, at three learning rates, measuring the slope by nudging the number a tiny bit.',
    proves:
      'This is the whole idea of training, on one parameter. Real training computes slopes with backpropagation for billions of parameters at once; nudging each one would not finish.',
    neutral: true,
    build: neutral(DESCENT),
    check: `assert abs(results[0.05] - 3) < 0.1, results`,
  },
  entropy: {
    title: 'Entropy and cross-entropy of your labels',
    brief: 'Measures how mixed your example project’s labels are, then how surprised two guessers are by the real labels: one that knows nothing and one that knows the mix.',
    proves:
      'Cross-entropy is the loss language models train on, and KL is the extra cost of a worse guess. Guessing from the label mix alone ignores the text, so these are baselines, not a model’s results.',
    build: entropy,
    check: `assert entropy <= math.log2(len(p)) + 1e-9\nassert entropy > 0`,
  },
  vectorise: {
    title: 'Vectorised Python and a reproducible run',
    brief: 'Sums the squares of a million values from your example project’s data with a Python loop and with one NumPy operation, then draws a seeded sample and fingerprints the settings.',
    proves:
      'Whole-array operations are much faster than Python loops, and a fixed seed repeats a random draw. Timings in the browser are slower than native Python and vary between runs, so do not read them as benchmarks.',
    build: vectorise,
    check: `assert np.isclose(total, total2)\nassert len(sample) == 5`,
  },
  precision: {
    title: 'Number formats and model memory',
    brief: 'Stores the same numbers as float32, float16 and bfloat16, then works out the memory and the speed limit of models in each format.',
    proves:
      'The ranges and roundings are exact. The memory figures are weights only, and the speed limit is a ceiling set by memory bandwidth, not a measured speed.',
    neutral: true,
    build: neutral(PRECISION),
    check: `assert np.isinf(np.float16(70_000.0))\nassert bf16(70_000.0) > 60_000`,
  },
} satisfies Record<string, Snippet>
