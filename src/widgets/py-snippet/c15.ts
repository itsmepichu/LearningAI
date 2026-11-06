/** Chapter 15 snippets: peak load, error budgets, workload isolation, caches, fair queuing, breakers, failover, load tests, cost, evidence. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { neutral, projectLabelled, type Snippet, type SnippetBundle } from './common.ts'

/** Each project's dated events: tickets, transactions, orders or bookings. */
const EVENTS: Record<string, [string, string, string]> = {
  harbor: ['tickets.csv', 'created', 'support tickets'],
  store: ['orders.csv', 'order_date', 'orders'],
  bank: ['transactions.csv', 'timestamp', 'transactions'],
  travel: ['bookings.csv', 'booked_on', 'bookings'],
}
const withEvents = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const [file, column, what] = EVENTS[p.id]
  const rows = (await read.csv(file)) as unknown as Record<string, string>[]
  return { code, files: { 'events.json': JSON.stringify({ what, days: rows.map((r) => r[column].slice(0, 10)) }) }, sources: [file] }
}
const withLabelled = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { rows, sources, what } = await projectLabelled(p, read)
  return { code, files: { 'labelled.json': JSON.stringify({ what, rows: rows.slice(0, 500) }) }, sources }
}

// ---- 15.1 From users to peak requests per second -----------------------------------------------------------------------

const PEAK = String.raw`import json, collections

data = json.load(open("events.json", encoding="utf-8"))
per_day = collections.Counter(data["days"])
average = sum(per_day.values()) / len(per_day)
busiest, top = per_day.most_common(1)[0]
PEAK_DAY = top / average
print(f"Your project's {data['what']}: {average:.1f} a day on average, {top} on the busiest day ({busiest}): {PEAK_DAY:.1f}x")

# The chain, with illustrative assumptions you would measure.
REGISTERED = 2_000_000
ACTIVE = 0.08                 # share who use the AI feature on a day
PER_USER = 6                  # requests per active user per day
PEAK_HOUR = 0.12              # share of a day's requests in its busiest hour
BURST = 2.0                   # busiest minute against the hour's average
SECONDS = 6                   # average time a request is in the system
OUT_TOKENS = 350

daily = REGISTERED * ACTIVE * PER_USER
rps = daily * PEAK_HOUR / 3600 * BURST
for label, factor in (("an ordinary day", 1.0), ("your busiest day", PEAK_DAY)):
    peak = rps * factor
    print(f"{label:16}: {daily * factor:10,.0f} requests, peak {peak:6.0f} per second, "
          f"{peak * SECONDS:6,.0f} in flight (Little's law), {peak * OUT_TOKENS:9,.0f} output tokens/s")
`

// ---- 15.2 Error budgets ------------------------------------------------------------------------------------------------

const BUDGET = String.raw`REQUESTS = 30_000_000         # a month
MINUTES = 28 * 24 * 60         # a 28-day window
OUTAGE_MIN = 45                # a provider outage with no fallback (illustrative)

print("SLO      failed requests allowed   minutes of full outage allowed   a 45-minute outage uses")
for slo in (0.99, 0.995, 0.999, 0.9995, 0.9999):
    budget_req = REQUESTS * (1 - slo)
    budget_min = MINUTES * (1 - slo)
    print(f"{slo:7.2%}  {budget_req:24,.0f}  {budget_min:31,.1f}  {OUTAGE_MIN / budget_min:20.0%}")

# Burn rate: how fast the budget is being spent compared with spending it evenly over the window.
errors_last_hour, requests_last_hour = 900, 45_000
slo = 0.999
burn = (errors_last_hour / requests_last_hour) / (1 - slo)
print(f"\nLast hour: {errors_last_hour / requests_last_hour:.1%} errors against a {slo:.1%} SLO = burn rate {burn:.0f}x; "
      f"the month's budget would last {MINUTES / burn / 60:.1f} hours at this pace.")
`

// ---- 15.3 A backfill on a shared pool ----------------------------------------------------------------------------------

const ISOLATION = String.raw`import random

random.seed(15)
SERVICE_MS = 8              # one embedding call
WORKERS = 4                 # embedding workers in the pool
QUERIES_PER_S = 300         # live search queries needing an embedding
BACKFILL_PER_S = 400        # bulk re-ingestion embeddings, arriving faster than they can all be served

def p95_wait(shared, seconds=10):
    free_at = [0.0] * WORKERS
    waits = []
    events = [(random.uniform(0, seconds * 1000), "query") for _ in range(QUERIES_PER_S * seconds)]
    if shared:
        events += [(random.uniform(0, seconds * 1000), "backfill") for _ in range(BACKFILL_PER_S * seconds)]
    for t, kind in sorted(events):
        i = min(range(WORKERS), key=lambda k: free_at[k])
        start = max(t, free_at[i])
        free_at[i] = start + SERVICE_MS
        if kind == "query":
            waits.append(start - t)
    waits.sort()
    return waits[int(0.95 * len(waits))], waits[len(waits) // 2]

capacity = WORKERS * 1000 / SERVICE_MS
print(f"Pool capacity: {capacity:.0f} embeddings a second; queries need {QUERIES_PER_S}, the backfill wants {BACKFILL_PER_S}")
for shared in (False, True):
    p95, p50 = p95_wait(shared)
    print(f"  {'shared with backfill' if shared else 'separate pools      '}: query wait p50 {p50:7.1f} ms, p95 {p95:8.1f} ms")
print("On a separate pool, the backfill only takes longer; on a shared pool, every search waits behind it.")
`

// ---- 15.4 Cache keys and semantic false hits ---------------------------------------------------------------------------

const CACHE = String.raw`import json, re, hashlib

data = json.load(open("labelled.json", encoding="utf-8"))
def norm(t):
    return " ".join(re.findall(r"[a-z0-9]+", t.lower()))
def key(tenant, role, text, model="m-2026-10", prompt="v14"):
    return hashlib.sha256("|".join([tenant, role, norm(text), model, prompt]).encode()).hexdigest()[:10]

seen, rows = set(), []
for r in data["rows"]:                     # one copy of each distinct request
    if norm(r["text"]) not in seen:
        seen.add(norm(r["text"]))
        rows.append(r)
print("exact key, same text, two tenants:", key("t1", "user", rows[0]["text"]), key("t2", "user", rows[0]["text"]))

def words(t):
    return set(norm(t).split())
def details(t):
    """Numbers and names: the parts an answer usually depends on."""
    return set(re.findall(r"\d[\d,.]*", t)) | set(re.findall(r"(?<!^)(?<![.?!] )\b[A-Z][a-z]+", t))
def similar(a, b):
    wa, wb = words(a), words(b)
    return len(wa & wb) / max(1, len(wa | wb))

# Semantic cache: answer a new request with a stored one if they are similar enough.
stored, new = rows[: len(rows) // 2], rows[len(rows) // 2:]
for threshold in (0.3, 0.5, 0.7, 0.9):
    hits = wrong = 0
    for r in new:
        best = max(stored, key=lambda s: similar(r["text"], s["text"]))
        if similar(r["text"], best["text"]) >= threshold:
            hits += 1
            wrong += best["label"] != r["label"] or details(best["text"]) != details(r["text"])
    print(f"threshold {threshold}: {hits / len(new):5.1%} served from cache, {wrong} of {hits} hits answered a request "
          f"with a different type, number or name")
print(f"{len(new)} new {data['what']} against {len(stored)} cached.")
if not any(similar(r["text"], s["text"]) >= 0.3 for r in new for s in stored):
    print("None of these requests is close to another: a semantic cache would almost never hit here.")
`

// ---- 15.5 A noisy neighbour, FIFO against fair queuing -----------------------------------------------------------------

const FAIR = String.raw`CAPACITY = 100                       # units of work per second
NORMAL = {"A": 10, "B": 15, "C": 15, "D": 15, "E": 15}
SECONDS = 60

def run(burst, fair):
    load = dict(NORMAL, A=NORMAL["A"] * burst)
    queues = {t: 0.0 for t in load}
    waits = {t: [] for t in load}
    for _ in range(SECONDS):
        for t in load:
            queues[t] += load[t]
        if fair:
            # Each tenant's share is equal; unused share is passed to tenants that still have work.
            left, active = CAPACITY, [t for t in queues if queues[t] > 0]
            while left > 1e-9 and active:
                share = left / len(active)
                for t in active:
                    take = min(share, queues[t])
                    queues[t] -= take
                    left -= take
                active = [t for t in active if queues[t] > 1e-9]
        else:
            total = sum(queues.values())
            served = min(CAPACITY, total)
            for t in queues:
                queues[t] -= served * queues[t] / total if total else 0
        for t in queues:
            waits[t].append(queues[t] / max(1e-9, load[t]))     # seconds of backlog for this tenant
    return {t: sum(w) / len(w) for t, w in waits.items()}

for burst in (1, 3, 6):
    fifo, fair = run(burst, False), run(burst, True)
    print(f"A sends {burst}x normal: FIFO wait A {fifo['A']:5.1f} s, B {fifo['B']:5.1f} s | fair queuing A {fair['A']:5.1f} s, B {fair['B']:5.1f} s")
`

// ---- 15.6 A circuit breaker and deadline-aware shedding ----------------------------------------------------------------

const BREAKER = String.raw`import random

random.seed(6)
WINDOW, THRESHOLD, OPEN_FOR, TRIALS = 20, 0.5, 50, 3
TIMEOUT_S = 10

def provider_ok(t):
    return random.random() < (0.02 if 200 <= t < 600 else 0.99)   # an outage between calls 200 and 600

def run(with_breaker):
    recent, state, opened_at, trials = [], "closed", 0, 0
    served = fallback = failed = 0
    seconds_wasted = 0
    for t in range(1000):
        if with_breaker and state == "open":
            if t - opened_at >= OPEN_FOR:
                state, trials = "half-open", 0
            else:
                fallback += 1                       # fail fast to the fallback, no waiting
                continue
        ok = provider_ok(t)
        if not ok:
            seconds_wasted += TIMEOUT_S             # a caller waited for a timeout
        served += ok
        if not ok:
            if with_breaker:
                fallback += 1
            else:
                failed += 1
        recent = (recent + [ok])[-WINDOW:]
        if with_breaker and state == "half-open":
            trials += 1
            if not ok:
                state, opened_at = "open", t
            elif trials >= TRIALS:
                state, recent = "closed", []
        elif with_breaker and len(recent) == WINDOW and recent.count(False) / WINDOW >= THRESHOLD:
            state, opened_at = "open", t
    return served, fallback, failed, seconds_wasted

for wb in (False, True):
    s, fb, f, wasted = run(wb)
    print(f"{'with breaker   ' if wb else 'without breaker'}: primary {s}, fallback {fb}, failed {f}, caller time lost to timeouts {wasted / 3600:.1f} h")

CAPACITY, ARRIVING, DEADLINE = 10, 15, 8      # per second, per second, seconds
queue = timed_out = rejected = 0
for second in range(60):
    for _ in range(ARRIVING):
        if (queue + 1) / CAPACITY > DEADLINE:
            rejected += 1                         # predicted wait beats the deadline: say no now
        else:
            queue += 1
    queue = max(0, queue - CAPACITY)
print(f"Shedding by predicted wait: {rejected} rejected at once, every admitted request starts within {DEADLINE} s.")
`

// ---- 15.7 Failover capacity with residency -----------------------------------------------------------------------------

const FAILOVER = String.raw`REGIONS = {"eu-west": {"capacity": 120, "load": 70, "eu": True},
           "eu-central": {"capacity": 100, "load": 60, "eu": True},
           "us-east": {"capacity": 150, "load": 90, "eu": False},
           "ap-south": {"capacity": 120, "load": 80, "eu": False}}
EU_ONLY_SHARE = 0.8      # share of EU traffic that must stay in EU regions (illustrative)

def fail(region):
    lost = REGIONS[region]["load"]
    survivors = {r: dict(v) for r, v in REGIONS.items() if r != region}
    if REGIONS[region]["eu"]:
        must_stay = lost * EU_ONLY_SHARE
        eu = [r for r in survivors if survivors[r]["eu"]]
        anywhere = lost - must_stay
    else:
        must_stay, eu, anywhere = 0, [], lost
    for r in eu:
        survivors[r]["load"] += must_stay / len(eu)
    spare = {r: v["capacity"] - v["load"] for r, v in survivors.items()}
    total_spare = sum(max(0, s) for s in spare.values())
    for r in survivors:
        survivors[r]["load"] += anywhere * max(0, spare[r]) / total_spare if total_spare else 0
    print(f"{region} fails ({lost} units of load):")
    for r, v in survivors.items():
        flag = "  OVER CAPACITY" if v["load"] > v["capacity"] else ""
        print(f"   {r:10} {v['load']:6.1f} of {v['capacity']}  ({v['load'] / v['capacity']:.0%}){flag}")

fail("eu-west")
fail("us-east")
RPO_MIN, WRITES_PER_MIN = 5, 1_200
print(f"An RPO of {RPO_MIN} minutes allows losing up to {RPO_MIN * WRITES_PER_MIN:,} conversation writes; replay them exactly once on fail-back.")
`

// ---- 15.8 Heavy tails and coordinated omission -------------------------------------------------------------------------

const LOADTEST = String.raw`import numpy as np

rng = np.random.default_rng(8)
prompts = rng.lognormal(mean=np.log(600), sigma=1.0, size=20_000).astype(int) + 20
median = int(np.median(prompts))
top = np.sort(prompts)[-len(prompts) // 10:]
print(f"Real-looking prompts: median {median}, p99 {np.percentile(prompts, 99):,.0f}, longest {prompts.max():,} tokens")
print(f"The longest 10% hold {top.sum() / prompts.sum():.0%} of all prompt tokens; a fixed-length test at {median} has none of them.")

# Coordinated omission: a stall of 5 s while the service handles 10 requests a second.
STALL_AT, STALL_S, NORMAL_S = 30, 5.0, 0.1
# Closed loop: one virtual user waits for each reply, so it sends nothing during the stall.
closed = [NORMAL_S] * 60
closed[STALL_AT] = STALL_S
# Open loop: requests keep arriving every 0.1 s; those arriving during the stall wait for it to end.
open_loop = []
for i in range(600):
    t = i * 0.1
    wait = max(0.0, STALL_AT - t + STALL_S) if STALL_AT <= t < STALL_AT + STALL_S else 0.0
    open_loop.append(NORMAL_S + wait)
for name, xs in (("closed loop", closed), ("open loop", open_loop)):
    print(f"{name:11}: {len(xs):3} samples, p50 {np.percentile(xs, 50):.2f} s, p99 {np.percentile(xs, 99):.2f} s")
print("The closed-loop test recorded one slow request; real users arriving during the stall saw 50.")
`

// ---- 15.9 Cost per successful task -------------------------------------------------------------------------------------

const PER_SUCCESS = String.raw`TASKS = 100_000
OPTIONS = {"A: small model":  {"attempt": 0.004, "success": 0.70},
           "B: large model":  {"attempt": 0.012, "success": 0.88},
           "C: small + retry with large": {"attempt": 0.004, "success": 0.70, "retry": 0.012, "retry_success": 0.60}}
HUMAN = 1.50              # dollars when a person handles a failure (illustrative)

for name, o in OPTIONS.items():
    cost = TASKS * o["attempt"]
    solved = TASKS * o["success"]
    if "retry" in o:
        failed_first = TASKS - solved
        cost += failed_first * o["retry"]
        solved += failed_first * o["retry_success"]
    failures = TASKS - solved
    total = cost + failures * HUMAN
    print(f"{name:28} model {cost:7,.0f} + people {failures * HUMAN:7,.0f} = {total:7,.0f} dollars; "
          f"{total / TASKS:.4f} per task, model cost per success {cost / solved:.4f}")
`

// ---- 15.10 Measured, projected and actual -------------------------------------------------------------------------------

const EVIDENCE = String.raw`MEASURED_PER_REPLICA = 2_400       # output tokens/s at the SLO, load test 2026-10-28 (measured)
VENDOR_PER_REPLICA = 5_000         # a vendor's peak figure (not measured by you)
REPLICAS = 12
SAFE = 0.8                         # plan to stay below 80% of projected capacity
actual_peaks = [12.1, 13.0, 13.8, 14.9, 15.6, 16.8, 18.2]   # last seven Mondays, thousand tokens/s (actual)

projected = MEASURED_PER_REPLICA * REPLICAS / 1000
growth = (actual_peaks[-1] / actual_peaks[0]) ** (1 / (len(actual_peaks) - 1))
print(f"[measured]  {MEASURED_PER_REPLICA:,} tokens/s per replica under stated conditions")
print(f"[projected] {REPLICAS} replicas -> {projected:.1f}k tokens/s; safe limit {projected * SAFE:.1f}k")
print(f"[actual]    last peak {actual_peaks[-1]}k tokens/s, growing {growth - 1:.1%} a week")
weeks, peak = 0, actual_peaks[-1]
while peak < projected and weeks < 52:
    peak *= growth
    weeks += 1
print(f"Already {'above' if actual_peaks[-1] > projected * SAFE else 'below'} the safe limit; projected capacity reached in about {weeks} weeks.")
print(f"Planning on the vendor figure would have claimed {VENDOR_PER_REPLICA * REPLICAS / 1000:.0f}k tokens/s: "
      f"{VENDOR_PER_REPLICA / MEASURED_PER_REPLICA:.1f}x more than you measured.")
`

export const C15 = {
  'peak-load': {
    title: 'From users to peak requests per second',
    brief: 'Measures how much busier the busiest day is in your project’s dated records, then runs the chain from users to peak requests, requests in flight and output tokens.',
    proves: 'How each assumption multiplies through and how much a peak day adds. The user counts and rates are illustrative, not your traffic.',
    build: withEvents(PEAK),
    check: 'assert PEAK_DAY >= 1 and rps > 0',
  },
  'error-budget': {
    title: 'Error budgets and burn rate',
    brief: 'Converts five SLOs into failed requests and outage minutes allowed per 28 days, and computes how fast a bad hour burns the budget.',
    proves: 'Why each extra nine shrinks the budget tenfold. It does not choose an SLO for you; that depends on users and cost.',
    neutral: true,
    build: neutral(BUDGET),
    check: 'assert round(burn) == 20',
  },
  'workload-isolation': {
    title: 'A backfill on a shared pool',
    brief: 'Simulates live query embeddings with and without a bulk backfill on the same worker pool and compares the queries’ waiting time.',
    proves: 'Why bulk and interactive work need separate capacity. The rates are illustrative and it does not model a real GPU.',
    neutral: true,
    build: neutral(ISOLATION),
    check: 'assert p95_wait(True)[0] > p95_wait(False)[0]',
  },
  'cache-scope': {
    title: 'Cache keys and semantic false hits',
    brief: 'Shows that tenant and role change an exact cache key, then runs a word-overlap semantic cache over your project’s requests and counts hits that answered a different kind of request.',
    proves: 'How a similarity threshold trades hit rate for wrong answers. Word overlap stands in for embeddings; it does not measure your embedding model’s false hits.',
    build: withLabelled(CACHE),
    check: 'assert key("t1", "user", "x") != key("t2", "user", "x")',
  },
  'fair-queuing': {
    title: 'A noisy neighbour',
    brief: 'Lets one tenant send 1, 3 and 6 times its normal load into shared capacity and compares everyone’s waiting time under first-come-first-served and fair queuing.',
    proves: 'How fair queuing contains a burst to the tenant who caused it. It is a fluid model, not a real scheduler.',
    neutral: true,
    build: neutral(FAIR),
    check: 'assert run(6, True)["B"] < run(6, False)["B"]',
  },
  'circuit-breaker': {
    title: 'A circuit breaker and shedding by deadline',
    brief: 'Sends 1,000 calls through a provider outage with and without a circuit breaker, then sheds requests whose predicted wait exceeds their deadline.',
    proves: 'How a breaker stops callers waiting on a dying dependency. The outage and timings are simulated; it does not test your fallback’s quality.',
    neutral: true,
    build: neutral(BREAKER),
    check: 'assert run(True)[3] < run(False)[3]',
  },
  'failover-capacity': {
    title: 'Failover capacity with data residency',
    brief: 'Fails one region at a time and moves its load to the survivors, keeping most EU traffic in EU regions, and flags any region pushed over capacity.',
    proves: 'Why residency can overload the regions allowed to take over. Regions, loads and capacities are invented, not taken from any real deployment.',
    neutral: true,
    build: neutral(FAILOVER),
    check: 'assert sum(v["load"] for v in REGIONS.values()) == 300',
  },
  'load-test-shape': {
    title: 'Heavy tails and coordinated omission',
    brief: 'Samples heavy-tailed prompt lengths and measures how much of the work the longest tenth holds, then compares a closed-loop and an open-loop test of the same stall.',
    proves: 'Why fixed-length, closed-loop tests understate the tail. The distribution is synthetic, not your traffic.',
    neutral: true,
    build: neutral(LOADTEST),
    check: 'assert np.percentile(open_loop, 99) > np.percentile(closed, 99)',
  },
  'cost-per-success': {
    title: 'Cost per successful task',
    brief: 'Compares a small model, a large model and a small model with a large-model retry, counting model cost and the cost of people handling failures.',
    proves: 'Why a cheaper attempt can cost more per success. Prices and success rates are illustrative, not measured.',
    neutral: true,
    build: neutral(PER_SUCCESS),
    check: 'assert OPTIONS["B: large model"]["success"] > OPTIONS["A: small model"]["success"]',
  },
  'measured-projected': {
    title: 'Measured, projected and actual',
    brief: 'Labels a measured per-replica figure, the capacity projected from it and actual weekly peaks, works out the growth rate and the weeks left, and compares a vendor figure.',
    proves: 'How the three kinds of numbers combine into a forecast. All figures are illustrative; it does not replace re-measuring with the current traffic mix.',
    neutral: true,
    build: neutral(EVIDENCE),
    check: 'assert weeks > 0 and growth > 1',
  },
} satisfies Record<string, Snippet>
