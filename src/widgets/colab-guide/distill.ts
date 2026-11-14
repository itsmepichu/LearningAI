/**
 * 20.3: logit distillation on a free T4. A 1.7B teacher and a 0.6B student from the same family share one vocabulary, so the
 * student can be trained to match the teacher's whole next-token distribution on the selected project's labelled rows, with
 * the hard label blended in. It reports the student before and after, the teacher, and how often the student's first token
 * agrees with the teacher's.
 */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { py, withSetup, type GuideDef, type GuideStep } from './notebook.ts'
import { loadQloraSeed, pythonRows, type QloraSeed } from './qlora.ts'

export const TEACHER = 'Qwen/Qwen3-1.7B'
export const STUDENT = 'Qwen/Qwen3-0.6B'
export const DISTILL_CARD = 'https://huggingface.co/Qwen/Qwen3-0.6B'

export type DistillSeed = QloraSeed
export const loadDistillSeed = (p: Project, read: DataReader): Promise<DistillSeed> => loadQloraSeed(p, read)

export function distillSteps(p: Pick<Project, 'company'>, seed: DistillSeed): GuideStep[] {
  return withSetup(
    [
      {
        title: 'Install the libraries',
        text: 'Transformers loads both models and PEFT adds a small trainable adapter to the student. The version ranges keep you on the releases this guide was written for. If pip warns about conflicts with other packages, carry on.',
        code: `!pip install -q "transformers>=4.56,<5" "peft>=0.17,<1" accelerate`,
      },
      {
        title: `Load ${p.company}’s labelled ${seed.noun}`,
        text: `The ${seed.rows.length} ${seed.noun} from ${seed.file}, labelled by ${seed.target}, split once with a fixed seed into training and held-out test rows. The teacher’s probabilities on the training rows are what the student learns from; the test rows are never trained on.`,
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
        expect: 'About three quarters of the rows for training and a quarter for testing, and the count of each label.',
      },
      {
        title: 'Load the teacher and the student',
        text: `The teacher is ${TEACHER} in float16, frozen. The student is ${STUDENT}, a model about a third the size, loaded in float32 with a LoRA adapter on top so only a few million numbers train. Logit distillation needs both to give a score for the same token list, so the guide checks that the vocabularies match.`,
        code: `import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model

tokenizer = AutoTokenizer.from_pretrained(${py(STUDENT)})
teacher = AutoModelForCausalLM.from_pretrained(${py(TEACHER)}, dtype=torch.float16).to(device).eval()
student_base = AutoModelForCausalLM.from_pretrained(${py(STUDENT)}, dtype=torch.float32).to(device)
assert teacher.config.vocab_size == student_base.config.vocab_size, "teacher and student need the same vocabulary"

lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, task_type="CAUSAL_LM",
                  target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
student = get_peft_model(student_base, lora)
student.print_trainable_parameters()
print("Vocabulary size:", teacher.config.vocab_size)
if device == "cuda":
    print(f"GPU memory in use: {torch.cuda.memory_allocated() / 1e9:.1f} GB")`,
        expect: 'About 10 million trainable parameters in the student out of about 600 million, one shared vocabulary size, and roughly 6 GB of GPU memory in use.',
      },
      {
        title: 'Measure the teacher, the student and how often they agree',
        text: `Before training, ask each model to label every test row from the instruction alone. A new LoRA adapter is an exact no-op, so the student’s score is the plain 0.6B model’s. Also record how often the two models start their answer with the same token: that is the agreement distillation should raise.`,
        code: `import time

SYSTEM = ("You label ${seed.noun} for ${p.company}, a fictional company, by ${seed.target}. "
          "Answer with exactly one label and nothing else. Labels: " + ", ".join(LABELS) + ".")

def prompt(text):
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}]
    return tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)

@torch.no_grad()
def generate(model, text, max_new_tokens=8):
    inputs = tokenizer(text, return_tensors="pt").to(device)
    output = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False, pad_token_id=tokenizer.eos_token_id)
    return tokenizer.decode(output[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()

def accuracy(model, rows):
    model.eval()
    return sum(generate(model, prompt(t)).lower().startswith(l.lower()) for t, l in rows) / len(rows)

@torch.no_grad()
def first_tokens(model, rows):
    model.eval()
    ids = []
    for t, _ in rows:
        inputs = tokenizer(prompt(t), return_tensors="pt").to(device)
        ids.append(int(model(**inputs, logits_to_keep=1).logits[0, -1].argmax()))
    return ids

def agreement(a, b):
    return sum(x == y for x, y in zip(a, b)) / len(a)

start = time.perf_counter()
majority = Counter(l for _, l in train).most_common(1)[0]
print(f"Majority baseline (always '{majority[0]}'): {sum(l == majority[0] for _, l in test) / len(test):.0%}")
teacher_score = accuracy(teacher, test)
student_before = accuracy(student, test)
teacher_first = first_tokens(teacher, test)
agree_before = agreement(first_tokens(student, test), teacher_first)
print(f"Teacher {teacher_score:.0%}   student before {student_before:.0%}   agreement before {agree_before:.0%}   ({time.perf_counter() - start:.0f} s)")`,
        expect: 'Four numbers. The teacher usually scores higher than the student, and the student usually agrees with the teacher on only some of the rows.',
      },
      {
        title: 'Train the student on the teacher’s distribution',
        text: 'For each training row the teacher scores every token in the vocabulary for the first word of the answer. Dividing those scores by a temperature of 2 flattens them, so the near-misses show up too: that is the extra information a hard label lacks. The loss is the gap between the two distributions (KL divergence) mixed half and half with the ordinary loss on the true label. Two passes, eight rows at a time; expect a few minutes.',
        code: `import torch.nn.functional as F

EPOCHS, BATCH, LR, TEMP, ALPHA = 2, 8, 2e-4, 2.0, 0.5
tokenizer.padding_side = "left"
label_token = {l: tokenizer(l, add_special_tokens=False)["input_ids"][0] for l in LABELS}

def last_logits(model, texts):
    enc = tokenizer([prompt(t) for t in texts], return_tensors="pt", padding=True, add_special_tokens=False).to(device)
    return model(**enc, logits_to_keep=1).logits[:, -1, :].float()

optimizer = torch.optim.AdamW([p for p in student.parameters() if p.requires_grad], lr=LR)
scaler = torch.amp.GradScaler("cuda", enabled=device == "cuda")
student.train()
step, start = 0, time.perf_counter()
for epoch in range(EPOCHS):
    random.Random(epoch).shuffle(train)
    for i in range(0, len(train), BATCH):
        texts = [t for t, _ in train[i:i + BATCH]]
        hard = torch.tensor([label_token[l] for _, l in train[i:i + BATCH]], device=device)
        with torch.no_grad(), torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
            target = F.softmax(last_logits(teacher, texts) / TEMP, dim=-1)
        with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
            logits = last_logits(student, texts)
        kl = F.kl_div(F.log_softmax(logits / TEMP, dim=-1), target, reduction="batchmean") * TEMP ** 2
        loss = ALPHA * kl + (1 - ALPHA) * F.cross_entropy(logits, hard)
        scaler.scale(loss).backward()
        scaler.step(optimizer)
        scaler.update()
        optimizer.zero_grad()
        step += 1
        if step % 5 == 0:
            print(f"epoch {epoch + 1} step {step}: loss {loss.item():.3f}  KL to teacher {kl.item():.3f}")
print(f"Trained {step} steps in {time.perf_counter() - start:.0f} s")`,
        expect: 'A loss and a KL value that start high and fall, and the time taken. A KL that stays flat means the learning rate or the shared vocabulary is wrong.',
      },
      {
        title: 'Compare the student before and after, and with the teacher',
        text: 'The same three numbers as before. Distillation should pull the student toward the teacher: agreement up, and accuracy somewhere between the old student and the teacher. It cannot beat a teacher that is wrong on a row, and with this few rows the test score moves in steps of a row or two.',
        code: `student_after = accuracy(student, test)
agree_after = agreement(first_tokens(student, test), teacher_first)
print(f"Test accuracy:   student before {student_before:.0%}  ->  after {student_after:.0%}   (teacher {teacher_score:.0%})")
print(f"Agreement with the teacher's first token:  {agree_before:.0%}  ->  {agree_after:.0%}")
print(f"Parameters: student {sum(p.numel() for p in student.parameters()) / 1e6:.0f}M vs teacher {teacher.num_parameters() / 1e9:.1f}B")`,
        expect: 'Agreement usually higher than before. Accuracy often rises toward the teacher’s; a small drop is possible on a small test set and is not proof that distillation failed.',
      },
    ],
    { torch: true, kept: 'To keep the student, run student.save_pretrained("student-adapter") before you disconnect, then download that folder from the Files panel.' },
  )
}

export const DISTILL: GuideDef<DistillSeed> = {
  id: 'distill',
  section: '20.3',
  title: 'Logit distillation on a GPU',
  fileStem: 'logit-distillation',
  load: loadDistillSeed,
  source: (seed) => ({ files: [seed.file], note: `The code below carries these ${seed.rows.length} ${seed.noun} and their ${seed.target} labels.` }),
  steps: distillSteps,
  limits: (p) =>
    `You will distil a 1.7B teacher into a 0.6B student on one next-token distribution and measure the change in accuracy and in agreement with the teacher. It does not show that the student is ready to replace the teacher: the teacher is used as it comes, with no tuning of its own, the test set is small, only the first answer token is matched, and ${p.company}’s labels are invented and sometimes noisy. Times depend on the GPU Colab gives you.`,
  links: [
    { label: `${STUDENT} model card`, href: DISTILL_CARD },
    { label: `${TEACHER} model card`, href: 'https://huggingface.co/Qwen/Qwen3-1.7B' },
    { label: 'Hinton, Vinyals and Dean (2015), Distilling the Knowledge in a Neural Network', href: 'https://arxiv.org/abs/1503.02531' },
  ],
}
