/** Chapter 21 snippets: the cost model of a feature, token reduction, batch work, routing for cost, showback, commitments. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { NUMBER_COLUMNS, fromMessages, neutral, projectDocs, projectLabelled, type Snippet, type SnippetBundle } from './common.ts'

const withDocs = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { docs, sources } = await projectDocs(p, read)
  return { code, files: { 'docs.json': JSON.stringify(docs.slice(0, 120)) }, sources }
}
const withLabelled = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { rows, sources, what } = await projectLabelled(p, read)
  return { code, files: { 'labelled.json': JSON.stringify({ what, labels: rows.map((r) => r.label) }) }, sources }
}
const withGroups = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const spec = NUMBER_COLUMNS[p.id]
  const rows = (await read.csv(spec.file)) as unknown as Record<string, string>[]
  return { code, files: { 'groups.json': JSON.stringify({ group: spec.group, values: rows.map((r) => r[spec.group]) }) }, sources: [spec.file] }
}

// ---- 21.1 What one request really costs --------------------------------------------------------------------------------

const UNIT = String.raw`import json

msgs = json.load(open("messages.json", encoding="utf-8"))
avg_user = sum(len(m["text"].split()) for m in msgs) / len(msgs) * 1.3
PRICE = {"input": 3.0, "cached": 0.3, "output": 15.0}      # illustrative dollars per million tokens
SYSTEM, CONTEXT, OUTPUT = 1_500, 3_000, 350                 # tokens: instructions, retrieved chunks, answer
CACHED_SHARE = 0.9                                          # share of the instructions served from the prompt cache
EMBED, VECTOR_DB, TOOLS = 0.00001, 0.0002, 0.0005           # dollars per request (illustrative)
RETRY_RATE, SUCCESS, HUMAN = 0.05, 0.85, 1.20               # retries, share solved, dollars when a person takes over

model = ((SYSTEM * (1 - CACHED_SHARE) + CONTEXT + avg_user) * PRICE["input"]
         + SYSTEM * CACHED_SHARE * PRICE["cached"] + OUTPUT * PRICE["output"]) / 1e6
per_request = model * (1 + RETRY_RATE) + EMBED + VECTOR_DB + TOOLS
lines = {"model tokens (incl. retries)": model * (1 + RETRY_RATE), "embeddings": EMBED, "vector search": VECTOR_DB, "tools": TOOLS}
print(f"average user message from your project: {avg_user:.0f} tokens")
for k, v in lines.items():
    print(f"  {k:28} {v * 1000:7.3f} dollars per 1,000 requests ({v / per_request:4.0%})")
per_success = (per_request + (1 - SUCCESS) * HUMAN) / SUCCESS
print(f"per request {per_request * 1000:.2f} dollars per 1,000; per successful task {per_success:.4f} dollars, "
      f"of which people handling failures {(1 - SUCCESS) * HUMAN / SUCCESS / per_success:.0%}")
`

// ---- 21.2 Trimming the tokens ------------------------------------------------------------------------------------------

const DIET = String.raw`import json

docs = json.load(open("docs.json", encoding="utf-8"))
chunk = sum(len(d["text"].split()) for d in docs) / len(docs) * 1.3      # tokens in an average chunk (one document)
REQUESTS = 3_000_000                                                       # a month (illustrative)
IN, CACHED, OUT = 3.0, 0.3, 15.0                                           # dollars per million tokens (illustrative)

def monthly(system, k, output, cached_share):
    tokens_in = system * (1 - cached_share) + k * chunk + 60
    return REQUESTS * (tokens_in * IN + system * cached_share * CACHED + output * OUT) / 1e6

steps = [("starting point", dict(system=2_400, k=8, output=500, cached_share=0.0)),
         ("cache the instructions", dict(system=2_400, k=8, output=500, cached_share=0.9)),
         ("trim instructions to 1,200", dict(system=1_200, k=8, output=500, cached_share=0.9)),
         ("retrieve 4 chunks, not 8", dict(system=1_200, k=4, output=500, cached_share=0.9)),
         ("ask for shorter answers (300)", dict(system=1_200, k=4, output=300, cached_share=0.9))]
base = monthly(**steps[0][1])
print(f"average chunk from your project's documents: {chunk:.0f} tokens; {REQUESTS:,} requests a month")
for name, s in steps:
    cost = monthly(**s)
    print(f"  {name:30} {cost:10,.0f} dollars  ({cost / base:4.0%} of the start)")
print("Check quality after every step: fewer chunks or shorter answers can cost more in failures than they save.")
`

// ---- 21.3 What can wait for a batch ------------------------------------------------------------------------------------

const BATCH = String.raw`JOBS = [  # name, requests a month, tokens each, must finish within (hours)
    ("live chat answers", 3_000_000, 4_000, 0.01),
    ("nightly ticket summaries", 600_000, 3_000, 12),
    ("re-embedding changed documents", 2_000_000, 500, 24),
    ("weekly evaluation runs", 80_000, 6_000, 48),
    ("monthly report drafts", 5_000, 20_000, 72),
]
PRICE = 4.0                 # dollars per million tokens, blended (illustrative)
BATCH_DISCOUNT = 0.5        # many providers price batch work at about half (check yours)
BATCH_WINDOW_H = 24         # results arrive within this many hours

total = saved = 0
print("job                              tokens/month   batchable   monthly dollars")
for name, n, tokens, deadline in JOBS:
    cost = n * tokens * PRICE / 1e6
    ok = deadline >= BATCH_WINDOW_H
    new = cost * (1 - BATCH_DISCOUNT) if ok else cost
    total += cost
    saved += cost - new
    print(f"{name:32} {n * tokens / 1e9:8.1f} bn   {'yes' if ok else 'no ':>5}   {cost:9,.0f} -> {new:9,.0f}")
print(f"saving {saved:,.0f} of {total:,.0f} dollars a month ({saved / total:.0%}); "
      "jobs that must finish within 24 hours stay real-time or run off-peak on your own GPUs")
`

// ---- 21.4 The cheapest model that meets the bar, per request type -------------------------------------------------------

const ROUTE = String.raw`import json, collections

data = json.load(open("labelled.json", encoding="utf-8"))
volume = collections.Counter(data["labels"])
types = [t for t, _ in volume.most_common()]
MODELS = {"small": 0.0002, "mid": 0.0015, "large": 0.006}          # dollars per request (illustrative)
# Illustrative accuracy of each model per request type: harder types are the rarer ones here.
def accuracy(model, rank):
    base = {"small": 0.93, "mid": 0.96, "large": 0.975}[model]
    return base - rank * {"small": 0.04, "mid": 0.015, "large": 0.005}[model]
BAR = 0.90

single = sum(volume.values()) * MODELS["large"]
routed = 0
print(f"request types in your project's {data['what']}, commonest first; quality bar {BAR:.0%}")
for rank, t in enumerate(types):
    ok = [m for m in MODELS if accuracy(m, rank) >= BAR]
    pick = min(ok, key=MODELS.get) if ok else "large"
    routed += volume[t] * MODELS[pick]
    print(f"  {t:22} {volume[t]:5} requests -> {pick:5} ({accuracy(pick, rank):.1%})")
print(f"cost: everything on the large model {single:,.2f}; routed {routed:,.2f} dollars ({routed / single:.0%})")
`

// ---- 21.5 Showback, budgets and alerts ---------------------------------------------------------------------------------

const SHOWBACK = String.raw`import json, random, collections

random.seed(21)
data = json.load(open("groups.json", encoding="utf-8"))
usage = collections.Counter()
for v in data["values"]:
    usage[v] += random.uniform(0.5, 1.5) * 0.004               # direct model spend per record (illustrative)
SHARED = 0.25 * sum(usage.values())                            # gateway, vector database, observability
total_direct = sum(usage.values())
share_of = {k: SHARED * v / total_direct for k, v in usage.items()}
HEADROOM = [0.95, 1.15, 1.8, 2.5, 1.3, 1.6, 2.1]               # budgets set last quarter, as a multiple of this month (illustrative)
BUDGET = {k: (v + share_of[k]) * HEADROOM[i % len(HEADROOM)] for i, (k, v) in enumerate(usage.most_common())}

print(f"teams named after your project's {data['group']} values; shared costs split by direct usage")
for team, direct in usage.most_common():
    share = share_of[team]
    spend = direct + share
    used = spend / BUDGET[team]
    alert = "OVER" if used >= 1 else "80% alert" if used >= 0.8 else "50% alert" if used >= 0.5 else ""
    print(f"  {team:20} direct {direct:8.2f}  shared {share:7.2f}  total {spend:8.2f}  {used:5.0%} of budget  {alert}")
print("Showback reports these numbers; chargeback moves them into each team's own budget.")
`

// ---- 21.6 Sizing a commitment ------------------------------------------------------------------------------------------

const COMMIT = String.raw`import numpy as np

rng = np.random.default_rng(6)
ON_DEMAND = 1.0          # cost of one unit of usage on demand
DISCOUNT = 0.30          # committed units are 30% cheaper, but you pay for them whether used or not
forecast = 100           # expected monthly units
months = rng.normal(forecast, 25, (5000, 12)).clip(0)          # 5,000 possible years of usage

def yearly_cost(commit, price_drop_at=None, drop=0.0):
    cost = []
    for year in months:
        total = 0.0
        for m, use in enumerate(year):
            od = ON_DEMAND * (1 - drop) if price_drop_at is not None and m >= price_drop_at else ON_DEMAND
            total += commit * ON_DEMAND * (1 - DISCOUNT) + max(0, use - commit) * od
        cost.append(total)
    return np.mean(cost)

print("commit/month  expected yearly cost   with a 40% on-demand price cut from month 6")
for c in (0, 50, 75, 100, 125):
    print(f"{c:12}  {yearly_cost(c):19,.0f}   {yearly_cost(c, 6, 0.4):10,.0f}")
best = min(range(0, 151, 5), key=yearly_cost)
print(f"best commitment without price cuts: about {best} units a month, below the forecast of {forecast}")
`

export const C21 = {
  'unit-cost': {
    title: 'What one request really costs',
    brief: 'Builds the cost of one request from your project’s message lengths: cached and uncached input, output, retries, embeddings, search and tools, then cost per successful task including people.',
    proves: 'Where the money goes in one feature and how failures dominate. Every price is illustrative and it does not replace your own usage records.',
    build: fromMessages(UNIT),
    check: 'assert per_success > per_request > 0',
  },
  'token-diet': {
    title: 'Trimming the tokens',
    brief: 'Applies five cost reductions one after another to a feature built on your project’s documents: caching, shorter instructions, fewer chunks and shorter answers.',
    proves: 'How much each step saves at scale. It does not measure quality, which each step can lower.',
    build: withDocs(DIET),
    check: 'assert monthly(**steps[-1][1]) < base',
  },
  'batch-offpeak': {
    title: 'What can wait for a batch',
    brief: 'Lists five kinds of model work with volumes and deadlines, moves those that can wait a day to a discounted batch interface, and totals the saving.',
    proves: 'Which work can move to batch and roughly what it saves. The discount and volumes are illustrative, not any provider’s terms.',
    neutral: true,
    build: neutral(BATCH),
    check: 'assert 0 < saved < total',
  },
  'cost-router': {
    title: 'The cheapest model that meets the bar',
    brief: 'Takes the request types and volumes in your project’s labelled data and routes each type to the cheapest model whose (illustrative) accuracy meets a quality bar.',
    proves: 'How routing by request type cuts cost. The accuracies are invented; it does not measure any model.',
    build: withLabelled(ROUTE),
    check: 'assert routed <= single',
  },
  'showback': {
    title: 'Showback, budgets and alerts',
    brief: 'Splits spend by teams named after a grouping in your project’s data, allocates shared platform costs by usage, and raises budget alerts at 50%, 80% and 100%.',
    proves: 'How allocation and alerts work. The spend and budgets are simulated, not real costs.',
    build: withGroups(SHOWBACK),
    check: 'assert abs(sum(usage.values()) - total_direct) < 1e-9',
  },
  'commitment-sizing': {
    title: 'Sizing a commitment',
    brief: 'Simulates 5,000 possible years of uncertain usage and compares the expected cost of committing to different monthly amounts, with and without a mid-year price cut.',
    proves: 'Why the best commitment sits below the forecast and how price cuts change it. It does not reflect any provider’s actual terms.',
    neutral: true,
    build: neutral(COMMIT),
    check: 'assert best < forecast',
  },
} satisfies Record<string, Snippet>
