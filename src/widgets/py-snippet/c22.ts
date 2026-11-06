/** Chapter 22 snippets: where AI fits, citations, perceived latency, review and undo, feedback, graceful failure. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { fromActions, fromMessages, neutral, projectDocs, type Snippet, type SnippetBundle } from './common.ts'

const withDocs = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { docs, sources } = await projectDocs(p, read)
  return { code, files: { 'docs.json': JSON.stringify(docs.slice(0, 120)) }, sources }
}

// ---- 22.1 Should this feature use AI? ----------------------------------------------------------------------------------

const FIT = String.raw`# Score candidate features from 1 (poor) to 5 (good) on what makes AI a good fit. Weights are a starting point.
CRITERIA = {"tolerates_errors": 3, "easy_to_check": 3, "rules_cannot_capture": 2, "volume": 1, "data_available": 1}
FEATURES = {
    "draft replies for agents to edit":       {"tolerates_errors": 4, "easy_to_check": 5, "rules_cannot_capture": 5, "volume": 4, "data_available": 4},
    "auto-approve refunds without review":    {"tolerates_errors": 1, "easy_to_check": 2, "rules_cannot_capture": 3, "volume": 4, "data_available": 4},
    "calculate the refund amount":            {"tolerates_errors": 1, "easy_to_check": 5, "rules_cannot_capture": 1, "volume": 4, "data_available": 5},
    "summarise long ticket threads":          {"tolerates_errors": 4, "easy_to_check": 3, "rules_cannot_capture": 5, "volume": 3, "data_available": 4},
    "search help articles in plain language": {"tolerates_errors": 4, "easy_to_check": 4, "rules_cannot_capture": 4, "volume": 5, "data_available": 5},
}
def score(f):
    return sum(CRITERIA[k] * f[k] for k in CRITERIA) / (5 * sum(CRITERIA.values()))

for name, f in sorted(FEATURES.items(), key=lambda kv: -score(kv[1])):
    s = score(f)
    if f["rules_cannot_capture"] <= 1:
        verdict = "use code: rules capture it"
    elif f["tolerates_errors"] <= 2:
        verdict = "AI only with a person deciding"
    elif s >= 0.75:
        verdict = "good fit for AI"
    else:
        verdict = "AI to assist, measure first"
    print(f"{name:40} fit {s:4.0%}  -> {verdict}")
`

// ---- 22.2 Attaching citations and flagging unsupported sentences ------------------------------------------------------

const CITE = String.raw`import json, re, random

random.seed(22)
docs = json.load(open("docs.json", encoding="utf-8"))
def words(t):
    return {w for w in re.findall(r"[a-z0-9]+", t.lower()) if len(w) > 3}

# An "answer": two sentences taken from documents plus one the model made up (simulated).
picked = random.sample(docs, 2)
answer = [re.split(r"(?<=[.!?])\s+", d["text"])[0] for d in picked] + ["Any exception is always approved if you simply ask for it."]

def cite(sentence, threshold=0.5):
    best = max(docs, key=lambda d: len(words(sentence) & words(d["text"])) / max(1, len(words(sentence))))
    overlap = len(words(sentence) & words(best["text"])) / max(1, len(words(sentence)))
    return (best["id"], overlap) if overlap >= threshold else (None, overlap)

for s in answer:
    doc, overlap = cite(s)
    mark = f"[{doc}]" if doc else "[no source: show as unverified or remove]"
    print(f"{s[:70]:72} {mark}  (overlap {overlap:.0%})")

def label(p):
    return "high" if p >= 0.85 else "medium" if p >= 0.6 else "low: suggest checking with a person"
for p in (0.92, 0.7, 0.4):
    print(f"model score {p:.2f} -> show '{label(p)}' (only if scores are calibrated)")
`

// ---- 22.3 What users perceive while they wait -------------------------------------------------------------------------

const WAIT = String.raw`import random

random.seed(3)
USERS = 10_000
# Simulated patience: how long people wait with no sign of progress before giving up (illustrative).
patience = [random.lognormvariate(1.6, 0.6) for _ in range(USERS)]     # median about 5 seconds

def abandon(first_feedback_s):
    return sum(p < first_feedback_s for p in patience) / USERS

TTFT, TOTAL = 0.8, 9.0          # seconds to first token and to the full answer
print(f"first token after {TTFT} s, full answer after {TOTAL} s")
for design, first in (("wait for the full answer", TOTAL), ("show a progress step at 0.3 s", 0.3), ("stream tokens", TTFT)):
    print(f"  {design:32} first feedback at {first:4.1f} s -> {abandon(first):5.1%} give up before seeing anything")
for steps in (3, 6):
    print(f"an agent task of {steps} steps at 4 s each: {steps * 4} s; showing each finished step keeps the longest silent gap at 4 s "
          f"({abandon(4):.0%} give up) instead of {steps * 4} s ({abandon(steps * 4):.0%})")
`

// ---- 22.4 Review, edit and undo --------------------------------------------------------------------------------------

const REVIEW = String.raw`import json, random

random.seed(4)
A = json.load(open("actions.json", encoding="utf-8"))
WRONG = 0.06              # share of proposed actions that are wrong (simulated)
REVIEW_CATCH = 0.80       # share of wrong proposals a reviewer catches
UNDO_WINDOW_MIN = 10      # reversible actions can be undone within this many minutes
UNDO_USED = 0.5           # share of remaining mistakes noticed and undone in the window

items = A["items"]
wrong = [random.random() < WRONG for _ in items]
reviewed = [it["amount"] > A["threshold"] for it in items]          # big amounts need a person
caught = [w and r and random.random() < REVIEW_CATCH for w, r in zip(wrong, reviewed)]
undone = [w and not c and random.random() < UNDO_USED for w, c in zip(wrong, caught)]
slipped = [w and not c and not u for w, c, u in zip(wrong, caught, undone)]

money = lambda flags: sum(it["amount"] for it, f in zip(items, flags) if f)
print(f"{len(items)} proposed {A['action']} actions; {sum(reviewed)} above {A['threshold']:,} {A['currency']} need a reviewer")
print(f"  wrong proposals:        {sum(wrong):3}  ({money(wrong):,.0f} {A['currency']})")
print(f"  caught in review:       {sum(caught):3}  ({money(caught):,.0f})")
print(f"  undone in {UNDO_WINDOW_MIN} minutes:    {sum(undone):3}  ({money(undone):,.0f})")
print(f"  slipped through:        {sum(slipped):3}  ({money(slipped):,.0f}) -> needs reconciliation, since rollback cannot undo money already moved")
`

// ---- 22.5 Feedback buttons: who clicks, and how much data you need ----------------------------------------------------

const FEEDBACK = String.raw`import math, random

random.seed(5)
SESSIONS = 50_000
BAD_RATE = 0.12                       # true share of unhelpful answers (simulated)
CLICK_IF_BAD, CLICK_IF_GOOD = 0.08, 0.02      # unhappy users click more often than happy ones
REASONS = ["wrong", "out of date", "not what I asked", "too long", "unsafe"]

down = up = 0
reasons = {r: 0 for r in REASONS}
for _ in range(SESSIONS):
    bad = random.random() < BAD_RATE
    if bad and random.random() < CLICK_IF_BAD:
        down += 1
        reasons[random.choices(REASONS, weights=[5, 2, 3, 2, 0.3])[0]] += 1
    elif not bad and random.random() < CLICK_IF_GOOD:
        up += 1
print(f"{SESSIONS:,} sessions: {down} thumbs down, {up} thumbs up ({(down + up) / SESSIONS:.1%} gave feedback)")
print(f"thumbs-down share of feedback {down / (down + up):.0%}, but the true unhelpful rate is {BAD_RATE:.0%}: clicks are biased")
print("reasons:", reasons)

def sessions_needed(p, drop):
    """Rough count per arm to see a change in the feedback rate from p to p - drop (95% confidence, 80% power)."""
    q = p - drop
    return math.ceil((1.96 + 0.84) ** 2 * (p * (1 - p) + q * (1 - q)) / drop ** 2)
rate = down / SESSIONS
print(f"to detect thumbs-down falling from {rate:.2%} to {rate * 0.8:.2%}: about {sessions_needed(rate, rate * 0.2):,} sessions per version")
`

// ---- 22.6 Failing gracefully ------------------------------------------------------------------------------------------

const FAILURE = String.raw`import json, random

random.seed(6)
msgs = json.load(open("messages.json", encoding="utf-8"))
OUTCOMES = {"answered": 0.80, "low confidence": 0.07, "out of scope": 0.05, "tool failed": 0.04, "timeout": 0.04}
NEXT_STEP = {   # what the user sees instead of a dead end
    "low confidence": "Here is what I found, but please check it: [sources]. Talk to a person?",
    "out of scope": "I can't help with that here. You can [contact support] or [search the help centre].",
    "tool failed": "I couldn't reach the booking system just now. I've saved your request and will retry.",
    "timeout": "This is taking longer than usual. Keep waiting, or get the answer by email?",
}
results = {k: 0 for k in OUTCOMES}
dead_ends_before = 0
for m in msgs:
    outcome = random.choices(list(OUTCOMES), weights=list(OUTCOMES.values()))[0]
    results[outcome] += 1
    if outcome != "answered":
        dead_ends_before += 1            # before: a generic "Something went wrong"
print(f"{len(msgs)} of your project's messages: {results}")
print(f"with a generic error message: {dead_ends_before} users hit a dead end")
print(f"with a designed message per failure: 0 dead ends, each gets a next step, for example:")
for k, v in NEXT_STEP.items():
    print(f"  {k:15} -> {v}")
`

export const C22 = {
  'ai-fit': {
    title: 'Should this feature use AI?',
    brief: 'Scores five candidate features on error tolerance, ease of checking, whether rules capture the task, volume and data, and suggests AI, AI with a person, or plain code.',
    proves: 'A structured way to argue about fit. The weights and scores are judgements, so it does not replace testing the feature with users.',
    neutral: true,
    build: neutral(FIT),
    check: 'assert score(FEATURES["search help articles in plain language"]) > score(FEATURES["auto-approve refunds without review"])',
  },
  'citations-display': {
    title: 'Citations and unsupported sentences',
    brief: 'Builds an answer from two of your project’s documents plus one invented sentence, attaches a citation to each sentence by word overlap, and flags the one with no source.',
    proves: 'How a UI can mark unsupported sentences. Word overlap is a weak stand-in for a real support check, and it does not prove a cited sentence is right.',
    build: withDocs(CITE),
    check: 'assert cite(answer[2])[0] is None',
  },
  'perceived-wait': {
    title: 'What users perceive while they wait',
    brief: 'Simulates 10,000 users’ patience and compares how many give up when the interface waits for the full answer, shows progress, or streams tokens.',
    proves: 'Why first feedback matters more than total time. The patience model is invented; it does not predict your users’ behaviour.',
    neutral: true,
    build: neutral(WAIT),
    check: 'assert abandon(0.3) < abandon(9.0)',
  },
  'review-undo': {
    title: 'Review, edit and undo',
    brief: 'Takes your project’s proposed money-moving actions, sends large ones to a reviewer, offers an undo window, and counts the mistakes and money caught at each layer.',
    proves: 'How review and undo stack up. Error and catch rates are simulated, and undo does not reverse money already moved.',
    build: fromActions(REVIEW),
    check: 'assert sum(caught) + sum(undone) + sum(slipped) == sum(wrong)',
  },
  'feedback-bias': {
    title: 'Feedback buttons and their bias',
    brief: 'Simulates 50,000 sessions where unhappy users click more than happy ones, compares thumbs-down share with the true unhelpful rate, and estimates the sessions needed to see an improvement.',
    proves: 'Why raw feedback rates are biased and how much data a change needs. Click rates are invented, not measured.',
    neutral: true,
    build: neutral(FEEDBACK),
    check: 'assert sessions_needed(0.01, 0.002) > 1000',
  },
  'graceful-failure': {
    title: 'Failing with a next step',
    brief: 'Assigns simulated outcomes to your project’s messages and compares a generic error message with a designed message and next step for each kind of failure.',
    proves: 'How designed failure messages remove dead ends. The outcome rates are simulated and it does not test the wording with users.',
    build: fromMessages(FAILURE),
    check: 'assert sum(results.values()) == len(msgs)',
  },
} satisfies Record<string, Snippet>
