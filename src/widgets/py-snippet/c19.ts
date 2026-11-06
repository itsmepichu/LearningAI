/** Chapter 19 snippets: image and audio tokens, VLM shapes and cost, document pipelines, speech, multimodal retrieval, grounding checks. */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { neutral, projectDocs, projectMessages, type Snippet, type SnippetBundle } from './common.ts'

const withDocs = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { docs, sources } = await projectDocs(p, read)
  return { code, files: { 'docs.json': JSON.stringify(docs.slice(0, 120)) }, sources }
}
const withMessages = (code: string) => async (p: Project, read: DataReader): Promise<SnippetBundle> => {
  const { rows, sources } = await projectMessages(p, read)
  return { code, files: { 'messages.json': JSON.stringify(rows) }, sources }
}

// ---- 19.1 How many tokens is a picture or a minute of audio? ---------------------------------------------------------

const TOKENS = String.raw`import math

PATCH = 14                       # pixels per side of one image patch (a common ViT setting)
MERGE = 2                        # many models merge 2 x 2 neighbouring patches into one token
PRICE_PER_M = 3.0                # illustrative dollars per million input tokens

def image_tokens(w, h, max_side=1024):
    scale = min(1.0, max_side / max(w, h))            # large images are shrunk first
    w, h = int(w * scale), int(h * scale)
    patches = math.ceil(w / PATCH) * math.ceil(h / PATCH)
    return w, h, patches, math.ceil(patches / (MERGE * MERGE))

print("image            resized      patches  tokens  dollars per 1,000 images")
for name, (w, h) in {"phone photo": (4032, 3024), "screenshot": (1920, 1080), "scanned page": (2480, 3508), "thumbnail": (320, 240)}.items():
    rw, rh, patches, tokens = image_tokens(w, h)
    print(f"{name:15} {rw:4} x {rh:<5} {patches:8,} {tokens:7,}  {tokens * 1000 * PRICE_PER_M / 1e6:8.2f}")

FRAMES_PER_S = 50               # audio encoders often produce one vector per 20 ms
for seconds in (10, 60, 600):
    print(f"{seconds:4} s of audio -> about {seconds * FRAMES_PER_S:,} audio positions before any merging")
print("Same budget, different shapes: one page image can cost as much as a thousand words of text.")
`

// ---- 19.2 Inside a vision-language model: shapes and the cost of images ------------------------------------------------

const VLM = String.raw`import numpy as np

rng = np.random.default_rng(19)
IMG, PATCH, VIT_DIM, LLM_DIM = 448, 14, 1024, 2048
patches = (IMG // PATCH) ** 2                                   # 32 x 32 = 1,024 patches
image = rng.random((IMG, IMG, 3))
grid = image.reshape(IMG // PATCH, PATCH, IMG // PATCH, PATCH, 3).transpose(0, 2, 1, 3, 4).reshape(patches, -1)
print(f"image {image.shape} -> {patches} patches of {grid.shape[1]} numbers each")

W_embed = rng.normal(0, 0.02, (grid.shape[1], VIT_DIM))
vit_out = grid @ W_embed                                         # stands in for the whole vision encoder
merged = vit_out.reshape(16, 2, 16, 2, VIT_DIM).transpose(0, 2, 1, 3, 4).reshape(256, 4 * VIT_DIM)   # 2 x 2 merge
W_proj = rng.normal(0, 0.02, (4 * VIT_DIM, LLM_DIM))
image_tokens = merged @ W_proj                                   # the projector: into the language model's space
text_tokens = rng.normal(size=(40, LLM_DIM))
sequence = np.vstack([image_tokens, text_tokens])
print(f"vision encoder {vit_out.shape} -> merged {merged.shape} -> projected {image_tokens.shape}")
print(f"sequence the language model reads: {sequence.shape[0]} positions ({image_tokens.shape[0]} image + {text_tokens.shape[0]} text)")

for images in (1, 4, 16):
    tokens = images * 256 + 40
    print(f"{images:2} image(s) + a 40-token question = {tokens:5,} prefill tokens; at 10,000 tokens/s about {tokens / 10_000:.2f} s before the first word")
`

// ---- 19.3 OCR text or page images? ------------------------------------------------------------------------------------

const DOCS = String.raw`import json

docs = json.load(open("docs.json", encoding="utf-8"))
words = sum(len(d["text"].split()) for d in docs)
COPIES = 20_000                               # pretend each document is one of 20,000 similar ones (illustrative)
WORDS_PER_PAGE = 450
pages = max(1, round(words * COPIES / WORDS_PER_PAGE))

# Illustrative unit costs and speeds; measure your own.
OCR = {"cost_per_page": 0.0015, "seconds_per_page": 1.2, "tokens_per_page": WORDS_PER_PAGE * 1.3}
VLM = {"cost_per_page": 0.0040, "seconds_per_page": 2.5, "tokens_per_page": 1_600}
TEXT_PRICE = 3.0 / 1e6                         # dollars per token to read the result later

print(f"{len(docs)} of your project's documents x {COPIES} = about {pages:,} pages")
for name, p in (("OCR -> text", OCR), ("page image -> VLM", VLM)):
    once = pages * p["cost_per_page"]
    hours = pages * p["seconds_per_page"] / 3600
    print(f"  {name:18} extraction {once:9,.0f} dollars, {hours:7,.1f} worker-hours; {p['tokens_per_page']:,.0f} tokens a page")

TABLE_PAGES = 0.15                             # share of pages with tables (illustrative)
OCR_TABLE_ERRORS, VLM_TABLE_ERRORS = 0.20, 0.06
print(f"pages with a mangled table: OCR about {pages * TABLE_PAGES * OCR_TABLE_ERRORS:,.0f}, "
      f"VLM about {pages * TABLE_PAGES * VLM_TABLE_ERRORS:,.0f} (illustrative error rates)")
print("A common design: cheap OCR everywhere, a VLM only for pages with tables, forms or handwriting.")
`

// ---- 19.4 Word error rate and the voice-turn budget -------------------------------------------------------------------

const SPEECH = String.raw`import json, random, collections

random.seed(4)
msgs = json.load(open("messages.json", encoding="utf-8"))

def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    d = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        d[i][0] = i
    for j in range(len(h) + 1):
        d[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] != h[j - 1]))
    return d[len(r)][len(h)] / max(1, len(r))

NOISE = {"en": 0.05, "hi": 0.12, "ta": 0.15, "hinglish": 0.18, "de": 0.08}   # simulated per-word error rates
def recognise(text, lang):
    out = []
    for w in text.split():
        x = random.random()
        p = NOISE.get(lang, 0.10)
        if x < p / 2:
            continue                                 # a dropped word
        out.append(w[::-1] if x < p else w)          # a wrongly heard word
    return " ".join(out)

by_lang = collections.defaultdict(list)
for m in msgs:
    by_lang[m["language"]].append(wer(m["text"], recognise(m["text"], m["language"])))
for lang, xs in sorted(by_lang.items()):
    print(f"{lang:9} {len(xs):4} messages  word error rate {sum(xs) / len(xs):5.1%}")

BUDGET = {"end-of-speech detection": 300, "speech-to-text": 250, "model first token": 450, "text-to-speech first audio": 200}
print("voice turn:", " + ".join(f"{k} {v}" for k, v in BUDGET.items()), f"= {sum(BUDGET.values())} ms before the caller hears anything")
`

// ---- 19.5 Fusing text and image retrieval ------------------------------------------------------------------------------

const FUSION = String.raw`import json, random

random.seed(5)
docs = json.load(open("docs.json", encoding="utf-8"))
ids = [d["id"] for d in docs]
QUERIES = max(300, len(docs))     # several simulated queries per document, so the rates are stable

def ranking(target, strength):
    """A simulated ranker: the target's score is boosted by 'strength' plus noise; others are noise."""
    scores = {i: random.gauss(0, 1) + (strength if i == target else 0) for i in ids}
    return sorted(ids, key=lambda i: -scores[i])

def rrf(*rankings, k=60):
    total = {}
    for r in rankings:
        for pos, i in enumerate(r):
            total[i] = total.get(i, 0) + 1 / (k + pos + 1)
    return sorted(total, key=lambda i: -total[i])

hits = {"text only": 0, "image only": 0, "fused (RRF)": 0}
for q in range(QUERIES):
    target = ids[q % len(ids)]
    visual = random.random() < 0.4     # 40% of queries ask about how something looks (simulated)
    text = ranking(target, 0.6 if visual else 2.5)     # words describe some queries well
    image = ranking(target, 2.5 if visual else 0.8)    # image similarity catches what words miss
    for name, r in (("text only", text), ("image only", image), ("fused (RRF)", rrf(text, image))):
        hits[name] += target in r[:3]
for name, h in hits.items():
    print(f"{name:12} recall@3 {h / QUERIES:.0%}")
print(f"{QUERIES} queries over {len(docs)} of your project's documents; the scores are simulated, the fusion is real.")
`

// ---- 19.6 Checking a description against its source -------------------------------------------------------------------

const GROUNDED = String.raw`import json, re, random

random.seed(6)
docs = json.load(open("docs.json", encoding="utf-8"))
NUM = r"\d[\d,]*(?:\.\d+)?"

def describe(text):
    """Stands in for a model describing an image of this document: sometimes it changes a number."""
    return re.sub(NUM, lambda m: m.group() if random.random() > 0.15 else str(int(float(m.group().replace(",", ""))) + 7), text)

claims = unsupported = 0
examples = []
for d in docs:
    source = set(re.findall(NUM, d["text"]))
    out = describe(d["text"])
    for n in re.findall(NUM, out):
        claims += 1
        if n not in source:
            unsupported += 1
            if len(examples) < 3:
                examples.append((d["id"], n))
print(f"{len(docs)} descriptions, {claims} numbers claimed, {unsupported} not found in the source ({unsupported / max(1, claims):.1%})")
for doc, n in examples:
    print(f"  {doc}: '{n}' does not appear in the source")
print("A number check catches changed figures; it cannot judge a wrong colour or object, which needs a labelled set.")
`

export const C19 = {
  'image-tokens': {
    title: 'How many tokens is a picture?',
    brief: 'Resizes four kinds of image, cuts them into patches, merges neighbours into tokens and prices them, then counts audio positions for three clip lengths.',
    proves: 'Why images and audio fill a context window fast. Patch size, merging and price differ by model; it does not describe any one product exactly.',
    neutral: true,
    build: neutral(TOKENS),
    check: 'assert image_tokens(320, 240)[3] < image_tokens(4032, 3024)[3]',
  },
  'vlm-shapes': {
    title: 'Inside a vision-language model',
    brief: 'Cuts an image into patches with NumPy, passes them through a stand-in encoder, merges and projects them into the language model’s space, and counts prefill tokens for several images.',
    proves: 'The shapes and why many images slow the first token. The weights are random, so it does not recognise anything.',
    neutral: true,
    build: neutral(VLM),
    check: 'assert image_tokens.shape == (256, LLM_DIM) and sequence.shape[0] == 296',
  },
  'doc-pipeline': {
    title: 'OCR text or page images?',
    brief: 'Sizes a page count from your project’s documents and compares OCR with sending page images to a VLM on cost, worker-hours, tokens and table errors.',
    proves: 'How the trade-off is calculated. Every rate is illustrative, not a measurement of any OCR engine or model.',
    build: withDocs(DOCS),
    check: 'assert pages > 0 and VLM["cost_per_page"] > OCR["cost_per_page"]',
  },
  'speech-wer': {
    title: 'Word error rate by language',
    brief: 'Simulates speech recognition errors on your project’s messages, computes word error rate per language with an edit distance, and adds up a voice turn’s latency budget.',
    proves: 'How word error rate is computed and why it is reported per language. The recognition errors are simulated, not from a real speech model.',
    build: withMessages(SPEECH),
    check: 'assert wer("a b c", "a b c") == 0 and abs(wer("a b c d", "a x c") - 0.5) < 1e-9',
  },
  'multimodal-fusion': {
    title: 'Fusing text and image retrieval',
    brief: 'Ranks your project’s documents with a simulated text ranker and a simulated image ranker, fuses them with reciprocal rank fusion and compares recall@3.',
    proves: 'How rank fusion combines two signals. The rankers are simulated, so it does not show how well real image embeddings work on your data.',
    build: withDocs(FUSION),
    check: 'assert rrf(["a", "b"], ["a", "c"])[0] == "a"',
  },
  'grounded-description': {
    title: 'Checking a description against its source',
    brief: 'Simulates a model describing each of your project’s documents with some numbers changed, and flags every number in the description that the source does not contain.',
    proves: 'That automatic checks catch changed figures. It does not catch wrong objects, colours or layout, which need human-labelled examples.',
    build: withDocs(GROUNDED),
    check: 'assert unsupported <= claims',
  },
} satisfies Record<string, Snippet>
