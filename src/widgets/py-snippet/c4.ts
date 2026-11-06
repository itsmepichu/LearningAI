/** Chapter 4 snippets: a network by hand, optimisers, stability, learned word vectors, convolution and recurrence, a training loop. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { fromMessages, neutral, projectTable, type Snippet, type SnippetBundle } from './common.ts'

// ---- 4.1 A two-layer network with backpropagation by hand ----------------------------------------------------------

const TINY_NET = String.raw`import numpy as np

# XOR: the output is 1 when exactly one input is 1. No straight line separates the two classes.
X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)
y = np.array([[0], [1], [1], [0]], dtype=float)
rng = np.random.default_rng(0)
HIDDEN, LR, STEPS = 4, 0.5, 3000           # change them and run again

def train(use_hidden_activation):
    W1, b1 = rng.normal(0, 1, (2, HIDDEN)), np.zeros(HIDDEN)
    W2, b2 = rng.normal(0, 1, (HIDDEN, 1)), np.zeros(1)
    for step in range(STEPS):
        # Forward pass: keep every intermediate value, backprop needs them.
        z1 = X @ W1 + b1
        h = np.tanh(z1) if use_hidden_activation else z1
        p = 1 / (1 + np.exp(-(h @ W2 + b2)))
        loss = -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))
        # Backward pass: the chain rule, layer by layer, from the loss back to each weight.
        dlogit = (p - y) / len(X)
        dW2, db2 = h.T @ dlogit, dlogit.sum(0)
        dh = dlogit @ W2.T
        dz1 = dh * (1 - h ** 2) if use_hidden_activation else dh
        dW1, db1 = X.T @ dz1, dz1.sum(0)
        for param, grad in ((W1, dW1), (b1, db1), (W2, dW2), (b2, db2)):
            param -= LR * grad
    return loss, p.ravel()

for name, act in (("no activation (linear)", False), ("tanh hidden layer", True)):
    loss, p = train(act)
    print(f"{name:24} loss {loss:.3f}   predictions {np.round(p, 2)}   right answers {y.ravel().astype(int)}")
linear_loss, _ = train(False)
tanh_loss, tanh_p = train(True)
print("\nWithout an activation the two layers act as one straight line, so XOR stays out of reach.")
`

// ---- 4.2 SGD, momentum and Adam; a warm-up and cosine schedule -----------------------------------------------------

const OPTIMISERS = String.raw`import numpy as np

# A long, narrow valley: the loss is 0.5 * (x^2 + 25 * y^2), lowest at (0, 0).
def grad(p):
    return np.array([p[0], 25 * p[1]])

def run(kind, lr, steps=60):
    p, v, m, s = np.array([-8.0, 1.5]), np.zeros(2), np.zeros(2), np.zeros(2)
    for t in range(1, steps + 1):
        g = grad(p)
        if kind == "sgd":
            p = p - lr * g
        elif kind == "momentum":
            v = 0.9 * v + g                       # remember the direction we have been going
            p = p - lr * v
        else:                                     # Adam: a step size for each parameter
            m = 0.9 * m + 0.1 * g
            s = 0.999 * s + 0.001 * g ** 2
            m_hat, s_hat = m / (1 - 0.9 ** t), s / (1 - 0.999 ** t)
            p = p - lr * m_hat / (np.sqrt(s_hat) + 1e-8)
    return np.linalg.norm(p)

print("Distance from the lowest point after 60 steps (smaller is better):")
results = {}
for kind, lr in (("sgd", 0.035), ("momentum", 0.01), ("adam", 0.3)):
    results[kind] = run(kind, lr)
    print(f"  {kind:9} learning rate {lr:<6} {results[kind]:8.4f}")
print("Try sgd at 0.08: the steep direction overshoots and it blows up.")

# The usual LLM schedule: warm up linearly, then follow a cosine curve down to 10% of the peak.
PEAK, WARMUP, TOTAL = 3e-4, 100, 1000
def lr_at(step):
    if step < WARMUP:
        return PEAK * (step + 1) / WARMUP
    done = (step - WARMUP) / (TOTAL - WARMUP)
    return PEAK * (0.1 + 0.9 * 0.5 * (1 + np.cos(np.pi * done)))
print("\nLearning rate at a few steps:", ", ".join(f"{s}: {lr_at(s):.1e}" for s in (0, 50, 100, 550, 999)))
`

// ---- 4.3 Initialisation, normalisation and residuals --------------------------------------------------------------

const STABILITY = String.raw`import numpy as np

rng = np.random.default_rng(0)
WIDTH, DEPTH = 256, 50
x0 = rng.normal(size=(64, WIDTH))                     # 64 examples go in

def push(scale, residual=False, norm=False):
    """Send the batch through DEPTH layers of ReLU, and report the size of the activations at a few depths."""
    x, sizes = x0, []
    for layer in range(1, DEPTH + 1):
        W = rng.normal(0, scale / np.sqrt(WIDTH), (WIDTH, WIDTH))
        inp = x / (np.sqrt((x ** 2).mean(axis=1, keepdims=True)) + 1e-6) if norm else x
        out = np.maximum(0, inp @ W)
        x = x + out if residual else out
        if layer in (1, 10, 25, 50):
            sizes.append(np.sqrt((x ** 2).mean()))
    return sizes

print(f"{'setup':38} {'layer 1':>10} {'layer 10':>10} {'layer 25':>10} {'layer 50':>10}")
rows = {
    "weights too small (scale 0.5)": push(0.5),
    "weights too big (scale 2.0)": push(2.0),
    "He initialisation (scale 1.41)": push(np.sqrt(2)),
    "too big, with residual + norm": push(2.0, residual=True, norm=True),
}
for name, sizes in rows.items():
    print(f"{name:38} " + " ".join(f"{s:10.2e}" for s in sizes))

# Dropout keeps the average the same: zero out some values, scale up the rest.
a = np.ones(10_000)
mask = rng.random(a.shape) > 0.1
print(f"\nDropout 10%: {1 - mask.mean():.1%} zeroed, average before {a.mean():.2f}, after {(a * mask / 0.9).mean():.2f}")
`

// ---- 4.4 Word vectors learned from your messages ------------------------------------------------------------------

const EMBEDDINGS = String.raw`import json, re, collections
import numpy as np

rows = json.load(open("messages.json", encoding="utf-8"))
texts = [re.findall(r"[a-z']+", r["text"].lower()) for r in rows if r["language"] == "en"]

# 1. Count which words appear near each other (within 3 words), for the 300 most common words.
common = [w for w, _ in collections.Counter(w for t in texts for w in t).most_common(300)]
ix = {w: i for i, w in enumerate(common)}
C = np.zeros((len(common), len(common)))
for t in texts:
    for i, w in enumerate(t):
        for u in t[max(0, i - 3): i + 4]:
            if u != w and w in ix and u in ix:
                C[ix[w], ix[u]] += 1

# 2. Squash each word's 300 counts into 16 numbers that keep the main patterns (an SVD).
U, S, _ = np.linalg.svd(np.log1p(C), full_matrices=False)
DIM = 16
vectors = U[:, :DIM] * S[:DIM]
vectors /= np.linalg.norm(vectors, axis=1, keepdims=True) + 1e-9
print(f"{len(common)} words, each now a vector of {DIM} numbers learned from {len(texts)} messages")

def nearest(word, k=4):
    sims = vectors @ vectors[ix[word]]
    return [common[i] for i in np.argsort(-sims) if common[i] != word][:k]

SKIP = {"the", "a", "i", "my", "to", "and", "of", "is", "for", "on", "in", "it", "was", "but", "we", "our", "me", "this"}
words = [w for w in common if w not in SKIP and len(w) > 3][:6]
print("\nNearest words (words used in similar places end up close together):")
for w in words:
    print(f"  {w:12} -> {', '.join(nearest(w))}")
`

// ---- 4.5 Convolution over a daily series, and a fading memory --------------------------------------------------------

const DATES: Record<string, [string, string, string]> = {
  harbor: ['tickets.csv', 'created', 'tickets'],
  store: ['orders.csv', 'order_date', 'orders'],
  bank: ['transactions.csv', 'timestamp', 'transactions'],
  travel: ['bookings.csv', 'booked_on', 'bookings'],
}

const CONV_RNN = String.raw`import json
import numpy as np

d = json.load(open("daily.json", encoding="utf-8"))
days, counts = d["days"], np.array(d["counts"], dtype=float)
print(f"{d['what'].capitalize()} per day: {len(days)} days from {days[0]} to {days[-1]}")

# A convolution slides one small filter along the series and computes the same weighted sum at every position.
SMOOTH = np.ones(7) / 7                      # a 7-day average
EDGE = np.array([1.0, 0, -1.0])              # today minus two days ago: big when the count changes fast
smooth = np.convolve(counts, SMOOTH, mode="valid")
edge = np.convolve(counts, EDGE, mode="valid")
print(f"7-day average ranges from {smooth.min():.1f} to {smooth.max():.1f} a day")
jump = int(np.argmax(np.abs(edge)))
print(f"Biggest change around {days[jump + 1]}: {edge[jump]:+.0f} compared with two days earlier")

# A recurrent network reads one step at a time and carries a hidden state forward.
# If each step keeps half of the old state, the first input fades fast.
KEEP = 0.5                                   # try 0.9: memory lasts longer, but still fades
state, trace = 1.0, []
for step in range(1, 21):
    state = KEEP * state
    trace.append(state)
print(f"\nWhat is left of the first input after 5, 10 and 20 steps: {trace[4]:.3f}, {trace[9]:.5f}, {trace[19]:.7f}")
`

async function daily(p: Project, read: DataReader): Promise<SnippetBundle> {
  const [file, column, what] = DATES[p.id]
  const rows = (await read.csv(file)) as unknown as Record<string, string>[]
  const counts = new Map<string, number>()
  for (const r of rows) {
    const day = String(r[column]).slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const days = [...counts.keys()].sort()
  return { code: CONV_RNN, files: { 'daily.json': JSON.stringify({ what, days, counts: days.map((k) => counts.get(k)) }) }, sources: [file] }
}

// ---- 4.6 The training loop, with checkpoints and the debugging habits ------------------------------------------------

const TRAINING_LOOP = String.raw`import json
import numpy as np

t = json.load(open("table.json", encoding="utf-8"))
X, y = np.array(t["X"], dtype=float), np.array(t["y"], dtype=float)
rng = np.random.default_rng(0)
order = rng.permutation(len(y))
tr, va = order[: int(len(y) * 0.8)], order[int(len(y) * 0.8):]
mean, std = X[tr].mean(0), X[tr].std(0) + 1e-9
X = (X - mean) / std
POS_WEIGHT = (y[tr] == 0).sum() / (y[tr] == 1).sum()      # the rare outcome counts more (3.3)

def init(hidden=16):
    return {"W1": rng.normal(0, np.sqrt(2 / X.shape[1]), (X.shape[1], hidden)), "b1": np.zeros(hidden),
            "W2": rng.normal(0, np.sqrt(1 / hidden), (hidden, 1)), "b2": np.zeros(1)}

def forward(P, xb):
    h = np.maximum(0, xb @ P["W1"] + P["b1"])
    return h, 1 / (1 + np.exp(-(h @ P["W2"] + P["b2"]).ravel()))

def loss_and_grads(P, xb, yb):
    h, p = forward(P, xb)
    w = np.where(yb == 1, POS_WEIGHT, 1.0)
    loss = -np.sum(w * (yb * np.log(p + 1e-9) + (1 - yb) * np.log(1 - p + 1e-9))) / w.sum()
    dz = (w * (p - yb) / w.sum())[:, None]
    dh = dz @ P["W2"].T * (h > 0)
    return loss, {"W1": xb.T @ dh, "b1": dh.sum(0), "W2": h.T @ dz, "b2": dz.sum(0)}

# Debugging habit 1: overfit one small batch first. If the loss will not fall, there is a bug.
P = init()
few = tr[:8]
for _ in range(500):
    l, g = loss_and_grads(P, X[few], y[few])
    for k in P: P[k] -= 0.5 * g[k]
print(f"Overfit 8 rows: loss {l:.3f} (should be near 0)")

# The real loop: mini-batches, forward, backward, update, evaluate, keep the best checkpoint.
P, best = init(), None
for epoch in range(1, 9):
    for batch in np.array_split(rng.permutation(tr), max(1, len(tr) // 64)):
        l, g = loss_and_grads(P, X[batch], y[batch])
        norm = np.sqrt(sum((v ** 2).sum() for v in g.values()))
        scale = min(1.0, 1.0 / (norm + 1e-9))                    # gradient clipping at 1.0
        for k in P: P[k] -= 0.1 * scale * g[k]
    val_loss, _ = loss_and_grads(P, X[va], y[va])
    recall = ((forward(P, X[va])[1] >= 0.5) & (y[va] == 1)).sum() / max(1, (y[va] == 1).sum())
    print(f"epoch {epoch}: last batch loss {l:.3f}   validation loss {val_loss:.3f}   recall {recall:.0%}")
    if best is None or val_loss < best[0]:
        best = (val_loss, epoch)
        best_P = {k: v.copy() for k, v in P.items()}
        np.savez("checkpoint.npz", **P)                       # save the best weights so far

saved = dict(np.load("checkpoint.npz"))
print(f"\nBest checkpoint: epoch {best[1]}. Reloaded weights give the same predictions:",
      np.allclose(forward(saved, X[va])[1], forward(best_P, X[va])[1]))
`

async function trainingLoop(p: Project, read: DataReader): Promise<SnippetBundle> {
  const { table, sources } = await projectTable(p, read)
  return { code: TRAINING_LOOP, files: { 'table.json': JSON.stringify(table) }, sources }
}

export const C4 = {
  'tiny-net': {
    title: 'A neural network, with backpropagation by hand',
    brief: 'Trains a two-layer network on XOR with the chain rule written out step by step, once without an activation and once with tanh.',
    proves:
      'An activation between layers is what lets a network bend its decision boundary. Four points are a toy, not a benchmark; real networks use the same steps on millions of examples, with a framework computing the gradients.',
    neutral: true,
    build: neutral(TINY_NET),
    check: `assert tanh_loss < 0.1, tanh_loss\nassert linear_loss > 0.6, linear_loss`,
  },
  optimisers: {
    title: 'SGD, momentum and Adam in a narrow valley',
    brief: 'Runs three optimisers for 60 steps down a long, narrow valley and prints how close each gets, then the learning rate of a warm-up and cosine schedule.',
    proves:
      'Momentum and Adam cope with directions of very different steepness, which plain SGD does not. A two-number valley is not a real loss surface, so the ranking can differ on a real model.',
    neutral: true,
    build: neutral(OPTIMISERS),
    check: `assert results["momentum"] < results["sgd"]\nassert abs(lr_at(99) - PEAK) < 1e-12`,
  },
  stability: {
    title: 'Signals through 50 layers',
    brief: 'Sends a batch through 50 random ReLU layers with weights too small, too big and correctly scaled, then with residual connections and normalisation, and shows how dropout keeps the average.',
    proves:
      'Weight scale decides whether activations vanish, explode or stay steady; with residuals and normalisation they grow slowly instead of exploding. These are random, untrained layers, so this shows the forward signal only, not the training behaviour.',
    neutral: true,
    build: neutral(STABILITY),
    check: `assert rows["weights too small (scale 0.5)"][-1] < 1e-6\nassert rows["weights too big (scale 2.0)"][-1] > 1e6\nassert 0.1 < rows["He initialisation (scale 1.41)"][-1] < 10`,
  },
  'word-vectors': {
    title: 'Word vectors learned from your messages',
    brief: 'Counts which words appear near each other in your English messages, squashes the counts into 16 numbers per word, and lists each word’s nearest neighbours.',
    proves:
      'Representations come from how words are used, with nobody labelling meaning. A few hundred short synthetic messages give rough neighbours; embedding models learn from billions of sentences and are not counted this way.',
    build: fromMessages(EMBEDDINGS),
    check: `assert vectors.shape == (len(common), DIM)\nassert len(nearest(words[0])) == 4`,
  },
  'conv-rnn': {
    title: 'Convolution over a daily series, and a fading memory',
    brief: 'Counts your example project’s records per day, slides a smoothing filter and a change detector along the series, then shows how fast an RNN’s memory of its first input fades.',
    proves:
      'A convolution applies the same small filter everywhere, and a plain recurrent state forgets quickly. The filters here are written by hand, not learned; a CNN learns its filters, and an LSTM learns what to keep.',
    build: daily,
    check: `assert len(smooth) == len(counts) - 6\nassert trace[19] < 1e-5`,
  },
  'training-loop': {
    title: 'A training loop, with checkpoints',
    brief: 'Overfits 8 rows first, then trains a small network on your example project’s table in mini-batches with gradient clipping, checks validation loss every epoch and saves the best checkpoint.',
    proves:
      'These are the steps every PyTorch loop runs, written out in NumPy so nothing is hidden. It does not show GPU training, mixed precision or a framework’s automatic gradients; the laptop lab above does those.',
    build: trainingLoop,
    check: `assert l >= 0 and best[1] >= 1\nassert set(saved) == {"W1", "b1", "W2", "b2"}`,
  },
} satisfies Record<string, Snippet>
