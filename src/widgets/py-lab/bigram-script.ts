/** The Appendix A script, reading its text from files, and the text it prints inline. A test keeps this equal to the page. */
export const BIGRAM_SCRIPT = String.raw`"""Tiny character language model, trained end to end on CPU with NumPy only.

What it shows: vocabulary from training text only, separate train / validation / test
splits, next-character targets, softmax cross-entropy, gradients, SGD updates,
checkpoint selection on validation loss, a unigram baseline, save + reload + verify,
temperature sampling, and a JSON report. Context is ONE character (a bigram model),
so it cannot learn long-range structure; that is what transformers add.
Run:  python -m pip install numpy   then   python tiny_bigram_lab.py
"""
import json, time
from pathlib import Path
import numpy as np

SEED, STEPS, BATCH, LR = 11, 1500, 256, 2.0
rng = np.random.default_rng(SEED)

train_text = open("train.txt").read()
val_text = open("val.txt").read()
test_text = open("test.txt").read()

chars = ["<unk>"] + sorted(set(train_text))          # vocabulary from TRAIN only
stoi = {c: i for i, c in enumerate(chars)}
enc = lambda t: np.array([stoi.get(c, 0) for c in t], dtype=np.int64)
tr, va, te = enc(train_text), enc(val_text), enc(test_text)
V = len(chars)

def softmax(z):
    z = z - z.max(axis=-1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=-1, keepdims=True)

def loss(seq, W):                                     # mean cross-entropy in nats/char
    p = softmax(W[seq[:-1]])
    return float(-np.log(p[np.arange(len(seq) - 1), seq[1:]] + 1e-12).mean())

W = rng.normal(0, 0.01, (V, V))                       # one V x V table of logits
best_val, best_W, history = float("inf"), W.copy(), []
t0 = time.perf_counter()
for step in range(STEPS + 1):
    i = rng.integers(0, len(tr) - 1, size=BATCH)      # random (current, next) pairs
    x, y = tr[i], tr[i + 1]
    g = softmax(W[x]); g[np.arange(BATCH), y] -= 1     # dLoss/dlogits = p - onehot
    grad = np.zeros_like(W); np.add.at(grad, x, g / BATCH)
    W -= LR * grad
    if step % 100 == 0:
        h = {"step": step, "train": loss(tr, W), "val": loss(va, W)}
        history.append(h)
        if h["val"] < best_val:
            best_val, best_W = h["val"], W.copy()
secs = time.perf_counter() - t0

uni = np.bincount(tr, minlength=V).astype(float) + 1.0  # add-one smoothed unigram
uni /= uni.sum()
baseline = float(-np.log(uni[te[1:]]).mean())
test_loss = loss(te, best_W)

np.savez("tiny_bigram_checkpoint.npz", W=best_W, chars=np.array(chars))
ck = np.load("tiny_bigram_checkpoint.npz", allow_pickle=False)
assert np.array_equal(ck["W"], best_W), "reloaded weights differ"
assert abs(loss(te, ck["W"]) - test_loss) < 1e-12, "reloaded model scores differently"

def sample(W, start="t", n=160, temperature=0.8, seed=SEED + 1):
    r, out = np.random.default_rng(seed), [stoi[start]]
    for _ in range(n):
        out.append(int(r.choice(V, p=softmax(W[out[-1]] / temperature))))
    return "".join(chars[i] for i in out)

report = {"numpy": np.__version__, "seed": SEED, "vocab": V, "parameters": int(W.size),
          "steps": STEPS, "batch": BATCH, "lr": LR, "train_seconds": round(secs, 2),
          "uniform_loss": float(np.log(V)), "best_val": best_val, "test": test_loss,
          "unigram_baseline_test": baseline, "history": history,
          "sample_t0.8": sample(ck["W"])}
Path("tiny_bigram_report.json").write_text(json.dumps(report, indent=2))
print(f"vocab {V}  params {W.size}  {secs:.2f}s")
print(f"uniform {np.log(V):.3f}  unigram test {baseline:.3f}  bigram test {test_loss:.3f}  best val {best_val:.3f}")
print("sample:", report["sample_t0.8"][:120].replace("\n", " / "))
`

export const MANUAL_TEXT = {
  train: "the gateway checks the tenant before the request reaches a model.\nthe retriever returns passages with their source ids and versions.\nthe reranker reads the query and each passage together.\nthe assistant cites a passage or says it cannot find an answer.\nthe queue keeps jobs until a worker has finished them.\na worker retries a failed job with backoff and a fresh deadline.\nthe same idempotency key returns the same ticket on a retry.\nan evaluation set holds real questions with expected answers.\nthe judge is checked against people before it gates a release.\nthe index stores vectors, text and the permissions of each chunk.\nthe trace links retrieval, generation and tool calls for one task.\nthe release manifest records the model, prompt and index versions.\na canary sends a small share of traffic to the new version first.\nif quality falls, the rollout returns traffic to the old version.\n",
  val: "the worker checks the index before the release.\nthe assistant reads the trace and cites the source.\n",
  test: "a retry keeps the same key so the ticket is not repeated.\nthe gateway sends traffic to the new model version.\n",
}
