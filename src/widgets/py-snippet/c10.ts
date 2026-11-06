/** Chapter 10 snippets: sizing, ingestion, document structure, incremental updates, sharding, permissions, migrations, benchmarks, hierarchy. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { neutral, projectDocs, type Snippet, type SnippetBundle } from './common.ts'

const DOCS_PY = String.raw`import json, re, hashlib, collections, math

docs = json.load(open("docs.json", encoding="utf-8"))
STOP = {"the", "a", "an", "of", "to", "and", "is", "for", "in", "on", "with", "are", "be", "or", "by", "at",
        "from", "it", "i", "my", "do", "can", "we", "what", "how", "if", "will", "does", "much", "long"}
def words(text):
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOP]
`
const withDocs = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { docs, sources } = await projectDocs(p, read)
  return { code: DOCS_PY + '\n' + code, files: { 'docs.json': JSON.stringify(docs.slice(0, 80)) }, sources }
}

// ---- 10.1 From documents to gigabytes ---------------------------------------------------------------------------------

const SIZING = String.raw`# Every assumption multiplies. Measure them on a sample of your corpus, then change them here.
DOCUMENTS = 10_000_000
PAGES_PER_DOC, TOKENS_PER_PAGE = 6, 500
CHUNK_TOKENS, OVERLAP = 512, 0.10
DIMS, BYTES_PER_NUMBER = 768, 1          # int8 vectors; use 4 for float32
GRAPH_BYTES = 128                        # HNSW links per vector (about M = 16)
METADATA_BYTES = 300                     # ids, permissions, timestamps per chunk
REPLICAS = 2
EMBED_PRICE = 0.02                       # illustrative dollars per million tokens

tokens = DOCUMENTS * PAGES_PER_DOC * TOKENS_PER_PAGE
chunks = tokens / (CHUNK_TOKENS * (1 - OVERLAP))
vectors_gb = chunks * DIMS * BYTES_PER_NUMBER / 1e9
graph_gb = chunks * GRAPH_BYTES / 1e9
meta_gb = chunks * METADATA_BYTES / 1e9
one_copy = vectors_gb + graph_gb + meta_gb
print(f"Tokens:            {tokens / 1e9:,.0f} billion")
print(f"Chunks:            {chunks / 1e6:,.0f} million")
print(f"Vectors:           {vectors_gb:,.0f} GB   graph {graph_gb:,.0f} GB   metadata {meta_gb:,.0f} GB")
print(f"One copy:          {one_copy:,.0f} GB;  with {REPLICAS} replicas and 40% headroom: {one_copy * REPLICAS * 1.4:,.0f} GB")
print(f"Embedding once:    {tokens * (1 + OVERLAP) * EMBED_PRICE / 1e6:,.0f} dollars at {EMBED_PRICE} per million tokens")
for b, name in ((4, "float32"), (1, "int8"), (0.125, "binary")):
    print(f"  vectors as {name:8}: {chunks * DIMS * b / 1e9:8,.0f} GB")
`

// ---- 10.2 A queue with retries, a dead-letter queue and backpressure ---------------------------------------------------

const INGESTION = String.raw`import random

random.seed(11)
ARRIVALS_PER_TICK = 9                  # documents arriving each tick
WORKERS, PER_WORKER = 4, 2             # each worker processes 2 documents a tick
POISON_RATE = 0.03                     # share of documents that always fail (a corrupt PDF)
TRANSIENT_RATE = 0.10                  # share of attempts that fail once and then work (a timeout)
MAX_ATTEMPTS = 3
QUEUE_LIMIT = 40                       # backpressure: set to None to let the queue grow without limit

def run(limit, ticks=60):
    queue, done, dlq, lag, peak = [], 0, 0, 0, 0
    for t in range(ticks):
        room = ARRIVALS_PER_TICK if limit is None else max(0, min(ARRIVALS_PER_TICK, limit - len(queue)))
        lag += ARRIVALS_PER_TICK - room          # documents left waiting at the source
        queue += [{"poison": random.random() < POISON_RATE, "tries": 0} for _ in range(room)]
        for _ in range(min(len(queue), WORKERS * PER_WORKER)):
            item = queue.pop(0)
            item["tries"] += 1
            if not item["poison"] and random.random() > TRANSIENT_RATE:
                done += 1
            elif item["tries"] >= MAX_ATTEMPTS:
                dlq += 1                          # parked for a person to look at, not retried forever
            else:
                queue.append(item)                # retry later
        peak = max(peak, len(queue))
    return done, dlq, peak, lag

for limit in (QUEUE_LIMIT, None):
    done, dlq, peak, lag = run(limit)
    label = f"bounded at {limit}" if limit else "unbounded"
    print(f"Queue {label:15}: {done} done, {dlq} in the dead-letter queue, peak queue {peak}, waiting at source {lag}")
capacity = WORKERS * PER_WORKER
print(f"\nCapacity {capacity} a tick against {ARRIVALS_PER_TICK} arriving: add a worker, or the backlog only grows.")
`

// ---- 10.3 Keeping a table's structure ----------------------------------------------------------------------------------

const TABLES = String.raw`import re

# What naive PDF text extraction often gives for a pricing table: the cells, in reading order, with no structure.
FLAT = "Plan Monthly price Seats Support Basic 19 5 Email Pro 49 10 Email and chat Enterprise Contact us Unlimited Dedicated"
# What a layout-aware parser recovers: rows and columns.
TABLE = [
    ["Plan", "Monthly price", "Seats", "Support"],
    ["Basic", "19", "5", "Email"],
    ["Pro", "49", "10", "Email and chat"],
    ["Enterprise", "Contact us", "Unlimited", "Dedicated"],
]
header, rows = TABLE[0], TABLE[1:]

# Store each row as a self-contained sentence, so a chunk answers a question on its own.
row_chunks = ["; ".join(f"{h}: {v}" for h, v in zip(header, r)) for r in rows]
for c in row_chunks:
    print("chunk:", c)

QUESTION = "How many seats does Pro include?"
def words(t):
    return set(re.findall(r"[a-z0-9]+", t.lower()))
best = max(row_chunks, key=lambda c: len(words(QUESTION) & words(c)))
seats = dict(p.split(": ") for p in best.split("; "))["Seats"]
print(f"\nQ: {QUESTION}\nBest chunk: {best}\nAnswer: {seats}")
print("\nFrom the flat text, '10' sits between '49' and 'Email' with nothing saying it is Pro's seat count.")
`

// ---- 10.4 Incremental updates by content hash ---------------------------------------------------------------------------

const INCREMENTAL = String.raw`import random, copy

def chunk_ids(doc, version):
    """One chunk per sentence; the id depends on the document, the position and the content."""
    out = {}
    for i, s in enumerate(re.split(r"(?<=[.!?])\s+", doc["text"])):
        h = hashlib.sha256(s.encode()).hexdigest()[:10]
        out[f"{doc['id']}#{i}:{h}"] = {"doc": doc["id"], "version": version, "text": s}
    return out

v1 = {d["id"]: d for d in docs[:20]}
index = {}
for d in v1.values():
    index.update(chunk_ids(d, 1))

# Version 2 of the source: one document edited, one deleted, one added.
random.seed(4)
v2 = copy.deepcopy(v1)
edited, deleted = random.sample(sorted(v2), 2)
v2[edited]["text"] = v2[edited]["text"].replace(".", " (updated).", 1)
del v2[deleted]
v2["NEW-1"] = {"id": "NEW-1", "title": "New policy", "text": "This policy starts next month. It applies to everyone."}

wanted = {}
for d in v2.values():
    wanted.update(chunk_ids(d, 2))
to_add = set(wanted) - set(index)
to_delete = set(index) - set(wanted)
unchanged = set(index) & set(wanted)
print(f"Documents: edited {edited}, deleted {deleted}, added NEW-1")
print(f"Chunks to embed: {len(to_add)}   to delete: {len(to_delete)}   untouched: {len(unchanged)} of {len(index)}")
print(f"Re-embedding everything would cost {len(wanted)} embeddings; the diff costs {len(to_add)}.")
for cid in sorted(to_delete)[:3]:
    print("  delete", cid, "from", index[cid]["doc"])
`

// ---- 10.5 Shards under a hot tenant --------------------------------------------------------------------------------

const SHARDING = String.raw`import numpy as np

SHARDS, TENANTS = 8, 200
rng = np.random.default_rng(1)
traffic = 1 / np.arange(1, TENANTS + 1) ** 1.1          # a few tenants get most of the traffic (Zipf-like)
traffic /= traffic.sum()
print(f"Largest tenant: {traffic[0]:.0%} of all queries; top 10: {traffic[:10].sum():.0%}")

def by_tenant():
    load = np.zeros(SHARDS)
    for t, q in enumerate(traffic):
        load[hash(("tenant", t)) % SHARDS] += q            # the whole tenant lives on one shard
    return load, 1                                         # shards touched per query

def by_hash():
    return np.full(SHARDS, 1 / SHARDS), SHARDS             # even load, but every query hits every shard

def dedicated(big=3):
    load = np.zeros(SHARDS)
    load[:big] = traffic[:big]                             # the biggest tenants get a shard each
    for t in range(big, TENANTS):
        load[big + hash(("tenant", t)) % (SHARDS - big)] += traffic[t]
    return load, 1

for name, (load, fanout) in (("by tenant", by_tenant()), ("hash everything", by_hash()), ("dedicated for top 3", dedicated())):
    print(f"{name:20} busiest shard {load.max() / (1 / SHARDS):4.1f} x its fair share   shards per query {fanout}")
`

// ---- 10.6 Permission-aware retrieval: pre-filter against post-filter --------------------------------------------------

const PERMISSIONS = String.raw`import random

random.seed(5)
GROUPS = ["all-staff", "finance", "hr", "legal"]
acl = {d["id"]: {"all-staff"} if random.random() < 0.3 else {random.choice(GROUPS[1:])} for d in docs}
USER_GROUPS = {"all-staff", "hr"}                          # what the identity provider says right now
K = 5

def score(q, d):
    return len(set(words(q)) & set(words(d["title"] + " " + d["text"])))
QUERY = docs[0]["title"] + " " + docs[1]["title"]

allowed = lambda d: bool(acl[d["id"]] & USER_GROUPS)
ranked = sorted(docs, key=lambda d: -score(QUERY, d))
post = [d["id"] for d in ranked[:K] if allowed(d)]          # search first, filter after
pre = [d["id"] for d in ranked if allowed(d)][:K]           # filter inside the search
print(f"Query: {QUERY[:70]}")
print(f"User groups: {sorted(USER_GROUPS)}; the user may see {sum(map(allowed, docs))} of {len(docs)} documents\n")
print(f"Post-filter (top {K}, then remove): {len(post)} results {post}")
print(f"Pre-filter  (only allowed docs):  {len(pre)} results {pre}")

leaks = [d["id"] for d in ranked[:K] if not allowed(d)]
print(f"\nWithout any filter, {len(leaks)} of the top {K} would have been documents this user cannot open: {leaks}")
`

// ---- 10.7 Why an embedding change needs a new index --------------------------------------------------------------------

const MIGRATION = String.raw`import numpy as np

vocab = sorted({w for d in docs for w in words(d["title"] + " " + d["text"])})
ix = {w: i for i, w in enumerate(vocab)}
def counts(t):
    v = np.zeros(len(vocab))
    for w in words(t):
        if w in ix: v[ix[w]] += 1
    return v
C = np.array([counts(d["title"] + " " + d["text"]) for d in docs])

# Two "embedding models": different random projections of the same word counts (stand-ins for real models).
rng = np.random.default_rng(0)
A, B = rng.normal(size=(len(vocab), 64)), rng.normal(size=(len(vocab), 96))
def embed(M, P):
    E = M @ P
    return E / (np.linalg.norm(E, axis=1, keepdims=True) + 1e-9)
old_index, new_index = embed(C, A), embed(C, B)

def top(index, qvec, k=5):
    return list(np.argsort(-(index @ qvec))[:k])

queries = [d["title"] for d in docs[:20]]
hits_old = np.mean([i in top(old_index, embed(counts(q)[None], A)[0]) for i, q in enumerate(queries)])
hits_new = np.mean([i in top(new_index, embed(counts(q)[None], B)[0]) for i, q in enumerate(queries)])
print(f"Old model, old index:  {hits_old:.0%} of title queries find their document in the top 5")
print(f"New model, new index:  {hits_new:.0%}")
# Mixing them: a new-model query against the old index. The dimensions do not even match, and if they did,
# the numbers would mean different things. Truncate to show it.
mixed = np.mean([i in top(old_index, embed(counts(q)[None], B)[0][:64]) for i, q in enumerate(queries)])
print(f"New query on old index: {mixed:.0%}  <- why every migration builds a complete new index first")

# Shadow comparison before cutover: how much do the two indexes agree on the top 5?
overlap = np.mean([len(set(top(old_index, embed(counts(q)[None], A)[0])) & set(top(new_index, embed(counts(q)[None], B)[0]))) / 5
                   for q in queries])
print(f"\nShadow run: the two indexes share {overlap:.0%} of their top 5 on average; review the differences")
`

// ---- 10.8 Latency percentiles under load ------------------------------------------------------------------------------

const BENCHMARK = String.raw`import numpy as np

rng = np.random.default_rng(2)
SERVICE_MS = 20                          # average time one replica needs for one query (illustrative)
REPLICAS = 4
DURATION_S = 60

def simulate(qps, write_storm=False):
    """Queries arrive at random; each goes to the replica that is free first. Returns latencies in ms."""
    n = int(qps * DURATION_S)
    arrivals = np.cumsum(rng.exponential(1000 / qps, n))
    service = rng.lognormal(np.log(SERVICE_MS), 0.5, n) * (1.6 if write_storm else 1.0)
    free_at = np.zeros(REPLICAS)
    lat = np.empty(n)
    for i in range(n):
        r = free_at.argmin()
        start = max(arrivals[i], free_at[r])
        free_at[r] = start + service[i]
        lat[i] = free_at[r] - arrivals[i]
    return lat

print(f"{'queries/s':>9} {'p50 ms':>7} {'p95 ms':>7} {'p99 ms':>7}")
p99 = {}
for qps in (50, 100, 150, 180):
    lat = simulate(qps)
    p99[qps] = np.percentile(lat, 99)
    print(f"{qps:9} {np.median(lat):7.0f} {np.percentile(lat, 95):7.0f} {p99[qps]:7.0f}")
lat = simulate(100, write_storm=True)
print(f"{'100 + writes':>12} {np.median(lat):4.0f} {np.percentile(lat, 95):7.0f} {np.percentile(lat, 99):7.0f}")
print(f"\nCapacity is about {REPLICAS * 1000 / SERVICE_MS:.0f} queries/s; p99 climbs long before that, so plan at well below it.")
`

// ---- 10.9 Two-stage hierarchical retrieval -----------------------------------------------------------------------------

const HIERARCHY = String.raw`
sections = []                            # the fine level: one entry per sentence, remembering its document
for d in docs:
    for s in re.split(r"(?<=[.!?])\s+", d["text"]):
        sections.append((d["id"], s))
QUERY = docs[len(docs) // 2]["title"]

def overlap(q, t):
    return len(set(words(q)) & set(words(t)))

# Flat: score every sentence in the collection.
flat = sorted(sections, key=lambda s: -overlap(QUERY, s[1]))[:3]
# Hierarchical: pick the best 2 documents by title first, then search only their sentences.
best_docs = [d["id"] for d in sorted(docs, key=lambda d: -overlap(QUERY, d["title"]))[:2]]
inside = [s for s in sections if s[0] in best_docs]
hier = sorted(inside, key=lambda s: -overlap(QUERY, s[1]))[:3]

print(f"Query: {QUERY}\n")
print(f"Flat search compared {len(sections)} sentences; top: {[s[0] for s in flat]}")
print(f"Two-stage search compared {len(docs)} titles + {len(inside)} sentences; top: {[s[0] for s in hier]}")
print("\nThe coarse stage cuts the work and keeps results inside the right documents;")
print("if it picks the wrong documents, the fine stage can never recover, so measure both stages.")
`

export const C10 = {
  'corpus-sizing': {
    title: 'From documents to gigabytes',
    brief: 'Multiplies documents, pages, tokens, chunk size, dimensions and bytes into chunks, gigabytes of vectors, graph and metadata, replicas and a one-off embedding cost.',
    proves:
      'Each assumption multiplies the result, and vector precision changes memory several-fold. Every input is an illustrative assumption, not a measurement of your corpus.',
    neutral: true,
    build: neutral(SIZING),
    check: `assert round(chunks / 1e6) == 65\nassert vectors_gb > graph_gb`,
  },
  'ingestion-queue': {
    title: 'A queue with retries and a dead-letter queue',
    brief: 'Simulates an ingestion queue with workers, retries for temporary failures, a dead-letter queue for documents that always fail, and a bounded queue that pushes back on the source.',
    proves:
      'Bounded queues keep memory in check by making the source wait, and a dead-letter queue stops bad documents blocking good ones. The rates are simulated, not measured from a real pipeline.',
    neutral: true,
    build: neutral(INGESTION),
    check: `assert run(QUEUE_LIMIT)[2] <= QUEUE_LIMIT\nassert run(None)[2] > QUEUE_LIMIT`,
  },
  'table-chunks': {
    title: 'Keeping a table’s structure',
    brief: 'Compares a pricing table flattened by naive extraction with the same table parsed into rows, stores each row as its own sentence, and answers a question from the right row.',
    proves:
      'Row-as-sentence chunks keep each number tied to its column. The table here is typed in, not parsed from a PDF; the laptop lab compares real parsers.',
    neutral: true,
    build: neutral(TABLES),
    check: `assert seats == "10"\nassert len(row_chunks) == 3`,
  },
  incremental: {
    title: 'Updating only what changed',
    brief: 'Gives each chunk of your example project’s documents an id built from its content, then edits one document, deletes one and adds one, and works out exactly which chunks to embed and delete.',
    proves:
      'Content-hash ids make updates cheap and deletions exact. It does not show change feeds, permissions or the reconciliation job that catches missed events.',
    build: withDocs(INCREMENTAL),
    check: `assert len(to_add) >= 2 and len(to_delete) >= 2\nassert len(unchanged) > 0`,
  },
  sharding: {
    title: 'Shards under a hot tenant',
    brief: 'Spreads 200 tenants with very uneven traffic over 8 shards three ways (by tenant, by hash, and with dedicated shards for the biggest) and compares the busiest shard and the fan-out.',
    proves:
      'Placement trades hot spots against fan-out. The traffic shape is simulated, not taken from a real platform, so the exact factors are illustrative.',
    neutral: true,
    build: neutral(SHARDING),
    check: `assert by_hash()[0].max() <= by_tenant()[0].max()\nassert dedicated()[1] == 1`,
  },
  permissions: {
    title: 'Filter by permission inside the search',
    brief: 'Gives each of your example project’s documents a random access group, searches as one user, and compares filtering after the top 5 with filtering inside the search, and with no filter.',
    proves:
      'Filtering after retrieval returns too few results, and no filter leaks documents the user cannot open. The groups are assigned at random, not synced from a real identity provider.',
    build: withDocs(PERMISSIONS),
    check: `assert len(pre) >= len(post)\nassert all(allowed(next(d for d in docs if d["id"] == i)) for i in pre)`,
  },
  'embedding-migration': {
    title: 'Why a new embedding model needs a new index',
    brief: 'Embeds your example project’s documents with two stand-in models, shows that a query from the new model finds nothing useful in the old index, and measures how much the two indexes agree.',
    proves:
      'Vectors from different models cannot be mixed, so migrations build a full new index and compare before cutting over. The models are random projections, not real embedding models.',
    build: withDocs(MIGRATION),
    check: `assert hits_new >= mixed\nassert 0 <= overlap <= 1`,
  },
  'load-test': {
    title: 'Latency percentiles under load',
    brief: 'Simulates queries arriving at four rates on four replicas, plus one run during a heavy write load, and prints p50, p95 and p99 latency.',
    proves:
      'Tail latency rises sharply well before full capacity, and background writes make it worse. The service times are simulated, not measured from a vector database.',
    neutral: true,
    build: neutral(BENCHMARK),
    check: `assert p99[180] > p99[50]`,
  },
  hierarchical: {
    title: 'Coarse first, then fine',
    brief: 'Searches every sentence of your example project’s documents directly, then searches titles first and only the best documents’ sentences, and compares the work done.',
    proves:
      'A coarse stage cuts the search space and keeps results inside the right documents, but cannot recover from a wrong first pick. Titles stand in for the summaries a real hierarchical index would use; they are not generated summaries.',
    build: withDocs(HIERARCHY),
    check: `assert len(inside) <= len(sections)\nassert len(hier) >= 1`,
  },
} satisfies Record<string, Snippet>
