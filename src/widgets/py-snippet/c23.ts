/** Chapter 23 snippets: obligations to evidence, AI Act roles, data-subject requests, transparency records, audit sampling. */
import { fromActions, neutral, type Snippet } from './common.ts'

// ---- 23.1 From obligations to controls to evidence --------------------------------------------------------------------

const MATRIX = String.raw`from datetime import date

TODAY = date(2026, 11, 7)
OBLIGATIONS = {
    "O1 human oversight of consequential decisions": ["C1 approval step", "C2 override and stop"],
    "O2 keep records of system operation": ["C3 decision logs"],
    "O3 tell people they are talking to an AI": ["C4 disclosure banner"],
    "O4 manage risks before release": ["C5 release gates", "C6 threat model"],
    "O5 handle requests to delete personal data": [],
}
EVIDENCE = {   # control -> (evidence, last produced)
    "C1 approval step": ("approval records in the audit log", date(2026, 11, 6)),
    "C2 override and stop": ("kill-switch drill report", date(2026, 3, 2)),
    "C3 decision logs": ("log retention report", date(2026, 10, 31)),
    "C4 disclosure banner": ("screenshot in release notes", date(2026, 9, 15)),
    "C5 release gates": ("gate results per release", date(2026, 11, 3)),
}
MAX_AGE_DAYS = 180

for obligation, controls in OBLIGATIONS.items():
    if not controls:
        print(f"GAP  {obligation}: no control")
        continue
    for c in controls:
        if c not in EVIDENCE:
            print(f"GAP  {obligation} -> {c}: no evidence")
        else:
            what, when = EVIDENCE[c]
            age = (TODAY - when).days
            status = "STALE" if age > MAX_AGE_DAYS else "ok   "
            print(f"{status} {obligation} -> {c}: {what} ({age} days old)")
print("Simplified example for orientation; it is not legal advice and does not list any law's actual obligations.")
`

// ---- 23.2 Roles and risk categories, simplified -----------------------------------------------------------------------

const ROLES = String.raw`# A deliberately simplified sketch of the EU AI Act's structure, for orientation only.
PROHIBITED = {"social scoring by public authorities", "manipulation exploiting vulnerabilities"}
HIGH_RISK_AREAS = {"employment", "credit scoring", "education", "essential public services", "law enforcement"}
DUTIES = {
    ("high", "provider"): ["risk management system", "data governance", "technical documentation", "logging",
                           "human oversight design", "accuracy and robustness", "conformity assessment", "registration"],
    ("high", "deployer"): ["use as instructed", "human oversight by trained people", "keep logs", "inform affected people",
                           "fundamental rights impact assessment (some deployers)"],
    ("limited", "provider"): ["mark AI-generated content", "design for disclosure"],
    ("limited", "deployer"): ["tell people they interact with AI", "disclose deep fakes"],
    ("minimal", "provider"): ["voluntary codes of conduct"],
    ("minimal", "deployer"): ["voluntary codes of conduct"],
}
def category(case):
    if case["practice"] in PROHIBITED:
        return "prohibited"
    if case["area"] in HIGH_RISK_AREAS:
        return "high"
    if case["interacts_with_people"] or case["generates_content"]:
        return "limited"
    return "minimal"

cases = [
    {"name": "loan pre-qualification model", "area": "credit scoring", "practice": "", "interacts_with_people": False, "generates_content": False, "role": "provider"},
    {"name": "CV screening tool bought from a vendor", "area": "employment", "practice": "", "interacts_with_people": False, "generates_content": False, "role": "deployer"},
    {"name": "customer support chatbot", "area": "customer service", "practice": "", "interacts_with_people": True, "generates_content": True, "role": "deployer"},
    {"name": "spam filter", "area": "email", "practice": "", "interacts_with_people": False, "generates_content": False, "role": "provider"},
]
for c in cases:
    cat = category(c)
    duties = DUTIES.get((cat, c["role"]), ["do not deploy"])
    print(f"{c['name']:40} {cat:8} as {c['role']:8}: {', '.join(duties)}")
print("Orientation only, not legal advice: real classification depends on the full text, annexes, guidance and dates.")
`

// ---- 23.3 A deletion request reaching every copy ----------------------------------------------------------------------

const ERASURE = String.raw`import random
from datetime import date, timedelta

random.seed(23)
SUBJECT = "C-104477"           # a fictional customer id
STORES = {"source records": 3, "chunks and vectors": 12, "answer cache": 4, "agent memory": 2,
          "traces (30-day retention)": 40, "evaluation set": 1, "fine-tuning set": 2, "backups": 3}
LEGAL_HOLD = {"traces (30-day retention)": False, "backups": True}     # backups expire on their own schedule

found = {k: v for k, v in STORES.items()}
deleted, kept = {}, {}
for store, n in found.items():
    if LEGAL_HOLD.get(store):
        kept[store] = n
    else:
        deleted[store] = n
received = date(2026, 11, 1)
deadline = received + timedelta(days=30)
print(f"request for {SUBJECT} received {received}, respond by {deadline} (a common one-month deadline; check your law)")
print(f"copies found: {sum(found.values())} across {len(found)} stores")
for k, v in deleted.items():
    print(f"  deleted   {v:3}  {k}")
for k, v in kept.items():
    print(f"  retained  {v:3}  {k}: expires with the backup cycle; restore procedures must re-delete")
print("verification: search every store again for the id and a canary phrase; record the result as evidence")
print("models trained on the fine-tuning set are flagged for review: deleting the rows does not remove what was learned")
`

// ---- 23.4 Disclosure, labelling and records -----------------------------------------------------------------------------

const RECORDS = String.raw`import json, random

random.seed(4)
REQUIRED = ["timestamp", "system_version", "model", "input_ref", "output_ref", "user_or_operator", "human_reviewer", "decision"]
def log_entry(i):
    e = {"timestamp": f"2026-11-0{1 + i % 6}T10:{i % 60:02d}", "system_version": "r2026.11.3", "model": "provider-a/large-2026-09",
         "input_ref": f"in-{i}", "output_ref": f"out-{i}", "user_or_operator": f"op-{i % 7}", "human_reviewer": f"rev-{i % 3}",
         "decision": random.choice(["approved", "rejected", "edited"])}
    for k in REQUIRED:
        if random.random() < 0.02:
            e.pop(k)                       # a field the pipeline sometimes forgets
    return e

logs = [log_entry(i) for i in range(500)]
missing = {k: sum(k not in e for e in logs) for k in REQUIRED}
complete = sum(all(k in e for k in REQUIRED) for e in logs)
print(f"{len(logs)} decision records, {complete} complete ({complete / len(logs):.0%})")
print("missing fields:", {k: v for k, v in missing.items() if v})

def label(content, generated):
    meta = {"generator": "assistant", "model": "provider-a/large-2026-09", "created": "2026-11-07"} if generated else None
    shown = ("AI-generated: " + content) if generated else content
    return shown, meta
shown, meta = label("Summary of your claim and next steps.", True)
print("shown to the user:", shown)
print("attached metadata:", json.dumps(meta))
`

// ---- 23.5 Audit sampling ------------------------------------------------------------------------------------------------

const AUDIT = String.raw`import json, math, random

random.seed(5)
A = json.load(open("actions.json", encoding="utf-8"))
items = A["items"]
TRUE_ERROR = 0.04                         # share of decisions that break policy (simulated, unknown to the auditor)
broken = {it["id"] for it in items if random.random() < TRUE_ERROR}

def wilson(k, n, z=1.96):
    p = k / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return max(0, centre - half), centre + half

for n in (20, 60, len(items)):
    sample = random.sample(items, n)
    k = sum(it["id"] in broken for it in sample)
    lo, hi = wilson(k, n)
    print(f"sample {n:3} of {len(items)} {A['action']} decisions: {k} breaches, rate {k / n:5.1%}, 95% interval {lo:.1%} to {hi:.1%}")

def zero_sample(limit, confidence=0.95):
    """How many checks with zero breaches let you say the rate is below 'limit'."""
    return math.ceil(math.log(1 - confidence) / math.log(1 - limit))
print(f"to claim fewer than 5% breaches after finding none: {zero_sample(0.05)} checks; fewer than 1%: {zero_sample(0.01)} checks")
`

export const C23 = {
  'control-matrix': {
    title: 'From obligations to controls to evidence',
    brief: 'Maps five example obligations to controls and each control to its latest evidence, then flags obligations with no control, controls with no evidence, and evidence that is out of date.',
    proves: 'How a control matrix shows gaps. The obligations are generic examples, not any law’s text, and it is not legal advice.',
    neutral: true,
    build: neutral(MATRIX),
    check: 'assert OBLIGATIONS["O5 handle requests to delete personal data"] == []',
  },
  'ai-act-roles': {
    title: 'Roles and risk categories, simplified',
    brief: 'Places four use cases into simplified risk categories and lists sketched duties for a provider or a deployer.',
    proves: 'The shape of a risk-based law: category and role decide duties. It is a simplification, not legal advice, and does not classify any real system.',
    neutral: true,
    build: neutral(ROLES),
    check: 'assert category(cases[0]) == "high" and category(cases[3]) == "minimal"',
  },
  'erasure-request': {
    title: 'A deletion request reaching every copy',
    brief: 'Finds a fictional customer’s data in eight stores, deletes what can be deleted, records what is retained and why, and notes what deleting training rows cannot undo.',
    proves: 'How many copies a deletion must reach. The stores and counts are illustrative, and it does not state any law’s exact deadline or exceptions.',
    neutral: true,
    build: neutral(ERASURE),
    check: 'assert sum(deleted.values()) + sum(kept.values()) == sum(STORES.values())',
  },
  'decision-records': {
    title: 'Decision records and AI labels',
    brief: 'Checks 500 simulated decision records for required fields, reports the gaps, and labels a generated text with visible text and attached metadata.',
    proves: 'How record-keeping and labelling can be checked automatically. The field list is an example, not a legal requirement.',
    neutral: true,
    build: neutral(RECORDS),
    check: 'assert complete <= len(logs) and meta is not None',
  },
  'audit-sampling': {
    title: 'Sampling decisions for an audit',
    brief: 'Samples your project’s money-moving decisions with a hidden breach rate, estimates the rate with an interval for three sample sizes, and works out how many clean checks support a claim.',
    proves: 'How sample size limits what an audit can claim. The breaches are simulated; it does not audit any real decision.',
    build: fromActions(AUDIT),
    check: 'assert zero_sample(0.05) == 59',
  },
} satisfies Record<string, Snippet>
