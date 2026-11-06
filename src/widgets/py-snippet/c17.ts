/** Chapter 17 snippets: trace context, critical path, percentiles, AI signals, cost attribution, sampling, drift, burn rates, eval cases, conventions. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { NUMBER_COLUMNS, neutral, projectMessages, type Snippet, type SnippetBundle } from './common.ts'

const withMessages = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { rows, sources } = await projectMessages(p, read)
  return { code, files: { 'messages.json': JSON.stringify(rows) }, sources }
}
const withGroups = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const spec = NUMBER_COLUMNS[p.id]
  const rows = (await read.csv(spec.file)) as unknown as Record<string, string>[]
  return { code, files: { 'groups.json': JSON.stringify({ group: spec.group, values: rows.map((r) => r[spec.group]) }) }, sources: [spec.file] }
}

// ---- 17.1 One trace across a queue -------------------------------------------------------------------------------------

const TRACE = String.raw`import json, random

random.seed(17)
def new_id(n):
    return "".join(random.choice("0123456789abcdef") for _ in range(n))

spans, logs = [], []
def span(name, trace_id, parent, **attrs):
    s = {"trace_id": trace_id, "span_id": new_id(16), "parent": parent, "name": name, **attrs}
    spans.append(s)
    return s

def traceparent(s):                     # the W3C header: version-trace-span-flags
    return f"00-{s['trace_id']}-{s['span_id']}-01"

root = span("POST /ask", new_id(32), None, tenant="acme")
search = span("retrieval.search", root["trace_id"], root["span_id"], k=8)
message = {"body": {"doc": "policy-12"}, "headers": {"traceparent": traceparent(root)}}   # put on a queue

# ... later, in a worker process, the trace continues from the message headers:
_, trace_id, parent_id, _ = message["headers"]["traceparent"].split("-")
worker = span("ingest.reembed", trace_id, parent_id, doc=message["body"]["doc"])
logs.append({"level": "warn", "msg": "reranker timeout, using fused order", "trace_id": trace_id, "span_id": search["span_id"]})

def tree(parent=None, depth=0):
    for s in spans:
        if s["parent"] == parent:
            print("  " * depth + f"{s['name']}  ({s['span_id'][:6]})")
            tree(s["span_id"], depth + 1)
print(f"trace {root['trace_id'][:12]}..., header {traceparent(root)[:30]}...")
tree()
print("logs for this trace:", [l["msg"] for l in logs if l["trace_id"] == root["trace_id"]])
`

// ---- 17.2 The critical path --------------------------------------------------------------------------------------------

const CRITICAL = String.raw`# Each step: duration in ms and the steps it waits for (illustrative timings).
STEPS = {"embed query": (40, []), "bm25": (60, ["embed query"]), "vector search": (90, ["embed query"]),
         "fuse": (5, ["bm25", "vector search"]), "rerank": (420, ["fuse"]),
         "model ttft": (690, ["rerank"]), "model decode": (2600, ["model ttft"]), "tool lookup": (300, ["model ttft"])}

def finish_times(steps):
    done = {}
    def end(name):
        if name not in done:
            dur, deps = steps[name]
            done[name] = max([end(d) for d in deps] + [0]) + dur
        return done[name]
    for n in steps:
        end(n)
    return done

def critical_path(steps):
    done = finish_times(steps)
    name = max(done, key=done.get)
    path = [name]
    while steps[name][1]:
        name = max(steps[name][1], key=done.get)
        path.append(name)
    return path[::-1], max(done.values())

path, total = critical_path(STEPS)
print(f"total {total} ms; critical path: {' -> '.join(path)}")
for step, faster in (("bm25", 50), ("rerank", 300), ("model decode", 1000)):
    changed = dict(STEPS, **{step: (STEPS[step][0] - faster, STEPS[step][1])})
    print(f"  {step:13} {faster:4} ms faster -> total {critical_path(changed)[1]} ms")
print("Speeding up a step off the critical path (bm25 runs beside the slower vector search) changes nothing.")
`

// ---- 17.3 Means hide tails ---------------------------------------------------------------------------------------------

const PERCENTILES = String.raw`import numpy as np

rng = np.random.default_rng(3)
def latencies(slow_share):
    normal = rng.lognormal(np.log(2.0), 0.35, 5000)            # most requests: about 2 s
    slow = rng.lognormal(np.log(12.0), 0.5, 5000)              # long-context or retried requests
    pick = rng.random(5000) < slow_share
    return np.where(pick, slow, normal)

print("slow share   mean    p50    p95    p99   (seconds)")
for share in (0.0, 0.02, 0.05, 0.15):
    x = latencies(share)
    print(f"{share:9.0%}  {x.mean():5.1f}  {np.percentile(x, 50):5.1f}  {np.percentile(x, 95):5.1f}  {np.percentile(x, 99):5.1f}")

# Queue depth against age of the oldest item: a slow trickle can be old while the queue looks short.
queue_items = [{"enqueued_min": m} for m in (0, 1, 2, 47)]
now = 50
print(f"queue depth {len(queue_items)}, oldest item {now - min(i['enqueued_min'] for i in queue_items)} minutes old: alert on age, not only depth")
`

// ---- 17.4 Implicit feedback: rephrasing ------------------------------------------------------------------------------

const REPHRASE = String.raw`import json, re, random

random.seed(4)
msgs = [m["text"] for m in json.load(open("messages.json", encoding="utf-8"))]
def words(t):
    return set(re.findall(r"[a-z0-9]+", t.lower()))
def similar(a, b):
    return len(words(a) & words(b)) / max(1, len(words(a) | words(b)))

def reword(t):
    w = t.split()
    return " ".join(w[:-1] + ["please"]) if len(w) > 3 else t + " again"

# Simulated sessions: after an unhelpful answer, users often ask again in other words within a minute.
sessions = []
for i, m in enumerate(msgs[:300]):
    helpful = random.random() < 0.8
    turns = [(0, m)]
    if not helpful and random.random() < 0.7:
        turns.append((random.randint(10, 50), reword(m)))
    elif random.random() < 0.3:
        turns.append((random.randint(10, 300), random.choice(msgs)))     # a new question
    sessions.append({"helpful": helpful, "turns": turns})

def rephrased(s, window=60, threshold=0.5):
    return any(t2 - t1 <= window and similar(a, b) >= threshold
               for (t1, a), (t2, b) in zip(s["turns"], s["turns"][1:]))

flag = [rephrased(s) for s in sessions]
bad = [not s["helpful"] for s in sessions]
caught = sum(f and b for f, b in zip(flag, bad))
print(f"{len(sessions)} sessions from your project's messages; {sum(bad)} had an unhelpful answer (simulated)")
print(f"'rephrased within 60 s' flagged {sum(flag)}: {caught} of the {sum(bad)} unhelpful ones, {sum(flag) - caught} false alarms")
print(f"rephrase rate {sum(flag) / len(sessions):.1%}: a proxy to watch daily, validated against delayed outcomes")
`

// ---- 17.5 Cost attribution ---------------------------------------------------------------------------------------------

const ATTRIBUTION = String.raw`import json, random, collections

random.seed(5)
data = json.load(open("groups.json", encoding="utf-8"))
PRICE = {"input": 3.0, "input_cached": 0.3, "output": 15.0}       # dollars per million tokens (illustrative)
TENANTS = ["acme", "globex", "initech", "umbrella"]
records = []
for value in data["values"][:3000]:
    tenant = random.choices(TENANTS, weights=[5, 2, 2, 1])[0]
    tokens = {"input": random.randint(500, 1500), "input_cached": random.choice([0, 4096]), "output": random.randint(100, 600)}
    cost = sum(tokens[k] * PRICE[k] / 1e6 for k in tokens)
    records.append({"tenant": tenant, data["group"]: value, "tokens": tokens, "cost": cost})

total = sum(r["cost"] for r in records)
for by in ("tenant", data["group"]):
    spend = collections.Counter()
    for r in records:
        spend[r[by]] += r["cost"]
    print(f"by {by}: " + ", ".join(f"{k} {v / total:.0%}" for k, v in spend.most_common(4)))
by_type = {k: sum(r["tokens"][k] * PRICE[k] / 1e6 for r in records) for k in PRICE}
print("by token type: " + ", ".join(f"{k} {v / total:.0%}" for k, v in by_type.items()))
print(f"{len(records)} usage records, {total:,.2f} dollars; the {data['group']} labels come from your project's data")
`

// ---- 17.6 Tail sampling and telemetry volume ---------------------------------------------------------------------------

const SAMPLING = String.raw`import random

random.seed(6)
RPS, TRACE_KB = 400, 60
BASELINE = 0.05            # random share kept of ordinary traces
INTERESTING = 0.03         # errors, slow traces, flagged safety events: always kept
PRICE_PER_GB = 0.30        # illustrative, ingest plus 30 days of storage

per_day = RPS * 86_400
kept = per_day * (INTERESTING + (1 - INTERESTING) * BASELINE)
print(f"{per_day:,} traces a day; all of them: {per_day * TRACE_KB / 1e6:,.0f} GB/day; "
      f"tail-sampled: {kept * TRACE_KB / 1e6:,.0f} GB/day ({kept * TRACE_KB / 1e6 * PRICE_PER_GB * 30:,.0f} dollars a month)")

RARE = 0.001               # a rare failure, 1 trace in 1,000
traces = [random.random() < RARE for _ in range(200_000)]
failures = sum(traces)
head = sum(f for f in traces if random.random() < BASELINE)       # decided at the start, blind to the outcome
tail = failures                                                   # decided at the end: every error is kept
print(f"{failures} rare failures in 200,000 traces: head sampling at {BASELINE:.0%} keeps {head}, tail sampling keeps {tail}")
print("Metrics stay unsampled, so rates and percentiles are exact even when most traces are dropped.")
`

// ---- 17.7 Drift in what users send -------------------------------------------------------------------------------------

const DRIFT = String.raw`import json, math, random, collections

random.seed(7)
msgs = json.load(open("messages.json", encoding="utf-8"))
langs = sorted({m["language"] for m in msgs})
before = collections.Counter(m["language"] for m in msgs)
# A later week: a campaign brings many more non-English users (simulated by resampling).
weights = [1 if m["language"] == "en" else 4 for m in msgs]
after = collections.Counter(m["language"] for m in random.choices(msgs, weights=weights, k=len(msgs)))

def psi(a, b):
    """Population stability index: a sum over categories of (share now − share before) × log(now ÷ before)."""
    total_a, total_b = sum(a.values()), sum(b.values())
    out = 0.0
    for k in langs:
        pa, pb = max(a[k] / total_a, 1e-4), max(b[k] / total_b, 1e-4)
        out += (pb - pa) * math.log(pb / pa)
    return out

for k in langs:
    print(f"  {k}: {before[k] / sum(before.values()):6.1%} -> {after[k] / sum(after.values()):6.1%}")
score = psi(before, after)
print(f"PSI {score:.2f}: {'large shift, investigate' if score > 0.25 else 'moderate shift' if score > 0.1 else 'stable'} "
      "(common rules of thumb: under 0.1 stable, over 0.25 large)")

audits = {"t1": "overturned", "t3": "upheld"}      # outcomes arriving 45 days later, keyed by trace id
decisions = [{"trace_id": "t1", "prompt": "v14"}, {"trace_id": "t2", "prompt": "v14"}, {"trace_id": "t3", "prompt": "v13"}]
joined = [dict(d, audit=audits.get(d["trace_id"], "pending")) for d in decisions]
print("delayed outcomes joined by trace id:", joined)
`

// ---- 17.8 Multi-window burn-rate alerts --------------------------------------------------------------------------------

const BURN = String.raw`import numpy as np

rng = np.random.default_rng(8)
SLO = 0.999
BUDGET = 1 - SLO
hours = 30 * 24
errors = rng.normal(0.0004, 0.0001, hours).clip(0)
errors[200:203] = 0.03                     # a sharp incident: three bad hours
errors[400:520] += 0.0012                  # a slow leak for five days

RULES = [("fast page", 1, 14.4), ("slow page", 6, 6.0), ("ticket", 72, 1.0)]
def first_fire(start, stop):
    out = {}
    for name, window, threshold in RULES:
        for h in range(max(start, window), stop):
            if errors[h - window:h].mean() / BUDGET >= threshold:
                out[name] = h
                break
    return out

print("incident at hour 200:", {k: f"hour {v}" for k, v in first_fire(190, 230).items()})
print("slow leak from hour 400:", {k: f"hour {v}" for k, v in first_fire(380, 600).items()})
used = errors.mean() / BUDGET
print(f"budget used over 30 days: {used:.0%}")
`

// ---- 17.9 From flagged traces to evaluation cases -----------------------------------------------------------------------

const TO_EVAL = String.raw`import json, re, random

random.seed(9)
msgs = json.load(open("messages.json", encoding="utf-8"))
ROOT_CAUSES = ["retrieval", "generation", "tool", "stale data"]
flagged = [{"trace_id": f"tr-{i:04d}", "input": m["text"] + random.choice(["", " Call me on +91 98765 43210."]),
            "cause": random.choice(ROOT_CAUSES)} for i, m in enumerate(random.sample(msgs, min(40, len(msgs))))]
flagged += flagged[:5]                      # the same failure is often reported more than once

def norm(t):
    return " ".join(re.findall(r"[a-z0-9]+", t.lower()))
def redact(t):
    return re.sub(r"\+?\d{2}[\s-]?\d{5}[\s-]?\d{5}", "<PHONE>", t)

cases, seen = [], set()
for f in flagged:
    key = norm(redact(f["input"]))
    if key in seen:
        continue
    seen.add(key)
    cases.append({"id": f"prod-{f['trace_id']}", "source": {"trace_id": f["trace_id"]}, "input": redact(f["input"]),
                  "tags": [f["cause"]], "expect": ["judge_groundedness >= 1.0"]})
print(f"{len(flagged)} flagged traces -> {len(cases)} new evaluation cases after de-duplication and redaction")
by_cause = {c: sum(1 for x in cases if c in x["tags"]) for c in ROOT_CAUSES}
print("by root cause:", by_cause)
print(json.dumps(cases[0], indent=1)[:300])
`

// ---- 17.10 Mapping changing attribute names -----------------------------------------------------------------------------

const SEMCONV = String.raw`# Attribute names used by an older instrumentation, and the names in the current draft (check before relying on them).
RENAMES = {"gen_ai.system": "gen_ai.provider.name", "gen_ai.prompt": "gen_ai.input.messages", "gen_ai.completion": "gen_ai.output.messages"}
RECOMMENDED = {"gen_ai.operation.name", "gen_ai.provider.name", "gen_ai.request.model", "gen_ai.response.model",
               "gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens"}
SENSITIVE = {"gen_ai.input.messages", "gen_ai.output.messages", "gen_ai.system_instructions"}

old_span = {"gen_ai.system": "provider-a", "gen_ai.operation.name": "chat", "gen_ai.request.model": "large-2026-09",
            "gen_ai.usage.input_tokens": 5120, "gen_ai.usage.output_tokens": 388, "gen_ai.prompt": "What is the refund window?"}

def transform(span):
    """What a Collector transform processor would do: rename old keys, drop sensitive content."""
    out = {RENAMES.get(k, k): v for k, v in span.items()}
    dropped = [k for k in out if k in SENSITIVE]
    for k in dropped:
        del out[k]
    return out, dropped

new_span, dropped = transform(old_span)
print("renamed:", [f"{k} -> {v}" for k, v in RENAMES.items() if k in old_span])
print("dropped as sensitive:", dropped)
print("missing recommended attributes:", sorted(RECOMMENDED - set(new_span)))
print("Pin instrumentation versions, and re-run this check whenever you upgrade them.")
`

export const C17 = {
  'trace-context': {
    title: 'One trace across a queue',
    brief: 'Creates spans with trace and span ids, carries the trace through a queue message as a W3C traceparent header, rebuilds the span tree and finds the logs for the trace.',
    proves: 'How context propagation joins asynchronous work to one trace. It is not the OpenTelemetry SDK, which also handles sampling flags and export.',
    neutral: true,
    build: neutral(TRACE),
    check: 'assert all(s["trace_id"] == root["trace_id"] for s in spans) and worker["parent"] == root["span_id"]',
  },
  'critical-path': {
    title: 'The critical path of a request',
    brief: 'Computes finish times for a RAG request’s steps, some running in parallel, finds the critical path, and shows which speed-ups change the total.',
    proves: 'Why only steps on the critical path matter. The timings are illustrative, not from your traces.',
    neutral: true,
    build: neutral(CRITICAL),
    check: 'assert "rerank" in path and "bm25" not in path',
  },
  'tail-percentiles': {
    title: 'Means hide tails',
    brief: 'Generates latencies with a growing share of slow requests and prints the mean, median, 95th and 99th percentiles, then compares queue depth with the age of the oldest item.',
    proves: 'How the 99th percentile moves while the median stays put. The latencies are synthetic, not from your service.',
    neutral: true,
    build: neutral(PERCENTILES),
    check: 'x = latencies(0.15)\nassert np.percentile(x, 99) > 3 * np.percentile(x, 50)',
  },
  'rephrase-signal': {
    title: 'Rephrasing as implicit feedback',
    brief: 'Builds simulated sessions from your project’s messages, where unhelpful answers often lead to a reworded question, and measures how well “rephrased within 60 seconds” finds them.',
    proves: 'How a cheap proxy signal is computed and checked. The sessions are simulated; it does not show how well the proxy tracks outcomes for your users.',
    build: withMessages(REPHRASE),
    check: 'assert caught > 0',
  },
  'cost-attribution': {
    title: 'Cost by tenant, feature and token type',
    brief: 'Creates usage records tagged with a tenant and a grouping from your project’s data, prices their tokens and groups the spend three ways.',
    proves: 'How tagging every call makes spend explainable. Tenants, token counts and prices are invented; only the grouping labels are from your data, so the shares are not your spend.',
    build: withGroups(ATTRIBUTION),
    check: 'assert abs(sum(by_type.values()) - total) < 1e-6',
  },
  'tail-sampling': {
    title: 'Tail sampling and telemetry volume',
    brief: 'Works out daily trace volume and storage with and without tail sampling, then shows how many rare failures head and tail sampling each keep.',
    proves: 'Why tail sampling keeps the traces you need. Sizes and prices are illustrative, not quotes.',
    neutral: true,
    build: neutral(SAMPLING),
    check: 'assert tail >= head',
  },
  'input-drift': {
    title: 'Drift in what users send',
    brief: 'Compares the language mix of your project’s messages with a simulated later week, scores the shift with a population stability index, and joins delayed audit outcomes by trace id.',
    proves: 'How an input shift is measured and outcomes are joined back. The later week is simulated; a shift in inputs does not prove quality has changed.',
    build: withMessages(DRIFT),
    check: 'assert psi(before, before) < 1e-9 and score >= 0',
  },
  'burn-rate-alerts': {
    title: 'Multi-window burn-rate alerts',
    brief: 'Generates 30 days of hourly error rates with a sharp incident and a slow leak, and finds when a fast page, a slow page and a ticket rule would each fire.',
    proves: 'Why several windows are needed: the fast rule catches incidents, the long one catches leaks. The error series is generated, not real traffic.',
    neutral: true,
    build: neutral(BURN),
    check: 'assert "fast page" in first_fire(190, 230) and "fast page" not in first_fire(380, 600)',
  },
  'failure-to-eval': {
    title: 'From flagged traces to evaluation cases',
    brief: 'Turns flagged traces built from your project’s messages into evaluation cases: redacts phone numbers, removes duplicates, keeps the trace link and tags the root cause.',
    proves: 'The mechanics of the flywheel. The flags and root causes are simulated; it does not write the expected behaviour, which needs a reviewer.',
    build: withMessages(TO_EVAL),
    check: 'assert len(cases) < len(flagged) and all("<PHONE>" in c["input"] or "98765" not in c["input"] for c in cases)',
  },
  'semconv-mapping': {
    title: 'Mapping changing attribute names',
    brief: 'Renames attributes an older GenAI instrumentation used, drops sensitive message content as a Collector rule would, and lists recommended attributes still missing.',
    proves: 'How to absorb renames in one place. The names reflect a draft that can change; it does not replace reading the current conventions.',
    neutral: true,
    build: neutral(SEMCONV),
    check: 'assert "gen_ai.provider.name" in new_span and "gen_ai.input.messages" not in new_span',
  },
} satisfies Record<string, Snippet>
