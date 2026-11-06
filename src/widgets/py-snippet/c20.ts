/** Chapter 20 snippets: small models, teacher data, soft targets, pruning, on-device budgets, cascades. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { neutral, projectLabelled, type Snippet, type SnippetBundle } from './common.ts'

const withLabelled = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { rows, sources, what } = await projectLabelled(p, read)
  return { code: NB + '\n' + code, files: { 'labelled.json': JSON.stringify({ what, rows: rows.slice(0, 1500) }) }, sources }
}

/** A small word-count classifier (naive Bayes) trained on the project's labelled text: the "small model" in this chapter. */
const NB = String.raw`import json, re, math, random, collections

data = json.load(open("labelled.json", encoding="utf-8"))
seen, rows = set(), []
for r in data["rows"]:                       # one copy of each distinct text, so test rows are never seen in training
    if r["text"].lower() not in seen:
        seen.add(r["text"].lower())
        rows.append(r)
random.seed(20)
random.shuffle(rows)
cut = int(len(rows) * 0.6)
train, test = rows[:cut], rows[cut:]
labels = sorted({r["label"] for r in rows})

def words(t):
    return re.findall(r"[a-z0-9]+", t.lower())

def fit(examples):
    prior = collections.Counter(r["label"] for r in examples)
    counts = {l: collections.Counter() for l in labels}
    for r in examples:
        counts[r["label"]].update(words(r["text"]))
    vocab = {w for c in counts.values() for w in c}
    return prior, counts, vocab

def predict(model, text):
    """Returns (label, confidence): the share of probability on the top label."""
    prior, counts, vocab = model
    n = sum(prior.values())
    scores = {}
    for l in labels:
        total = sum(counts[l].values()) + len(vocab)
        s = math.log((prior[l] + 1) / (n + len(labels)))
        for w in words(text):
            s += math.log((counts[l][w] + 1) / total)
        scores[l] = s
    top = max(scores.values())
    exp = {l: math.exp(s - top) for l, s in scores.items()}
    best = max(exp, key=exp.get)
    return best, exp[best] / sum(exp.values())
`

// ---- 20.1 Is a small model good enough? -------------------------------------------------------------------------------

const FIT = String.raw`model = fit(train)
right = sum(predict(model, r["text"])[0] == r["label"] for r in test)
small_acc = right / len(test)
LARGE_ACC = 0.95                 # illustrative accuracy of a large hosted model on this task
SMALL_COST, LARGE_COST = 0.00002, 0.004     # illustrative dollars per request
MONTHLY = 1_000_000
print(f"{len(train)} training and {len(test)} test {data['what']}, {len(labels)} labels")
print(f"small word-count model: {small_acc:.1%} accuracy, about {SMALL_COST * MONTHLY:,.0f} dollars a month")
print(f"large model (assumed):  {LARGE_ACC:.0%} accuracy, about {LARGE_COST * MONTHLY:,.0f} dollars a month")
for n in sorted({min(n, len(train)) for n in (10, 20, 50, len(train))}):
    m = fit(train[:n])
    acc = sum(predict(m, r["text"])[0] == r["label"] for r in test) / len(test)
    print(f"  trained on {n:5} examples -> {acc:.1%}")
print("Synthetic text is easier than real messages; measure on your own held-out data before deciding.")
`

// ---- 20.2 Filtering teacher labels -------------------------------------------------------------------------------------

const TEACHER = String.raw`TEACHER_RIGHT = 0.88              # the teacher's label is right this often (simulated)
def teacher(r):
    right = random.random() < TEACHER_RIGHT
    label = r["label"] if right else random.choice([l for l in labels if l != r["label"]])
    confidence = random.uniform(0.75, 1.0) if right else random.uniform(0.3, 0.9)
    return label, confidence

pool = [r for r in train]
labelled = []
for r in pool:
    a, ca = teacher(r)
    b, cb = teacher(r)                   # ask twice with a different sample
    labelled.append({"text": r["text"], "gold": r["label"], "a": a, "b": b, "conf": min(ca, cb)})

def report(name, keep):
    kept = [x for x in labelled if keep(x)]
    wrong = sum(x["a"] != x["gold"] for x in kept)
    print(f"{name:34} keeps {len(kept):5} ({len(kept) / len(labelled):4.0%}), label errors {wrong / max(1, len(kept)):5.1%}")
    return kept

report("everything the teacher wrote", lambda x: True)
report("confidence >= 0.8", lambda x: x["conf"] >= 0.8)
report("two samples agree", lambda x: x["a"] == x["b"])
kept = report("agree and confidence >= 0.8", lambda x: x["a"] == x["b"] and x["conf"] >= 0.8)
student = fit([{"text": x["text"], "label": x["a"]} for x in kept])
acc = sum(predict(student, r["text"])[0] == r["label"] for r in test) / len(test)
print(f"student trained on the filtered labels: {acc:.1%} on {len(test)} human-labelled test rows")
`

// ---- 20.3 Soft targets against hard labels -----------------------------------------------------------------------------

const SOFT = String.raw`import numpy as np

rng = np.random.default_rng(3)
def softmax(z, T=1.0):
    z = z / T
    e = np.exp(z - z.max(axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)

logits = np.array([6.0, 3.5, 0.5, -1.0])          # a teacher's scores for four classes
for T in (1, 2, 4):
    print(f"temperature {T}: " + "  ".join(f"{p:.3f}" for p in softmax(logits, T)))

# A teacher that knows classes 0 and 1 are similar. A student sees only 40 examples.
K, D = 4, 8
centres = rng.normal(0, 2, (K, D))
centres[1] = centres[0] + rng.normal(0, 0.6, D)      # two confusable classes
def sample(n):
    y = rng.integers(0, K, n)
    return centres[y] + rng.normal(0, 1.2, (n, D)), y
X_train, y_train = sample(40)
X_test, y_test = sample(4000)
teacher_logits = -((X_train[:, None, :] - centres[None]) ** 2).sum(-1) / 2   # the teacher knows the true centres

def train_student(targets, steps=600, lr=0.1):
    W = np.zeros((D, K)); b = np.zeros(K)
    for _ in range(steps):
        p = softmax(X_train @ W + b)
        g = (p - targets) / len(X_train)
        W -= lr * X_train.T @ g; b -= lr * g.sum(0)
    return (np.argmax(X_test @ W + b, axis=1) == y_test).mean()

hard = np.eye(K)[y_train]
for T in (1, 4):
    soft = softmax(teacher_logits, T)
    print(f"student on soft targets (T={T}): {train_student(soft):.1%}")
print(f"student on hard labels:          {train_student(hard):.1%}  (same 40 examples, 4,000 test points)")
`

// ---- 20.4 Pruning and quantising a small model -------------------------------------------------------------------------

const PRUNE = String.raw`import numpy as np

rng = np.random.default_rng(4)
D, K, N = 64, 5, 3000
true_W = rng.normal(0, 1, (D, K)) * (rng.random((D, K)) < 0.3)      # only some inputs matter
X = rng.normal(0, 1, (N, D))
y = np.argmax(X @ true_W + rng.normal(0, 0.5, (N, K)), axis=1)
Xtr, ytr, Xte, yte = X[:2000], y[:2000], X[2000:], y[2000:]

W = np.zeros((D, K))
for _ in range(400):                                                   # train a linear classifier
    z = Xtr @ W
    p = np.exp(z - z.max(1, keepdims=True)); p /= p.sum(1, keepdims=True)
    W -= 0.5 * Xtr.T @ (p - np.eye(K)[ytr]) / len(Xtr)
acc = lambda M: (np.argmax(Xte @ M, axis=1) == yte).mean()
print(f"trained: {W.size} weights, accuracy {acc(W):.1%}")

for share in (0.5, 0.8, 0.95):
    cut = np.quantile(np.abs(W), share)
    pruned = np.where(np.abs(W) >= cut, W, 0.0)
    print(f"  prune the smallest {share:.0%}: {int((pruned != 0).sum()):4} weights left, accuracy {acc(pruned):.1%}")

scale = np.abs(W).max() / 127
int8 = np.round(W / scale).astype(np.int8)
print(f"  int8 weights: {int8.nbytes} bytes instead of {W.astype(np.float32).nbytes}, accuracy {acc(int8 * scale):.1%}")
`

// ---- 20.5 Will it run on the device? -----------------------------------------------------------------------------------

const DEVICE = String.raw`DEVICES = {"phone (8 GB, ~50 GB/s)": (8, 50), "laptop CPU (16 GB, ~80 GB/s)": (16, 80),
           "laptop with GPU (8 GB VRAM, ~300 GB/s)": (8, 300)}
MODELS = {"0.5B": 0.5e9, "1.5B": 1.5e9, "3B": 3e9, "8B": 8e9}
BYTES = {"4-bit": 0.55, "8-bit": 1.0, "16-bit": 2.0}
USABLE = 0.5            # share of device memory an app can reasonably use

for device, (mem_gb, bw) in DEVICES.items():
    print(device)
    for name, params in MODELS.items():
        row = []
        for fmt, b in BYTES.items():
            size = params * b / 1e9
            if size > mem_gb * USABLE:
                row.append(f"{fmt}: too big")
            else:
                row.append(f"{fmt}: {size:4.1f} GB ~{bw / size:4.0f} tok/s")      # decode reads all weights per token
        print(f"   {name:5} " + " | ".join(row))
print("Upper bounds from memory bandwidth; real speeds are lower, and phones throttle when hot.")
`

// ---- 20.6 A cascade: small first, large when unsure --------------------------------------------------------------------

const CASCADE = String.raw`model = fit(train[:30])          # a deliberately small model: 30 training examples
LARGE_ACC = 0.95
SMALL_COST, LARGE_COST = 0.00002, 0.004
preds = [(predict(model, r["text"]), r["label"]) for r in test]
print(f"small model trained on 30 examples; {len(test)} test {data['what']}; a large model (assumed {LARGE_ACC:.0%} right) handles what the small one sends up")
print("threshold  sent to large  accuracy  cost per 1,000 requests")
for threshold in (0.0, 0.6, 0.8, 0.9, 0.99, 1.01):
    right = cost = up = 0
    for (label, conf), gold in preds:
        cost += SMALL_COST
        if conf >= threshold:
            right += label == gold
        else:
            up += 1
            cost += LARGE_COST
            right += random.random() < LARGE_ACC
    print(f"{threshold:9.2f}  {up / len(test):12.0%}  {right / len(test):8.1%}  {cost / len(test) * 1000:10.2f} dollars")
`

export const C20 = {
  'small-model-fit': {
    title: 'Is a small model good enough?',
    brief: 'Trains a small word-count classifier on your project’s labelled text, compares its accuracy and cost with an assumed large model, and shows how accuracy grows with training examples.',
    proves: 'That a tiny model can be enough for narrow classification on this data. The data is synthetic and the large model’s accuracy is assumed, so it does not settle your choice.',
    build: withLabelled(FIT),
    check: 'assert 0 <= small_acc <= 1',
  },
  'teacher-filtering': {
    title: 'Filtering teacher labels',
    brief: 'Simulates a teacher model labelling your project’s training rows twice, filters by confidence and agreement, and trains a student on what is kept.',
    proves: 'How filtering trades quantity for label quality. The teacher’s mistakes and confidences are simulated, not from a real model.',
    build: withLabelled(TEACHER),
    check: 'assert len(kept) <= len(labelled)',
  },
  'soft-targets': {
    title: 'Soft targets against hard labels',
    brief: 'Shows how temperature softens a teacher’s probabilities, then trains a small student on 40 examples with soft targets and with hard labels and compares them.',
    proves: 'That soft targets carry information about similar classes. It is a toy with a perfect teacher; it does not show the gain on a real language model.',
    neutral: true,
    build: neutral(SOFT),
    check: 'assert abs(softmax(logits).sum() - 1) < 1e-9',
  },
  'prune-quantise': {
    title: 'Pruning and quantising a small model',
    brief: 'Trains a linear classifier with NumPy, removes 50%, 80% and 95% of its smallest weights, and stores it in 8-bit, measuring accuracy each time.',
    proves: 'How much a model tolerates losing small weights. It is a linear toy, so it does not predict how a transformer degrades.',
    neutral: true,
    build: neutral(PRUNE),
    check: 'assert int8.nbytes * 4 == W.astype(np.float32).nbytes',
  },
  'device-budget': {
    title: 'Will it run on the device?',
    brief: 'Checks four model sizes in three formats against the memory of a phone and two laptops, and estimates decode speed from memory bandwidth.',
    proves: 'Which combinations can fit and their speed ceilings. The device figures are rough and it does not measure real speed.',
    neutral: true,
    build: neutral(DEVICE),
    check: 'assert MODELS["8B"] * BYTES["16-bit"] / 1e9 > 8 * USABLE',
  },
  'cascade': {
    title: 'A cascade: small first, large when unsure',
    brief: 'Runs the small classifier on your project’s test rows, sends low-confidence cases to an assumed large model, and shows accuracy and cost for several thresholds.',
    proves: 'How a confidence threshold trades cost for accuracy. The large model is simulated, and it does not calibrate confidences, which a real model needs first.',
    build: withLabelled(CASCADE),
    check: 'assert len(preds) == len(test)',
  },
} satisfies Record<string, Snippet>
