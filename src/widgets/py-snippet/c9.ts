/** Chapter 9 snippets: retrieval or long context, chunking, BM25, approximate search, hybrid fusion, decomposition and citations, metrics. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { neutral, projectDocs, type Snippet, type SnippetBundle } from './common.ts'

/** Shared Python: load the documents and a word tokenizer. */
const DOCS_PY = String.raw`import json, re, math, collections

docs = json.load(open("docs.json", encoding="utf-8"))
STOP = {"the", "a", "an", "of", "to", "and", "is", "for", "in", "on", "with", "are", "be", "or", "by", "at",
        "from", "it", "i", "my", "do", "can", "we", "what", "how", "if", "will", "does", "much", "long"}
def words(text):
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOP]
`

const withDocs = (code: string, extra?: (p: Project) => Record<string, string>) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { docs, sources } = await projectDocs(p, read)
  let full = DOCS_PY + '\n' + code
  for (const [k, v] of Object.entries(extra?.(p) ?? {})) full = full.replace(k, v)
  return { code: full, files: { 'docs.json': JSON.stringify(docs.slice(0, 80)) }, sources }
}

const QUESTION: Record<string, string> = {
  harbor: 'Can we get a refund if we switch from an annual plan?',
  store: 'How much does the Aarav smartphone cost?',
  bank: 'How many days do I have to raise a card dispute?',
  travel: 'Can I change the date of a saver fare and what is the fee?',
}
const COMPOUND: Record<string, string> = {
  harbor: 'How many days of annual leave do employees get, and what is the API rate limit?',
  store: 'How much does the Aarav smartphone cost, and how much is the Kesar Glow face wash?',
  bank: 'How long do I have to raise a card dispute, and what is the default UPI limit?',
  travel: 'Until when can I cancel a hotel room for free, and can I change a saver fare?',
}

// ---- 9.1 Send everything, or retrieve? ---------------------------------------------------------------------------------

const STUFF_OR_RETRIEVE = String.raw`
QUESTION = __QUESTION__
def tokens(t):
    return max(1, len(t) // 4)                       # about 4 characters per token in English

corpus_tokens = sum(tokens(d["title"] + " " + d["text"]) for d in docs)
ranked = sorted(docs, key=lambda d: -len(set(words(QUESTION)) & set(words(d["title"] + " " + d["text"]))))
top3 = ranked[:3]
retrieved_tokens = sum(tokens(d["title"] + " " + d["text"]) for d in top3)
PRICE_PER_MILLION = 1.00                             # illustrative input price, dollars
QUESTIONS_PER_MONTH = 100_000
print(f"{len(docs)} documents, about {corpus_tokens:,} tokens in total")
print(f"Question: {QUESTION}")
print(f"Top 3 retrieved: {[d['id'] for d in top3]}, about {retrieved_tokens:,} tokens\n")
for name, t in (("send every document", corpus_tokens), ("send the top 3", retrieved_tokens)):
    cost = t * QUESTIONS_PER_MONTH * PRICE_PER_MILLION / 1e6
    print(f"{name:20} {t:7,} tokens a question   {cost:,.0f} dollars a month for {QUESTIONS_PER_MONTH:,} questions")
print("\nThis corpus is tiny. A real knowledge base of 50,000 documents would not fit any context window,")
print("and retrieval is what lets each answer cite the few documents it used.")
`

// ---- 9.2 Chunking: fixed size against sentence-aware -------------------------------------------------------------------

const CHUNKING = String.raw`
text = "\n".join(f"{d['title']}. {d['text']}" for d in docs[:6])
SIZE, OVERLAP = 30, 8                                 # words per chunk and words shared with the next chunk

def fixed_chunks(t):
    w = t.split()
    step = SIZE - OVERLAP
    return [" ".join(w[i:i + SIZE]) for i in range(0, max(1, len(w) - OVERLAP), step)]

def sentence_chunks(doc_list):
    """Keep sentences whole, start a new chunk at each document, and prefix every chunk with its title."""
    out = []
    for d in doc_list:
        current = []
        for s in re.split(r"(?<=[.!?])\s+", d["text"]):
            if current and len(" ".join(current + [s]).split()) > SIZE:
                out.append(f"[{d['title']}] " + " ".join(current))
                current = []
            current.append(s)
        if current:
            out.append(f"[{d['title']}] " + " ".join(current))
    return out

fixed, smart = fixed_chunks(text), sentence_chunks(docs[:6])
cut_mid = sum(not c.rstrip().endswith((".", "!", "?")) for c in fixed)
print(f"Fixed {SIZE}-word chunks with {OVERLAP} overlap: {len(fixed)} chunks, {cut_mid} end mid-sentence")
print(f"Sentence-aware chunks with titles:     {len(smart)} chunks, 0 end mid-sentence\n")
print("A fixed chunk:      ", fixed[1][:150])
print("A sentence chunk:   ", smart[1][:150])
`

// ---- 9.3 BM25 from an inverted index --------------------------------------------------------------------------------

const BM25 = String.raw`
K1, B = 1.2, 0.75                                    # standard BM25 settings: change them and run again
doc_words = [words(d["title"] + " " + d["text"]) for d in docs]
avg_len = sum(len(w) for w in doc_words) / len(doc_words)

index = collections.defaultdict(dict)                # inverted index: word -> {document number: count}
for i, w in enumerate(doc_words):
    for term, count in collections.Counter(w).items():
        index[term][i] = count

def idf(term):
    n = len(index.get(term, {}))
    return math.log(1 + (len(docs) - n + 0.5) / (n + 0.5))

def bm25(query, k=3):
    scores = collections.Counter()
    for term in words(query):
        for i, tf in index.get(term, {}).items():    # only documents that contain the term are touched
            scores[i] += idf(term) * tf * (K1 + 1) / (tf + K1 * (1 - B + B * len(doc_words[i]) / avg_len))
    return scores.most_common(k)

QUERY = __QUESTION__
print(f"{len(docs)} documents, {len(index):,} distinct words in the index")
print(f"Query: {QUERY}")
for term in words(QUERY):
    print(f"  '{term}': in {len(index.get(term, {}))} documents, rarity weight {idf(term):.2f}")
print("\nTop results:")
results = bm25(QUERY)
for i, s in results:
    print(f"  {s:5.2f}  {docs[i]['id']}  {docs[i]['title']}")
`

// ---- 9.4 Exact against approximate vector search, and int8 vectors -----------------------------------------------------

const ANN = String.raw`import time
import numpy as np

rng = np.random.default_rng(0)
N, DIM, CELLS = 20_000, 64, 100                     # vectors, numbers per vector, clusters
centres_true = rng.normal(size=(40, DIM))
X = centres_true[rng.integers(0, 40, N)] + rng.normal(scale=0.6, size=(N, DIM))
X /= np.linalg.norm(X, axis=1, keepdims=True)
queries = X[rng.integers(0, N, 50)] + rng.normal(scale=0.05, size=(50, DIM))

def exact(q, k=10):
    return np.argsort(-(X @ q))[:k]

# IVF: group the vectors into cells with a few rounds of k-means, then search only the nearest cells.
cent = X[rng.choice(N, CELLS, replace=False)]
for _ in range(5):
    assign = np.argmax(X @ cent.T, axis=1)
    cent = np.array([X[assign == c].mean(0) if (assign == c).any() else cent[c] for c in range(CELLS)])
    cent /= np.linalg.norm(cent, axis=1, keepdims=True)
members = [np.where(assign == c)[0] for c in range(CELLS)]

def ivf(q, nprobe, k=10):
    cand = np.concatenate([members[c] for c in np.argsort(-(cent @ q))[:nprobe]])
    return cand[np.argsort(-(X[cand] @ q))[:k]], len(cand)

truth = [set(exact(q)) for q in queries]
print(f"{N:,} vectors of {DIM} numbers; exact search compares all {N:,} each time\n")
print(f"{'cells searched':>14} {'vectors compared':>17} {'recall@10':>10}")
recalls = {}
for nprobe in (1, 3, 10, 30):
    found = [ivf(q, nprobe) for q in queries]
    recalls[nprobe] = np.mean([len(set(f[0]) & t) / 10 for f, t in zip(found, truth)])
    print(f"{nprobe:14} {np.mean([f[1] for f in found]):17,.0f} {recalls[nprobe]:10.0%}")

# int8: store each number in 1 byte instead of 4, then re-check the top 50 with full vectors.
scale = np.abs(X).max()
X8 = np.round(X / scale * 127).astype(np.int8)
r8 = np.mean([len(set(np.argsort(-(X8.astype(np.int32) @ np.round(q / scale * 127).astype(np.int32)))[:10]) & t) / 10
              for q, t in zip(queries, truth)])
print(f"\nint8 vectors: {X8.nbytes / 1e6:.1f} MB instead of {X.astype(np.float32).nbytes / 1e6:.1f} MB, recall@10 {r8:.0%}")
`

// ---- 9.5 Hybrid search with reciprocal rank fusion, and a filter ---------------------------------------------------------

const HYBRID = String.raw`
QUERY = __QUESTION__
K = 60                                               # the RRF constant: try 1 and 600

# Keyword ranking: shared words, weighted by rarity.
df = collections.Counter(w for d in docs for w in set(words(d["title"] + " " + d["text"])))
def keyword_rank(q):
    s = {d["id"]: sum(math.log(len(docs) / df[w]) for w in set(words(q)) & set(words(d["title"] + " " + d["text"])))
         for d in docs}
    return [i for i, v in sorted(s.items(), key=lambda kv: -kv[1]) if v > 0]

# A stand-in for dense ranking: overlap of 4-letter pieces, which matches "refunds" to "refund" and typos.
def grams(t):
    t = re.sub(r"\s+", " ", t.lower())
    return {t[i:i + 4] for i in range(len(t) - 3)}
def fuzzy_rank(q):
    g = grams(q)
    s = {d["id"]: len(g & grams(d["title"] + " " + d["text"])) / math.sqrt(len(grams(d["text"])) + 1) for d in docs}
    return [i for i, _ in sorted(s.items(), key=lambda kv: -kv[1])]

kw, fz = keyword_rank(QUERY), fuzzy_rank(QUERY)
fused = collections.Counter()
for ranking in (kw, fz):
    for rank, doc_id in enumerate(ranking, start=1):
        fused[doc_id] += 1 / (K + rank)              # only ranks matter, so the two scales never need matching

print(f"Query: {QUERY}\n")
print("keyword:", kw[:5])
print("fuzzy:  ", fz[:5])
print("fused:  ", [d for d, _ in fused.most_common(5)])

# A metadata filter: this user may only see some documents (every second one here, as a stand-in for permissions).
ALLOWED = {d["id"] for d in docs[::2]}
filtered = [d for d, _ in fused.most_common() if d in ALLOWED][:5]
print(f"\nOnly {len(ALLOWED)} of {len(docs)} documents allowed for this user:", filtered)
`

// ---- 9.6 Decompose a question, cite every part, or abstain --------------------------------------------------------

const DECOMPOSE = String.raw`
QUESTION = __COMPOUND__
MIN_SCORE = 2                                        # shared words needed before we trust a source

parts = [p.strip(" ?,") + "?" for p in re.split(r",? and (?=what|how|until|can|is|do)", QUESTION)]
answer, cited = [], []
for i, part in enumerate(parts, start=1):
    best = max(docs, key=lambda d: len(set(words(part)) & set(words(d["title"] + " " + d["text"]))))
    score = len(set(words(part)) & set(words(best["title"] + " " + best["text"])))
    if score < MIN_SCORE:
        answer.append(f"I could not find an answer to '{part}' in the documents.")
        continue
    sentence = max(re.split(r"(?<=[.!?])\s+", best["text"]), key=lambda s: len(set(words(part)) & set(words(s))))
    answer.append(f"{sentence} [{best['id']}]")
    cited.append((best["id"], sentence))

print("Question:", QUESTION)
print("Split into:", parts, "\n")
print(" ".join(answer))

# Verify every citation in code: the id exists and the cited sentence really is in that document.
by_id = {d["id"]: d["text"] for d in docs}
checks = [doc_id in by_id and sentence in by_id[doc_id] for doc_id, sentence in cited]
print(f"\nCitations checked: {sum(checks)} of {len(checks)} point at a real document containing the sentence")
`

// ---- 9.7 Recall@k, precision@k, MRR and nDCG ----------------------------------------------------------------------------

const METRICS = String.raw`import random

# Test queries: each document's title with one word removed. The source document is the relevant result,
# and any other document sharing two title words counts as partly relevant (grade 1).
random.seed(3)
qrels = []
for d in docs:
    t = words(d["title"])
    if len(t) >= 2:
        t.pop(random.randrange(len(t)))
        grades = {d["id"]: 2}
        for o in docs:
            if o["id"] != d["id"] and len(set(t) & set(words(o["title"]))) >= 2:
                grades[o["id"]] = 1
        qrels.append((" ".join(t), grades))

def rank(q):
    return [d["id"] for d in sorted(docs, key=lambda d: -len(set(words(q)) & set(words(d["title"] + " " + d["text"]))))]

K = 5
rec = prec = rr = ndcg = 0.0
for q, grades in qrels:
    top = rank(q)[:K]
    relevant = set(grades)
    rec += len(relevant & set(top)) / len(relevant)
    prec += len(relevant & set(top)) / K
    first = next((i for i, d in enumerate(rank(q), start=1) if d in relevant), None)
    rr += 1 / first if first else 0
    dcg = sum(grades.get(d, 0) / math.log2(i + 1) for i, d in enumerate(top, start=1))
    ideal = sum(g / math.log2(i + 1) for i, g in enumerate(sorted(grades.values(), reverse=True)[:K], start=1))
    ndcg += dcg / ideal
n = len(qrels)
metrics = {"Recall@5": rec / n, "Precision@5": prec / n, "MRR": rr / n, "nDCG@5": ndcg / n}
print(f"{n} queries over {len(docs)} documents")
for name, value in metrics.items():
    print(f"  {name:12} {value:.2f}")
avg_relevant = sum(len(g) for _, g in qrels) / n
print(f"\nEach query has {avg_relevant:.1f} relevant documents on average, so even a perfect ranking")
print(f"scores Precision@5 of at most about {min(avg_relevant, K) / K:.2f}.")
`

export const C9 = {
  'stuff-or-retrieve': {
    title: 'Send everything, or retrieve?',
    brief: 'Counts the tokens in all of your example project’s documents, retrieves the top 3 for one question, and compares the monthly cost of sending everything with sending only what was retrieved.',
    proves:
      'Retrieval keeps each request small, cheap and citable as a corpus grows. The corpus here is tiny and the price is illustrative, so it does not show where long context would beat retrieval for you.',
    build: withDocs(STUFF_OR_RETRIEVE, (p) => ({ __QUESTION__: JSON.stringify(QUESTION[p.id]) })),
    check: `assert retrieved_tokens <= corpus_tokens\nassert len(top3) == min(3, len(docs))`,
  },
  chunking: {
    title: 'Fixed-size against sentence-aware chunks',
    brief: 'Splits six of your example project’s documents into fixed 30-word chunks with overlap, then into sentence-aware chunks that each carry their title, and counts chunks that end mid-sentence.',
    proves:
      'Respecting sentences and adding a title keeps each chunk meaningful on its own. It does not measure retrieval quality; only an evaluation (9.7) tells you which chunking works best for your data.',
    build: withDocs(CHUNKING),
    check: `assert all(c.startswith("[") for c in smart)\nassert len(fixed) >= 1`,
  },
  bm25: {
    title: 'BM25 from an inverted index',
    brief: 'Builds an inverted index over your example project’s documents, shows each query word’s rarity weight, and ranks the documents with BM25.',
    proves:
      'BM25 rewards rare query words and only touches documents that contain them. It matches exact words only, so it does not find documents that say the same thing in different words.',
    build: withDocs(BM25, (p) => ({ __QUESTION__: JSON.stringify(QUESTION[p.id]) })),
    check: `assert len(results) >= 1\nassert results[0][1] >= results[-1][1]`,
  },
  ann: {
    title: 'Exact against approximate vector search',
    brief: 'Searches 20,000 random vectors exactly and with an IVF index at four settings, measuring how many vectors each compares and its recall, then stores the vectors as int8.',
    proves:
      'Approximate search compares far fewer vectors for a small loss of recall, and int8 cuts memory by four. The vectors are random clusters, not real embeddings, so the recall figures are not what your data would give.',
    neutral: true,
    build: neutral(ANN),
    check: `assert recalls[30] >= recalls[1]\nassert r8 > 0.7`,
  },
  hybrid: {
    title: 'Hybrid search with reciprocal rank fusion',
    brief: 'Ranks your example project’s documents by shared rare words and by shared word pieces, fuses the two rankings with RRF, then applies a metadata filter.',
    proves:
      'RRF combines rankings using ranks alone, so documents both methods like rise to the top. The word-piece ranking is a stand-in for real embeddings, not a dense retriever.',
    build: withDocs(HYBRID, (p) => ({ __QUESTION__: JSON.stringify(QUESTION[p.id]) })),
    check: `assert len(fused) == len(docs)\nassert all(d in ALLOWED for d in filtered)`,
  },
  'decompose-cite': {
    title: 'Split the question, cite each part',
    brief: 'Splits a two-part question about your example project, retrieves a source for each part, writes the answer with citations or declines a part, and checks every citation in code.',
    proves:
      'Answering part by part with checked citations makes every claim traceable. The splitting is a simple rule and the answer is quoted, not written by a model, so it does not show generation quality.',
    build: withDocs(DECOMPOSE, (p) => ({ __COMPOUND__: JSON.stringify(COMPOUND[p.id]) })),
    check: `assert len(parts) == 2\nassert all(checks)`,
  },
  'ranking-metrics': {
    title: 'Recall, precision, MRR and nDCG',
    brief: 'Builds graded relevance labels for queries made from your example project’s document titles, ranks the documents, and computes Recall@5, Precision@5, MRR and nDCG@5.',
    proves:
      'The four metrics reward different things, and labels decide them all. The queries come from titles and the labels are made by a rule, not by people, so the values do not describe a real retriever.',
    build: withDocs(METRICS),
    check: `assert all(0 <= v <= 1 for v in metrics.values())\nassert metrics["Recall@5"] > 0`,
  },
} satisfies Record<string, Snippet>
