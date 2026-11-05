/**
 * 6.7: train nanoGPT's character-level Shakespeare model at its full GPU size, the recipe whose shrunken CPU version is
 * the laptop lab on the same page. Neutral: pretraining from scratch needs no project data.
 */
import { withSetup, type GuideDef, type GuideStep } from './notebook.ts'

export const NANOGPT_REPO = 'https://github.com/karpathy/nanoGPT'
/** Pinned so the flags below keep working. Checked on 5 November 2026. */
export const NANOGPT_COMMIT = '3adf61e154c3fe3fca428ad6bc3818b27a3b8291'
const DIR = '/content/nanoGPT'
const OUT = 'out-shakespeare-char'

/**
 * The README's GPU config (10.7M parameters, 5,000 steps, about 3 minutes on an A100), cut to 2,000 steps with lighter
 * evaluation so it fits a free T4. float16 because a T4 has no fast bfloat16, and no torch.compile, which would spend
 * minutes compiling before the first step.
 */
export const TRAIN_FLAGS = ['--dtype=float16', '--compile=False', '--max_iters=2000', '--lr_decay_iters=2000', '--eval_iters=50']

export function trainGptSteps(): GuideStep[] {
  return withSetup(
    [
      {
        title: 'Get nanoGPT',
        text: `This copies nanoGPT, a small and readable GPT training codebase, onto Colab’s machine, at the exact version this guide was written against, so the commands below keep working. tiktoken is only needed by its sampling script.`,
        code: `!git clone -q ${NANOGPT_REPO} ${DIR}
%cd ${DIR}
!git checkout -q ${NANOGPT_COMMIT}
!pip install -q tiktoken
!ls`,
        expect: 'A list of files including model.py, train.py, sample.py and the config and data folders.',
      },
      {
        title: 'Prepare the data',
        text: 'This downloads the Tiny Shakespeare text (about 1 MB), maps each of its characters to an integer, and writes a training split and a validation split. Every character is one token, so the vocabulary is tiny.',
        code: `!python data/shakespeare_char/prepare.py`,
        expect: 'About 1.1 million characters, a vocabulary of 65, and roughly 1.0 million training and 0.1 million validation tokens.',
      },
      {
        title: 'Train on the GPU',
        text: `This is the same recipe as the laptop lab, at full size: 6 layers, 6 heads, 384-dimensional embeddings and 256 characters of context, about 10.7 million parameters. It trains for 2,000 steps instead of the README’s 5,000 so it fits a free session; expect roughly 10 to 20 minutes on a T4. Each line shows the step, the training loss, the time per step and mfu, the share of the GPU’s peak arithmetic in use. Every 250 steps it reports training and validation loss and saves the model when validation loss improves.`,
        code: `!python train.py config/train_shakespeare_char.py ${TRAIN_FLAGS.join(' ')}`,
        expect: 'Loss starting near 4.2 (about ln 65, uniform guessing) and falling to roughly 1.5–1.7 on validation. A warning about GradScaler being deprecated is harmless.',
      },
      {
        title: 'Sample from it',
        text: 'This loads the best checkpoint and writes three samples. Compare them with the laptop lab’s samples (validation loss about 1.88): lower loss shows up as real words, names and line structure.',
        code: `!python sample.py --out_dir=${OUT} --dtype=float16 --num_samples=3 --max_new_tokens=300`,
        expect: 'Text laid out like a play, with speaker names and mostly real words that do not make sense together.',
      },
      {
        title: 'Time the same model on the CPU',
        text: 'Twenty steps of the same 10.7M-parameter model on Colab’s CPU, for a sense of what the GPU buys you. Compare the time per step with the GPU run. This writes to its own folder, so it leaves your trained model alone.',
        code: `!python train.py config/train_shakespeare_char.py --device=cpu --dtype=float32 --compile=False --max_iters=20 --eval_iters=1 --log_interval=5 --out_dir=out-cpu-timing`,
        expect: 'A few log lines, each step taking seconds rather than a fraction of a second.',
      },
      {
        title: 'Run one experiment',
        text: 'Change one setting, keep the rest, and compare the validation loss at the same step. This run halves the depth and raises the learning rate; try your own, such as --block_size=64 or --dropout=0.0. Keep each run’s out_dir separate, and write down what you changed and what happened.',
        code: `!python train.py config/train_shakespeare_char.py ${TRAIN_FLAGS.join(' ')} --n_layer=3 --learning_rate=3e-3 --out_dir=out-experiment`,
        expect: 'A different loss curve. A change that lowers training loss but not validation loss is overfitting.',
      },
    ],
    { torch: true, kept: 'Copy the loss lines and samples you want to keep into a note first.' },
  )
}

/** Nothing to load: an empty object, because the data gate waits while data is null. */
export const TRAIN_GPT: GuideDef<Record<string, never>> = {
  id: 'train-gpt',
  section: '6.7',
  title: 'Train a small GPT on a GPU',
  fileStem: 'train-a-small-gpt',
  neutral: true,
  load: async () => ({}),
  steps: () => trainGptSteps(),
  limits: () =>
    'You will train a real transformer from scratch and see loss, speed and sample quality move together. It does not show what training a useful model costs: this one has about 10.7 million parameters and learns from 1 MB of text, while assistant models have billions and learn from trillions of tokens on many GPUs. Times depend on the GPU Colab gives you.',
  links: [
    { label: 'nanoGPT', href: NANOGPT_REPO },
    { label: 'PyTorch automatic mixed precision', href: 'https://docs.pytorch.org/docs/stable/amp.html' },
  ],
}
