/** Chapter 18 snippets: release manifests, build once, CI gates, canary analysis, upgrade checks, draft edits, readiness. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { neutral, projectLabelled, projectMessages, type Snippet, type SnippetBundle } from './common.ts'

const withLabelled = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { rows, sources, what } = await projectLabelled(p, read)
  return { code, files: { 'labelled.json': JSON.stringify({ what, rows: rows.slice(0, 400) }) }, sources }
}
const withMessages = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { rows, sources } = await projectMessages(p, read)
  return { code, files: { 'messages.json': JSON.stringify(rows.filter((r) => r.language === 'en')) }, sources }
}

// ---- 18.1 A release manifest and its id --------------------------------------------------------------------------------

const MANIFEST = String.raw`import json, hashlib

def release_id(m):
    return "r-" + hashlib.sha256(json.dumps(m, sort_keys=True).encode()).hexdigest()[:10]

current = {"code": {"commit": "7f3c2e1", "image": "sha256:9b1e"},
           "prompts": {"answer": "v12", "triage": "v7"},
           "models": {"answer": "provider-a/large-2026-09", "triage": "pool/small-8b@ft-r431"},
           "index": {"alias": "kb-search", "target": "kb-v4", "embedder": "bge-base@rev2"},
           "config": {"retrieval_k": 8, "temperature": 0.2},
           "evaluation": {"suite": "v31"}}
candidate = json.loads(json.dumps(current))
candidate["prompts"]["answer"] = "v13"          # only a prompt changed: no code change at all

def diff(a, b, path=""):
    for k in sorted(set(a) | set(b)):
        if isinstance(a.get(k), dict):
            yield from diff(a[k], b[k], path + k + ".")
        elif a.get(k) != b.get(k):
            yield f"{path}{k}: {a.get(k)} -> {b.get(k)}"

print("current  ", release_id(current))
print("candidate", release_id(candidate), "changes:", list(diff(current, candidate)))
traces = [{"trace_id": "t1", "release": release_id(current), "thumbs_down": 0},
          {"trace_id": "t2", "release": release_id(candidate), "thumbs_down": 1}]
print("complaint t2 was served by", next(t["release"] for t in traces if t["trace_id"] == "t2"),
      "-> reproduce it with exactly that manifest")
`

// ---- 18.2 Build once, promote the same digest --------------------------------------------------------------------------

const PROMOTE = String.raw`import hashlib

def build(lockfile, base_image):
    return "sha256:" + hashlib.sha256((lockfile + base_image).encode()).hexdigest()[:12]

PINNED = ("vllm==0.11.0\ntransformers==4.57.1\n", "python@sha256:3f9a")
UNPINNED_TODAY = ("vllm>=0.10\ntransformers\n", "python:3.12")      # resolves to whatever is newest
UNPINNED_LATER = ("vllm>=0.10\ntransformers\n", "python:3.12-new-patch")

tested = build(*PINNED)
envs = {}
for env in ("dev", "staging", "prod"):
    envs[env] = tested                          # the same artefact moves forward; only config differs
print("build once:   ", envs, "-> prod runs what staging tested:", envs["prod"] == envs["staging"])

rebuilt = {"staging": build(*UNPINNED_TODAY), "prod": build(*UNPINNED_LATER)}
print("rebuild each: ", rebuilt, "-> prod runs what staging tested:", rebuilt["prod"] == rebuilt["staging"])
print("Pin versions by digest and promote the digest; a rebuild is a new, untested artefact.")
`

// ---- 18.3 A quality gate with per-segment checks -----------------------------------------------------------------------

const GATE = String.raw`import json, random, collections

random.seed(18)
data = json.load(open("labelled.json", encoding="utf-8"))
cases = [{"id": f"case-{i:03d}", "segment": r["label"], "critical": i % 10 == 0} for i, r in enumerate(data["rows"])]
segments = sorted({c["segment"] for c in cases})
weak = segments[-1]                      # the candidate is worse on one segment (simulated)

draw = {c["id"]: random.random() for c in cases}       # the same draw for both runs: a paired comparison

def run(candidate):
    out = {}
    for c in cases:
        p = 0.93 if not (candidate and c["segment"] == weak) else 0.80
        out[c["id"]] = draw[c["id"]] < p
    return out

MIN_PASS, MAX_SEGMENT_DROP = 0.90, 0.03
base, cand = run(False), run(True)
def rate(results, pick):
    ids = [c["id"] for c in cases if pick(c)]
    return sum(results[i] for i in ids) / len(ids)

failures = []
overall = rate(cand, lambda c: True)
if overall < MIN_PASS:
    failures.append(f"overall pass rate {overall:.1%} < {MIN_PASS:.0%}")
critical_broken = [c["id"] for c in cases if c["critical"] and base[c["id"]] and not cand[c["id"]]]
if critical_broken:
    failures.append(f"{len(critical_broken)} critical cases regressed: {critical_broken[:3]}")
for s in segments:
    drop = rate(base, lambda c: c["segment"] == s) - rate(cand, lambda c: c["segment"] == s)
    if drop > MAX_SEGMENT_DROP:
        failures.append(f"segment '{s}' dropped {drop:.1%}")
print(f"{len(cases)} cases from your project's {data['what']}; overall {rate(base, lambda c: True):.1%} -> {overall:.1%}")
print("GATE FAILED:" if failures else "gate passed", *failures, sep="\n  ")
`

// ---- 18.4 Automated canary analysis ------------------------------------------------------------------------------------

const CANARY = String.raw`import random

random.seed(4)
STEPS = [5, 25, 50, 100]
SAMPLES_PER_STEP = 500
BOUNDS = {"error_rate": 0.003, "groundedness": -0.015}     # allowed change against the baseline

def observe(errors, grounded):
    e = sum(random.random() < errors for _ in range(SAMPLES_PER_STEP)) / SAMPLES_PER_STEP
    g = sum(random.random() < grounded for _ in range(SAMPLES_PER_STEP)) / SAMPLES_PER_STEP
    return e, g

def rollout(regress_at=None):
    for step in STEPS:
        base_e, base_g = observe(0.004, 0.95)
        bad = regress_at is not None and step >= regress_at
        cand_e, cand_g = observe(0.004, 0.90 if bad else 0.95)
        breaches = []
        if cand_e - base_e > BOUNDS["error_rate"]:
            breaches.append(f"errors +{cand_e - base_e:.2%}")
        if cand_g - base_g < BOUNDS["groundedness"]:
            breaches.append(f"groundedness {cand_g - base_g:+.1%}")
        print(f"  {step:3}% of traffic: candidate groundedness {cand_g:.1%} vs baseline {base_g:.1%}", "BREACH " + ", ".join(breaches) if breaches else "ok")
        if breaches:
            return f"rolled back to 0% at the {step}% step"
    return "promoted to 100%"

print("healthy candidate:"); print(" ", rollout())
print("candidate that regresses at 25%:"); print(" ", rollout(regress_at=25))
`

// ---- 18.5 A model upgrade compatibility report -------------------------------------------------------------------------

const UPGRADE = String.raw`import random, statistics

random.seed(5)
N = 1000
def run(model):
    """Simulated per-request results for the current and the new model."""
    if model == "current":
        return [{"json_ok": random.random() < 0.998, "tokens": random.gauss(220, 60), "refused": random.random() < 0.012} for _ in range(N)]
    return [{"json_ok": random.random() < 0.991, "tokens": random.gauss(305, 80), "refused": random.random() < 0.031} for _ in range(N)]

cur, new = run("current"), run("new")
def share(rows, k):
    return sum(r[k] for r in rows) / len(rows)
checks = [
    ("JSON adherence", share(cur, "json_ok"), share(new, "json_ok"), lambda a, b: b >= a - 0.002, "enable constrained decoding"),
    ("over-refusal", share(cur, "refused"), share(new, "refused"), lambda a, b: b <= a + 0.005, "investigate categories, adjust the system prompt"),
    ("median output tokens", statistics.median(r["tokens"] for r in cur), statistics.median(r["tokens"] for r in new),
     lambda a, b: b <= a * 1.10, "add length guidance and re-check the cost gate"),
]
for name, a, b, ok, action in checks:
    fmt = (lambda x: f"{x:.1%}") if a < 1 else (lambda x: f"{x:.0f}")
    print(f"{name:21} current {fmt(a):>6}  new {fmt(b):>6}  {'OK' if ok(a, b) else 'ACTION: ' + action}")
PRICE_PER_M_OUT, REQUESTS = 15.0, 3_000_000
extra = (statistics.median(r["tokens"] for r in new) - statistics.median(r["tokens"] for r in cur)) * REQUESTS * PRICE_PER_M_OUT / 1e6
print(f"Longer outputs alone add about {extra:,.0f} dollars a month at {REQUESTS:,} requests (illustrative price).")
`

// ---- 18.6 Draft edits as a quality signal ------------------------------------------------------------------------------

const EDITS = String.raw`import json, random, difflib

random.seed(6)
msgs = [m["text"] for m in json.load(open("messages.json", encoding="utf-8"))][:120]
FILLER = ["Thank you for reaching out.", "We apologise for the inconvenience.", "Please let us know if you need anything else."]

def draft(m, version):
    extra = random.sample(FILLER, 3 if version == "v12" else 1)       # v12 drafts were wordier (simulated)
    return [f"Here is what we found about your message: {m}"] + extra

def sent(d):
    """An agent's edit: removes the filler sentences they never send."""
    return [s for s in d if s not in FILLER]

def edit_fraction(a, b):
    return 1 - difflib.SequenceMatcher(None, a, b).ratio()

for version in ("v12", "v13"):
    fractions = []
    for m in msgs:
        d = draft(m, version)
        fractions.append(edit_fraction(" ".join(d), " ".join(sent(d))))
    fractions.sort()
    print(f"prompt {version}: median edit fraction {fractions[len(fractions) // 2]:.0%} over {len(msgs)} drafts")

NEW_LABELS, THRESHOLD = 2_150, 2_000
print(f"retraining trigger: {NEW_LABELS:,} corrected examples >= {THRESHOLD:,} -> open a work item (it still goes through every gate)")
print("Each (draft, sent) pair is also a preference pair: the draft as rejected, the sent reply as chosen.")
`

// ---- 18.7 Readiness and ownership --------------------------------------------------------------------------------------

const READINESS = String.raw`MUST = {"SLOs defined": True, "dashboards and alerts live": True, "runbooks tested": False,
        "on-call staffed": True, "capacity plan from measured numbers": True, "DR restore tested": False,
        "security review done": True, "cost budgets configured": True, "rollback rehearsed": True}
missing = [k for k, v in MUST.items() if not v]
print(f"readiness: {len(MUST) - len(missing)} of {len(MUST)} must-have items done;",
      "launch blocked by: " + ", ".join(missing) if missing else "ready for launch")

RACI = {"acceptance criteria and eval set": {"product": "A", "ai_eng": "R", "sre": "C", "security": "C"},
        "prompt, model and index changes": {"product": "C", "ai_eng": "A/R", "sre": "I", "security": "I"},
        "SLOs, alerts and on-call": {"product": "C", "ai_eng": "R", "sre": "A", "security": "I"},
        "threat model and data protection": {"product": "I", "ai_eng": "R", "sre": "C", "security": "A"},
        "cost budgets": {"product": "A", "ai_eng": "R", "sre": "A", "security": "I"}}
for activity, roles in RACI.items():
    accountable = [who for who, r in roles.items() if "A" in r]
    if len(accountable) != 1:
        print(f"RACI problem: '{activity}' has {len(accountable)} accountable owners {accountable}; it needs exactly one")
print(f"{len(RACI)} activities checked; fix the problems before the readiness review signs off.")
`

export const C18 = {
  'release-manifest': {
    title: 'A release manifest and its id',
    brief: 'Hashes every versioned input, code, prompts, models, index, config and evaluation suite, into a release id, shows that a prompt-only change makes a new release, and finds which release served a complaint.',
    proves: 'How one id names the whole deployed system. It does not deploy anything; real manifests are stored and signed by the pipeline.',
    neutral: true,
    build: neutral(MANIFEST),
    check: 'assert release_id(current) != release_id(candidate) and list(diff(current, candidate)) == ["prompts.answer: v12 -> v13"]',
  },
  'build-once': {
    title: 'Build once, promote the same digest',
    brief: 'Builds an artefact from pinned inputs and promotes its digest through three environments, then shows that rebuilding with unpinned inputs ships something staging never tested.',
    proves: 'Why the digest, not the source, is what gets promoted. A hash stands in for a container build.',
    neutral: true,
    build: neutral(PROMOTE),
    check: 'assert envs["prod"] == envs["staging"] and rebuilt["prod"] != rebuilt["staging"]',
  },
  'ci-gate': {
    title: 'A quality gate with segment checks',
    brief: 'Builds an evaluation suite from your project’s labelled data, runs a baseline and a candidate that is worse on one segment, and fails the gate on overall rate, critical cases or a segment drop.',
    proves: 'How a gate catches a regression hidden in one segment. The pass and fail results are simulated, not a real evaluation; the gate logic is real.',
    build: withLabelled(GATE),
    check: 'assert any("segment" in f for f in failures)',
  },
  'canary-analysis': {
    title: 'Automated canary analysis',
    brief: 'Steps a candidate through 5%, 25%, 50% and 100% of traffic, compares sampled errors and groundedness with the baseline at each step, and rolls back on a breach.',
    proves: 'How bounds and sampling decide promotion. The metrics are simulated, and 500 samples do not reliably catch a small regression.',
    neutral: true,
    build: neutral(CANARY),
    check: 'assert rollout(regress_at=25).startswith("rolled back")',
  },
  'upgrade-report': {
    title: 'A model upgrade compatibility report',
    brief: 'Compares simulated results for the current and a new model on JSON adherence, over-refusal and output length, names an action for each failed check, and prices the longer outputs.',
    proves: 'Which properties code depends on beyond answer quality. The results are simulated; it does not test any real model.',
    neutral: true,
    build: neutral(UPGRADE),
    check: 'assert extra > 0',
  },
  'draft-edits': {
    title: 'Draft edits as a quality signal',
    brief: 'Writes simulated reply drafts for your project’s messages under two prompt versions, measures how much agents edit before sending, and checks a retraining trigger.',
    proves: 'How the draft-to-sent difference becomes a metric and training data. The drafts and edits are simulated, not real agents’ behaviour.',
    build: withMessages(EDITS),
    check: 'assert edit_fraction("abc", "abc") == 0',
  },
  'readiness-raci': {
    title: 'Readiness and ownership checks',
    brief: 'Checks a launch against its must-have readiness items and validates that every activity in a RACI table has exactly one accountable owner.',
    proves: 'That readiness and ownership can be checked mechanically. A ticked box does not prove the runbook works; drills do.',
    neutral: true,
    build: neutral(READINESS),
    check: 'assert missing == ["runbooks tested", "DR restore tested"]',
  },
} satisfies Record<string, Snippet>
