/**
 * F.1: the Transformer of Vaswani et al. (2017), told stage by stage. Neutral: it reads no project data. Every number is the
 * paper's own, with the section or table it comes from. Pure.
 */
import type { Story, WalkStep } from '../story.ts'

export const PAPER_TRANSFORMER: Story<null> = {
  id: 'paper-transformer',
  section: 'F.1',
  title: 'The original Transformer, one sentence through the model',
  nodes: [
    { id: 'tokens', label: 'Input words', x: 60, y: 70 },
    { id: 'embed', label: 'Vectors + positions', x: 200, y: 70 },
    { id: 'encoder', label: 'Encoder × 6', x: 340, y: 70 },
    { id: 'decoder', label: 'Decoder × 6', x: 480, y: 160 },
    { id: 'softmax', label: 'Next-word odds', x: 340, y: 240 },
    { id: 'output', label: 'Output word', x: 200, y: 240 },
  ],
  edges: [
    { from: 'tokens', to: 'embed' }, { from: 'embed', to: 'encoder' }, { from: 'encoder', to: 'decoder' },
    { from: 'decoder', to: 'softmax' }, { from: 'softmax', to: 'output' }, { from: 'output', to: 'decoder' },
  ],
  load: () => Promise.resolve(null),
  files: () => [],
  note: () => 'The sizes and scores come from the paper (sections and tables named in each step). Nothing on this page was run by the course.',
  steps: (): WalkStep[] => [
    {
      title: 'Words become vectors, and each gets a position',
      text: 'Each input word piece is turned into a list of 512 numbers (section 3.4, 3.1). Attention has no sense of order by itself, so the paper adds a fixed pattern of sine and cosine waves that tells each position where it sits (section 3.5). A learned position table did almost as well (Table 3, row E).',
      nodes: ['tokens', 'embed'],
      edges: [['tokens', 'embed']],
    },
    {
      title: 'Encoder: every word looks at every other word',
      text: 'In self-attention each position scores every position in the sentence, then mixes their information by those scores (section 3.2). The base model does this with 8 heads at once, each working in 64 numbers, so the model can follow several relations in parallel (section 3.2.2).',
      nodes: ['embed', 'encoder'],
      edges: [['embed', 'encoder']],
    },
    {
      title: 'Feed-forward layer, residual path, normalisation, and six layers',
      text: 'After attention, each position passes through a small two-layer network 2,048 wide (section 3.3). Both parts sit inside a skip connection followed by layer normalisation (section 3.1). The encoder is six such layers stacked (section 3.1).',
      nodes: ['encoder'],
      detail: {
        kind: 'table',
        caption: 'Table 3 of the paper: the base model and the big model',
        head: ['', 'Base', 'Big'],
        rows: [['Layers each side', 6, 6], ['Model width', 512, 1024], ['Feed-forward width', 2048, 4096], ['Attention heads', 8, 16], ['Parameters', '65 million', '213 million']],
      },
    },
    {
      title: 'Decoder: write the answer one word at a time, without peeking ahead',
      text: 'The decoder has its own self-attention, but each position may only look at itself and earlier words: later positions are blocked before the softmax so the model cannot copy the answer it is supposed to predict (section 3.2.3).',
      nodes: ['decoder', 'output'],
      edges: [['output', 'decoder']],
    },
    {
      title: 'Decoder reads the encoder through cross-attention',
      text: 'A second attention step in each decoder layer takes its questions from the decoder and its keys and values from the encoder output, so every output word can look at the whole input sentence (section 3.2.3).',
      nodes: ['encoder', 'decoder'],
      edges: [['encoder', 'decoder']],
    },
    {
      title: 'Scores become odds, and one word is chosen',
      text: 'A final linear layer and a softmax turn the decoder state into a probability for every word in the vocabulary (section 3.4). The chosen word is fed back in as the next decoder input, and the loop repeats until the sentence ends.',
      nodes: ['decoder', 'softmax', 'output'],
      edges: [['decoder', 'softmax'], ['softmax', 'output']],
    },
  ],
}
