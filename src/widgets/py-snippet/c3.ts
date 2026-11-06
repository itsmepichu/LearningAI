/** Chapter 3 snippets: three kinds of learning, baselines, imbalance, leakage, metrics and thresholds, slices and drift. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { NUMBER_COLUMNS, projectTable, type Snippet, type SnippetBundle } from './common.ts'

/** Loads table.json and trains a logistic regression with NumPy; shared by the chapter's snippets. */
const LOGISTIC = String.raw`import json
import numpy as np

t = json.load(open("table.json", encoding="utf-8"))
X, y = np.array(t["X"], dtype=float), np.array(t["y"], dtype=float)

def standardise(train, other):
    mean, std = train.mean(axis=0), train.std(axis=0) + 1e-9      # scales come from the training rows only
    return (train - mean) / std, (other - mean) / std

def train_logistic(X, y, weight_positive=1.0, steps=500, lr=0.5):
    """Logistic regression by gradient descent: learns one weight per feature."""
    w, b = np.zeros(X.shape[1]), 0.0
    weights = np.where(y == 1, weight_positive, 1.0)
    for _ in range(steps):
        p = 1 / (1 + np.exp(-(X @ w + b)))                          # predicted chance of a positive
        g = (p - y) * weights
        w -= lr * X.T @ g / weights.sum()
        b -= lr * g.sum() / weights.sum()
    return w, b

def scores(X, w, b):
    return 1 / (1 + np.exp(-(X @ w + b)))

def report(name, pred, y):
    tp = int(((pred == 1) & (y == 1)).sum()); fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    print(f"{name:36} accuracy {(pred == y).mean():6.1%}   precision {precision:6.1%}   recall {recall:6.1%}")
    return precision, recall
`

const withTable = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { table, sources } = await projectTable(p, read)
  return { code: LOGISTIC + '\n' + code, files: { 'table.json': JSON.stringify(table) }, sources }
}

const SPLIT = String.raw`
rng = np.random.default_rng(0)
order = rng.permutation(len(y))
cut = int(len(y) * 0.7)
tr, te = order[:cut], order[cut:]                  # 70% to learn from, 30% to test on
Xtr, Xte = standardise(X[tr], X[te])
ytr, yte = y[tr], y[te]
`

// ---- 3.1 Supervised, unsupervised and reinforcement learning --------------------------------------------------------

const LEARNING_TYPES = String.raw`import json
import numpy as np

d = json.load(open("column.json", encoding="utf-8"))
values, groups = np.array(d["values"]), np.array(d["groups"])
print(f"{len(values):,} rows of {d['what']}, grouped by {d['group_name']}")

# 1. Supervised: learn from labelled rows. Here the "model" is the average value for each group,
#    learned from the first 80% of rows and checked on the rest.
cut = int(len(values) * 0.8)
learned = {g: values[:cut][groups[:cut] == g].mean() for g in np.unique(groups[:cut])}
guess = np.array([learned.get(g, values[:cut].mean()) for g in groups[cut:]])
error_group = np.abs(guess - values[cut:]).mean()
error_mean = np.abs(values[:cut].mean() - values[cut:]).mean()
print(f"\n1. Supervised: average miss {error_group:,.1f} using the group, {error_mean:,.1f} using one overall average")

# 2. Unsupervised: no labels. k-means finds 3 groups of similar values by itself.
centres = np.percentile(values, [10, 50, 90])
for _ in range(20):
    nearest = np.abs(values[:, None] - centres[None, :]).argmin(axis=1)    # put each value with its nearest centre
    centres = np.array([values[nearest == k].mean() for k in range(3)])    # move each centre to its group's average
print("2. Unsupervised: three groups centred on", ", ".join(f"{c:,.1f}" for c in sorted(centres)))

# 3. Reinforcement: try actions, get rewards, prefer what works. Three made-up reply styles with hidden
#    success rates; the learner usually picks its best so far and sometimes explores (simulated, seeded).
rng = np.random.default_rng(7)
TRUE_RATES = [0.05, 0.12, 0.08]
tries, wins = np.zeros(3), np.zeros(3)
for step in range(3000):
    explore = rng.random() < 0.1
    arm = rng.integers(3) if explore or tries.min() == 0 else int(np.argmax(wins / tries))
    tries[arm] += 1
    wins[arm] += rng.random() < TRUE_RATES[arm]
print("3. Reinforcement: times each reply style was chosen", tries.astype(int).tolist(), "(style 2 is really best)")
`

async function learningTypes(p: Project, read: DataReader): Promise<SnippetBundle> {
  const c = NUMBER_COLUMNS[p.id]
  const rows = (await read.csv(c.file)) as unknown as Record<string, string>[]
  const ok = rows.filter((r) => Number.isFinite(Number(r[c.column])))
  const data = { what: c.what, group_name: c.group, values: ok.map((r) => Number(r[c.column])), groups: ok.map((r) => r[c.group]) }
  return { code: LEARNING_TYPES, files: { 'column.json': JSON.stringify(data) }, sources: [c.file] }
}

// ---- 3.2 Baselines ---------------------------------------------------------------------------------------------------

const BASELINES = SPLIT + String.raw`
print(f"Predicting: {t['target']} ({ytr.mean():.1%} of training rows are positive)")
print(f"Features: {', '.join(t['features'])}\n")

majority = float(ytr.mean() >= 0.5)                 # the baseline: always answer the most common outcome
report("baseline (always the same)", np.full(len(yte), majority), yte)
w, b = train_logistic(Xtr, ytr)
model_pred = (scores(Xte, w, b) >= 0.5).astype(float)
report("logistic regression", model_pred, yte)
print("\nLearned weight per feature (bigger = pushes towards positive):")
for name, weight in sorted(zip(t["features"], w), key=lambda nw: -abs(nw[1])):
    print(f"  {name:24} {weight:+.2f}")
`

// ---- 3.3 Cleaning and class imbalance --------------------------------------------------------------------------------

const IMBALANCE = String.raw`
rows = [tuple(x) + (yy,) for x, yy in zip(t["X"], t["y"])]
print(f"{len(rows):,} rows; {len(rows) - len(set(rows)):,} of them repeat another row's features exactly")
print(f"Missing or broken numbers: {int(np.isnan(X).sum())}")
` + SPLIT + String.raw`
print(f"\nPositives in training: {int(ytr.sum())} of {len(ytr):,} ({ytr.mean():.1%})\n")

w, b = train_logistic(Xtr, ytr)
report("no weights, threshold 0.5", (scores(Xte, w, b) >= 0.5).astype(float), yte)

# Count each positive as many times as there are negatives per positive. Change WEIGHT and run again.
WEIGHT = (ytr == 0).sum() / (ytr == 1).sum()
w2, b2 = train_logistic(Xtr, ytr, weight_positive=WEIGHT)
print(f"(weight on positives: {WEIGHT:.1f})")
p_w, r_w = report("class weights, threshold 0.5", (scores(Xte, w2, b2) >= 0.5).astype(float), yte)
`

// ---- 3.4 Leakage and splits ------------------------------------------------------------------------------------------

const LEAKAGE = String.raw`
months = np.array(t["month"])
leak = np.array(t["leak"], dtype=float)[:, None]
cutoff = sorted(set(months))[int(len(set(months)) * 0.75)]
past, future = months < cutoff, months >= cutoff           # time split: learn on the past, test on the future
print(f"Learn on rows before {cutoff} ({past.sum():,}), test on the rest ({future.sum():,})")
print(f"Predicting: {t['target']}\n")

def run(name, features):
    Xa, Xb = standardise(features[past], features[future])
    w, b = train_logistic(Xa, y[past], weight_positive=(y[past] == 0).sum() / max(1, (y[past] == 1).sum()))
    report(name + " (training rows)", (scores(Xa, w, b) >= 0.5).astype(float), y[past])
    return report(name + " (future rows)", (scores(Xb, w, b) >= 0.5).astype(float), y[future])

honest = run("honest features", X)
leaky = run("plus " + t["leak_name"], np.hstack([X, leak]))
print(f"\n{t['leak_name']} is only known after the outcome, so it is not available when the prediction is made.")
print("A score that jumps when you add a column like that is a warning, not a win.")
`

// ---- 3.5 Metrics, thresholds and calibration ------------------------------------------------------------------------

const METRICS = SPLIT + String.raw`
w, b = train_logistic(Xtr, ytr, weight_positive=(ytr == 0).sum() / (ytr == 1).sum())
s = scores(Xte, w, b)
print(f"Predicting: {t['target']}, {int(yte.sum())} positives in {len(yte):,} test rows\n")
print(f"{'threshold':>9} {'flagged':>8} {'precision':>10} {'recall':>8} {'F1':>6}")
rows = []
for th in (0.2, 0.35, 0.5, 0.65, 0.8):
    pred = s >= th
    tp = int((pred & (yte == 1)).sum()); fp = int((pred & (yte == 0)).sum()); fn = int((~pred & (yte == 1)).sum())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    rows.append((th, tp, fp, fn))
    print(f"{th:9.2f} {int(pred.sum()):8} {precision:10.1%} {recall:8.1%} {f1:6.2f}")

# Pick the threshold by cost. Illustrative: a missed positive costs 50, a false alarm costs 2.
MISS_COST, ALARM_COST = 50, 2
best = min(rows, key=lambda r: MISS_COST * r[3] + ALARM_COST * r[2])
print(f"\nWith a miss costing {MISS_COST} and a false alarm {ALARM_COST}, the cheapest threshold is {best[0]}")

# Calibration: do scores of about 0.8 come true about 80% of the time?
print("\nScore band   rows   really positive")
for lo in (0.0, 0.25, 0.5, 0.75):
    band = (s >= lo) & (s < lo + 0.25)
    if band.sum():
        print(f"{lo:.2f}-{lo + 0.25:.2f} {int(band.sum()):7}   {yte[band].mean():6.1%}")
print("Class weights push scores up, so this model's scores run high: they rank well but are not chances.")
`

// ---- 3.6 Slices and drift --------------------------------------------------------------------------------------------

const SLICES = SPLIT + String.raw`
w, b = train_logistic(Xtr, ytr, weight_positive=(ytr == 0).sum() / (ytr == 1).sum())
pred = (scores(Xte, w, b) >= 0.5).astype(float)
slices = np.array(t["slice"])[te]
print(f"Predicting: {t['target']}. Results for each {t['slice_name']}:\n")
by_slice = {}
for name in sorted(set(slices)):
    m = slices == name
    by_slice[name] = report(f"{name} ({int(m.sum())} rows)", pred[m], yte[m])
report("all rows", pred, yte)

# Drift: does the data in the last months look like the first months?
months = np.array(t["month"])
order = sorted(set(months))
early, late = np.isin(months, order[:3]), np.isin(months, order[-3:])
print(f"\nFirst three months against last three ({order[0]} to {order[2]} vs {order[-3]} to {order[-1]}):")
print(f"  share positive {y[early].mean():6.1%} -> {y[late].mean():6.1%}")
for i, name in enumerate(t["features"]):
    print(f"  {name:24} average {X[early, i].mean():10.2f} -> {X[late, i].mean():10.2f}")
`

export const C3 = {
  'learning-types': {
    title: 'Three kinds of learning',
    brief: 'Predicts a number in your example project’s data from labelled rows, groups the same numbers without labels, and lets a learner find the best of three options by trial and reward.',
    proves:
      'The three kinds differ in the feedback they learn from. Each example is the smallest possible version; the reinforcement part is simulated with made-up success rates, so it does not show results on the project.',
    build: learningTypes,
    check: `assert error_group > 0 and len(centres) == 3\nassert int(np.argmax(tries)) == 1, tries`,
  },
  baselines: {
    title: 'A model against its baseline',
    brief: 'Predicts a rare yes/no outcome in your example project’s table, first by always giving the most common answer, then with a logistic regression trained on a few features.',
    proves:
      'Accuracy alone can hide a model that never finds the rare case, and the baseline shows it. The data is synthetic and the features are few, so these numbers do not predict real performance.',
    build: withTable(BASELINES),
    check: `assert len(w) == len(t["features"])\nassert 0 <= model_pred.mean() <= 1`,
  },
  imbalance: {
    title: 'Clean, then handle the rare class',
    brief: 'Counts repeated and broken rows in your example project’s table, then trains the same model with and without extra weight on the rare outcome.',
    proves:
      'Class weights trade precision for recall. The right trade depends on what each kind of mistake costs; this does not tell you that, and the synthetic data makes both numbers rosier than real ones.',
    build: withTable(IMBALANCE),
    check: `assert 0 <= p_w <= 1 and 0 <= r_w <= 1`,
  },
  leakage: {
    title: 'A leak, caught',
    brief: 'Splits your example project’s table by time, trains on the past and tests on the future, then adds a column that is only known after the outcome and watches the score jump.',
    proves:
      'A leaky column makes a model look far better than it can be in use. Which columns leak depends on when each value becomes known; the code does not work that out, you have to.',
    build: withTable(LEAKAGE),
    check: `assert leaky[1] >= honest[1] - 0.05`,
  },
  metrics: {
    title: 'Thresholds, costs and calibration',
    brief: 'Scores the test rows of your example project’s table, shows precision, recall and F1 at five thresholds, picks the cheapest threshold for given costs, and checks whether the scores are honest chances.',
    proves:
      'Moving the threshold trades precision for recall, and costs decide where to stop. The costs are illustrative, and the weighted model’s scores are not calibrated chances.',
    build: withTable(METRICS),
    check: `assert len(rows) == 5\nassert best[0] in (0.2, 0.35, 0.5, 0.65, 0.8)`,
  },
  slices: {
    title: 'Slices and drift',
    brief: 'Breaks your example project’s results down by one column to find where the model is weak, then compares the first and last months of data for drift.',
    proves:
      'An average can hide a slice that fails, and data moves over time. The synthetic data has little real drift, so a small change here does not mean a real dataset is stable.',
    build: withTable(SLICES),
    check: `assert len(by_slice) >= 2`,
  },
} satisfies Record<string, Snippet>
