/** Chapter 14 snippets: GPU memory, request latency, batching, speculative decoding, parallelism, autoscaling, roofline, cost. */
import { fromMessages, neutral, type Snippet } from './common.ts'

// ---- 14.1 What fits on one GPU ----------------------------------------------------------------------------------------

const MEMORY = String.raw`GPU_GB = 80
OVERHEAD_GB = 0.08 * GPU_GB + 2          # CUDA context, buffers, fragmentation (an assumption)
MODELS = {"3B": (3.2e9, 28, 8, 128), "8B": (8.0e9, 32, 8, 128), "70B": (70.6e9, 80, 8, 128)}
WEIGHT_BYTES = {"BF16": 2, "FP8": 1, "4-bit": 0.5}
KV_BYTES = 2                              # BF16 keys and values; use 1 for an FP8 KV cache

print(f"One {GPU_GB} GB GPU, KV cache in {'BF16' if KV_BYTES == 2 else 'FP8'}:")
for name, (params, layers, kv_heads, head_dim) in MODELS.items():
    per_token = 2 * layers * kv_heads * head_dim * KV_BYTES          # keys and values, every layer
    for fmt, b in WEIGHT_BYTES.items():
        weights = params * b / 1e9
        free = GPU_GB - OVERHEAD_GB - weights
        if free <= 0:
            print(f"  {name:4} {fmt:6} weights {weights:5.1f} GB: does not fit")
            continue
        tokens = free * 1e9 / per_token
        print(f"  {name:4} {fmt:6} weights {weights:5.1f} GB, KV {per_token / 1024:4.0f} KiB/token -> "
              f"{tokens / 1e3:6.0f}k tokens = {tokens // 8192:4.0f} chats of 8k or {tokens // 131072:3.0f} of 128k")
`

// ---- 14.2 Time to first token and total time --------------------------------------------------------------------------

const LATENCY = String.raw`import json, random

random.seed(14)
msgs = json.load(open("messages.json", encoding="utf-8"))
SYSTEM_TOKENS = 1500           # system prompt and tool definitions sent with every request (illustrative)
PREFILL_PER_S = 10_000         # prompt tokens per second (illustrative)
ITL_S = 1 / 60                 # one output token every 1/60 s
QUEUE_S = (0.0, 0.3)           # queue wait, uniformly between these

def pct(xs, q):
    xs = sorted(xs)
    return xs[int(q * (len(xs) - 1))]

ttft, total = [], []
for m in msgs:
    prompt = SYSTEM_TOKENS + int(len(m["text"].split()) * 1.3)
    out = random.randint(60, 400)
    first = random.uniform(*QUEUE_S) + prompt / PREFILL_PER_S
    ttft.append(first)
    total.append(first + (out - 1) * ITL_S)
print(f"{len(msgs)} of your project's messages as prompts, plus {SYSTEM_TOKENS} tokens of instructions")
print(f"time to first token: p50 {pct(ttft, .5):.2f} s, p95 {pct(ttft, .95):.2f} s")
print(f"total time:          p50 {pct(total, .5):.2f} s, p95 {pct(total, .95):.2f} s")
print(f"A 20,000-token document adds {20_000 / PREFILL_PER_S:.1f} s of prefill; 300 more output tokens add {300 * ITL_S:.1f} s.")
`

// ---- 14.3 Static and continuous batching, and paged memory ------------------------------------------------------------

const BATCHING = String.raw`import random

random.seed(3)
SLOTS = 4
lengths = [random.randint(5, 40) for _ in range(12)]     # output tokens per request

def static(lengths):
    steps = busy = 0
    for i in range(0, len(lengths), SLOTS):
        batch = lengths[i:i + SLOTS]
        steps += max(batch)                  # everyone waits for the longest
        busy += sum(batch)
    return steps, busy / (steps * SLOTS)

def continuous(lengths):
    waiting, running, steps, busy = list(lengths), [], 0, 0
    while waiting or running:
        while waiting and len(running) < SLOTS:
            running.append(waiting.pop(0))   # a free slot is refilled at once
        steps += 1
        busy += len(running)
        running = [r - 1 for r in running if r > 1]
    return steps, busy / (steps * SLOTS)

print("Request lengths:", lengths)
for name, fn in (("static", static), ("continuous", continuous)):
    steps, util = fn(lengths)
    print(f"  {name:10} batching: {steps:4} decode steps, slots busy {util:.0%}")

MAX_LEN, BLOCK = 4096, 16
used = [random.randint(200, 1500) for _ in range(20)]
reserved = MAX_LEN * len(used)
paged = sum(-(-u // BLOCK) * BLOCK for u in used)
print(f"KV slots for 20 sequences: reserve {MAX_LEN} each = {reserved:,}; blocks of {BLOCK} on demand = {paged:,} "
      f"({1 - paged / reserved:.0%} less)")
`

// ---- 14.4 Speculative decoding, simulated ------------------------------------------------------------------------------

const SPECULATIVE = String.raw`import random

random.seed(4)
def round_tokens(k, accept):
    n = 0
    while n < k and random.random() < accept:
        n += 1                     # draft token accepted
    return n + 1                   # plus one token from the target model itself

def expected(k, a):
    return sum(a ** i for i in range(k + 1))     # 1 + a + a^2 + ... up to a^k

print("draft k  acceptance  tokens per target pass (simulated / expected)")
for k in (2, 4, 8):
    for a in (0.5, 0.8, 0.9):
        sim = sum(round_tokens(k, a) for _ in range(20_000)) / 20_000
        print(f"{k:7}  {a:10.0%}  {sim:10.2f} / {expected(k, a):.2f}")
print("Each draft token also costs a little draft-model time, so a longer draft only helps when acceptance is high.")

for fmt, b in (("BF16", 2), ("FP8", 1), ("4-bit", 0.55)):
    print(f"8B weights in {fmt:5}: {8 * b:4.1f} GB; ideal decode speed-up from fewer bytes read {2 / b:.1f}x (real gains are lower)")
`

// ---- 14.5 Tensor parallelism and replicas ------------------------------------------------------------------------------

const PARALLEL = String.raw`GPU_GB, OVERHEAD_GB = 80, 8
WEIGHTS_GB = 70                                 # a 70B model in FP8
KV_PER_TOKEN = 2 * 80 * 8 * 128 * 2             # bytes: K and V, 80 layers, 8 KV heads of 128, BF16
CONVERSATIONS, CONTEXT = 600, 4096
need_tokens = CONVERSATIONS * CONTEXT
print(f"Need KV for {CONVERSATIONS} conversations x {CONTEXT} tokens = {need_tokens / 1e6:.1f} M tokens "
      f"({need_tokens * KV_PER_TOKEN / 1e9:.0f} GB)")
for tp in (1, 2, 4, 8):
    free_gb = tp * (GPU_GB - OVERHEAD_GB) - WEIGHTS_GB
    if free_gb <= 0:
        print(f"  TP={tp}: weights do not fit")
        continue
    per_unit = free_gb * 1e9 / KV_PER_TOKEN
    units = -(-need_tokens // int(per_unit))
    print(f"  TP={tp}: {per_unit / 1e3:5.0f}k tokens per unit -> {units} units, {units * tp} GPUs; "
          f"with N+1 spare: {(units + 1) * tp} GPUs")
print("Losing one GPU stops its whole unit, so the spare is a whole unit, not one GPU.")
`

// ---- 14.6 Autoscaling through a morning ramp ---------------------------------------------------------------------------

const AUTOSCALE = String.raw`def demand(minute):
    """Replicas' worth of load: quiet night, a ramp from 8:00 to 9:00, then a plateau (illustrative)."""
    if minute < 60:
        return 2
    return min(10, 2 + (minute - 60) * 8 / 60)

def run(cold_start, warm_min, signal):
    ready, starting, short = warm_min, [], 0
    for m in range(180):
        ready += sum(1 for s in starting if s == m)
        starting = [s for s in starting if s > m]
        load = demand(m)
        if load > ready:
            short += 1                                 # a minute when users wait
        # Queue depth reacts as soon as load exceeds capacity; GPU utilisation saturates and lags by ~5 minutes.
        seen = load if signal == "queue" else demand(max(0, m - 5))
        want = int(seen + 0.999) + 1                  # one replica of headroom
        if want > ready + len(starting):
            starting += [m + cold_start] * (want - ready - len(starting))
    return short

print("minutes short of capacity over 3 hours")
print("cold start  warm pool  queue signal  utilisation signal")
for cold in (2, 6, 12):
    for warm in (2, 6):
        print(f"{cold:7} min  {warm:9}  {run(cold, warm, 'queue'):12}  {run(cold, warm, 'util'):18}")
`

// ---- 14.7 A roofline model of decode, and admission control ------------------------------------------------------------

const ROOFLINE = String.raw`WEIGHT_BYTES = 16e9            # 8B model in BF16
BANDWIDTH = 3.3e12             # bytes per second (illustrative datacentre GPU)
FLOPS = 400e12                 # usable operations per second (illustrative)
KV_BYTES_PER_SEQ = 0.5e9       # each sequence's cache, read every step (about 4k tokens)
ITL_SLO = 0.050                # 50 ms per output token

best = None
print("batch  step ms  tokens/s per GPU  per-user tokens/s")
for batch in (1, 8, 32, 64, 128, 256, 512):
    memory_time = (WEIGHT_BYTES + batch * KV_BYTES_PER_SEQ) / BANDWIDTH
    compute_time = batch * 2 * 8e9 / FLOPS
    step = max(memory_time, compute_time)        # whichever is slower decides
    ok = step <= ITL_SLO
    if ok:
        best = batch
    print(f"{batch:5}  {step * 1000:7.1f}  {batch / step:16,.0f}  {1 / step:17.1f}  {'' if ok else 'over the SLO'}")
print(f"Largest batch under {ITL_SLO * 1000:.0f} ms per token: {best}. Admission control caps sequences there and queues the rest.")

QUEUE_LIMIT, ARRIVING, SERVED = 40, 90, 80        # requests per minute
queue = rejected = 0
for minute in range(10):
    queue += ARRIVING
    queue -= min(queue, SERVED)
    if queue > QUEUE_LIMIT:
        rejected += queue - QUEUE_LIMIT
        queue = QUEUE_LIMIT
print(f"Bounded queue of {QUEUE_LIMIT}: after 10 minutes at {ARRIVING}/min arriving and {SERVED}/min served, "
      f"{rejected} requests were turned away quickly instead of timing out.")
`

// ---- 14.8 Hosted or self-hosted ----------------------------------------------------------------------------------------

const COST = String.raw`SECONDS_PER_MONTH = 30 * 24 * 3600
API_PER_M = 0.60               # dollars per million tokens, blended (illustrative)
GPU_HOUR = 2.50                # dollars (illustrative)
THROUGHPUT = 2_500             # tokens per second per GPU at your SLO: measure it (14.7)
UTILISATION = 0.45             # average over the month, nights included
OPS = 15_000                   # dollars a month: engineers, on-call, observability

print(f"{'billion tokens/month':>21} {'API':>9} {'GPUs':>5} {'self-hosted':>12}")
for billions in (5, 20, 60, 150, 400):
    tokens = billions * 1e9
    api = tokens / 1e6 * API_PER_M
    gpus = max(2, -(-tokens // (THROUGHPUT * UTILISATION * SECONDS_PER_MONTH)))
    self_hosted = gpus * GPU_HOUR * 24 * 30 + OPS
    print(f"{billions:21} {api:9,.0f} {gpus:5.0f} {self_hosted:12,.0f}  {'self-host' if self_hosted < api else 'API'}")
print(f"One GPU delivers {THROUGHPUT * UTILISATION * SECONDS_PER_MONTH / 1e9:.2f} billion tokens a month at {UTILISATION:.0%} utilisation.")
def self_hosted_cost(billions, util):
    gpus = max(2, -(-billions * 1e9 // (THROUGHPUT * util * SECONDS_PER_MONTH)))
    return gpus * GPU_HOUR * 24 * 30 + OPS
for util in (0.45, 0.70, 0.90):
    even = next((b for b in range(1, 5000) if self_hosted_cost(b, util) < b * 1e3 * API_PER_M), None)
    print(f"  at {util:.0%} utilisation, self-hosting is cheaper from about {even} billion tokens a month" if even else f"  at {util:.0%}: never")
`

export const C14 = {
  'gpu-memory': {
    title: 'What fits on one GPU',
    brief: 'Works out weights, KV cache per token and how many tokens and conversations fit on one 80 GB GPU for three model sizes and three weight formats.',
    proves: 'The memory arithmetic behind concurrency limits. The overhead is an assumption and engines reserve memory differently; it does not measure a real deployment.',
    neutral: true,
    build: neutral(MEMORY),
    check: 'assert 2 * 32 * 8 * 128 * 2 == 131072',
  },
  'ttft-itl': {
    title: 'First-token and total time for your messages',
    brief: 'Uses your project’s messages as prompts, adds a fixed instruction block, and computes time to first token and total time with illustrative prefill and decode rates.',
    proves: 'How prompt length drives the first token and output length drives the total. The rates are illustrative; it does not call a model.',
    build: fromMessages(LATENCY),
    check: 'assert pct(ttft, .95) >= pct(ttft, .5) and min(total) >= min(ttft)',
  },
  'batching-steps': {
    title: 'Static and continuous batching',
    brief: 'Runs 12 requests of random length through 4 slots with static and continuous batching, then compares reserving maximum-length KV memory with blocks on demand.',
    proves: 'Why continuous batching and paged memory raise utilisation. It counts steps and slots; it does not model prefill or real kernel timings.',
    neutral: true,
    build: neutral(BATCHING),
    check: 'assert continuous(lengths)[0] <= static(lengths)[0] and paged < reserved',
  },
  'speculative-decoding': {
    title: 'Speculative decoding, simulated',
    brief: 'Simulates draft-and-verify rounds for several draft lengths and acceptance rates and compares tokens per target pass with the expected value, then sizes quantised weights.',
    proves: 'How acceptance rate and draft length set the speed-up. It ignores the draft model’s own cost and says nothing about acceptance on your text.',
    neutral: true,
    build: neutral(SPECULATIVE),
    check: 'assert abs(expected(4, 0.8) - 3.3616) < 1e-3',
  },
  'tp-replicas': {
    title: 'Tensor parallelism and replicas',
    brief: 'Sizes a 70B FP8 deployment for 600 conversations of 4k tokens at tensor-parallel sizes 1 to 8, counting units, GPUs and a spare unit.',
    proves: 'How the KV room per unit sets the number of replicas. It does not include headroom or latency targets, and the overhead is assumed.',
    neutral: true,
    build: neutral(PARALLEL),
    check: 'assert need_tokens == 600 * 4096',
  },
  'autoscale-ramp': {
    title: 'Autoscaling through a morning ramp',
    brief: 'Simulates three hours with a traffic ramp and counts minutes short of capacity for different cold-start times, warm pools and scaling signals.',
    proves: 'Why long cold starts and lagging signals miss a ramp. The demand curve and the signal lag are invented, so it does not predict your traffic.',
    neutral: true,
    build: neutral(AUTOSCALE),
    check: 'assert run(12, 2, "util") >= run(2, 6, "queue")',
  },
  'roofline-batch': {
    title: 'Throughput, latency and admission control',
    brief: 'Computes decode step time as the slower of memory and compute for growing batch sizes, finds the largest batch under a 50 ms SLO, and simulates a bounded queue.',
    proves: 'The shape of the throughput–latency trade-off. The constants are illustrative, not a benchmark; the Colab guide below measures a real engine.',
    neutral: true,
    build: neutral(ROOFLINE),
    check: 'assert best is not None and rejected > 0',
  },
  'hosted-vs-self': {
    title: 'Hosted or self-hosted',
    brief: 'Compares API cost with self-hosted GPUs plus operations across monthly token volumes, using a measured-throughput placeholder and average utilisation.',
    proves: 'Where the break-even lies for these inputs. Every price and the throughput are placeholders; it is not a quote until your own benchmark replaces them.',
    neutral: true,
    build: neutral(COST),
    check: 'assert THROUGHPUT * UTILISATION * SECONDS_PER_MONTH > 2.9e9',
  },
} satisfies Record<string, Snippet>
