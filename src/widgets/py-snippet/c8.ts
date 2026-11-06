/** Chapter 8 snippets: building an eval set, checks, judge calibration, answer metrics, stage evaluation, regressions, A/B tests, agents. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { neutral, projectDocs, projectLabelled, projectMessages, type Snippet, type SnippetBundle } from './common.ts'

const withLabelled = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { rows, sources } = await projectLabelled(p, read)
  return { code, files: { 'labelled.json': JSON.stringify(rows) }, sources }
}
const withDocs = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { docs, sources } = await projectDocs(p, read)
  return { code, files: { 'docs.json': JSON.stringify(docs.slice(0, 60)) }, sources }
}

// ---- 8.1 A stratified evaluation set and its baseline --------------------------------------------------------------

const EVAL_SET = String.raw`import json, random, collections

rows = json.load(open("labelled.json", encoding="utf-8"))
random.seed(0)
counts = collections.Counter(r["label"] for r in rows)
print("Labels in all the data:", dict(counts.most_common()))

SIZE, MIN_PER_LABEL = 100, 8          # change them and run again
# A plain random sample can miss rare labels entirely. Stratify: every label gets at least MIN_PER_LABEL,
# the rest is filled in proportion to how common each label is.
by_label = collections.defaultdict(list)
for r in rows:
    by_label[r["label"]].append(r)
eval_set = []
for label, items in by_label.items():
    eval_set += random.sample(items, min(MIN_PER_LABEL, len(items)))
rest = [r for r in rows if r not in eval_set]
eval_set += random.sample(rest, SIZE - len(eval_set))
random_only = random.sample(rows, SIZE)

print(f"\n{'label':20} {'random sample':>14} {'stratified':>11}")
for label in counts:
    print(f"{label:20} {sum(r['label'] == label for r in random_only):14} {sum(r['label'] == label for r in eval_set):11}")

# The baseline every result is compared against: always answer the most common label.
majority = counts.most_common(1)[0][0]
baseline = sum(r["label"] == majority for r in eval_set) / len(eval_set)
print(f"\nBaseline (always '{majority}'): {baseline:.0%} correct. A model is worth what it adds above this.")
`

// ---- 8.2 Deterministic checks before any judge -----------------------------------------------------------------------

const CHECKS = String.raw`import json, re

# Candidate answers to "What is the refund window?", as an assistant might write them. Add your own.
ANSWERS = [
    '{"answer": "Refunds are possible within 14 days of delivery.", "source": "POL-12"}',
    '{"answer": "You can get a refund within 30 days.", "source": "POL-12"}',
    '{"answer": "Refunds are possible within 14 days of delivery."}',
    'Refunds are possible within 14 days of delivery. [POL-12]',
    '{"answer": "As an AI language model I cannot say.", "source": "POL-12"}',
    '{"answer": "' + "Refunds are possible within 14 days of delivery. " * 12 + '", "source": "POL-12"}',
]
SOURCES = {"POL-12": "Refunds are possible within 14 days of delivery for unused items."}
BANNED = ["as an ai language model", "i cannot say"]

def check(raw):
    try:
        out = json.loads(raw)
    except json.JSONDecodeError:
        return ["not valid JSON"]
    problems = []
    if not isinstance(out.get("answer"), str): problems.append("no answer field")
    if out.get("source") not in SOURCES: problems.append("missing or unknown source")
    text = out.get("answer", "")
    if len(text.split()) > 60: problems.append("too long")
    if any(b in text.lower() for b in BANNED): problems.append("banned phrase")
    src = SOURCES.get(out.get("source"), "")
    if any(n not in src for n in re.findall(r"\d+", text)): problems.append("a number not in the source")
    return problems

results = [check(a) for a in ANSWERS]
for raw, problems in zip(ANSWERS, results):
    print(("PASS " if not problems else "FAIL ") + f"{raw[:58]:58}  {'; '.join(problems)}")
print(f"\n{sum(not p for p in results)} of {len(ANSWERS)} pass. Code checks are free, fast and repeatable;")
print("only what they cannot judge (tone, helpfulness, subtle errors) needs a human or a model judge.")
`

// ---- 8.3 Judge bias and agreement with humans --------------------------------------------------------------------------

const JUDGE = String.raw`import numpy as np

rng = np.random.default_rng(4)
N = 300
human_good = rng.random(N) < 0.8                   # humans say 80% of answers are good
length = rng.uniform(50, 400, N)                    # words in each answer

# A SIMULATED judge: mostly follows quality, but likes long answers. Change LENGTH_LOVE and run again.
LENGTH_LOVE = 0.004
score = np.where(human_good, 1.5, -1.0) + LENGTH_LOVE * (length - 200) + rng.normal(0, 0.8, N)
judge_good = score > 0

agree = (judge_good == human_good).mean()
p_yes = judge_good.mean() * human_good.mean() + (1 - judge_good.mean()) * (1 - human_good.mean())
kappa = (agree - p_yes) / (1 - p_yes)
caught = (~judge_good & ~human_good).sum() / (~human_good).sum()
print(f"Raw agreement {agree:.0%}, but Cohen's kappa only {kappa:.2f}")
print(f"The judge catches {caught:.0%} of the answers humans call bad")
always_good = human_good.mean()
print(f"(A 'judge' that always says good would agree {always_good:.0%} of the time while knowing nothing.)")

long_bad = (~human_good) & (length > 300)
print(f"\nBad answers over 300 words passed by the judge: {judge_good[long_bad].mean():.0%}")
print(f"Bad answers under 100 words passed by the judge: {judge_good[(~human_good) & (length < 100)].mean():.0%}")

# Uncertainty on the judge's pass rate: bootstrap the cases.
boots = [rng.choice(judge_good, N).mean() for _ in range(1000)]
low, high = np.percentile(boots, [2.5, 97.5])
print(f"\nJudge pass rate {judge_good.mean():.0%}, 95% range {low:.0%} to {high:.0%} from {N} cases")
`

// ---- 8.4 Groundedness, completeness and refusals -------------------------------------------------------------------------

const ANSWER_METRICS = String.raw`import json, re, random

docs = json.load(open("docs.json", encoding="utf-8"))
random.seed(2)
picked = random.sample([d for d in docs if re.search(r"\d", d["text"])] or docs, min(4, len(docs)))

def sentences(t):
    return [s for s in re.split(r"(?<=[.!?])\s+", t) if s]
def words(t):
    return set(re.findall(r"[a-z0-9]+", t.lower()))

def grounded(answer, source):
    """A claim counts as supported if most of its words, and all of its numbers, appear in the source."""
    w, s = words(answer), words(source)
    numbers_ok = all(n in source for n in re.findall(r"\d+", answer))
    return numbers_ok and len(w & s) / max(1, len(w)) >= 0.7

cases = []
for d in picked:
    first = sentences(d["text"])[0]
    changed = re.sub(r"\d+", lambda m: str(int(m.group()) + 7), first, count=1)
    cases.append(("faithful", first, d["text"]))
    cases.append(("number changed", changed, d["text"]))
    cases.append(("added claim", first + " Staff can also approve exceptions by phone.", d["text"]))

print(f"{'case':16} {'grounded':>9}  answer")
scores = []
for kind, answer, source in cases:
    claims = sentences(answer)
    ok = [grounded(c, source) for c in claims]
    scores.append((kind, all(ok)))
    print(f"{kind:16} {sum(ok)}/{len(ok)} {'yes' if all(ok) else 'NO':>5}  {answer[:70]}")

# Refusals: should-answer and should-refuse cases measured separately.
SHOULD_ANSWER, SHOULD_REFUSE = 50, 20
answered_ok, refused_ok = 44, 17                # illustrative counts from a run
print(f"\nOver-refusal: {1 - answered_ok / SHOULD_ANSWER:.0%} of answerable questions refused")
print(f"Under-refusal: {1 - refused_ok / SHOULD_REFUSE:.0%} of should-refuse questions answered anyway")
`

// ---- 8.5 Retrieval against answer evaluation ----------------------------------------------------------------------------

const STAGES = String.raw`import json, re, random

docs = json.load(open("docs.json", encoding="utf-8"))
STOP = {"the", "a", "an", "of", "to", "and", "is", "for", "in", "on", "with", "are", "be", "or", "by", "at", "from", "it"}
def words(t):
    return [w for w in re.findall(r"[a-z0-9]+", t.lower()) if w not in STOP]

# Queries: each document's title with one word dropped, so the retriever has to match the rest.
random.seed(1)
queries = []
for d in docs:
    w = words(d["title"])
    if len(w) >= 2:
        w.pop(random.randrange(len(w)))
        queries.append((" ".join(w), d["id"]))

def retrieve(q, k):
    qw = set(words(q))
    ranked = sorted(docs, key=lambda d: -len(qw & set(words(d["title"] + " " + d["text"]))))
    return [d["id"] for d in ranked[:k]]

for k in (1, 3, 5):
    recall = sum(gold in retrieve(q, k) for q, gold in queries) / len(queries)
    print(f"Recall@{k}: {recall:.0%} of {len(queries)} queries find their document in the top {k}")

# Answer stage with ORACLE context: give the right document directly. If answers are good here but bad
# end to end, the retriever is the problem, not the model.
ANSWER_ACCURACY_WITH_ORACLE = 0.93     # illustrative, from a separate answer evaluation
recall5 = sum(gold in retrieve(q, 5) for q, gold in queries) / len(queries)
print(f"\nIf answers are {ANSWER_ACCURACY_WITH_ORACLE:.0%} right with the correct document, end-to-end accuracy")
print(f"is at most about {recall5 * ANSWER_ACCURACY_WITH_ORACLE:.0%} with this retriever at k = 5.")
`

// ---- 8.6 A regression suite with slices -----------------------------------------------------------------------------

const REGRESSION = String.raw`import json, random, collections

rows = json.load(open("messages.json", encoding="utf-8"))
random.seed(6)
suite = []
for lang in sorted({r["language"] for r in rows}):           # up to 50 cases per language, so every slice counts
    same = [r for r in rows if r["language"] == lang]
    suite += random.sample(same, min(50, len(same)))
for i, case in enumerate(suite):
    case["id"] = f"#{100 + i}"
    case["critical"] = i % 25 == 0                 # a few must-pass cases

# SIMULATED results for the production prompt (v6) and a candidate (v7): v7 is better in English
# and worse in other languages. Change the rates and run again.
PASS = {"v6": {"en": 0.86, "other": 0.84}, "v7": {"en": 0.94, "other": 0.68}}
def run(version):
    rnd = random.Random(version)
    return {c["id"]: rnd.random() < PASS[version]["en" if c["language"] == "en" else "other"] for c in suite}
v6, v7 = run("v6"), run("v7")

print(f"v6 {sum(v6.values())}/{len(suite)}   v7 {sum(v7.values())}/{len(suite)}")
by_lang = collections.defaultdict(lambda: [0, 0, 0])
for c in suite:
    s = by_lang[c["language"]]
    s[0] += 1; s[1] += v6[c["id"]]; s[2] += v7[c["id"]]
print(f"\n{'language':10} {'cases':>6} {'v6':>6} {'v7':>6}")
for lang, (n, a, b) in sorted(by_lang.items()):
    print(f"{lang:10} {n:6} {a / n:6.0%} {b / n:6.0%}")

fixed = [c["id"] for c in suite if not v6[c["id"]] and v7[c["id"]]]
broke = [c for c in suite if v6[c["id"]] and not v7[c["id"]]]
blocking = [c["id"] for c in broke if c["critical"]]
print(f"\n{len(fixed)} cases fixed, {len(broke)} regressed; critical regressions: {blocking or 'none'}")
print("Release gate:", "BLOCK" if blocking else "pass on critical cases; now check each language slice")
`

// ---- 8.7 An A/B test: sample size, a result and the peeking trap -------------------------------------------------------

const AB_TEST = String.raw`import math
import numpy as np

BASE, LIFT = 0.30, 0.02          # 30% self-resolution now; the smallest gain worth detecting is 2 points
Z_ALPHA, Z_POWER = 1.96, 0.84    # 5% false-alarm rate (two-sided), 80% power
p_bar = BASE + LIFT / 2
n = math.ceil((Z_ALPHA + Z_POWER) ** 2 * 2 * p_bar * (1 - p_bar) / LIFT ** 2)
print(f"Users needed per group: about {n:,}")

# One simulated test with a real 2-point lift.
rng = np.random.default_rng(8)
a = rng.random(n) < BASE
b = rng.random(n) < BASE + LIFT
diff = b.mean() - a.mean()
se = math.sqrt(a.mean() * (1 - a.mean()) / n + b.mean() * (1 - b.mean()) / n)
print(f"Measured lift {diff:+.1%}, 95% interval {diff - 1.96 * se:+.1%} to {diff + 1.96 * se:+.1%}")

# The peeking trap: with NO real difference, checking every day and stopping at the first "significant"
# result declares a winner far more often than 5% of the time.
false_wins, RUNS, DAYS = 0, 400, 20
for _ in range(RUNS):
    a = rng.random((DAYS, n // DAYS)) < BASE
    b = rng.random((DAYS, n // DAYS)) < BASE
    for day in range(1, DAYS + 1):
        pa, pb, m = a[:day].mean(), b[:day].mean(), day * (n // DAYS)
        z = (pb - pa) / math.sqrt(pa * (1 - pa) / m + pb * (1 - pb) / m)
        if abs(z) > Z_ALPHA:
            false_wins += 1
            break
peek_rate = false_wins / RUNS
print(f"\nNo real difference, peeking daily for {DAYS} days: a 'winner' is declared in {peek_rate:.0%} of tests")
`

// ---- 8.8 Checking an agent's run by its trace and end state ---------------------------------------------------------

const AGENT_EVAL = String.raw`# Recorded runs of an agent asked to "issue the late-delivery credit for order A-1043". Edit them and run again.
RUNS = {
    "run 1": {"calls": [("get_order", {"id": "A-1043"}), ("create_credit", {"order": "A-1043", "amount": 200})],
              "state": {"credits": [("A-1043", 200)]}, "message": "I issued a 200 credit for A-1043."},
    "run 2": {"calls": [("get_order", {"id": "A-1043"}), ("create_credit", {"order": "A-1043", "amount": 200}),
                        ("create_credit", {"order": "A-1043", "amount": 200})],
              "state": {"credits": [("A-1043", 200), ("A-1043", 200)]}, "message": "Done, credit issued."},
    "run 3": {"calls": [("create_credit", {"order": "A-1043", "amount": 200})],
              "state": {"credits": [("A-1043", 200)]}, "message": "Credit of 200 issued."},
    "run 4": {"calls": [("get_order", {"id": "A-1043"}), ("get_customer", {"id": "C-7"})],
              "state": {"credits": []}, "message": "I issued the credit."},
}
EXPECTED_STATE = {"credits": [("A-1043", 200)]}
ALLOWED = {"get_order", "get_customer", "create_credit"}
MAX_STEPS = 8

def evaluate(run):
    problems = []
    names = [c[0] for c in run["calls"]]
    if any(n not in ALLOWED for n in names): problems.append("forbidden tool")
    if len(names) > MAX_STEPS: problems.append("too many steps")
    if "create_credit" in names and "get_order" not in names[: names.index("create_credit")]:
        problems.append("credited before checking the order")
    if run["state"] != EXPECTED_STATE: problems.append("wrong end state")
    says_done = "issued" in run["message"].lower()
    if says_done != bool(run["state"]["credits"]): problems.append("message does not match what happened")
    return problems

results = {name: evaluate(run) for name, run in RUNS.items()}
for name, problems in results.items():
    print(f"{name}: {'PASS' if not problems else 'FAIL'}  {'; '.join(problems)}")

p = sum(not v for v in results.values()) / len(results)
print(f"\nPer-run success {p:.0%}: pass@3 = {1 - (1 - p) ** 3:.0%} (at least one of 3 runs works), "
      f"pass^3 = {p ** 3:.0%} (all 3 work)")
`

async function regression(p: Project, read: DataReader): Promise<SnippetBundle> {
  const { rows, sources } = await projectMessages(p, read)
  return { code: REGRESSION, files: { 'messages.json': JSON.stringify(rows) }, sources }
}

export const C8 = {
  'eval-set': {
    title: 'A stratified evaluation set and its baseline',
    brief: 'Draws a 100-case evaluation set from your example project’s labelled data, once at random and once stratified so every label is present, and works out the always-the-same-answer baseline.',
    proves:
      'Stratifying guarantees rare labels are tested, and the baseline gives every score its meaning. It does not label anything: real evaluation sets need a written guideline and an agreement check.',
    build: withLabelled(EVAL_SET),
    check: `assert len(eval_set) == SIZE\nassert all(sum(r["label"] == l for r in eval_set) >= min(MIN_PER_LABEL, n) for l, n in counts.items())`,
  },
  'code-checks': {
    title: 'Deterministic checks first',
    brief: 'Runs six candidate answers through code checks: valid JSON, a known source, length, banned phrases and numbers that must appear in the source.',
    proves:
      'Code catches format errors, missing citations and changed numbers instantly and for free. It does not judge tone or subtle meaning; that is what humans and calibrated judges are for.',
    neutral: true,
    build: neutral(CHECKS),
    check: `assert results[0] == []\nassert "a number not in the source" in results[1]`,
  },
  'judge-bias': {
    title: 'A judge with a taste for length',
    brief: 'Simulates a model judge that mostly follows quality but likes long answers, and measures its agreement with human labels, Cohen’s kappa, how often it passes long bad answers, and a bootstrap range.',
    proves:
      'High raw agreement can hide a weak judge, and biases show up when you slice by the suspected cause. The judge and the human labels are simulated, so the numbers are not from a real judge.',
    neutral: true,
    build: neutral(JUDGE),
    check: `assert kappa < agree\nassert judge_good[long_bad].mean() > judge_good[(~human_good) & (length < 100)].mean()`,
  },
  'answer-metrics': {
    title: 'Groundedness, claim by claim',
    brief: 'Takes sentences from your example project’s documents as answers, makes versions with a changed number or an added claim, checks each claim against its source, and works out refusal rates.',
    proves:
      'Claim-level checks catch changed numbers and added claims. Matching words is far cruder than a calibrated judge, and the refusal counts are illustrative, not from a run.',
    build: withDocs(ANSWER_METRICS),
    check: `assert all(ok for kind, ok in scores if kind == "faithful")\nassert not any(ok for kind, ok in scores if kind == "added claim")`,
  },
  'stage-eval': {
    title: 'Retrieval first, then answers',
    brief: 'Builds a query from each of your example project’s document titles, measures Recall@1, 3 and 5 of a word-overlap retriever, and shows how retrieval caps end-to-end accuracy.',
    proves:
      'Measuring each stage tells you where failures come from. The queries are made from titles and the retriever only counts shared words, so this recall is not what a real retriever would score.',
    build: withDocs(STAGES),
    check: `assert 0 <= recall5 <= 1\nassert len(queries) >= 3`,
  },
  'regression-suite': {
    title: 'A regression suite with language slices',
    brief: 'Builds a suite of up to 50 cases per language from your example project’s messages, compares simulated results of two prompt versions overall, by language and on critical cases, and decides whether the release is blocked.',
    proves:
      'An overall gain can hide a drop for one language or a broken critical case, and a slice of a few cases is too small to judge. The pass rates are simulated, not from running real prompts.',
    build: regression,
    check: `assert len(fixed) >= 0 and len(broke) >= 0\nassert len(by_lang) >= 2`,
  },
  'ab-test': {
    title: 'A/B test size, result and the peeking trap',
    brief: 'Works out how many users an A/B test needs to detect a 2-point lift, simulates one test, then shows how checking every day and stopping early declares false winners.',
    proves:
      'Small lifts need large samples, and peeking inflates false positives well above 5%. Users are simulated, not real traffic; the formula is the standard two-proportion approximation.',
    neutral: true,
    build: neutral(AB_TEST),
    check: `assert n > 1000\nassert peek_rate > 0.07, peek_rate`,
  },
  'agent-eval': {
    title: 'Grading an agent by trace and end state',
    brief: 'Checks four recorded agent runs for allowed tools, step limits, checking before acting, the right end state and an honest final message, then works out pass@3 and pass^3.',
    proves:
      'End-state and honesty checks catch failures a final message hides. The runs are written by hand to show each failure, so the success rate is not a real agent’s.',
    neutral: true,
    build: neutral(AGENT_EVAL),
    check: `assert results["run 1"] == []\nassert "message does not match what happened" in results["run 4"]`,
  },
} satisfies Record<string, Snippet>
