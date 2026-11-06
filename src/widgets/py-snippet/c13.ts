/** Chapter 13 snippets: adaptation economics, labelling quality, LoRA sizes, extraction metrics, hard negatives, release gates, lineage. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { neutral, projectDocs, projectLabelled, type Snippet, type SnippetBundle } from './common.ts'

const withDocs = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { docs, sources } = await projectDocs(p, read)
  return { code, files: { 'docs.json': JSON.stringify(docs.slice(0, 120)) }, sources }
}
const withLabelled = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { rows, sources, what } = await projectLabelled(p, read)
  return { code, files: { 'labelled.json': JSON.stringify({ what, rows: rows.slice(0, 600) }) }, sources }
}

// ---- 13.1 When does distillation pay for itself? -----------------------------------------------------------------------

const DISTIL = String.raw`# Illustrative figures from the logistics example; replace them with your own.
LARGE_PER_ITEM = 0.004          # dollars per item on a large hosted model
SMALL_GPU_MONTH = 900           # dollars a month to self-host the small model
SMALL_PER_ITEM = 0.00001        # extra dollars per item (power, storage)
ONE_OFF = 6_000                 # teacher labelling, human spot checks, training runs, evaluation
UPKEEP_MONTH = 1_500            # an engineer's share to monitor, retrain and patch

print(f"{'items/month':>12} {'large model':>12} {'small model':>12}  payback")
for volume in (100_000, 300_000, 1_000_000, 3_000_000, 10_000_000):
    large = volume * LARGE_PER_ITEM
    small = SMALL_GPU_MONTH + UPKEEP_MONTH + volume * SMALL_PER_ITEM
    saving = large - small
    payback = f"{ONE_OFF / saving:4.1f} months" if saving > 0 else "never"
    print(f"{volume:12,} {large:12,.0f} {small:12,.0f}  {payback}")
break_even = (SMALL_GPU_MONTH + UPKEEP_MONTH) / (LARGE_PER_ITEM - SMALL_PER_ITEM)
print(f"Break-even volume: about {break_even:,.0f} items a month, before counting the one-off cost.")
`

// ---- 13.2 Rubber-stamping and agreement -------------------------------------------------------------------------------

const LABELLING = String.raw`import json, random, collections

random.seed(13)
data = json.load(open("labelled.json", encoding="utf-8"))
gold = [r["label"] for r in data["rows"]]
labels = sorted(set(gold))
DRAFT_RIGHT = 0.85                       # the model's draft label is right this often
# How often each annotator fixes a wrong draft, and how often they wrongly change a right one.
ANNOTATORS = {"A": (0.90, 0.02), "B": (0.85, 0.03), "C": (0.05, 0.00)}

drafts = [g if random.random() < DRAFT_RIGHT else random.choice([l for l in labels if l != g]) for g in gold]
results = {}
for name, (fix, spoil) in ANNOTATORS.items():
    final, edits = [], 0
    for g, d in zip(gold, drafts):
        if d != g and random.random() < fix:
            out = g
        elif d == g and random.random() < spoil:
            out = random.choice([l for l in labels if l != g])
        else:
            out = d
        edits += out != d
        final.append(out)
    errors = sum(f != g for f, g in zip(final, gold))
    results[name] = final
    print(f"annotator {name}: edits {edits / len(gold):5.1%} of drafts, error rate {errors / len(gold):5.1%}")

def kappa(x, y):
    n = len(x)
    observed = sum(a == b for a, b in zip(x, y)) / n
    cx, cy = collections.Counter(x), collections.Counter(y)
    expected = sum(cx[l] * cy[l] for l in labels) / n / n
    return (observed - expected) / (1 - expected)

print(f"Agreement A vs B: kappa {kappa(results['A'], results['B']):.2f}; A vs C: {kappa(results['A'], results['C']):.2f}")
print(f"{len(gold)} {data['what']}; the drafts were {sum(d != g for d, g in zip(drafts, gold))} labels wrong.")
print("C almost never edits: a low edit rate with a high error rate is rubber-stamping, not skill.")
`

// ---- 13.3 LoRA sizes, and a merged adapter -----------------------------------------------------------------------------

const LORA = String.raw`import numpy as np

# A Llama-3-8B-shaped model: hidden size 4096, 32 layers, 8 KV heads of 128, MLP width 14,336.
D, LAYERS, KV, MLP = 4096, 32, 8 * 128, 14_336
MATRICES = {"q": (D, D), "k": (D, KV), "v": (D, KV), "o": (D, D), "gate": (D, MLP), "up": (D, MLP), "down": (MLP, D)}
TARGETS = {"q, v": ["q", "v"], "attention": ["q", "k", "v", "o"], "all linear": list(MATRICES)}
TOTAL = 8.0e9

print("rank  targets      trainable parameters  share of the model")
for r in (8, 16, 64):
    for name, mats in TARGETS.items():
        params = LAYERS * sum(r * (MATRICES[m][0] + MATRICES[m][1]) for m in mats)
        print(f"{r:4}  {name:11} {params / 1e6:18.1f} M   {params / TOTAL:8.2%}")

print("\nRough training memory for 8 billion parameters (no activations):")
print(f"  full fine-tune, 16 bytes a parameter:  {TOTAL * 16 / 1e9:5.0f} GB")
print(f"  LoRA, base in 16-bit (2 bytes):         {TOTAL * 2 / 1e9:5.0f} GB + adapters")
print(f"  QLoRA, base in 4-bit (0.5 bytes):       {TOTAL * 0.5 / 1e9:5.0f} GB + adapters")

rng = np.random.default_rng(3)
W = rng.normal(size=(64, 64))
B, A = rng.normal(size=(64, 4)) * 0.1, rng.normal(size=(4, 64)) * 0.1
x = rng.normal(size=64)
with_adapter = W @ x + B @ (A @ x)
merged = (W + B @ A) @ x
print(f"\nAdapter kept separate vs merged into W: largest difference {np.abs(with_adapter - merged).max():.1e}")
print(f"Adapter numbers: {B.size + A.size} against {W.size} in W ({(B.size + A.size) / W.size:.1%})")
`

// ---- 13.4 Field-level extraction metrics --------------------------------------------------------------------------------

const EXTRACT = String.raw`import json, re, random

random.seed(4)
docs = json.load(open("docs.json", encoding="utf-8"))
# The field to extract: the first number a document states, or null when it states none.
def first_number(text):
    m = re.search(r"\d[\d,]*(?:\.\d+)?", text)
    return m.group().replace(",", "") if m else None

# One record per sentence. Every other sentence has its numbers removed, so the field is truly absent there.
NUMBER = r"\d[\d,]*(?:\.\d+)?"
sentences = [s for d in docs for s in re.split(r"(?<=[.!?])\s+", d["text"]) if re.search(NUMBER, s)]
records = [s if i % 2 == 0 else re.sub(NUMBER, "some", s) for i, s in enumerate(sentences)]
gold = [first_number(s) for s in records]
TRIALS = 25            # score each record many times, so a small corpus still gives stable rates

def simulated_model(g, absent_share_in_training):
    """Stands in for a fine-tuned extractor. It fabricates more when training rarely showed an absent field."""
    if g is None:
        fabricate = 0.4 * (1 - absent_share_in_training / 0.3) if absent_share_in_training < 0.3 else 0.02
        return str(random.randint(2, 90)) if random.random() < fabricate else None
    return g if random.random() < 0.95 else str(int(float(g)) + 1)

for share in (0.02, 0.10, 0.30):
    pairs = [(simulated_model(g, share), g) for g in gold for _ in range(TRIALS)]
    exact = sum(p == g for p, g in pairs) / len(pairs)
    present = [(p, g) for p, g in pairs if g is not None]
    absent = [(p, g) for p, g in pairs if g is None]
    fabricated = sum(p is not None for p, _ in absent) / len(absent)
    print(f"absent examples in training {share:4.0%}: field accuracy {exact:5.1%}, "
          f"present-field accuracy {sum(p == g for p, g in present) / len(present):5.1%}, fabrication on absent {fabricated:5.1%}")
print(f"{len(records)} sentences from {len(docs)} documents, {sum(g is None for g in gold)} with no number to extract.")
print("The overall accuracy hides the fabrication; report the absent-field rate separately.")
`

// ---- 13.5 Mining hard negatives ----------------------------------------------------------------------------------------

const HARDNEG = String.raw`import json, re, math, collections

docs = json.load(open("docs.json", encoding="utf-8"))
STOP = {"the", "a", "an", "of", "to", "and", "is", "for", "in", "on", "with", "are", "be", "or", "by", "at", "from", "it", "can", "per", "up"}
def words(t):
    return [w for w in re.findall(r"[a-z0-9]+", t.lower()) if w not in STOP]
df = collections.Counter(w for d in docs for w in set(words(d["text"])))
def score(q, d):
    dw = collections.Counter(words(d["text"]))
    return sum(math.log(len(docs) / df[w]) * min(dw[w], 2) for w in set(words(q)) if w in dw)

# A synthetic query for each document: its title. Production pipelines ask an LLM for realistic questions.
pairs = [(d["title"], d["id"]) for d in docs]
hits, triplets = 0, []
for q, source in pairs:
    ranked = sorted(docs, key=lambda d: -score(q, d))[:10]
    ids = [d["id"] for d in ranked]
    hits += source in ids
    negatives = [d for d in ranked if d["id"] != source][:2]     # look relevant, but are not the source
    triplets.append((q, source, [n["id"] for n in negatives]))
print(f"Recall@10 of the current retriever on {len(pairs)} title queries: {hits / len(pairs):.0%}")
for q, pos, negs in triplets[:4]:
    print(f"  query '{q[:40]}' -> positive {pos}, hard negatives {negs}")
print(f"{len(triplets)} triplets ready for contrastive training; check that each negative really does not answer the query.")
`

// ---- 13.6 Release gates with uncertainty -------------------------------------------------------------------------------

const GATES = String.raw`import math

def interval(k, n):
    """Wilson 95% interval for k successes out of n."""
    z, p = 1.96, k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return centre - half, centre + half

# (suite, base passes, fine-tuned passes, cases, gate kind, threshold): illustrative counts
SUITES = [("Domain extraction", 881, 964, 1000, "at least", 0.94),
          ("Absent-field fabrication", 60, 21, 1000, "at most", 0.03),
          ("General instructions", 810, 785, 1000, "drop at most", 0.03),
          ("Multilingual", 421, 385, 500, "drop at most", 0.03),
          ("Refusal of harmful requests", 490, 458, 500, "at least", 0.97)]

for name, base, tuned, n, kind, limit in SUITES:
    lo, hi = interval(tuned, n)
    if kind == "at least":
        ok, note = lo >= limit, f"lower bound {lo:.1%} vs {limit:.0%}"
    elif kind == "at most":
        ok, note = hi <= limit, f"upper bound {hi:.1%} vs {limit:.0%}"
    else:
        drop = (base - tuned) / n
        ok, note = drop <= limit, f"drop {drop:.1%} vs {limit:.0%}"
    print(f"{name:28} base {base / n:6.1%}  tuned {tuned / n:6.1%}  {'pass' if ok else 'FAIL'}  ({note})")

CANARIES, EXTRACTED = 100, 0
print(f"Canary probe: {EXTRACTED} of {CANARIES} planted strings completed verbatim -> {'pass' if EXTRACTED == 0 else 'FAIL'}")
`

// ---- 13.7 A run record that ties model to data and code ----------------------------------------------------------------

const LINEAGE = String.raw`import json, hashlib
from types import MappingProxyType

data = json.load(open("labelled.json", encoding="utf-8"))
def digest(obj):
    return hashlib.sha256(json.dumps(obj, sort_keys=True).encode()).hexdigest()[:12]

dataset = {"name": "labelled", "rows": data["rows"]}
config = {"base": "SmolLM2-1.7B-Instruct@rev-5f1c", "method": "qlora", "rank": 16, "lr": 2e-4, "epochs": 2, "seed": 42}
run = {"dataset": digest(dataset), "config": digest(config), "code": "git:3e9a1c0", "image": "sha256:ab12…"}
run["id"] = digest(run)
registry = {"v7": MappingProxyType({"run": run["id"], "metrics": {"field_acc": 0.964, "general": 0.785}})}   # read-only
print(f"dataset {run['dataset']}  config {run['config']}  -> run {run['id']} registered as v7")

changed = json.loads(json.dumps(data["rows"]))
changed[0]["label"] = "something else"           # one label edited
print(f"one label changed -> dataset {digest({'name': 'labelled', 'rows': changed})} (a new version, a new run)")

rerun = {"field_acc": 0.961, "general": 0.787}       # a rerun on a GPU: not bit-identical
TOLERANCE = 0.005
same = all(abs(rerun[k] - registry["v7"]["metrics"][k]) <= TOLERANCE for k in rerun)
print(f"rerun of {run['id']}: {rerun} -> {'reproduced within tolerance' if same else 'NOT reproduced'} ({TOLERANCE})")
try:
    registry["v7"]["metrics"] = {"field_acc": 0.99}
except TypeError:
    print("Editing v7 is refused: a registered version is immutable, so a new result becomes v8.")
`

export const C13 = {
  'distillation-payback': {
    title: 'When distillation pays for itself',
    brief: 'Compares a large hosted model with a distilled small model across monthly volumes, including upkeep, and works out the payback time and the break-even volume.',
    proves: 'How volume decides whether adaptation pays. Every price is illustrative; it does not check that the small model is good enough.',
    neutral: true,
    build: neutral(DISTIL),
    check: 'assert 500_000 < break_even < 1_000_000',
  },
  'rubber-stamping': {
    title: 'Edit rates, error rates and agreement',
    brief: 'Gives three simulated annotators model-drafted labels for your project’s data and measures each one’s edit rate, error rate and agreement.',
    proves: 'How rubber-stamping shows up as a low edit rate with a high error rate. The drafts and annotators are simulated; it does not replace checking a gold sample.',
    build: withLabelled(LABELLING),
    check: 'assert kappa(results["A"], results["B"]) > kappa(results["A"], results["C"]) - 0.5',
  },
  'lora-sizes': {
    title: 'LoRA parameter counts and a merged adapter',
    brief: 'Counts trainable LoRA parameters for an 8B-shaped model by rank and target, estimates training memory, and shows that merging an adapter into W gives the same output.',
    proves: 'Where LoRA’s memory saving comes from and that merging is exact. It does not train anything or say which rank is good enough.',
    neutral: true,
    build: neutral(LORA),
    check: 'assert np.allclose(with_adapter, merged)',
  },
  'extraction-metrics': {
    title: 'Field accuracy hides fabrication',
    brief: 'Builds a one-field extraction set from the sentences of your project’s documents, many with the field absent, and scores a simulated extractor trained with different shares of absent examples.',
    proves: 'Why absent-field fabrication must be reported separately. The extractor is simulated; it does not show how a real fine-tune behaves.',
    build: withDocs(EXTRACT),
    check: 'assert sum(g is None for g in gold) > 0',
  },
  'hard-negatives': {
    title: 'Mining hard negatives',
    brief: 'Uses each of your project’s document titles as a query, retrieves the top ten with a keyword scorer, and keeps the high-ranked wrong documents as hard negatives.',
    proves: 'How triplets for contrastive training are mined. It does not train an embedding model, and some mined negatives may in fact be relevant.',
    build: withDocs(HARDNEG),
    check: 'assert len(triplets) == len(docs) and hits > 0',
  },
  'release-gates': {
    title: 'Release gates with intervals',
    brief: 'Checks a fine-tuned model’s scorecard against pre-agreed gates, using the lower or upper end of a 95% interval rather than the point estimate, plus a canary probe.',
    proves: 'How intervals make gates stricter on small suites. The counts are illustrative; it does not run any evaluation.',
    neutral: true,
    build: neutral(GATES),
    check: 'lo, hi = interval(964, 1000)\nassert lo < 0.964 < hi',
  },
  'run-lineage': {
    title: 'A run record with hashes',
    brief: 'Hashes your project’s labelled data and a training config into a run id, shows that one changed label makes a new version, and checks a rerun against a tolerance.',
    proves: 'How hashes tie a model to exact data and config. It does not train anything, and a real registry enforces immutability in its storage, not in a dictionary.',
    build: withLabelled(LINEAGE),
    check: 'assert run["id"] == digest({k: v for k, v in run.items() if k != "id"}) and same',
  },
} satisfies Record<string, Snippet>
