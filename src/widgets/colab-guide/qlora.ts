/**
 * 13.3 and the chapter 13 lab: a QLoRA fine-tune of a 1.7B model on the selected project's labelled text, the same rows
 * the 3.2 classifier trains on. It measures a prompt-only baseline, trains a LoRA adapter on a 4-bit base, then checks
 * the domain gain, general answers with the adapter switched off and on, the train–test gap, and a save-and-reload.
 */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { loadLabelled, type LabelledSet } from '../text-classifier/examples.ts'
import { py, withSetup, type GuideDef, type GuideStep } from './notebook.ts'

export const QLORA_MODEL = 'Qwen/Qwen3-1.7B'
export const QLORA_MODEL_CARD = 'https://huggingface.co/Qwen/Qwen3-1.7B'

/** General questions whose answers should not change when the adapter is switched on. */
export const GENERAL_PROBES = [
  'What is the capital of Japan?',
  'What is 17 multiplied by 3?',
  'In one sentence, why do we wash our hands before eating?',
  'Translate "thank you very much" into French.',
]

export type QloraSeed = Pick<LabelledSet, 'file' | 'noun' | 'target' | 'rows'>

export async function loadQloraSeed(p: Project, read: DataReader): Promise<QloraSeed> {
  const { file, noun, target, rows } = await loadLabelled(p, read)
  return { file, noun, target, rows }
}

/** The rows as a compact Python list of (text, label) pairs, one per line. */
export function pythonRows(rows: QloraSeed['rows']): string {
  return `[\n${rows.map((r) => `    (${py(r.text)}, ${py(r.label)}),`).join('\n')}\n]`
}

export function qloraSteps(p: Pick<Project, 'company'>, seed: QloraSeed): GuideStep[] {
  return withSetup(
    [
      {
        title: 'Install the fine-tuning libraries',
        text: 'Transformers loads the model, bitsandbytes stores it in 4 bits, and PEFT adds the small trainable LoRA matrices. This takes a minute or two. If pip warns about conflicting versions of other packages, carry on: they are not used here.',
        code: `!pip install -q --upgrade "transformers>=4.56" "peft>=0.17" "bitsandbytes>=0.46" accelerate`,
      },
      {
        title: `Load ${p.company}’s labelled ${seed.noun}`,
        text: `These are the ${seed.rows.length} ${seed.noun} from ${seed.file} that the 3.2 classifier trains on, labelled by ${seed.target}. They are split once, with a fixed seed, into a training set and a held-out test set, keeping each label’s share in both. The test rows are never trained on: they are how you measure a gain.`,
        code: `import random
from collections import Counter

ROWS = ${pythonRows(seed.rows)}

LABELS = sorted({label for _, label in ROWS})
rng = random.Random(0)
train, test = [], []
for label in LABELS:
    group = [row for row in ROWS if row[1] == label]
    rng.shuffle(group)
    cut = max(1, round(len(group) * 0.25))
    test += group[:cut]
    train += group[cut:]
rng.shuffle(train)
print(len(train), "training rows,", len(test), "test rows")
print("Labels:", dict(Counter(label for _, label in ROWS)))`,
        expect: `About three quarters of the rows for training and a quarter for testing, and the count of each label. Some labels are rare: watch them in the results.`,
      },
      {
        title: 'Load the model in 4 bits and add LoRA adapters',
        text: `This downloads ${QLORA_MODEL}, about 4 GB, and stores its weights in 4-bit NF4, which is what makes this QLoRA rather than LoRA: roughly 2 GB of GPU memory instead of about 4. The weights stay frozen. LoRA then adds rank-16 matrices beside every linear layer, and only those train. On a CPU there is no 4-bit step and the model loads in full precision, much more slowly.`,
        code: `import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

MODEL = ${py(QLORA_MODEL)}
tokenizer = AutoTokenizer.from_pretrained(MODEL)
if device == "cuda":
    # A T4 has no fast bfloat16, so the 4-bit weights compute in float16.
    quant = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True)
    base = AutoModelForCausalLM.from_pretrained(MODEL, quantization_config=quant, device_map={"": 0})
    base = prepare_model_for_kbit_training(base)
else:
    base = AutoModelForCausalLM.from_pretrained(MODEL)

lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, task_type="CAUSAL_LM",
                  target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
model = get_peft_model(base, lora)
model.print_trainable_parameters()
if device == "cuda":
    print(f"GPU memory in use: {torch.cuda.memory_allocated() / 1e9:.1f} GB")`,
        expect: 'trainable params of about 17 million out of about 1.7 billion, around 1%, and roughly 2 GB of GPU memory in use.',
      },
      {
        title: 'Measure the prompt-only baseline',
        text: `Before training, ask the model to label each test row from the instruction alone. A new LoRA adapter starts as an exact no-op, so this is the base model’s score. Freeze it: every later number is compared with it, and with the majority baseline, which always answers the commonest label.`,
        code: `import time

SYSTEM = ("You label ${seed.noun} for ${p.company}, a fictional company, by ${seed.target}. "
          "Answer with exactly one label and nothing else. Labels: " + ", ".join(LABELS) + ".")

def prompt(text):
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}]
    return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)

@torch.no_grad()
def generate(text, max_new_tokens=8):
    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    output = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False, pad_token_id=tokenizer.eos_token_id)
    return tokenizer.decode(output[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()

def accuracy(rows):
    model.eval()
    right = sum(generate(prompt(text)).lower().startswith(label.lower()) for text, label in rows)
    return right / len(rows)

PROBES = ${pythonList(GENERAL_PROBES)}

def general_answers():
    model.eval()
    out = []
    for q in PROBES:
        messages = [{"role": "user", "content": q}]
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        out.append(generate(text, max_new_tokens=40))
    return out

start = time.perf_counter()
majority = Counter(label for _, label in train).most_common(1)[0]
baseline = accuracy(test)
print(f"Majority baseline (always '{majority[0]}'): {sum(l == majority[0] for _, l in test) / len(test):.0%}")
print(f"Prompt-only baseline: {baseline:.0%}   ({time.perf_counter() - start:.0f} s)")`,
        expect: 'Two percentages. A prompt-only score near or below the majority baseline is common for a small model on invented labels.',
      },
      {
        title: 'Train the adapter',
        text: 'Each training example is the same prompt followed by the right label. The loss counts only the label’s tokens, so the model learns to answer, not to repeat the text. Two passes over the training rows, eight at a time; expect a few minutes on a T4. The loss should fall and level off.',
        code: `EPOCHS, BATCH, LR = 2, 8, 2e-4

def example(text, label):
    p = tokenizer(prompt(text), add_special_tokens=False)["input_ids"]
    a = tokenizer(label + tokenizer.eos_token, add_special_tokens=False)["input_ids"]
    return p + a, [-100] * len(p) + a

def batches(rows):
    for i in range(0, len(rows), BATCH):
        pairs = [example(t, l) for t, l in rows[i:i + BATCH]]
        width = max(len(ids) for ids, _ in pairs)
        pad = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else tokenizer.eos_token_id
        ids = torch.tensor([x + [pad] * (width - len(x)) for x, _ in pairs])
        labels = torch.tensor([y + [-100] * (width - len(y)) for _, y in pairs])
        mask = torch.tensor([[1] * len(x) + [0] * (width - len(x)) for x, _ in pairs])
        yield ids.to(model.device), labels.to(model.device), mask.to(model.device)

optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=LR)
scaler = torch.amp.GradScaler("cuda", enabled=device == "cuda")
model.train()
step, start = 0, time.perf_counter()
for epoch in range(EPOCHS):
    random.Random(epoch).shuffle(train)
    for ids, labels, mask in batches(train):
        with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
            loss = model(input_ids=ids, attention_mask=mask, labels=labels).loss
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
        optimizer.zero_grad()
        step += 1
        if step % 10 == 0:
            print(f"epoch {epoch + 1} step {step}: loss {loss.item():.3f}")
print(f"Trained {step} steps in {time.perf_counter() - start:.0f} s")`,
        expect: 'A loss that starts above 1 and falls well below it, and the time taken.',
      },
      {
        title: 'Measure the gain, the regressions and memorisation',
        text: 'Three checks from this chapter. The domain gain is the test score against the frozen baselines. The general answers are compared with the adapter switched off and on: they should mean the same thing. And the score on the training rows against the test rows: a much higher training score means the adapter memorised rows instead of learning the task.',
        code: `after = accuracy(test)
seen = accuracy(train[:len(test)])
print(f"Test:  prompt-only {baseline:.0%}  ->  with adapter {after:.0%}")
print(f"Train rows {seen:.0%} vs test rows {after:.0%}: a big gap means memorisation")

with model.disable_adapter():
    off = general_answers()
on = general_answers()
for q, b, a in zip(PROBES, off, on):
    print(f"\\nQ: {q}\\n  adapter off: {b}\\n  adapter on:  {a}")`,
        expect: 'A higher test score than the prompt-only baseline. General answers may now come out short or label-like: that is a regression to judge before any release.',
      },
      {
        title: 'Save the adapter and reload it',
        text: 'The adapter is the only thing you trained, so it is all you need to keep: a few tens of megabytes beside a base model you can download again. Reloading it onto a fresh copy of the base and scoring again proves the saved file is the model you measured.',
        code: `model.save_pretrained("adapter")
!du -sh adapter

from peft import PeftModel
del model
torch.cuda.empty_cache() if device == "cuda" else None
if device == "cuda":
    fresh = AutoModelForCausalLM.from_pretrained(MODEL, quantization_config=quant, device_map={"": 0})
else:
    fresh = AutoModelForCausalLM.from_pretrained(MODEL)
model = PeftModel.from_pretrained(fresh, "adapter")
print(f"Reloaded adapter, test score {accuracy(test):.0%} (was {after:.0%})")`,
        expect: 'An adapter folder of some tens of MB, and the same test score after reloading, give or take a row.',
      },
    ],
    { torch: true, kept: 'To keep the adapter, open the Files panel on the left, right-click the adapter folder’s files and download them, or copy them to Google Drive.' },
  )
}

/** A Python list literal of strings. */
function pythonList(items: string[]): string {
  return `[${items.map(py).join(', ')}]`
}

export const QLORA: GuideDef<QloraSeed> = {
  id: 'qlora',
  section: '13.3',
  title: 'QLoRA fine-tuning on a GPU',
  fileStem: 'qlora-fine-tune',
  load: loadQloraSeed,
  source: (seed) => ({ files: [seed.file], note: `The code below carries these ${seed.rows.length} ${seed.noun} and their ${seed.target} labels.` }),
  steps: qloraSteps,
  limits: (p) =>
    `You will fine-tune a real 1.7B model with QLoRA and measure the gain, a regression check and memorisation on held-out rows. It does not show that the adapter is ready to ship: the test set is small, the general check is four questions, and ${p.company}’s labels are invented and sometimes noisy. A release needs the chapter 13 lab’s full scorecard. Times depend on the GPU Colab gives you.`,
  links: [
    { label: `${QLORA_MODEL} model card`, href: QLORA_MODEL_CARD },
    { label: 'PEFT documentation', href: 'https://huggingface.co/docs/peft' },
    { label: 'bitsandbytes 4-bit quantisation', href: 'https://huggingface.co/docs/transformers/quantization/bitsandbytes' },
  ],
}
