/**
 * The Python labs: for each lab and project, the data files, the code the reader starts from, a worked solution and a
 * grader. A grader recomputes its expected values itself, so a check cannot pass by repeating the reader's own mistake.
 * Plain data and strings, so a test can run every solution through a local Python.
 */
import type { Project, ProjectId } from '../../data/projects'
import type { DataReader } from '../kit'
import { COMPARE } from '../retriever-compare/scenarios.ts'
import { loadCorpus } from '../bm25/corpus.ts'
import { mulberry } from '../kit/random.ts'
import { BIGRAM_SCRIPT, MANUAL_TEXT } from './bigram-script.ts'

export interface LabCheck {
  name: string
  pass: boolean
  detail: string
}

export interface LabBundle {
  /** What goes in the working folder: name to contents. */
  files: Record<string, string>
  /** The dataset files this bundle is built from, for the source line. */
  sources: string[]
  /** What to do, in a sentence or two. */
  brief: string
  starter: string
  solution: string
  /** Python that runs after the reader's code, in the same namespace. */
  grader: string
  /** What passing does and does not show. */
  proves: string
  /** Other data the reader can switch to, such as the manual's own text. */
  variants?: { label: string; files: Record<string, string> }[]
}

export type LabId = 'bigram' | 'cosine' | 'stats' | 'metrics'

/** Every grader starts with this and ends with GRADE_END, which leaves JSON in `__result__`. */
const GRADE_START = String.raw`
import json as _json
import numpy as _np
__checks__ = []
def _check(name, fn):
    try:
        ok, detail = fn()
        __checks__.append({"name": name, "pass": bool(ok), "detail": str(detail)})
    except Exception as e:
        __checks__.append({"name": name, "pass": False, "detail": f"{type(e).__name__}: {e}"})
`
const GRADE_END = `\n__result__ = _json.dumps(__checks__)\n`
const grader = (body: string) => GRADE_START + body + GRADE_END

// ---- Appendix A: the complete tiny language model ----

const BIGRAM_GRADER = grader(String.raw`
_check("The vocabulary comes from the training text only", lambda: (set(chars[1:]) == set(train_text) and chars[0] == "<unk>", f"{len(chars)} entries, {len(set(train_text))} distinct training characters"))
_check("The checkpoint is the one with the lowest validation loss", lambda: (abs(best_val - min(h["val"] for h in history)) < 1e-12, f"best_val {best_val:.3f}"))
_check("It beats the unigram baseline on unseen test text", lambda: (test_loss < baseline, f"bigram {test_loss:.3f} against unigram {baseline:.3f} nats per character"))
_check("The baseline beats a uniform guess", lambda: (baseline < _np.log(V), f"unigram {baseline:.3f} against ln V = {_np.log(V):.3f}"))
_check("Training loss fell", lambda: (history[-1]["train"] < history[0]["train"], f'{history[0]["train"]:.3f} to {history[-1]["train"]:.3f}'))
def _reload():
    saved = _np.load("tiny_bigram_checkpoint.npz", allow_pickle=False)
    return (_np.array_equal(saved["W"], best_W) and list(saved["chars"]) == chars, f'{saved["W"].shape[0]} by {saved["W"].shape[1]} logits on disk')
_check("The saved checkpoint reloads with the same weights", _reload)
def _report():
    r = _json.loads(open("tiny_bigram_report.json").read())
    return (r["test"] == test_loss and r["seed"] == SEED and len(r["history"]) == len(history), f'report has {len(r)} fields')
_check("The JSON report matches the run", _report)
`)

/** Each project's English text, one short line per message, for the tiny model. Lower-cased, as the manual's own text is. */
async function projectLines(p: Project, read: DataReader): Promise<string[]> {
  const corpus = (await loadCorpus(p, read)).docs.map((d) => d.body)
  const english = (rows: { language?: string; text: string }[]) => rows.filter((r) => r.language === 'en').map((r) => r.text)
  if (p.id === 'store') return [...english(await read.json('reviews.json')), ...english(await read.json('chats.json')), ...(await read.csv('products.csv')).map((r) => r.title)]
  if (p.id === 'bank') return [...english((await read.csv('disputes.csv')) as unknown as { language: string; text: string }[]), ...corpus]
  if (p.id === 'harbor') return [...english((await read.csv('tickets.csv')) as unknown as { language: string; text: string }[]), ...corpus]
  return [...english((await read.csv('requests.csv')) as unknown as { language: string; text: string }[]), ...corpus]
}

const LINES = { train: 40, val: 4, test: 4 }

export function splitLines(lines: string[], seed = 11) {
  const rnd = mulberry(seed)
  const unique = [...new Set(lines.map((l) => l.trim().toLowerCase()).filter(Boolean))]
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[unique[i], unique[j]] = [unique[j], unique[i]]
  }
  const join = (a: string[]) => a.join('\n') + '\n'
  return {
    'test.txt': join(unique.slice(0, LINES.test)),
    'val.txt': join(unique.slice(LINES.test, LINES.test + LINES.val)),
    'train.txt': join(unique.slice(LINES.test + LINES.val, LINES.test + LINES.val + LINES.train)),
  }
}

const MANUAL_FILES = { 'train.txt': MANUAL_TEXT.train, 'val.txt': MANUAL_TEXT.val, 'test.txt': MANUAL_TEXT.test }

async function bigramLab(p: Project, read: DataReader): Promise<LabBundle> {
  return {
    files: splitLines(await projectLines(p, read)),
    sources: [p.id === 'store' ? 'reviews.json' : p.id === 'bank' ? 'disputes.csv' : p.id === 'harbor' ? 'tickets.csv' : 'requests.csv'],
    brief: `The complete script from this appendix, reading its text from three files. It trains on short English lines from ${p.company}’s dataset. Run it, then try the experiments listed under What the actual run produced.`,
    starter: BIGRAM_SCRIPT,
    solution: BIGRAM_SCRIPT,
    grader: BIGRAM_GRADER,
    proves: 'Passing shows the lifecycle ran correctly: vocabulary from training data, a checkpoint chosen on validation loss, a baseline beaten, and a save that reloads. A lower toy loss says nothing about language understanding, or about any real model.',
    variants: [{ label: 'The manual’s own text', files: MANUAL_FILES }],
  }
}

// ---- 2.1: cosine similarity with NumPy ----

const COSINE_PREFIX = (query: string) => String.raw`import json, re
import numpy as np

docs = json.load(open("docs.json"))
query = ${JSON.stringify(query)}

def words(text):
    return re.findall(r"[a-z0-9]+", text.lower())

vocab = sorted({w for d in docs for w in words(d["text"])})
index = {w: i for i, w in enumerate(vocab)}

def count_vector(text):
    v = np.zeros(len(vocab))
    for w in words(text):
        if w in index:
            v[index[w]] += 1
    return v

X = np.stack([count_vector(d["text"]) for d in docs])   # one row per document
q = count_vector(query)
`

const COSINE_TODO = String.raw`
def cosine_scores(X, q):
    """Cosine similarity of each row of X with q. A row or query of all zeros scores 0, not nan."""
    # TODO: use a matrix product and norms, with no Python loop
    raise NotImplementedError

def top_k(scores, k):
    """Indices of the k highest scores, best first."""
    # TODO: np.argsort sorts ascending
    raise NotImplementedError

scores = cosine_scores(X, q)
for i in top_k(scores, 5):
    print(f"{scores[i]:.3f}  {docs[i]['id']}  {docs[i]['title']}")
`

const COSINE_DONE = String.raw`
def cosine_scores(X, q):
    """Cosine similarity of each row of X with q. A row or query of all zeros scores 0, not nan."""
    denom = np.linalg.norm(X, axis=1) * np.linalg.norm(q)
    safe = np.where(denom == 0, 1, denom)
    return np.where(denom == 0, 0.0, X @ q / safe)

def top_k(scores, k):
    """Indices of the k highest scores, best first."""
    return np.argsort(scores)[::-1][:k]

scores = cosine_scores(X, q)
for i in top_k(scores, 5):
    print(f"{scores[i]:.3f}  {docs[i]['id']}  {docs[i]['title']}")
`

const COSINE_GRADER = grader(String.raw`
def _expected(A, b):
    out = []
    for row in A:
        d = float(_np.sqrt((row * row).sum()) * _np.sqrt((b * b).sum()))
        out.append(float((row * b).sum()) / d if d else 0.0)
    return _np.array(out)
_check("Scores match cosine similarity for every document", lambda: (_np.allclose(cosine_scores(X, q), _expected(X, q)), f"{len(docs)} documents, {X.shape[1]} words in the vocabulary"))
_check("Scores divide by the norm of the query as well", lambda: (_np.allclose(cosine_scores(X, X[0] + 1), _expected(X, X[0] + 1)), "tried with a second query vector"))
_check("Scores do not depend on document length", lambda: (_np.allclose(cosine_scores(X * 3, q), cosine_scores(X, q)), "tripling every count changes nothing"))
_check("An all-zero row scores 0, not nan", lambda: (cosine_scores(_np.zeros((1, 3)), _np.ones(3))[0] == 0, "a document with no vocabulary words"))
_check("An all-zero query scores 0, not nan", lambda: (_np.all(cosine_scores(_np.ones((2, 3)), _np.zeros(3)) == 0), "a query with no vocabulary words"))
_check("top_k returns the highest scores, best first", lambda: (list(top_k(_np.array([0.1, 0.9, 0.5, 0.7]), 2)) == [1, 3], "on [0.1, 0.9, 0.5, 0.7] with k = 2"))
def _found():
    s = _expected(X, q)
    got = [float(s[i]) for i in top_k(cosine_scores(X, q), 5)]
    return (_np.allclose(got, sorted(s)[::-1][:5]), f"best score {max(s):.3f}")
_check("The top five for the query are right", _found)
`)

async function cosineLab(p: Project, read: DataReader): Promise<LabBundle> {
  const corpus = await loadCorpus(p, read)
  const docs = corpus.docs.map((d) => ({ id: d.id, title: d.title, text: d.text }))
  const prefix = COSINE_PREFIX(COMPARE[p.id].query)
  return {
    files: { 'docs.json': JSON.stringify(docs) },
    sources: [corpus.file],
    brief: `${p.company}’s ${corpus.noun} are already word-count vectors. Write cosine_scores and top_k with NumPy, without a Python loop, and rank the documents for this query.`,
    starter: prefix + COSINE_TODO,
    solution: prefix + COSINE_DONE,
    grader: COSINE_GRADER,
    proves: 'Passing shows your arithmetic matches cosine similarity, including the zero-vector edge case. Word counts are not embeddings: this ranks shared words and knows nothing of meaning, which is what 9.3 adds.',
  }
}

// ---- 2.5: summarising a real column ----

const STATS: Record<ProjectId, { file: string; value: string; group: string }> = {
  harbor: { file: 'tickets.csv', value: 'resolved_hours', group: 'category' },
  store: { file: 'orders.csv', value: 'delivery_days', group: 'payment' },
  bank: { file: 'transactions.csv', value: 'amount_inr', group: 'channel' },
  travel: { file: 'bookings.csv', value: 'fare_inr', group: 'product' },
}

const STATS_PREFIX = (s: { file: string; value: string; group: string }) => String.raw`import csv
import numpy as np

rows = list(csv.DictReader(open(${JSON.stringify(s.file)}, encoding="utf-8")))
values = np.array([float(r[${JSON.stringify(s.value)}]) for r in rows])
groups = np.array([r[${JSON.stringify(s.group)}] for r in rows])
print(len(rows), "rows of", ${JSON.stringify(s.value)}, "by", ${JSON.stringify(s.group)})
`

const STATS_TODO = String.raw`
# TODO: set each of these with NumPy
mean = None             # the mean of values
median = None           # the median of values
p95 = None              # the 95th percentile of values
group_means = None      # a dict: each group's name to the mean of its values
skew_gap = None         # mean minus median: positive when a long right tail pulls the mean up

print(mean, median, p95, skew_gap)
print(group_means)
`

const STATS_DONE = String.raw`
mean = values.mean()
median = np.median(values)
p95 = np.percentile(values, 95)
group_means = {str(g): float(values[groups == g].mean()) for g in np.unique(groups)}
skew_gap = mean - median

print(mean, median, p95, skew_gap)
print(group_means)
`

const statsGrader = (s: { file: string; value: string; group: string }) =>
  grader(String.raw`
import csv as _csv
_rows = list(_csv.DictReader(open(${JSON.stringify(s.file)}, encoding="utf-8")))
_v = sorted(float(r[${JSON.stringify(s.value)}]) for r in _rows)
_n = len(_v)
_mean = sum(_v) / _n
_median = (_v[(_n - 1) // 2] + _v[_n // 2]) / 2
_pos = 0.95 * (_n - 1)
_p95 = _v[int(_pos)] + (_pos - int(_pos)) * (_v[min(int(_pos) + 1, _n - 1)] - _v[int(_pos)])
_by = {}
for r in _rows:
    _by.setdefault(r[${JSON.stringify(s.group)}], []).append(float(r[${JSON.stringify(s.value)}]))
_check("The mean is right", lambda: (abs(mean - _mean) < 1e-6, f"{_mean:.2f}"))
_check("The median is right", lambda: (abs(median - _median) < 1e-6, f"{_median:.2f}"))
_check("The 95th percentile is right", lambda: (abs(p95 - _p95) < 1e-6, f"{_p95:.2f}, by linear interpolation"))
_check("Each group's mean is right", lambda: (set(group_means) == set(_by) and all(abs(group_means[g] - sum(x) / len(x)) < 1e-6 for g, x in _by.items()), f"{len(_by)} groups"))
_check("The skew gap is the mean minus the median", lambda: (abs(skew_gap - (_mean - _median)) < 1e-6, f"{_mean - _median:+.2f}"))
`)

async function statsLab(p: Project, read: DataReader): Promise<LabBundle> {
  const s = STATS[p.id]
  const file = await read.text(s.file)
  return {
    files: { [s.file]: file },
    sources: [s.file],
    brief: `Summarise ${s.value} in ${p.company}’s ${s.file}, overall and by ${s.group}, using NumPy. Then look at the gap between the mean and the median.`,
    starter: STATS_PREFIX(s) + STATS_TODO,
    solution: STATS_PREFIX(s) + STATS_DONE,
    grader: statsGrader(s),
    proves: 'Passing shows these summaries of this synthetic file are right. A difference between groups here is a description, not a cause, and it says nothing about real data.',
  }
}

// ---- 3.5: precision and recall by hand ----

const METRICS: Record<ProjectId, { file: string; truth: string; rule: string; question: string; ruleWords: string }> = {
  harbor: { file: 'tickets.csv', truth: 'r["category"] == "security"', rule: 'r["priority"] in ("high", "urgent")', question: 'security tickets', ruleWords: 'high or urgent priority' },
  store: { file: 'orders.csv', truth: 'r["returned"] == "1"', rule: 'int(r["delivery_days"]) >= 6', question: 'returned orders', ruleWords: 'six or more days to deliver' },
  bank: { file: 'transactions.csv', truth: 'r["fraud"] == "1"', rule: 'float(r["amount_vs_customer_avg"]) > 3', question: 'fraudulent transactions', ruleWords: 'an amount over three times the customer’s average' },
  travel: { file: 'bookings.csv', truth: 'r["cancelled"] == "1"', rule: 'int(r["refundable"]) == 1', question: 'cancelled bookings', ruleWords: 'a refundable fare' },
}

const METRICS_PREFIX = (m: (typeof METRICS)[ProjectId]) => String.raw`import csv
import numpy as np

rows = list(csv.DictReader(open(${JSON.stringify(m.file)}, encoding="utf-8")))
y_true = np.array([${m.truth} for r in rows])
y_pred = np.array([${m.rule} for r in rows])
print(len(rows), "rows,", y_true.sum(), "positive,", y_pred.sum(), "flagged by the rule")
`

const METRICS_TODO = String.raw`
def confusion(y_true, y_pred):
    """Returns (tp, fp, fn, tn) as plain counts."""
    # TODO
    raise NotImplementedError

def precision(tp, fp):
    """Of what the rule flagged, the share that was right. 0 when it flagged nothing."""
    # TODO
    raise NotImplementedError

def recall(tp, fn):
    """Of the real positives, the share the rule found. 0 when there are none."""
    # TODO
    raise NotImplementedError

def f1(p, r):
    """The harmonic mean of precision and recall. 0 when both are 0."""
    # TODO
    raise NotImplementedError

tp, fp, fn, tn = confusion(y_true, y_pred)
p, r = precision(tp, fp), recall(tp, fn)
print("precision", round(p, 3), "recall", round(r, 3), "f1", round(f1(p, r), 3))
print("accuracy", round((tp + tn) / len(rows), 3), "and always answering no would score", round(1 - y_true.mean(), 3))
`

const METRICS_DONE = String.raw`
def confusion(y_true, y_pred):
    """Returns (tp, fp, fn, tn) as plain counts."""
    return (int((y_true & y_pred).sum()), int((~y_true & y_pred).sum()), int((y_true & ~y_pred).sum()), int((~y_true & ~y_pred).sum()))

def precision(tp, fp):
    """Of what the rule flagged, the share that was right. 0 when it flagged nothing."""
    return tp / (tp + fp) if tp + fp else 0.0

def recall(tp, fn):
    """Of the real positives, the share the rule found. 0 when there are none."""
    return tp / (tp + fn) if tp + fn else 0.0

def f1(p, r):
    """The harmonic mean of precision and recall. 0 when both are 0."""
    return 2 * p * r / (p + r) if p + r else 0.0

tp, fp, fn, tn = confusion(y_true, y_pred)
p, r = precision(tp, fp), recall(tp, fn)
print("precision", round(p, 3), "recall", round(r, 3), "f1", round(f1(p, r), 3))
print("accuracy", round((tp + tn) / len(rows), 3), "and always answering no would score", round(1 - y_true.mean(), 3))
`

const metricsGrader = (m: (typeof METRICS)[ProjectId]) =>
  grader(String.raw`
import csv as _csv
_tp = _fp = _fn = _tn = 0
for r in _csv.DictReader(open(${JSON.stringify(m.file)}, encoding="utf-8")):
    _t, _p = ${m.truth}, ${m.rule}
    _tp += _t and _p
    _fp += (not _t) and _p
    _fn += _t and not _p
    _tn += (not _t) and not _p
_check("The confusion counts are right", lambda: (tuple(int(x) for x in confusion(y_true, y_pred)) == (_tp, _fp, _fn, _tn), f"tp {_tp}, fp {_fp}, fn {_fn}, tn {_tn}"))
_check("Precision is right on this data", lambda: (abs(precision(_tp, _fp) - (_tp / (_tp + _fp) if _tp + _fp else 0)) < 1e-9, f"{(_tp / (_tp + _fp) if _tp + _fp else 0):.3f}"))
_check("Recall is right on this data", lambda: (abs(recall(_tp, _fn) - (_tp / (_tp + _fn) if _tp + _fn else 0)) < 1e-9, f"{(_tp / (_tp + _fn) if _tp + _fn else 0):.3f}"))
_check("Precision is 0 when nothing is flagged", lambda: (precision(0, 0) == 0, "no division by zero"))
_check("Recall is 0 when there are no positives", lambda: (recall(0, 0) == 0, "no division by zero"))
_check("F1 is the harmonic mean, and 0 when both are 0", lambda: (abs(f1(0.5, 1.0) - 2 / 3) < 1e-9 and f1(0, 0) == 0, "f1(0.5, 1.0) is 2/3"))
`)

async function metricsLab(p: Project, read: DataReader): Promise<LabBundle> {
  const m = METRICS[p.id]
  return {
    files: { [m.file]: await read.text(m.file) },
    sources: [m.file],
    brief: `A simple rule tries to find ${m.question} in ${p.company}’s ${m.file}: it flags ${m.ruleWords}. Write the metrics by hand, then compare the rule’s accuracy with always answering no.`,
    starter: METRICS_PREFIX(m) + METRICS_TODO,
    solution: METRICS_PREFIX(m) + METRICS_DONE,
    grader: metricsGrader(m),
    proves: 'Passing shows your metrics are right, including the zero cases. It says nothing about whether the rule is any good: read the numbers it printed. These are in-sample counts on synthetic data, with no threshold tuned and nothing held out.',
  }
}

/** Pyodide's own frames say nothing about the reader's code. Keeps the traceback from the first frame in the reader's file. */
export function trimTraceback(message: string): string {
  const lines = message.trimEnd().split('\n')
  const at = lines.findIndex((l) => l.includes('File "lab.py"'))
  return at < 1 || !lines[0].startsWith('Traceback') ? lines.join('\n') : [lines[0], ...lines.slice(at)].join('\n')
}

const BUILDERS: Record<LabId, (p: Project, read: DataReader) => Promise<LabBundle>> = { bigram: bigramLab, cosine: cosineLab, stats: statsLab, metrics: metricsLab }

export const LAB_IDS = Object.keys(BUILDERS) as LabId[]

/** Loads a lab for a project. Bind the lab id first: the widget's loader takes (project, read). */
export const loadLab = (id: LabId) => (p: Project, read: DataReader) => BUILDERS[id](p, read)
