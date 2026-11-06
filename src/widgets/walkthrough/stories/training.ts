/**
 * 6.4: one supervised fine-tuning step, with one of the selected project's labelled messages as the training example.
 * The template, the masking and the token counts (1.4 estimator) are worked out from the dataset; the probabilities and
 * learning rates are illustrative, and labelled so. Pure.
 */
import type { Project } from '../../../data/projects'
import { estimateTokens } from '../../token-estimator/estimate.ts'
import { loadLabelled, type LabelledSet } from '../../text-classifier/examples.ts'
import type { Story, WalkStep } from '../story.ts'

export type TrainingSeed = LabelledSet

/** A ChatML-style template, as many open chat models use: each turn wrapped in role markers. */
export function render(system: string, user: string, assistant: string) {
  return `<|im_start|>system\n${system}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n${assistant}<|im_end|>`
}

export function example(p: Pick<Project, 'company'>, set: LabelledSet) {
  const row = set.rows[0]
  const labels = [...new Set(set.rows.map((r) => r.label))].sort()
  const system = `You label ${set.noun} for ${p.company} by ${set.target}. Reply with JSON. Labels: ${labels.join(', ')}.`
  const answer = JSON.stringify({ [set.target.split(/[ ,]/)[0]]: row.label })
  const prompt = render(system, row.text, '').replace(/<\|im_end\|>$/, '')
  const full = render(system, row.text, answer)
  // The answer tokens include the closing marker, so the model learns to stop.
  const promptTokens = estimateTokens(prompt)
  const answerTokens = estimateTokens(answer) + 1
  return { row, system, answer, full, promptTokens, answerTokens }
}

/** −ln p: the loss on one token the model gave probability p. */
export const tokenLoss = (p: number) => -Math.log(p)

export const TRAINING: Story<TrainingSeed> = {
  id: 'training',
  section: '6.4',
  title: 'One training step, from example to updated weights',
  nodes: [
    { id: 'example', label: 'Example', x: 60, y: 70 },
    { id: 'template', label: 'Chat template', x: 200, y: 70 },
    { id: 'tokens', label: 'Tokens', x: 340, y: 70 },
    { id: 'mask', label: 'Loss mask', x: 480, y: 70 },
    { id: 'forward', label: 'Forward', x: 580, y: 160 },
    { id: 'loss', label: 'Loss', x: 480, y: 240 },
    { id: 'backward', label: 'Backward', x: 340, y: 240 },
    { id: 'update', label: 'Update', x: 200, y: 240 },
  ],
  edges: [
    { from: 'example', to: 'template' }, { from: 'template', to: 'tokens' }, { from: 'tokens', to: 'mask' }, { from: 'mask', to: 'forward' },
    { from: 'forward', to: 'loss' }, { from: 'loss', to: 'backward' }, { from: 'backward', to: 'update' }, { from: 'update', to: 'example' },
  ],
  load: loadLabelled,
  files: (s) => [s.file],
  note: (p) =>
    `The example, its template and the token counts are worked out from ${p.company}’s dataset. The probabilities and learning rates are illustrative; 6.7 and the 13.3 Colab guide run real steps.`,
  steps: (p, set): WalkStep[] => {
    const e = example(p, set)
    const total = e.promptTokens + e.answerTokens
    const pRight = 0.4
    return [
      {
        title: 'One training example',
        text: `Supervised fine-tuning learns from examples of the behaviour you want. Here: one of ${p.company}’s ${set.noun}, “${e.row.text}”, and the answer the model should give, ${e.answer}. A real run uses thousands of these, checked for quality first (6.2).`,
        nodes: ['example'],
      },
      {
        title: 'Render it with the chat template',
        text: 'The conversation is turned into one string with the model’s chat template: role markers around each turn, exactly as the model will see them at inference. Training with one template and serving with another is a classic silent failure.',
        nodes: ['template'],
        edges: [['example', 'template']],
        detail: { kind: 'code', label: 'The rendered example (ChatML-style)', text: e.full },
      },
      {
        title: 'Tokenize',
        text: `The string becomes about ${total} tokens (by the 1.4 estimator): about ${e.promptTokens} for the system prompt and the message, and ${e.answerTokens} for the answer and its end marker. Each token is an integer index into the vocabulary.`,
        nodes: ['tokens'],
        edges: [['template', 'tokens']],
      },
      {
        title: 'Mask the prompt out of the loss',
        text: `Only the answer should be learned, not how to write ${p.company}’s ${set.noun}. So the about ${e.promptTokens} prompt tokens get the label −100, which the loss ignores, and only the ${e.answerTokens} answer tokens count. Including the end marker teaches the model when to stop.`,
        nodes: ['mask'],
        edges: [['tokens', 'mask']],
        detail: {
          kind: 'table',
          caption: 'What each part of the sequence contributes',
          head: ['Part', 'Tokens (about)', 'In the loss?'],
          rows: [['System prompt and message', e.promptTokens, 'no (label −100)'], ['Answer and end marker', e.answerTokens, 'yes']],
        },
      },
      {
        title: 'Forward pass: a prediction at every position',
        text: `The whole sequence goes through the model at once. At every position it outputs a probability for each token in the vocabulary as the next one, so one pass gives ${total} predictions in parallel. This is teacher forcing: each prediction sees the true tokens before it, not the model's own guesses.`,
        nodes: ['forward'],
        edges: [['mask', 'forward']],
      },
      {
        title: 'Loss: how surprised was the model?',
        text: `For each answer token, the loss is −ln of the probability the model gave the right token. If it gave the right label token probability ${pRight}, that token's loss is −ln ${pRight} = ${tokenLoss(pRight).toFixed(2)}; at probability 0.95 it would be ${tokenLoss(0.95).toFixed(2)}. The step's loss is the average over the ${e.answerTokens} unmasked tokens (and over every example in the batch). These probabilities are illustrative.`,
        nodes: ['loss'],
        edges: [['forward', 'loss']],
      },
      {
        title: 'Backward pass: a gradient for every weight',
        text: 'Backpropagation computes how the loss would change with each trainable weight: every weight in full fine-tuning, or only the small LoRA matrices (13.3). It needs the activations saved during the forward pass, which is why training needs far more memory than inference (6.6).',
        nodes: ['backward'],
        edges: [['loss', 'backward']],
      },
      {
        title: 'Update the weights, then the next batch',
        text: 'The optimiser (usually AdamW) moves each weight a small step against its gradient, scaled by the learning rate: often around 1e-5 for full fine-tuning and 1e-4 for LoRA (illustrative starting points, tuned per run), with the gradient norm clipped so one bad batch cannot throw the model off. Then the next batch arrives. Watch training and validation loss together: one falling while the other rises is overfitting.',
        nodes: ['update'],
        edges: [['backward', 'update'], ['update', 'example']],
      },
    ]
  },
}
