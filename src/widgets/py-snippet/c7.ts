/** Chapter 7 snippets: choosing a model with evidence, prompt versions, context budgets, validation and tools, memory, retries, rules. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { neutral, projectDocs, projectLabelled, type Snippet, type SnippetBundle } from './common.ts'

// ---- 7.1 Choosing a model on your own evaluation set -------------------------------------------------------------------

const MODEL_CHOICE = String.raw`import json, random
import numpy as np

rows = json.load(open("labelled.json", encoding="utf-8"))
random.seed(1)
cases = random.sample(rows, min(150, len(rows)))           # a small evaluation set from your own data
labels = sorted({r["label"] for r in rows})
print(f"{len(cases)} evaluation cases, {len(labels)} labels")

# Three candidate models, SIMULATED: each answers correctly with a hidden probability, at a latency and a price.
# Change the numbers to match models you have measured.
CANDIDATES = {          # chance of a right answer, median seconds, dollars per 1,000 calls
    "large":  (0.94, 2.4, 6.00),
    "medium": (0.91, 1.1, 1.20),
    "small":  (0.84, 0.4, 0.20),
}
QUALITY_BAR = 0.88       # the lowest accuracy the feature can ship with
rng = np.random.default_rng(0)

results = {}
for name, (skill, latency, price) in CANDIDATES.items():
    correct = rng.random(len(cases)) < skill
    # Bootstrap: resample the cases 1,000 times to see how much the accuracy could move.
    boots = [rng.choice(correct, len(correct)).mean() for _ in range(1000)]
    low, high = np.percentile(boots, [2.5, 97.5])
    lat = rng.lognormal(np.log(latency), 0.4, len(cases))
    results[name] = (correct.mean(), low, high, np.median(lat), np.percentile(lat, 95), price)
    print(f"{name:7} accuracy {correct.mean():.1%} (95% range {low:.1%} to {high:.1%})   "
          f"p50 {np.median(lat):.1f}s  p95 {np.percentile(lat, 95):.1f}s   {price:.2f} dollars per 1,000 calls")

ok = [n for n, r in results.items() if r[1] >= QUALITY_BAR]   # its whole range clears the bar
choice = min(ok, key=lambda n: results[n][5]) if ok else None
print(f"\nCheapest model whose range clears {QUALITY_BAR:.0%}: {choice or 'none: collect more cases or raise quality'}")
`

async function modelChoice(p: Project, read: DataReader): Promise<SnippetBundle> {
  const { rows, sources } = await projectLabelled(p, read)
  return { code: MODEL_CHOICE, files: { 'labelled.json': JSON.stringify(rows) }, sources }
}

// ---- 7.2 A prompt built from parts, versioned ------------------------------------------------------------------------

const PROMPT_BUILDER = String.raw`import json, hashlib, random, difflib

rows = json.load(open("labelled.json", encoding="utf-8"))
labels = sorted({r["label"] for r in rows})

def few_shot(k_per_label, seed):
    """Pick examples that cover every label, so the model does not copy one pattern."""
    rnd = random.Random(seed)
    return [rnd.choice([r for r in rows if r["label"] == l]) for l in labels for _ in range(k_per_label)]

def build(version, rule, k_per_label=1, seed=0):
    parts = [
        "<role>You classify incoming messages for the support team.</role>",
        f"<instructions>Pick exactly one label from: {', '.join(labels)}. Reply with JSON only.</instructions>",
        f"<rules>{rule}</rules>",
        "<examples>",
        *[f'  <example><in>{e["text"]}</in><out>{{"label": "{e["label"]}"}}</out></example>' for e in few_shot(k_per_label, seed)],
        "</examples>",
        "<input>{message}</input>",
    ]
    text = "\n".join(parts)
    return {"id": "triage", "version": version, "sha": hashlib.sha256(text.encode()).hexdigest()[:10], "text": text}

v1 = build(1, "If unsure, pick the closest label.")
v2 = build(2, "If unsure, pick the closest label. Judge by what the customer asks for, not by their tone.")
print(f"{v1['id']}@v{v1['version']} ({v1['sha']}):\n{v1['text']}\n")
print(f"What changed in {v2['id']}@v{v2['version']} ({v2['sha']}):")
for line in difflib.unified_diff(v1["text"].splitlines(), v2["text"].splitlines(), lineterm="", n=0):
    if line.startswith(("+", "-")) and not line.startswith(("+++", "---")):
        print(" ", line[:150])
print("\nLog the id, version and hash with every request, so any answer can be traced to its exact prompt.")
`

async function promptBuilder(p: Project, read: DataReader): Promise<SnippetBundle> {
  const { rows, sources } = await projectLabelled(p, read)
  return { code: PROMPT_BUILDER, files: { 'labelled.json': JSON.stringify(rows) }, sources }
}

// ---- 7.3 Assembling context within a token budget ------------------------------------------------------------------

const QUESTIONS: Record<string, string> = {
  harbor: 'Can we get a refund if we switch from an annual plan?',
  store: 'How much is the Aarav smartphone and is it well rated?',
  bank: 'How long do I have to dispute a card payment I do not recognise?',
  travel: 'Can I change the date of a saver fare flight, and what will it cost?',
}

const CONTEXT_BUDGET = String.raw`import json, re

docs = json.load(open("docs.json", encoding="utf-8"))
QUESTION = __QUESTION__
WINDOW, RESERVE_FOR_ANSWER = 700, 300          # tokens: change them and run again

def tokens(text):                                 # rough: about 4 characters per token in English
    return max(1, len(text) // 4)
def words(t):
    return set(re.findall(r"[a-z0-9]+", t.lower())) - {"the", "a", "is", "and", "of", "to", "i", "do", "can", "we", "if", "it", "for"}

# Candidates, each with a priority (lower = more important). Documents are ranked by shared words.
candidates = [
    (0, "system prompt", "You answer customer questions using only the documents provided. " * 6),
    (0, "current question", QUESTION),
    (1, "account summary", "Plan: standard. Region: India. Open requests: none. " * 3),
]
ranked = sorted(docs, key=lambda d: -len(words(QUESTION) & words(d["title"] + " " + d["text"])))
for rank, d in enumerate(ranked[:8]):
    candidates.append((2 + rank, f"document {d['id']}", d["title"] + ": " + d["text"]))
candidates.append((3, "conversation summary", "The customer asked about their plan earlier and was told the options. " * 4))

budget = WINDOW - RESERVE_FOR_ANSWER
used, included, dropped = 0, [], []
for prio, name, text in sorted(candidates, key=lambda c: c[0]):      # greedy: most important first
    t = tokens(text)
    if used + t <= budget:
        used += t
        included.append((name, t))
    elif prio >= 2 and used + 40 <= budget:                           # compress: keep the first 40 tokens
        used += 40
        included.append((name + " (trimmed)", 40))
    else:
        dropped.append((name, t))
print(f"Question: {QUESTION}\nWindow {WINDOW} tokens, {RESERVE_FOR_ANSWER} kept for the answer, {budget} for input\n")
for name, t in included:
    print(f"  in   {t:4}  {name}")
for name, t in dropped:
    print(f"  out  {t:4}  {name}")
print(f"\nUsed {used} of {budget} input tokens")
`

async function contextBudget(p: Project, read: DataReader): Promise<SnippetBundle> {
  const { docs, sources } = await projectDocs(p, read)
  return { code: CONTEXT_BUDGET.replace('__QUESTION__', JSON.stringify(QUESTIONS[p.id])), files: { 'docs.json': JSON.stringify(docs) }, sources }
}

// ---- 7.4 Validating structured output and tool calls ---------------------------------------------------------------

const RECORDS: Record<string, { file: string; id: string; owner: string | null; fields: string[]; tool: string }> = {
  harbor: { file: 'tickets.csv', id: 'ticket_id', owner: 'account_id', fields: ['category', 'priority', 'resolved_hours'], tool: 'get_ticket' },
  store: { file: 'orders.csv', id: 'order_id', owner: null, fields: ['order_date', 'delivery_days', 'returned'], tool: 'get_order' },
  bank: { file: 'transactions.csv', id: 'txn_id', owner: 'customer_id', fields: ['timestamp', 'amount_inr', 'merchant_category'], tool: 'get_transaction' },
  travel: { file: 'bookings.csv', id: 'booking_id', owner: null, fields: ['travel_date', 'product', 'cancelled'], tool: 'get_booking' },
}

const VALIDATE = String.raw`import json

d = json.load(open("records.json", encoding="utf-8"))
records, TOOL, OWNER = d["records"], d["tool"], d["owner_field"]
ids = list(records)
me = records[ids[0]].get(OWNER) if OWNER else None          # the signed-in customer owns the first record

SCHEMA = {"tool": str, "arguments": dict}
def check_call(raw):
    """Parse a model's proposed tool call; return (ok, reason). The model only proposes; this code decides."""
    try:
        call = json.loads(raw)
    except json.JSONDecodeError as e:
        return False, f"not JSON ({e.msg})"
    for field, kind in SCHEMA.items():
        if not isinstance(call.get(field), kind):
            return False, f"'{field}' missing or not a {kind.__name__}"
    if call["tool"] != TOOL:
        return False, f"unknown tool {call['tool']!r}"
    rid = call["arguments"].get("id")
    if rid not in records:
        return False, f"no record {rid!r}"
    if OWNER and records[rid].get(OWNER) != me:
        return False, "record belongs to another customer"
    return True, json.dumps({k: v for k, v in records[rid].items() if k != OWNER})

# Proposals a model might make. Add your own and run again.
other = next((i for i in ids if OWNER and records[i].get(OWNER) != me), ids[1])
PROPOSALS = [
    json.dumps({"tool": TOOL, "arguments": {"id": ids[0]}}),
    json.dumps({"tool": TOOL, "arguments": {"id": other}}),
    json.dumps({"tool": TOOL, "arguments": {"id": "X-0000"}}),
    json.dumps({"tool": "delete_everything", "arguments": {}}),
    '{"tool": "' + TOOL + '", "arguments": {"id": ',
]
if not OWNER:
    print("(These records have no owner column, so the ownership check is skipped: a real system would add one.)\n")
verdicts = []
for raw in PROPOSALS:
    ok, why = check_call(raw)
    verdicts.append(ok)
    print(("RUN   " if ok else "REFUSE") + f"  {raw[:60]:60}  {why[:70]}")
`

async function validate(p: Project, read: DataReader): Promise<SnippetBundle> {
  const r = RECORDS[p.id]
  const rows = ((await read.csv(r.file)) as unknown as Record<string, string>[]).slice(0, 300)
  const records = Object.fromEntries(
    rows.map((row) => [row[r.id], Object.fromEntries([...r.fields, ...(r.owner ? [r.owner] : [])].map((f) => [f, row[f]]))]),
  )
  return { code: VALIDATE, files: { 'records.json': JSON.stringify({ tool: r.tool, owner_field: r.owner, records }) }, sources: [r.file] }
}

// ---- 7.5 What each memory strategy keeps -------------------------------------------------------------------------------

const MEMORY = String.raw`# A scripted 24-turn conversation: facts are stated early, then the talk moves on.
FACTS = {2: "account id 88213", 3: "plan is EU data residency", 5: "prefers email over phone", 6: "billing contact is Priya"}
turns = [FACTS.get(t, f"small talk {t}") for t in range(1, 25)]
TOKENS_PER_TURN = 200                       # illustrative

def sliding_window(n):
    return turns[-n:]

def summary_and_window(n):
    summary = "summary: customer discussed billing and settings"          # a summary keeps the gist, not the IDs
    return [summary] + turns[-n:]

def facts_and_window(n):
    store = [f"fact: {f}" for f in FACTS.values()]                        # extracted once, kept in every call
    return store + turns[-n:]

for name, ctx in (("full history", turns), ("last 6 turns", sliding_window(6)),
                  ("summary + last 6", summary_and_window(6)), ("facts + last 6", facts_and_window(6))):
    kept = [f for f in FACTS.values() if any(f in c for c in ctx)]
    print(f"{name:18} {len(ctx) * TOKENS_PER_TURN:6,} tokens per call   facts kept {len(kept)}/{len(FACTS)}")
facts_kept = sum(any(f in c for c in facts_and_window(6)) for f in FACTS.values())
print("\nThe full transcript still goes to your database every turn; the context is only a working view.")
`

// ---- 7.6 Retries with backoff and jitter, and a token bucket --------------------------------------------------------

const RETRIES = String.raw`import numpy as np

rng = np.random.default_rng(0)
CLIENTS, ATTEMPTS, BASE = 30, 4, 1.0           # 30 clients fail at t = 0 and retry 4 times

def retry_times(jitter):
    times = []
    for _ in range(CLIENTS):
        t = 0.0
        for attempt in range(ATTEMPTS):
            wait = BASE * 2 ** attempt                          # 1, 2, 4, 8 seconds
            t += rng.uniform(0, wait) if jitter else wait       # full jitter: anywhere from 0 to the wait
            times.append(t)
    return np.array(times)

for jitter in (False, True):
    t = retry_times(jitter)
    peak = np.bincount((t / 0.25).astype(int)).max()            # the busiest quarter-second
    print(f"jitter {'on ' if jitter else 'off'}: busiest 250 ms gets {peak:3} retries")
    if jitter: peak_on = peak
    else: peak_off = peak

# A token bucket: refill RATE tokens per second up to CAPACITY; a request waits until enough tokens are there.
RATE, CAPACITY = 1000, 4000                       # tokens per second, burst size
level, clock, waits = CAPACITY, 0.0, []
for size in rng.integers(300, 1500, 20):          # 20 requests arriving at once
    if level < size:
        wait = (size - level) / RATE
        clock += wait
        level += wait * RATE
    level -= size
    waits.append(clock)
print(f"\nToken bucket: the 20th request starts after {waits[-1]:.1f} s instead of being rejected")
`

// ---- 7.7 The model proposes, code decides ---------------------------------------------------------------------------

const RULES = String.raw`import numpy as np

# The rule: 10% off for customers of more than 2 years, at most 500. The model reads the chat and proposes.
def rule(years, order_total):
    if years <= 2:
        return 0.0
    return min(round(order_total * 0.10, 2), 500.0)

rng = np.random.default_rng(5)
N = 1000
years = rng.integers(0, 6, N)
totals = rng.integers(200, 9000, N).astype(float)

# SIMULATED model proposals: usually right, but sometimes swayed or sloppy (rates are illustrative).
proposed = np.array([rule(y, t) for y, t in zip(years, totals)])
swayed = rng.random(N) < 0.03                 # persuaded to give 15%
sloppy = rng.random(N) < 0.02                 # forgot the 500 cap
proposed[swayed] = np.round(totals[swayed] * 0.15, 2)
proposed[sloppy] = np.round(totals[sloppy] * 0.10, 2)

final = np.array([rule(y, t) for y, t in zip(years, totals)])   # code recomputes from verified facts
overridden = proposed != final
print(f"{N} orders: the model's proposal was overridden {overridden.sum()} times")
print(f"Discount the model alone would have given away: {proposed.sum():,.0f}")
print(f"Discount under the rule:                        {final.sum():,.0f}")
print(f"Over-payment prevented:                         {(proposed - final).clip(min=0).sum():,.0f}")
print("\nThe model extracts and proposes; the rule, in code, decides and is logged. Same input, same answer, every time.")
`

export const C7 = {
  'model-choice': {
    title: 'Choosing a model on your own cases',
    brief: 'Draws 150 evaluation cases from your example project’s labelled data, scores three simulated candidate models with bootstrap ranges, latency and price, and picks the cheapest that clears the bar.',
    proves:
      'Choosing by evidence on your own cases, with a range on every score, is the method. The candidates are simulated with set accuracies, latencies and prices, so the winner here says nothing about real models.',
    build: modelChoice,
    check: `assert set(results) == set(CANDIDATES)\nassert all(r[1] <= r[0] <= r[2] for r in results.values())`,
  },
  'prompt-versions': {
    title: 'A prompt from parts, with versions',
    brief: 'Builds a classification prompt from delimited parts with one example per label from your example project’s data, then makes version 2 and prints the difference and a hash of each.',
    proves:
      'Prompts can be assembled, diffed and traced like code. It does not show whether version 2 is better: only running both on an evaluation set (chapter 8) can show that.',
    build: promptBuilder,
    check: `assert v1["sha"] != v2["sha"]\nassert all(l in v1["text"] for l in labels)`,
  },
  'context-budget': {
    title: 'Assembling context within a budget',
    brief: 'Ranks your example project’s documents against one question, then fills a token budget greedily by priority, trimming or dropping what does not fit.',
    proves:
      'A fixed budget forces choices, and priorities decide what is lost first. Token counts are estimated at four characters per token and the ranking is by shared words, not a real tokenizer or retriever.',
    build: contextBudget,
    check: `assert used <= budget\nassert any(n == "current question" for n, _ in included)`,
  },
  'validate-calls': {
    title: 'Checking a model’s tool calls',
    brief: 'Checks five proposed tool calls against a schema, the tool list, your example project’s records and who owns each record, and runs only the ones that pass.',
    proves:
      'Every model-proposed call needs parsing, schema, existence and permission checks in code. The proposals are written by hand, not by a model, so this does not show how often a real model gets them wrong.',
    build: validate,
    check: `assert verdicts[0] is True\nassert verdicts[2:] == [False, False, False]`,
  },
  memory: {
    title: 'What each memory strategy keeps',
    brief: 'Runs four memory strategies over a scripted 24-turn conversation and counts the tokens each sends and the early facts each still has.',
    proves:
      'A sliding window forgets early facts and a fact store keeps them for little cost. The conversation and the summary are scripted, not produced by a model, so a real summary may keep more or less.',
    neutral: true,
    build: neutral(MEMORY),
    check: `assert facts_kept == len(FACTS)`,
  },
  retries: {
    title: 'Retries with and without jitter',
    brief: 'Simulates 30 clients retrying with exponential backoff, with and without jitter, and measures the busiest quarter-second; then queues 20 requests through a token bucket.',
    proves:
      'Jitter spreads retries out, and a token bucket queues instead of failing. The clients and request sizes are simulated with a fixed seed, not measured from a real service.',
    neutral: true,
    build: neutral(RETRIES),
    check: `assert peak_on < peak_off`,
  },
  'rules-in-code': {
    title: 'The model proposes, code decides',
    brief: 'Applies a discount rule to 1,000 orders where a simulated model sometimes proposes the wrong discount, and counts how often the rule in code overrides it.',
    proves:
      'Recomputing the decision in code removes the model’s mistakes from the outcome. The error rates are illustrative and simulated, not measured from a real model.',
    neutral: true,
    build: neutral(RULES),
    check: `assert overridden.sum() > 0\nassert (final <= 500).all()`,
  },
} satisfies Record<string, Snippet>
