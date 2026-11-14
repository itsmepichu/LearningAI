/**
 * 19.2: a vision-language model on a free T4, reading an image made from the selected project's own text. It makes the image
 * with Pillow from one labelled message, counts the visual tokens at three resolutions, scores how much of the text the
 * model recovers at each, and asks one question whose answer is not in the picture.
 */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'
import { loadLabelled, type LabelledSet } from '../text-classifier/examples.ts'
import { py, withSetup, type GuideDef, type GuideStep } from './notebook.ts'

export const VLM_MODEL = 'Qwen/Qwen2-VL-2B-Instruct'
export const VLM_MODEL_CARD = 'https://huggingface.co/Qwen/Qwen2-VL-2B-Instruct'

export interface VlmSeed {
  file: string
  noun: string
  text: string
  id: string
}

/** One short row to draw: long enough to be worth reading, short enough to fit on one picture. */
export async function loadVlmSeed(p: Project, read: DataReader): Promise<VlmSeed> {
  const set: LabelledSet = await loadLabelled(p, read)
  const row = set.rows.find((r) => r.text.length >= 50 && r.text.length <= 200) ?? set.rows[0]
  return { file: set.file, noun: set.noun, text: row.text, id: row.id }
}

export function vlmSteps(p: Pick<Project, 'company'>, seed: VlmSeed): GuideStep[] {
  return withSetup(
    [
      {
        title: 'Install the libraries',
        text: 'Transformers loads the model and Pillow draws the picture. The version range keeps you on the 4.x releases this guide was written for. If pip warns about conflicts with other packages, carry on: they are not used here.',
        code: `!pip install -q "transformers>=4.56,<5" accelerate pillow`,
      },
      {
        title: `Draw one of ${p.company}’s ${seed.noun} as a picture`,
        text: `A vision-language model reads pixels, so the text has to become an image first. This draws row ${seed.id} of ${seed.file} in black type on white, like a screenshot of a message. It is the easiest case: clean type and no photo noise. Real scans are harder.`,
        code: `from PIL import Image, ImageDraw, ImageFont
from matplotlib import font_manager
import textwrap

TEXT = ${py(seed.text)}
font = ImageFont.truetype(font_manager.findfont("DejaVu Sans"), 30)

lines = textwrap.wrap(TEXT, width=38)
image = Image.new("RGB", (900, 70 + 44 * len(lines)), "white")
draw = ImageDraw.Draw(image)
draw.text((30, 20), "${p.company} · message", fill=(90, 90, 90), font=font)
for i, line in enumerate(lines):
    draw.text((30, 70 + 44 * i), line, fill="black", font=font)
print(image.size)
image`,
        expect: 'The size of the image, then the picture itself with the message in it.',
      },
      {
        title: 'Load the vision-language model',
        text: `This downloads ${VLM_MODEL}, about 4.5 GB, to Colab’s machine and loads it in float16, the T4’s fast format. It has two parts you will see in the printout: a vision encoder that turns the picture into tokens, and a language model that reads them.`,
        code: `import torch
from transformers import AutoProcessor, AutoModelForImageTextToText

MODEL = ${py(VLM_MODEL)}
processor = AutoProcessor.from_pretrained(MODEL)
model = AutoModelForImageTextToText.from_pretrained(MODEL, dtype=torch.float16, device_map={"": 0} if device == "cuda" else None)
print("Loaded", MODEL, "with", round(model.num_parameters() / 1e9, 2), "billion parameters")
if device == "cuda":
    print(f"GPU memory in use: {torch.cuda.memory_allocated() / 1e9:.1f} GB")`,
        expect: 'About 2.2 billion parameters and roughly 4.5 GB of GPU memory in use.',
      },
      {
        title: 'Write a function that asks about an image',
        text: 'The prompt holds an image slot and a question. The processor cuts the picture into patches, the model merges each group of four patches into one visual token, and those tokens go into the prompt like words. The function also reports how many visual tokens the picture became and how long the answer took.',
        code: `import time

def ask(img, question, max_new_tokens=160):
    messages = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": question}]}]
    text = processor.apply_chat_template(messages, add_generation_prompt=True)
    inputs = processor(text=[text], images=[img], return_tensors="pt").to(model.device)
    visual_tokens = int(inputs["image_grid_thw"][0].prod()) // 4
    start = time.perf_counter()
    with torch.no_grad():
        out = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
    seconds = time.perf_counter() - start
    answer = processor.batch_decode(out[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0].strip()
    return answer, visual_tokens, seconds

answer, tokens, seconds = ask(image, "Transcribe all the text in this image.")
print(f"{tokens} visual tokens, {seconds:.1f} s")
print(answer)`,
        expect: 'A visual-token count of a few hundred and an answer that is close to the original message. Compare it with the text above by eye.',
      },
      {
        title: 'Shrink the picture and watch tokens and readability',
        text: 'The same picture at three widths. Smaller means fewer visual tokens, so the prompt is cheaper and faster, but the type becomes harder to read. The score is the share of the original words the model got back. This is the trade-off behind every image-resolution setting.',
        code: `import re

def words(s):
    return set(re.findall(r"[a-z0-9']+", s.lower()))

original = words(TEXT)
print(f"{'width':>6} {'visual tokens':>14} {'seconds':>8} {'words recovered':>16}")
for width in (225, 450, 900):
    small = image.resize((width, round(image.height * width / image.width)))
    answer, tokens, seconds = ask(small, "Transcribe all the text in this image.")
    recall = len(original & words(answer)) / len(original)
    print(f"{width:>6} {tokens:>14} {seconds:>8.1f} {recall:>16.0%}")`,
        expect: 'Visual tokens rising roughly fourfold with each doubling of the width, and the share of words recovered falling at the smallest size.',
      },
      {
        title: 'Ask about something that is not in the picture',
        text: 'A model should say when the image does not hold the answer. Ask for an order number and a price: a plain message has neither. If the answer invents one, that is a visual hallucination, and the reason to check outputs against the source rather than trust them.',
        code: `for question in ("What is the order number shown in the image? If it is not shown, answer 'not shown'.",
                 "What price in euros is shown in the image? If it is not shown, answer 'not shown'."):
    answer, tokens, seconds = ask(image, question, max_new_tokens=40)
    print(question.split("?")[0] + "?")
    print("  ->", answer)`,
        expect: `A good run says "not shown" twice, unless the message itself mentions a number or price. A made-up number is the failure to look for. A small model can do either, and one row proves little.`,
      },
    ],
    { torch: true },
  )
}

export const VLM: GuideDef<VlmSeed> = {
  id: 'vlm',
  section: '19.2',
  title: 'A vision-language model on a real GPU',
  fileStem: 'vision-language-model',
  load: loadVlmSeed,
  source: (seed) => ({ files: [seed.file], note: `The code below draws row ${seed.id} (${seed.text.length} characters) as an image.` }),
  steps: vlmSteps,
  limits: (p) =>
    `You will see how a picture becomes visual tokens, how resolution changes their number, the time and how much text comes back, and what the model says about something absent. It does not show how well this model reads real scans, tables or photos: the picture is clean type drawn by the notebook, there is one image and a handful of questions, and ${p.company}’s text is invented. Speeds depend on the GPU Colab gives you.`,
  links: [
    { label: `${VLM_MODEL} model card`, href: VLM_MODEL_CARD },
    { label: 'Transformers: image-text-to-text', href: 'https://huggingface.co/docs/transformers/tasks/image_text_to_text' },
  ],
}
