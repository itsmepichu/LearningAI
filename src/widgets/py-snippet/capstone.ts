/** Capstone snippets: evidence for a milestone, and labelling every claim with its evidence category. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { neutral, projectDocs, type Snippet, type SnippetBundle } from './common.ts'

const withDocs = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { docs, sources } = await projectDocs(p, read)
  return { code, files: { 'docs.json': JSON.stringify(docs.slice(0, 120)) }, sources }
}

// ---- Milestones: a paired comparison that decides whether a component stays ------------------------------------------

const EVIDENCE = String.raw`import json, re, math, random, collections

random.seed(21)
docs = json.load(open("docs.json", encoding="utf-8"))
STOP = {"the", "a", "an", "of", "to", "and", "is", "for", "in", "on", "with", "are", "be", "or", "by", "at", "from",
        "it", "can", "per", "up", "this", "that", "within", "after", "before", "any", "all", "not", "no", "rupees"}
def words(t):
    return [w for w in re.findall(r"[a-z]+", t.lower()) if w not in STOP and len(w) > 2]

df = collections.Counter(w for d in docs for w in set(words(d["title"] + " " + d["text"])))
common = [w for w, _ in df.most_common(15)]
# Labelled questions (synthetic stand-ins): one word only the target document uses, plus two everyday words
# that many documents use, the way real questions mix a specific term with ordinary ones.
questions = []
for d in docs:
    rare = sorted(w for w in set(words(d["title"] + " " + d["text"])) if df[w] <= max(2, len(docs) // 25))
    for _ in range(5 if len(docs) < 40 else 1):
        if rare:
            questions.append((" ".join([random.choice(rare)] + random.sample(common, 2)), d["id"]))
def baseline(q, d):                       # plain word overlap
    return len(set(words(q)) & set(words(d["title"] + " " + d["text"])))
def candidate(q, d):                      # rarer words count more, and title words count double
    text, title = collections.Counter(words(d["text"])), set(words(d["title"]))
    return sum(math.log(len(docs) / df[w]) * ((w in text) + 2 * (w in title)) for w in set(words(q)))

K = 1
def hits(score):
    out = []
    for q, target in questions:
        top = sorted(docs, key=lambda d: (-score(q, d), d["id"]))[:K]
        out.append(int(any(d["id"] == target for d in top)))
    return out

a, b = hits(baseline), hits(candidate)
diffs = [y - x for x, y in zip(a, b)]
boot = sorted(sum(random.choice(diffs) for _ in diffs) / len(diffs) for _ in range(2000))
lo, hi = boot[50], boot[1949]
print(f"{len(questions)} labelled questions over {len(docs)} of your project's documents; top-{K} accuracy")
print(f"  baseline (word overlap):        {sum(a) / len(a):.0%}")
print(f"  candidate (rare words, titles): {sum(b) / len(b):.0%}")
print(f"  per question: candidate wins {diffs.count(1)}, loses {diffs.count(-1)}, ties {diffs.count(0)}")
print(f"  paired bootstrap 95% interval for the gain: {lo:+.0%} to {hi:+.0%}")
print("Keep the component" if lo > 0 else "Write down a decision not to add it: the interval includes zero")
`

// ---- Interview: every number carries its evidence category ------------------------------------------------------------

const CLAIMS = String.raw`import re

CATEGORIES = {"simulated", "measured locally", "projected", "operated in production"}
WRITEUP = """BM25 alone reached Recall@10 = 0.71 on our 100 labelled questions [measured locally].
Hybrid search plus a reranker reached 0.88, and the paired 95% interval excluded zero [measured locally].
The service handled 4 requests per second at p95 1.2 s with a mocked model [measured locally].
Production will need about 6 GPUs for 300 requests per second [projected].
The cache will cut costs by 40%.
Our agent never creates duplicate tickets.
The retry storm in the dashboard widget is generated in the browser [simulated]."""

report = []
for sentence in WRITEUP.splitlines():
    tag = re.search(r"\[([a-z ]+)\]\s*\.?$", sentence)
    has_number = bool(re.search(r"\d", sentence))
    absolute = bool(re.search(r"\b(never|always|guarantee[sd]?)\b", sentence.lower()))
    if tag and tag.group(1) not in CATEGORIES:
        report.append(("unknown category", sentence))
    elif not tag and (has_number or absolute):
        report.append(("needs a category" if has_number else "absolute claim: say what was tested", sentence))
for problem, sentence in report:
    print(f"{problem:38} | {sentence}")
counts = {c: WRITEUP.count(f"[{c}]") for c in CATEGORIES}
print("claims by category:", counts)
print("'Projected, not yet validated' is a strength in a review; an unlabelled projection is not.")
`

export const CAPSTONE = {
  'milestone-evidence': {
    title: 'Evidence for a milestone',
    brief: 'Builds labelled questions from your project’s documents, each mixing one specific word with two common ones, compares a baseline retriever with a candidate per question, and decides with a paired bootstrap interval whether the component stays.',
    proves: 'How a milestone’s pass condition is decided with a paired comparison. The questions are synthetic; they do not replace labelled questions from real users.',
    build: withDocs(EVIDENCE),
    check: 'assert len(a) == len(b) == len(questions) and lo <= hi',
  },
  'claim-labels': {
    title: 'Every number has an evidence category',
    brief: 'Checks a short write-up sentence by sentence: numbers need an evidence category, absolute claims need to say what was tested, and unknown categories are flagged.',
    proves: 'How to keep measured, projected and simulated claims apart. A pattern check does not tell whether a labelled claim is true.',
    neutral: true,
    build: neutral(CLAIMS),
    check: 'assert len(report) == 2 and counts["projected"] == 1',
  },
} satisfies Record<string, Snippet>
