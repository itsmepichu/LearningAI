/** Chapter 5 snippets: tokenisation, attention, the block, masks, softmax, decoding and costs. */
import { fromMessages, neutral, type Snippet } from './common.ts'

// ---- 5.1 Byte-pair encoding ----------------------------------------------------------------------------------------

const BPE = String.raw`import json, collections

rows = json.load(open("messages.json", encoding="utf-8"))
english = [r["text"].lower() for r in rows if r["language"] == "en"]

# Train byte-pair encoding on the English messages only.
# Start from characters (with an end-of-word marker) and merge the most frequent adjacent pair, again and again.
N_MERGES = 150
words = collections.Counter(w for t in english for w in t.split())
vocab = {tuple(w) + ("</w>",): n for w, n in words.items()}
merges = []

def merge_word(sym, a, b):
    out, i = [], 0
    while i < len(sym):
        if i < len(sym) - 1 and sym[i] == a and sym[i + 1] == b:
            out.append(a + b)
            i += 2
        else:
            out.append(sym[i])
            i += 1
    return tuple(out)

for _ in range(N_MERGES):
    pairs = collections.Counter()
    for sym, n in vocab.items():
        for pair in zip(sym, sym[1:]):
            pairs[pair] += n
    if not pairs:
        break
    best = max(pairs, key=pairs.get)
    merges.append(best)
    vocab = {merge_word(sym, *best): n for sym, n in vocab.items()}

print("First 12 merges:", ["".join(m) for m in merges[:12]])

def tokenize(text):
    tokens = []
    for w in text.lower().split():
        sym = tuple(w) + ("</w>",)
        for a, b in merges:  # apply the merges in the order they were learned
            sym = merge_word(sym, a, b)
        tokens += sym
    return tokens

print("\nAn English message:", english[0])
print("Its tokens:", tokenize(english[0]))

by_lang = collections.defaultdict(list)
for r in rows:
    by_lang[r["language"]].append(r["text"])
print("\nTokens per character, with a tokenizer trained on English only:")
ratio = {}
for lang, texts in sorted(by_lang.items()):
    chars = sum(len(t) for t in texts)
    toks = sum(len(tokenize(t)) for t in texts)
    ratio[lang] = toks / chars
    print(f"  {lang:9s} {ratio[lang]:.2f}   ({len(texts)} messages)")
`

// ---- 5.2 Scaled dot-product attention with a causal mask ----------------------------------------------------------

const ATTENTION = String.raw`import json
import numpy as np

rows = json.load(open("messages.json", encoding="utf-8"))
tokens = next(r["text"] for r in rows if r["language"] == "en" and len(r["text"].split()) >= 5).split()[:6]
n, d, heads = len(tokens), 8, 2
rng = np.random.default_rng(0)

# Stand-in embeddings and weights: random, not trained. The shapes and operations are real; the weights mean nothing.
X = rng.normal(size=(n, d))
Wq, Wk, Wv, Wo = (rng.normal(size=(d, d)) / np.sqrt(d) for _ in range(4))

def softmax_rows(s):
    e = np.exp(s - s.max(axis=1, keepdims=True))
    return e / e.sum(axis=1, keepdims=True)

def attention(Q, K, V, causal=True):
    scores = Q @ K.T / np.sqrt(K.shape[1])        # n x n: every query against every key
    if causal:
        scores[np.triu_indices(len(Q), k=1)] = -np.inf   # a token may not look at later tokens
    w = softmax_rows(scores)
    return w @ V, w

Q, K, V = X @ Wq, X @ Wk, X @ Wv
out, w = attention(Q, K, V)
np.set_printoptions(precision=2, suppress=True)
print("Tokens:", tokens)
print("Attention weights (row = the token attending, column = the token attended to):")
print(w)
print("Each row sums to 1:", np.allclose(w.sum(axis=1), 1))
print("Nothing above the diagonal:", np.allclose(np.triu(w, k=1), 0))

# Multi-head: split the width into heads, attend in each, concatenate, mix with Wo.
dh = d // heads
parts = [attention(Q[:, h*dh:(h+1)*dh], K[:, h*dh:(h+1)*dh], V[:, h*dh:(h+1)*dh])[0] for h in range(heads)]
multi = np.concatenate(parts, axis=1) @ Wo
print(f"\n{heads} heads of width {dh}: output shape {multi.shape}, the same as the input's {X.shape}")
`

// ---- 5.3 RoPE and RMSNorm ------------------------------------------------------------------------------------------

const BLOCK = String.raw`import numpy as np

rng = np.random.default_rng(1)

def rope(x, pos, base=10000.0):
    """Rotate pairs of dimensions by angles that grow with the position (rotary position embedding)."""
    half = len(x) // 2
    angle = pos * base ** (-np.arange(half) / half)
    x1, x2 = x[:half], x[half:]
    return np.concatenate([x1 * np.cos(angle) - x2 * np.sin(angle), x1 * np.sin(angle) + x2 * np.cos(angle)])

q, k = rng.normal(size=8), rng.normal(size=8)
print("Score of a query and a key three positions apart, at different places in the text:")
scores = []
for m in (5, 105, 1005):
    s = rope(q, m) @ rope(k, m - 3)
    scores.append(s)
    print(f"  query at {m:5d}, key at {m - 3:5d}: {s:.4f}")
print("Only the distance matters:", np.allclose(scores, scores[0]))

def rms_norm(x, gain, eps=1e-6):
    return x / np.sqrt((x ** 2).mean(axis=-1, keepdims=True) + eps) * gain

x = rng.normal(size=(4, 8)) * np.array([[1], [10], [0.1], [3]])  # four tokens at very different scales
gain = np.ones(8)
rms = lambda a: np.sqrt((a ** 2).mean(axis=1))
print("\nRMS of each token's vector before RMSNorm:", rms(x).round(2))
print("and after:                                ", rms(rms_norm(x, gain)).round(2))

# A pre-norm sub-layer adds its output to the residual stream instead of replacing it.
W = rng.normal(size=(8, 8)) / np.sqrt(8)
h = x + rms_norm(x, gain) @ W
print("\nResidual add keeps the shape:", h.shape, "and the original signal: x is still part of h")
`

// ---- 5.4 The three attention patterns ------------------------------------------------------------------------------

const MASKS = String.raw`import numpy as np

n_src, n_tgt = 5, 4   # 5 input tokens; 4 output tokens generated so far

bidirectional = np.ones((n_src, n_src), dtype=int)           # encoder-only: every token sees every token
causal = np.tril(np.ones((n_tgt, n_tgt), dtype=int))          # decoder-only: a token sees itself and earlier ones
cross = np.ones((n_tgt, n_src), dtype=int)                    # encoder-decoder: each output token sees all inputs

for name, m in [("Encoder-only (bidirectional)", bidirectional), ("Decoder-only (causal)", causal), ("Encoder-decoder cross-attention", cross)]:
    print(name, m.shape)
    print(m)
    print("  positions each token can see:", m.sum(axis=1).tolist(), "\n")

# Why decoder-only models dominate generation: with a causal mask, earlier tokens' keys and values never change,
# so they can be cached and each new token costs one row of attention instead of a whole matrix.
n = 1000
print(f"Generating token {n}: causal attention computes {n} scores with a KV cache,")
print(f"a bidirectional model would recompute {n * n:,} because earlier tokens could change.")
`

// ---- 5.5 Logits, softmax and greedy generation ---------------------------------------------------------------------

const SOFTMAX = String.raw`import json, re
import numpy as np

rows = json.load(open("messages.json", encoding="utf-8"))
english = [re.findall(r"[a-z']+", r["text"].lower()) for r in rows if r["language"] == "en"]
english = [s for s in english if s]
split = int(len(english) * 0.8)
train, test = english[:split], english[split:]

# A word-level bigram model: the logit for next word b after a is log(count(a, b) + 0.1).
# The 0.1 (smoothing) keeps unseen pairs possible, so held-out text never gets probability zero.
vocab = sorted({w for s in english for w in s} | {"<s>", "</s>"})
ix = {w: i for i, w in enumerate(vocab)}
counts = np.full((len(vocab), len(vocab)), 0.1)
for s in train:
    for a, b in zip(["<s>"] + s, s + ["</s>"]):
        counts[ix[a], ix[b]] += 1
logits = np.log(counts)

def softmax(z, temperature=1.0):
    z = z / temperature
    e = np.exp(z - z.max())
    return e / e.sum()

start = train[0][0]
p = softmax(logits[ix[start]])
top = np.argsort(p)[::-1][:5]
print(f"After '{start}', the five likeliest next words:")
for i in top:
    print(f"  {vocab[i]:15s} logit {logits[ix[start], i]:5.2f}   probability {p[i]:.3f}")
print("Probabilities over the whole vocabulary sum to", round(float(p.sum()), 6))

# Greedy generation: append the most likely word, feed it back in, repeat.
out = [start]
for _ in range(10):
    nxt = vocab[int(np.argmax(logits[ix[out[-1]]]))]
    if nxt == "</s>":
        break
    out.append(nxt)
print("\nGreedy continuation:", " ".join(out))

# Cross-entropy on held-out messages: the average -log p(actual next word).
nll = [-np.log(softmax(logits[ix[a]])[ix[b]]) for s in test for a, b in zip(["<s>"] + s, s + ["</s>"])]
loss = float(np.mean(nll))
print(f"\nHeld-out loss {loss:.2f} nats per word, against ln(V) = {np.log(len(vocab)):.2f} for a uniform guess")
`

// ---- 5.6 Temperature, top-k and top-p ------------------------------------------------------------------------------

const DECODING = String.raw`import json, collections, re
import numpy as np

rows = json.load(open("messages.json", encoding="utf-8"))
follow = collections.defaultdict(collections.Counter)
for r in rows:
    if r["language"] == "en":
        ws = re.findall(r"[a-z']+", r["text"].lower())   # words only: no numbers, dates or punctuation
        for a, b in zip(ws, ws[1:]):
            follow[a][b] += 1
context = max(follow, key=lambda w: (len(follow[w]), sum(follow[w].values())))  # the word with the most varied next words
nxt = follow[context]
cands = [w for w, _ in nxt.most_common(12)]
logits = np.log(np.array([nxt[w] for w in cands], dtype=float))
print(f"Next-word candidates after '{context}' (logits from counts in the messages):", cands)

def probs(z, t):
    e = np.exp((z - z.max()) / t)
    return e / e.sum()

np.set_printoptions(precision=2, suppress=True)
for t in (0.3, 1.0, 1.5):
    print(f"temperature {t}: {probs(logits, t)}")

p = probs(logits, 1.0)
order = np.argsort(p)[::-1]
k = 3
TOP_P = 0.8   # 0.9 to 0.95 is common in practice; lower here because there are few candidates
print(f"\ntop-k = {k} keeps:", [cands[i] for i in order[:k]])
cum = np.cumsum(p[order])
keep_p = order[: int(np.searchsorted(cum, TOP_P) + 1)]
print(f"top-p = {TOP_P} keeps:", [cands[i] for i in keep_p], f"(they hold {p[keep_p].sum():.2f} of the probability)")

rng = np.random.default_rng(42)
q = np.zeros_like(p)
q[keep_p] = p[keep_p]
q /= q.sum()
print(f"\nFive samples with top-p {TOP_P} and seed 42:", [cands[i] for i in rng.choice(len(cands), size=5, p=q)])
print("Greedy (temperature 0) always picks:", cands[int(np.argmax(logits))])
`

// ---- 5.7 Dense vs mixture-of-experts, and attention cost -----------------------------------------------------------

const COSTS = String.raw`# Illustrative configurations, close to public 8B-dense and 8x7B-MoE models; not exact figures for any one model.
d, layers, ffn = 4096, 32, 14336
attn_params = 4 * d * d                 # Q, K, V and output projections (ignoring grouped-query savings)
expert_params = 3 * d * ffn             # one SwiGLU feed-forward network
dense = layers * (attn_params + expert_params)
experts, active_experts = 8, 2
moe_total = layers * (attn_params + experts * expert_params)
moe_active = layers * (attn_params + active_experts * expert_params)
print(f"Dense:   {dense / 1e9:5.1f}B parameters, all used for every token")
print(f"MoE 8x:  {moe_total / 1e9:5.1f}B parameters stored, {moe_active / 1e9:4.1f}B used per token (2 experts)")
print("Memory follows the stored total; compute per token follows the active count.\n")

# Attention scores grow with the square of the context; the rest of the model grows linearly.
print(f"{'context':>8} {'attention score FLOPs':>22} {'rest of the layer FLOPs':>24}")
for n in (1_000, 8_000, 32_000, 128_000):
    attn = 2 * 2 * n * n * d             # QK^T and weights x V, multiply-add counted as 2
    rest = 2 * n * (attn_params + expert_params)
    print(f"{n:8,d} {attn:22.2e} {rest:24.2e}")
kv_per_token = 2 * layers * 8 * 128 * 2  # K and V, 32 layers, 8 KV heads of width 128, 2 bytes (BF16)
print(f"\nKV cache: {kv_per_token / 1024:.0f} KiB per token, so {kv_per_token * 128_000 / 2**30:.1f} GiB for one 128k-token context")
`

export const C5 = {
  bpe: {
    title: 'Train a tiny BPE tokenizer',
    brief: 'Learns 150 byte-pair merges from the English messages, tokenises a message, then compares tokens per character across languages.',
    proves:
      'BPE merges frequent pairs, and a tokenizer trained on one language splits other scripts into many more tokens. Real tokenizers learn tens of thousands of merges on far more text, often at the byte level, so these ratios are not theirs; the direction of the gap is the same.',
    build: fromMessages(BPE),
    check: `assert len(merges) > 20\nassert ratio["en"] < 0.5\nassert all(ratio["en"] < v for k, v in ratio.items() if k != "en")`,
  },
  attention: {
    title: 'Attention in a dozen lines of NumPy',
    brief: 'Computes causal scaled dot-product attention over the first words of one of your messages, then splits it into two heads.',
    proves:
      'The arithmetic is the real operation: scores, mask, softmax and weighted sum. The embeddings and weights are random, so which words attend to which says nothing about meaning; a trained model learns those weights.',
    build: fromMessages(ATTENTION),
    check: `assert np.allclose(w.sum(axis=1), 1)\nassert np.allclose(np.triu(w, k=1), 0)\nassert multi.shape == X.shape`,
  },
  block: {
    title: 'RoPE, RMSNorm and the residual add',
    brief: 'Shows that rotary embeddings make a score depend only on the distance between two tokens, and that RMSNorm puts every token on the same scale.',
    proves: 'These are exact properties of the formulas, shown on random vectors. They do not show how much each part helps a trained model.',
    neutral: true,
    build: neutral(BLOCK),
    check: `assert np.allclose(scores, scores[0])\nassert np.allclose(rms(rms_norm(x, gain)), 1, atol=1e-3)`,
  },
  masks: {
    title: 'The three attention patterns',
    brief: 'Builds the attention masks of encoder-only, decoder-only and encoder–decoder models and counts what each token can see.',
    proves: 'The masks are exactly what separates the three families. They do not show the rest of a real model: padding masks, many heads and many layers.',
    neutral: true,
    build: neutral(MASKS),
    check: `assert causal.sum() == n_tgt * (n_tgt + 1) // 2\nassert bidirectional.sum() == n_src * n_src\nassert cross.shape == (n_tgt, n_src)`,
  },
  softmax: {
    title: 'From logits to a generated sentence',
    brief: 'Turns word-pair counts from your English messages into logits, applies softmax, generates greedily and measures held-out loss.',
    proves:
      'Logits, softmax, greedy generation and cross-entropy work exactly like this in an LLM. A bigram model sees one word of context, so its text is repetitive and its loss is not comparable to an LLM’s; an LLM conditions on the whole context.',
    build: fromMessages(SOFTMAX),
    check: `assert abs(float(p.sum()) - 1) < 1e-9\nassert 0 < loss < float(np.log(len(vocab))) + 1`,
  },
  decoding: {
    title: 'Temperature, top-k and top-p on real counts',
    brief: 'Takes the next-word candidates after the most varied word in your messages and shows how temperature, top-k and top-p change what can be sampled.',
    proves: 'The filtering and sampling rules are the real ones. The candidates come from counts in a small dataset, not from a language model.',
    build: fromMessages(DECODING),
    check: `assert np.isclose(q.sum(), 1)\nassert len(keep_p) <= len(cands)\nassert probs(logits, 0.3).max() >= probs(logits, 1.5).max()`,
  },
  costs: {
    title: 'What MoE and long contexts cost',
    brief: 'Counts stored and active parameters for a dense and an MoE configuration, and attention cost and KV cache against context length.',
    proves:
      'The formulas are the standard estimates; the configurations are illustrative, not any one model’s. Real models differ in detail (grouped-query attention, shared experts), and measured speed also depends on kernels and hardware.',
    neutral: true,
    build: neutral(COSTS),
    check: `assert moe_active < moe_total and dense < moe_total\nassert kv_per_token == 131072`,
  },
} satisfies Record<string, Snippet>
