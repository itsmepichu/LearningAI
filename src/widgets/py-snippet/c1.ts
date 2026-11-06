/** Chapter 1 snippets: rules against learning, the eras, next-word prediction, tokens and cost, grounding, choosing a tool. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { fromMessages, neutral, projectDocs, projectLabelled, type Snippet, type SnippetBundle } from './common.ts'

/** A Python literal from JSON-like data (lists, strings, numbers), indented for readability. */
const py = (v: unknown): string => JSON.stringify(v, null, 4).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')

// ---- 1.1 Hand-written rules against a learned classifier ---------------------------------------------------------------

/** Starting rules for each project: the first label whose keyword appears wins. Readers edit them. */
const RULES: Record<string, { rules: Record<string, string[]>; otherwise: string }> = {
  harbor: {
    rules: {
      security: ['phishing', 'token', 'former employee', 'sign-ins', 'suspicious'],
      billing: ['invoice', 'charged', 'billing', 'refund', 'gst'],
      access: ['password', 'log in', 'sign-on', 'two-factor', 'cannot see'],
      bug: ['error', 'freezes', 'broken', 'crash', 'delayed'],
      'how-to': ['how do', 'how can', 'where do'],
    },
    otherwise: 'general',
  },
  bank: {
    rules: {
      failed_upi: ['upi', 'debited'],
      duplicate: ['twice', 'duplicate'],
      not_received: ['never arrived', 'not received', 'not delivered'],
      amount_differs: ['instead of', 'more than'],
    },
    otherwise: 'unrecognised',
  },
  travel: {
    rules: {
      disruption: ['rain', 'late', 'weather', 'strike'],
      refund_status: ['refund'],
      cancel: ['cancel'],
      change_date: ['change the date', 'move my'],
    },
    otherwise: 'new_booking',
  },
  store: {
    rules: {
      Mobiles: ['smartphone', 'phone'],
      Beauty: ['face wash', 'sunscreen', 'cream', 'shampoo'],
      Toys: ['toy', 'blocks', 'puzzle'],
      'Home decor': ['wall hanging', 'cushion', 'diya'],
      'Kurtas and sarees': ['saree', 'kurta'],
      Footwear: ['sandals', 'sneakers', 'shoes'],
      Kitchen: ['mixer', 'tiffin', 'pan', 'kadai'],
    },
    otherwise: 'Home decor',
  },
}

const RULES_VS_LEARNED = String.raw`import json, collections, math, random, re

rows = json.load(open("labelled.json", encoding="utf-8"))
# Drop repeats (same words, ignoring case and punctuation), so the test rows are really new to the classifier.
seen, unique = set(), []
for r in rows:
    key = " ".join(re.findall(r"[a-z0-9]+", r["text"].lower()))
    if key not in seen:
        seen.add(key)
        unique.append(r)
rows = unique
random.seed(0)
random.shuffle(rows)
cut = int(len(rows) * 0.8)
train, test = rows[:cut], rows[cut:]   # learn from 80%, check on the 20% it never saw

# 1. Hand-written rules (classic AI): the first label whose keyword appears, as whole words, wins.
#    Add or change keywords and run again.
RULES = __RULES__
OTHERWISE = __OTHERWISE__

def by_rules(text):
    t = text.lower()
    for label, keywords in RULES.items():
        if any(re.search(r"\b" + re.escape(k) + r"\b", t) for k in keywords):
            return label
    return OTHERWISE

# 2. Machine learning: count which words appear with which label in the training rows,
#    then pick the label whose words best match a new text (a "naive Bayes" classifier).
def words(text):
    return [w.strip(".,?!'\"") for w in text.lower().split()]

label_count = collections.Counter(r["label"] for r in train)
word_count = collections.defaultdict(collections.Counter)
for r in train:
    word_count[r["label"]].update(words(r["text"]))
vocab = {w for counts in word_count.values() for w in counts}

def by_learning(text):
    best, best_score = None, -math.inf
    for label in label_count:
        total = sum(word_count[label].values())
        score = math.log(label_count[label] / len(train))
        for w in words(text):
            score += math.log((word_count[label][w] + 1) / (total + len(vocab)))
        if score > best_score:
            best, best_score = label, score
    return best

def accuracy(classify):
    return sum(classify(r["text"]) == r["label"] for r in test) / len(test)

rule_acc, learn_acc = accuracy(by_rules), accuracy(by_learning)
print(f"{len(rows)} different texts: {len(train)} to learn from, {len(test)} to test on, {len(label_count)} labels")
print(f"Hand-written rules: {rule_acc:.0%} right on the test rows")
print(f"Learned from data:  {learn_acc:.0%} right on the test rows")
print("\nSome test rows the rules got wrong:")
for r in [r for r in test if by_rules(r["text"]) != r["label"]][:5]:
    print(f"  {r['text'][:58]!r}")
    print(f"      rules: {by_rules(r['text'])}   learned: {by_learning(r['text'])}   right answer: {r['label']}")
`

async function rulesVsLearned(p: Project, read: DataReader): Promise<SnippetBundle> {
  const { rows, sources } = await projectLabelled(p, read)
  const r = RULES[p.id]
  const code = RULES_VS_LEARNED.replace('__RULES__', py(r.rules)).replace('__OTHERWISE__', JSON.stringify(r.otherwise))
  return { code, files: { 'labelled.json': JSON.stringify(rows) }, sources }
}

// ---- 1.2 The same sentence across eras ---------------------------------------------------------------------------------

const ERAS = String.raw`import collections, math

# A tiny, made-up set of film reviews to learn from.
TRAIN = [
    ("a great film", "positive"), ("really good acting", "positive"), ("not bad at all", "positive"),
    ("not bad, quite fun", "positive"), ("loved it, great fun", "positive"), ("good story and good music", "positive"),
    ("the plot was not boring", "positive"),
    ("a bad film", "negative"), ("really bad acting", "negative"), ("boring and too long", "negative"),
    ("not good at all", "negative"), ("the music was not good", "negative"), ("the story was bad", "negative"), ("not great, quite boring", "negative"),
    ("bad music and a bad plot", "negative"),
]
TESTS = ["the film was not bad at all", "the acting was not good", "a great story"]

def words(text):
    return [w.strip(",.") for w in text.lower().split()]

# Era 1: hand-written rules. Count good words minus bad words.
GOOD, BAD = {"good", "great", "loved", "fun"}, {"bad", "boring"}
def rules(text):
    score = sum(w in GOOD for w in words(text)) - sum(w in BAD for w in words(text))
    return "positive" if score > 0 else "negative"

# Era 2: learn word weights from examples, but look at each word on its own ("bag of words").
# Era 3 (a step towards context): also learn from pairs of neighbouring words, so "not bad" is one feature.
def features(text, pairs):
    ws = words(text)
    return ws + ([a + " " + b for a, b in zip(ws, ws[1:])] if pairs else [])

def train(pairs):
    counts = collections.defaultdict(collections.Counter)
    for text, label in TRAIN:
        counts[label].update(features(text, pairs))
    vocab = {f for c in counts.values() for f in c}
    def classify(text):
        def score(label):
            total = sum(counts[label].values())
            return sum(math.log((counts[label][f] + 1) / (total + len(vocab))) for f in features(text, pairs))
        return max(counts, key=score)
    return classify

single, paired = train(pairs=False), train(pairs=True)
print(f"{'sentence':32} {'rules':10} {'single words':14} {'word pairs':10}")
results = {}
for t in TESTS:
    results[t] = (rules(t), single(t), paired(t))
    print(f"{t:32} {results[t][0]:10} {results[t][1]:14} {results[t][2]:10}")
`

// ---- 1.3 What a language model predicts ------------------------------------------------------------------------------

const NEXT_WORD = String.raw`import json, collections, random, re

rows = json.load(open("messages.json", encoding="utf-8"))
texts = [re.findall(r"[a-z']+", r["text"].lower()) for r in rows if r["language"] == "en"]

# Count which word comes after each pair of words. That table is our whole "model".
follow = collections.defaultdict(collections.Counter)
for ws in texts:
    ws = ["<start>", "<start>"] + ws + ["<end>"]
    for a, b, c in zip(ws, ws[1:], ws[2:]):
        follow[(a, b)][c] += 1

# The two-word context followed by the most different words.
context = max((k for k in follow if "<start>" not in k), key=lambda k: (len(set(follow[k]) - {"<end>"}), sum(follow[k].values())))
counts = follow[context]
total = sum(counts.values())
print(f'After "{" ".join(context)}", the next word could be:')
for word, n in counts.most_common(8):
    print(f"  {word:15} {n / total:6.1%}")
print("All the chances add up to", round(sum(n / total for n in counts.values()), 6))

# Generate: pick each next word by its chance, add it, and repeat. Change the seed for different text.
random.seed(1)
print("\nThree generated messages:")
for _ in range(3):
    a, b, out = "<start>", "<start>", []
    while len(out) < 20:
        options = follow[(a, b)]
        nxt = random.choices(list(options), weights=list(options.values()))[0]
        if nxt == "<end>":
            break
        out.append(nxt)
        a, b = b, nxt
    print("  " + " ".join(out))
print("\nEach word is likely, given the two before it. Nothing checks that the message is true.")
`

// ---- 1.4 Tokens, cost and the context window -------------------------------------------------------------------------

const TOKENS = String.raw`import json, collections

rows = json.load(open("messages.json", encoding="utf-8"))

# Illustrative settings: change them and run again.
PRICE_IN, PRICE_OUT = 1.00, 4.00      # dollars per million input and output tokens
REPLY_TOKENS = 150                    # tokens in each answer
PROMPT_TOKENS = 1_500                 # instructions and retrieved text sent with every message
MESSAGES_PER_MONTH = 100_000

# Two rough guesses for English (about 4 characters per token, about 0.75 words per token),
# and one hard limit: a byte-level tokenizer never needs more tokens than the text has bytes.
stats = collections.defaultdict(lambda: [0, 0, 0, 0])
for r in rows:
    s = stats[r["language"]]
    s[0] += 1
    s[1] += len(r["text"])
    s[2] += len(r["text"].split())
    s[3] += len(r["text"].encode("utf-8"))
print(f"{'language':10} {'messages':>8} {'chars/4':>8} {'words/0.75':>10} {'bytes':>6}   (average per message)")
for lang, (n, chars, words, nbytes) in sorted(stats.items()):
    print(f"{lang:10} {n:8} {chars / n / 4:8.1f} {words / n / 0.75:10.1f} {nbytes / n:6.1f}")
print("The two guesses agree for English and drift apart for other scripts: measure with the real tokenizer (5.1).")

n, chars = stats["en"][0], stats["en"][1]
msg_tokens = chars / n / 4
cost_in = (PROMPT_TOKENS + msg_tokens) * MESSAGES_PER_MONTH * PRICE_IN / 1e6
cost_out = REPLY_TOKENS * MESSAGES_PER_MONTH * PRICE_OUT / 1e6
def usd(x):
    return "$" + format(x, ",.0f")
print(f"\nEnglish, {MESSAGES_PER_MONTH:,} messages a month: input {usd(cost_in)} + output {usd(cost_out)} = {usd(cost_in + cost_out)}")

# Parameters: the embedding table alone is one row of numbers per vocabulary entry.
VOCAB, WIDTH = 128_000, 4_096
print(f"\nEmbedding table: {VOCAB:,} tokens x {WIDTH:,} numbers = {VOCAB * WIDTH / 1e6:,.0f} million parameters")
print(f"At 2 bytes each that is {VOCAB * WIDTH * 2 / 1e9:.1f} GB, before a single transformer layer.")
`

// ---- 1.5 Grounding: answer from a source, or say so ------------------------------------------------------------------

const QUESTIONS: Record<string, string[]> = {
  harbor: [
    'How many days of annual leave do employees get?',
    'How long can an annual plan be refunded pro rata?',
    'What is the API rate limit per token?',
    'Is there a gym membership allowance?',
  ],
  bank: [
    'How many days do I have to raise a card dispute?',
    'When is a failed UPI payment reversed?',
    'What markup applies to foreign currency card payments?',
    'Do you offer home loans?',
  ],
  travel: [
    'Can I change a saver fare, and what is the fee?',
    'Until when can I cancel a hotel room for free?',
    'What happens if the airline cancels a flight because of weather?',
    'Can I bring my dog on the train?',
  ],
  store: [
    'How much does the Aarav smartphone cost?',
    'What is the rating of the Kesar Glow face wash?',
    'How much are Pada sneakers?',
    'What is the return window for silk dupattas?',
  ],
}

const GROUNDING = String.raw`import json, re

docs = json.load(open("docs.json", encoding="utf-8"))

# Questions a customer or employee might ask. The last one has no answer in the documents.
QUESTIONS = __QUESTIONS__
MIN_OVERLAP = 2   # how many shared words a source needs before we trust it

SKIP = {"how", "many", "much", "what", "when", "can", "do", "does", "is", "the", "a", "an", "of", "to",
        "i", "my", "for", "and", "you", "your", "are", "if", "there", "until", "get", "be", "which", "on"}
def words(text):
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in SKIP}

for q in QUESTIONS:
    best = max(docs, key=lambda d: len(words(q) & words(d["title"] + " " + d["text"])))
    overlap = len(words(q) & words(best["title"] + " " + best["text"]))
    print("Q:", q)
    if overlap < MIN_OVERLAP:
        print("   I could not find this in the documents, so I will not guess.\n")
        continue
    sentences = re.split(r"(?<=[.!?])\s+", best["text"])
    answer = max(sentences, key=lambda s: len(words(q) & words(s)))
    print(f"   {answer} [{best['id']}]\n")
`

async function grounding(p: Project, read: DataReader): Promise<SnippetBundle> {
  const { docs, sources } = await projectDocs(p, read)
  return { code: GROUNDING.replace('__QUESTIONS__', py(QUESTIONS[p.id])), files: { 'docs.json': JSON.stringify(docs) }, sources }
}

// ---- 1.6 Choosing a tool: cost and speed ----------------------------------------------------------------------------

const TOOL_CHOICE = String.raw`# Illustrative numbers for one task, a million requests a month. Change any of them and run again.
REQUESTS = 1_000_000
LLM_TOKENS_IN, LLM_TOKENS_OUT = 1_500, 200
PRICE_IN, PRICE_OUT = 1.00, 4.00          # dollars per million tokens
llm_per_request = (LLM_TOKENS_IN * PRICE_IN + LLM_TOKENS_OUT * PRICE_OUT) / 1e6

APPROACHES = {                            # dollars per request, typical wait in milliseconds
    "Rules / code":   (0.000001, 1),
    "Search":         (0.00005, 50),
    "Traditional ML": (0.00002, 10),
    "LLM":            (llm_per_request, 1500),
}
def usd(x):
    return "$" + format(x, ",.0f")
print(f"{'approach':16} {'per month':>12} {'wait':>8}")
for name, (cost, ms) in APPROACHES.items():
    print(f"{name:16} {usd(cost * REQUESTS):>12} {ms:>6} ms")

# A combination: rules answer what they can, and only the rest goes to the LLM.
SHARE_FOR_LLM = 0.3
combined = REQUESTS * (APPROACHES["Rules / code"][0] + SHARE_FOR_LLM * llm_per_request)
print(f"\nRules first, LLM for {SHARE_FOR_LLM:.0%} of requests: {usd(combined)} a month")
print(f"LLM for everything:                     {usd(REQUESTS * llm_per_request)} a month")
`

export const C1 = {
  'rules-vs-learned': {
    title: 'Hand-written rules against a learned classifier',
    brief: 'Sorts your labelled text with keyword rules, then with a classifier that learns word counts from 80% of the rows, and compares both on the other 20%.',
    proves:
      'Learning needs enough different examples: with a few hundred it beats a short rule list, with a few dozen the rules can win. The data is synthetic and repetitive, so the percentages are not what you would get on real text.',
    build: rulesVsLearned,
    check: `assert 0 <= rule_acc <= 1 and 0 <= learn_acc <= 1\nassert len(train) > len(test) > 0`,
  },
  eras: {
    title: 'One sentence, three eras',
    brief: 'Classifies "not bad at all" with word-count rules, with learned single-word weights, and with learned word pairs.',
    proves:
      'Word order matters, and a model that sees neighbouring words can learn that "not" flips "bad". Fourteen invented reviews are far too few to train a real model; the point is the difference between the three, not their accuracy.',
    neutral: true,
    build: neutral(ERAS),
    check: `assert results["the film was not bad at all"][0] == "negative"\nassert results["the film was not bad at all"][2] == "positive"`,
  },
  'next-word': {
    title: 'Predict the next word from counts',
    brief: 'Counts which word follows each pair of words in your English messages, shows the chances for one context, and generates text by picking word after word.',
    proves:
      'A language model outputs a chance for every possible next word and generates by picking again and again. A count table only sees two words back and is not a neural network; an LLM sees the whole context.',
    build: fromMessages(NEXT_WORD),
    check: `assert abs(sum(n / total for n in counts.values()) - 1) < 1e-9\nassert len(counts) >= 2`,
  },
  tokens: {
    title: 'Tokens, cost and parameters',
    brief: 'Estimates tokens per message in each language of your messages, the monthly cost at illustrative prices, and the size of an embedding table.',
    proves: 'The rules of thumb hold for English only, and the prices are illustrative. It does not count real tokens: use the model’s own tokenizer for that.',
    build: fromMessages(TOKENS),
    check: `assert stats["en"][0] > 0\nassert cost_in > 0 and cost_out > 0`,
  },
  grounding: {
    title: 'Answer from a source, or say so',
    brief: 'Finds the document that shares the most words with each question, quotes its best sentence with the document id, and declines when nothing matches.',
    proves:
      'Answers that quote a source can be checked, and a system can decline instead of guessing. Word overlap is a crude retriever that does not understand paraphrases; chapter 9 builds real retrieval.',
    build: grounding,
    check: `assert len(QUESTIONS) == 4\nassert any(len(words(QUESTIONS[-1]) & words(d["title"] + " " + d["text"])) < MIN_OVERLAP for d in docs)`,
  },
  'tool-choice': {
    title: 'What each approach costs',
    brief: 'Compares the monthly cost and wait of rules, search, traditional ML and an LLM for a million requests, then a combination that sends only some requests to the LLM.',
    proves: 'All the prices and waits are illustrative, not quotes. It shows how the gap scales with volume; it does not show which approach is accurate enough for your task.',
    neutral: true,
    build: neutral(TOOL_CHOICE),
    check: `assert combined < REQUESTS * llm_per_request`,
  },
} satisfies Record<string, Snippet>
