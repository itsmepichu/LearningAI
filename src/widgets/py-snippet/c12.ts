/** Chapter 12 snippets: when to split work, routing, parallel workers, contracts, DAGs, compounding errors, delegation, baselines. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { neutral, projectDocs, projectLabelled, type Snippet, type SnippetBundle } from './common.ts'

const withDocs = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { docs, sources } = await projectDocs(p, read)
  return { code, files: { 'docs.json': JSON.stringify(docs.slice(0, 120)) }, sources }
}
const withLabelled = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { rows, sources, what } = await projectLabelled(p, read)
  return { code, files: { 'labelled.json': JSON.stringify({ what, rows: rows.slice(0, 1200) }) }, sources }
}

// ---- 12.1 Does the work fit in one context? ---------------------------------------------------------------------------

const BREADTH = String.raw`import json

docs = json.load(open("docs.json", encoding="utf-8"))
TOKENS_PER_WORD = 1.3
COPIES = 1000                 # pretend the corpus is this many times larger (illustrative)
CONTEXT = 128_000             # tokens one model call can read
USABLE = 0.75                 # leave room for instructions and the answer
SUMMARY, BRIEF, PLAN = 400, 300, 1_500   # tokens per worker summary, task brief and coordinator plan

corpus = int(sum(len(d["text"].split()) for d in docs) * TOKENS_PER_WORD * COPIES)
WORKERS = -(-corpus // int(CONTEXT * USABLE))      # round up: enough workers that each part fits
per_worker = corpus // WORKERS
print(f"{len(docs)} documents x {COPIES} = about {corpus:,} tokens to read; one context holds {CONTEXT:,}")
print(f"Single agent: reads {min(corpus, CONTEXT):,} tokens, {min(1, CONTEXT / corpus):.0%} of the material")
workflow = corpus + WORKERS * SUMMARY + WORKERS * SUMMARY
coordinator = workflow + PLAN + WORKERS * BRIEF + 2 * WORKERS * SUMMARY   # planning, briefs and a review pass
print(f"Parallel workflow, {WORKERS} parts of {per_worker:,} tokens each: {workflow:,} tokens")
print(f"Coordinator + {WORKERS} workers: {coordinator:,} tokens, {coordinator / workflow:.2f}x the workflow")
print("Both read everything; the coordinator pays extra to discover a plan code could have written.")
`

// ---- 12.2 Routing to specialists, with an "other" path -----------------------------------------------------------------

const ROUTER = String.raw`import json, re, collections, random

data = json.load(open("labelled.json", encoding="utf-8"))
rows = data["rows"]
random.seed(2)
random.shuffle(rows)
train, test = rows[: len(rows) // 2], rows[len(rows) // 2:]
STOP = {"the", "a", "an", "to", "my", "i", "is", "of", "and", "for", "in", "on", "it", "was", "with", "me", "please", "can", "how", "do"}
def words(t):
    return [w for w in re.findall(r"[a-z]+", t.lower()) if w not in STOP]

# Each specialist "owns" the words that appear most often in its own requests.
by_label = collections.defaultdict(collections.Counter)
for r in train:
    by_label[r["label"]].update(set(words(r["text"])))
def route(text, min_share=0.5):
    scores = {lab: sum(c[w] / sum(c.values()) for w in words(text)) for lab, c in by_label.items()}
    total = sum(scores.values())
    best = max(scores, key=scores.get)
    if total == 0 or scores[best] / total < min_share:
        return "other"                      # not sure: a person or a general agent decides
    return best

OUT_OF_SCOPE = ["What will the weather be in Chennai tomorrow?", "Write me a poem about the sea.", "Who won the cricket match?"]
for share in (0.0, 0.5, 0.8):
    routed = [(route(r["text"], share), r["label"]) for r in test]
    sure = [(p, t) for p, t in routed if p != "other"]
    right = sum(p == t for p, t in sure)
    stray = sum(route(t, share) != "other" for t in OUT_OF_SCOPE)
    print(f"min share {share}: {len(sure) / len(test):6.1%} routed automatically, {right / max(1, len(sure)):6.1%} of those correct; "
          f"{len(test) - len(sure)} to the other path; {stray} of 3 off-topic requests sent to a specialist")
print(f"{len(test)} held-out {data['what']}; {len(by_label)} specialists. Synthetic text is cleaner than real requests: expect lower accuracy on yours.")
`

// ---- 12.3 Parallel workers and the slowest one -------------------------------------------------------------------------

const PARALLEL = String.raw`import json, heapq

docs = json.load(open("docs.json", encoding="utf-8"))
# Six subtasks: each worker reads a sixth of the documents. Duration grows with the words it reads (simulated).
parts = [docs[i::6] for i in range(6)]
durations = [round(4 + sum(len(d["text"].split()) for d in p) / 40, 1) for p in parts]
SYNTHESIS = 6.0

def wall_clock(limit, deadline=None):
    running, t, done, dropped = [], 0.0, 0, 0
    queue = list(durations)
    while queue or running:
        while queue and len(running) < limit:
            heapq.heappush(running, t + queue.pop(0))
        t = heapq.heappop(running)
        if deadline and t > deadline:
            dropped += 1 + len(running)       # cancel what is still running: partial results
            t = deadline
            break
        done += 1
    return t + SYNTHESIS, done, dropped

print("Subtask durations (s):", durations, "  total work", round(sum(durations), 1))
for limit in (1, 3, 6):
    t, done, _ = wall_clock(limit)
    print(f"  concurrency {limit}: finished after {t:5.1f} s")
t, done, dropped = wall_clock(6, deadline=sorted(durations)[3])
print(f"  concurrency 6 with a deadline: {t:5.1f} s, {done} of 6 parts, {dropped} cancelled (report the gap)")
`

// ---- 12.4 A versioned message contract ---------------------------------------------------------------------------------

const CONTRACT = String.raw`CONTRACT_V2 = {"required": {"contract": str, "task_id": str, "status": str, "result": dict, "coverage": dict, "confidence": str, "errors": list},
               "status": {"complete", "partial", "failed"},
               "confidence": {"low", "medium", "high"}}

def upgrade(msg):
    """Accept v1 results by filling the fields v2 added; refuse anything else."""
    if msg.get("contract") == "worker-result/v1":
        msg = {**msg, "contract": "worker-result/v2", "coverage": {"searched": None, "of_estimated": None}, "confidence": "low"}
    return msg

def check(msg):
    msg = upgrade(msg)
    problems = [f"missing {k}" for k in CONTRACT_V2["required"] if k not in msg]
    problems += [f"{k} must be {t.__name__}" for k, t in CONTRACT_V2["required"].items() if k in msg and not isinstance(msg[k], t)]
    if msg.get("contract") != "worker-result/v2":
        problems.append(f"unknown contract {msg.get('contract')}")
    if msg.get("status") not in CONTRACT_V2["status"]:
        problems.append(f"status {msg.get('status')!r} not allowed")
    if msg.get("confidence") not in CONTRACT_V2["confidence"]:
        problems.append(f"confidence {msg.get('confidence')!r} not allowed")
    if msg.get("status") == "partial" and not msg.get("coverage", {}).get("reason"):
        problems.append("a partial result must say why coverage is incomplete")
    return problems or ["ok"]

messages = {
    "good v2": {"contract": "worker-result/v2", "task_id": "T-17.3", "status": "partial", "result": {"themes": []},
                "coverage": {"searched": 9400, "of_estimated": 12000, "reason": "deadline reached"}, "confidence": "medium", "errors": []},
    "old v1": {"contract": "worker-result/v1", "task_id": "T-17.4", "status": "complete", "result": {"themes": []}, "errors": []},
    "free text": {"contract": "worker-result/v2", "task_id": "T-17.5", "status": "done, mostly", "result": "Found 5 themes, see above",
                  "coverage": {}, "confidence": "pretty sure", "errors": []},
    "silent partial": {"contract": "worker-result/v2", "task_id": "T-17.6", "status": "partial", "result": {"themes": []},
                       "coverage": {"searched": 100}, "confidence": "high", "errors": []},
}
for name, msg in messages.items():
    print(f"{name:15} -> {check(msg)}")
`

// ---- 12.5 A task graph with timeouts, retries and cancellation --------------------------------------------------------

const DAG = String.raw`TASKS = {"plan": [], "worker_a": ["plan"], "worker_b": ["plan"], "worker_c": ["plan"],
         "synthesis": ["worker_a", "worker_b", "worker_c"], "review": ["synthesis"]}
DURATION = {"plan": 3, "worker_a": 8, "worker_b": 25, "worker_c": 6, "synthesis": 5, "review": 4}
TIMEOUT = 15                       # seconds per task

def run(failure=None, policy="partial", cancel_at=None):
    finished, results, t, attempts = {}, {}, 0, {}
    log = []
    for name in ["plan", "worker_a", "worker_b", "worker_c", "synthesis", "review"]:
        start = max([finished[d] for d in TASKS[name] if d in finished] + [0])
        if any(results.get(d) == "cancelled" for d in TASKS[name]):
            log.append(f"{name}: cancelled before starting (an input was cancelled)")
            results[name] = "cancelled"
            continue
        missing = [d for d in TASKS[name] if results.get(d) not in ("ok", "partial")]
        if missing:
            if policy == "fail" or name != "synthesis":
                log.append(f"{name}: skipped, waiting on failed {missing}")
                results[name] = "skipped"
                continue
        took = DURATION[name]
        if failure == name and took <= TIMEOUT:
            attempts[name] = 2
            took = took * 2                      # failed once, retried once
            log.append(f"{name}: error, retried once")
        if cancel_at is not None and start + min(took, TIMEOUT) > cancel_at:
            where = "while running" if start < cancel_at else "before starting"
            log.append(f"{name}: cancelled {where} (user cancelled at {cancel_at} s)")
            results[name] = "cancelled"
            continue
        if took > TIMEOUT:
            finished[name] = start + TIMEOUT
            results[name] = "timeout"
            log.append(f"{name}: timed out at {start + TIMEOUT} s")
            continue
        finished[name] = start + took
        partial = name == "synthesis" and missing
        results[name] = "partial" if partial else "ok"
        log.append(f"{name}: {results[name]} at {finished[name]} s" + (f" (without {missing}, marked incomplete)" if partial else ""))
    return results, log

for label, kwargs in (("worker_b too slow, proceed with partial", {}),
                      ("worker_b too slow, fail the whole run", {"policy": "fail"}),
                      ("worker_c errors once, worker_b faster", {"failure": "worker_c"}),
                      ("user cancels at 10 s", {"cancel_at": 10})):
    if "faster" in label:
        DURATION["worker_b"] = 9
    results, log = run(**kwargs)
    print(label)
    for line in log:
        print("   ", line)
`

// ---- 12.6 Errors compound along a chain --------------------------------------------------------------------------------

const COMPOUND = String.raw`import random

STEP_OK = 0.95          # chance each step is right
CATCH = 0.6             # share of a step's errors a verifier catches (and the step is then fixed)

def chain(steps, catch):
    per_step = STEP_OK + (1 - STEP_OK) * catch     # right first time, or wrong but caught
    return per_step ** steps

print("steps  no verifier  verifier catches 60%")
for n in (1, 3, 6, 10):
    print(f"{n:5}  {chain(n, 0):11.1%}  {chain(n, CATCH):19.1%}")

random.seed(12)
runs, ok = 20_000, 0
for _ in range(runs):
    ok += all(random.random() < STEP_OK or random.random() < CATCH for _ in range(6))
print(f"Simulated 6-step chain with the verifier: {ok / runs:.1%} of {runs:,} runs end right")

ROUND_COST, MAX_ROUNDS = 0.30, 2
print(f"Critique loop: 14 rounds cost {14 * ROUND_COST:.2f} dollars; capped at {MAX_ROUNDS}, {MAX_ROUNDS * ROUND_COST:.2f} dollars")
`

// ---- 12.7 Delegation that can only narrow permissions ------------------------------------------------------------------

const DELEGATE = String.raw`USERS = {"alice": {"invoices.read", "invoices.write", "reports.read"},
         "intern": {"reports.read"}}

def sign_in(user):
    return {"sub": user, "aud": "assistant", "scopes": set(USERS[user]), "act": []}

def exchange(token, actor, audience, scopes):
    """Token exchange: a new token for one audience, never with scopes the incoming token lacks."""
    extra = set(scopes) - token["scopes"]
    if extra:
        raise PermissionError(f"{actor} asked for {sorted(extra)}, which {token['sub']} does not have")
    return {"sub": token["sub"], "aud": audience, "scopes": set(scopes), "act": token["act"] + [actor]}

def api(token, audience, needed):
    if token["aud"] != audience:
        return f"401 token is for {token['aud']}, not {audience}"
    if needed not in token["scopes"] or needed not in USERS[token["sub"]]:
        return f"403 {token['sub']} may not {needed}"
    chain = " <- ".join([token["sub"]] + token["act"][::-1])
    return f"200 ok, audit: {chain}"

alice = sign_in("alice")
worker = exchange(alice, "coordinator", "finance-api", {"invoices.read"})
print("read invoices:      ", api(worker, "finance-api", "invoices.read"))
print("write invoices:     ", api(worker, "finance-api", "invoices.write"))
print("wrong audience:     ", api(worker, "hr-api", "invoices.read"))
intern = sign_in("intern")
try:
    exchange(intern, "coordinator", "hr-api", {"salaries.read"})
except PermissionError as e:
    print("confused deputy:    ", e)
`

// ---- 12.8 Three designs on one evaluation suite ------------------------------------------------------------------------

const BASELINE = String.raw`import numpy as np

rng = np.random.default_rng(8)
TASKS = 120
# Illustrative per-task success chances: each design is good at a different share of the suite.
difficulty = rng.uniform(0, 1, TASKS)
designs = {
    "single agent":      {"p": np.clip(0.95 - 0.6 * difficulty, 0, 1), "cost": 0.19, "p95": 48},
    "parallel workflow": {"p": np.clip(0.97 - 0.35 * difficulty, 0, 1), "cost": 0.21, "p95": 31},
    "coordinator+critic": {"p": np.clip(0.98 - 0.32 * difficulty, 0, 1), "cost": 0.88, "p95": 112},
}
print(f"{'design':19} success  pass^3  cost/success  p95 s")
outcomes = {}
for name, d in designs.items():
    runs = rng.random((3, TASKS)) < d["p"]          # three repeated runs per task
    outcomes[name] = runs[0]
    success, pass3 = runs[0].mean(), runs.all(axis=0).mean()
    print(f"{name:19} {success:7.0%}  {pass3:6.0%}  {d['cost'] / success:12.2f}  {d['p95']:5}")

a, b = outcomes["coordinator+critic"].astype(float), outcomes["parallel workflow"].astype(float)
diffs = [np.mean((a - b)[idx]) for idx in rng.integers(0, TASKS, (2000, TASKS))]
lo, hi = np.percentile(diffs, [2.5, 97.5])
print(f"Coordinator minus workflow, paired bootstrap 95% interval: {lo:+.1%} to {hi:+.1%}")
print("If the interval includes zero, the extra cost buys no measurable quality.")
`

export const C12 = {
  'breadth-tokens': {
    title: 'When the work does not fit one context',
    brief: 'Sizes your project’s documents, scaled up, against one context window, and compares the tokens a parallel workflow and a coordinator with workers would use.',
    proves: 'Why breadth forces splitting and what coordination adds on top. The scale factor and per-message sizes are illustrative; it does not measure answer quality.',
    build: withDocs(BREADTH),
    check: 'assert coordinator > workflow > corpus',
  },
  'specialist-router': {
    title: 'Routing to specialists with an “other” path',
    brief: 'Learns a simple keyword router from half of your project’s labelled requests, routes the other half, and sends unsure cases to an “other” path.',
    proves: 'How a confidence margin trades automatic routing for accuracy. A keyword router is a stand-in; it does not show how an LLM router performs.',
    build: withLabelled(ROUTER),
    check: 'assert route("zzzz qqqq") == "other" and route(test[0]["text"], 1.01) == "other"',
  },
  'parallel-workers': {
    title: 'Parallel workers and the slowest one',
    brief: 'Splits your project’s documents among six workers with simulated durations and compares wall-clock time at concurrency 1, 3 and 6, then adds a deadline.',
    proves: 'That parallelism cuts waiting but not total work, and that synthesis waits for the slowest worker. The durations are simulated, not measured.',
    build: withDocs(PARALLEL),
    check: 'assert wall_clock(6)[0] <= wall_clock(3)[0] <= wall_clock(1)[0]',
  },
  'message-contract': {
    title: 'A versioned result contract',
    brief: 'Checks four worker results against a versioned contract, upgrades an old version and refuses free text and silent partial results.',
    proves: 'What a contract check catches between agents. It does not check that a well-formed result is true.',
    neutral: true,
    build: neutral(CONTRACT),
    check: 'assert check(messages["good v2"]) == ["ok"] and check(messages["old v1"]) == ["ok"] and check(messages["free text"]) != ["ok"]',
  },
  'task-dag': {
    title: 'A task graph under failure',
    brief: 'Runs a plan, three workers, synthesis and review with a timeout, a retry, a partial-results policy and a cancellation, and logs what happens to each task.',
    proves: 'How dependencies, timeouts and policies decide the outcome of a run. The durations are scripted; it does not run tasks concurrently.',
    neutral: true,
    build: neutral(DAG),
    check: 'DURATION["worker_b"] = 25\nr, _ = run()\nassert r["synthesis"] == "partial"\nr, _ = run(policy="fail")\nassert r["synthesis"] == "skipped"',
  },
  'error-compounding': {
    title: 'How errors compound along a chain',
    brief: 'Computes how per-step reliability compounds over 1 to 10 steps, with and without a verifier, checks it by simulation and prices a capped critique loop.',
    proves: 'How quickly chains lose reliability and how much a verifier recovers. It assumes independent errors, which real errors often are not.',
    neutral: true,
    build: neutral(COMPOUND),
    check: 'assert chain(6, CATCH) > chain(6, 0) and abs(ok / runs - chain(6, CATCH)) < 0.02',
  },
  'delegation-tokens': {
    title: 'Delegation that only narrows',
    brief: 'Exchanges a user’s token for a narrower one at each hop, lets the API decide with the user’s own rights, and refuses a scope the user never had.',
    proves: 'Why each hop can only reduce permissions and how the audit chain is kept. It is a model of token exchange, not a real OAuth server.',
    neutral: true,
    build: neutral(DELEGATE),
    check: 'assert api(worker, "finance-api", "invoices.read").startswith("200") and api(worker, "finance-api", "invoices.write").startswith("403")',
  },
  'design-baseline': {
    title: 'Three designs on one suite',
    brief: 'Scores a single agent, a parallel workflow and a coordinator with a critic on the same 120 simulated tasks: success, pass^3, cost per success and a paired bootstrap interval.',
    proves: 'How to compare designs fairly and read the interval. Every success chance and cost is invented, so it does not say which design wins on your tasks.',
    neutral: true,
    build: neutral(BASELINE),
    check: 'assert lo <= hi',
  },
} satisfies Record<string, Snippet>
