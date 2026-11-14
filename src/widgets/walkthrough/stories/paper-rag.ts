/**
 * F.3: retrieval-augmented generation as Lewis et al. (2020) built it, told stage by stage. Neutral: it reads no project data.
 * Every number is the paper's own, with the section or table it comes from. Pure.
 */
import type { Story, WalkStep } from '../story.ts'

export const PAPER_RAG: Story<null> = {
  id: 'paper-rag',
  section: 'F.3',
  title: 'The original RAG model, one question through the system',
  nodes: [
    { id: 'question', label: 'Question', x: 60, y: 70 },
    { id: 'encoder', label: 'Query encoder', x: 200, y: 70 },
    { id: 'index', label: 'Wikipedia index', x: 340, y: 70 },
    { id: 'passages', label: 'Top passages', x: 480, y: 70 },
    { id: 'generator', label: 'BART generator', x: 480, y: 220 },
    { id: 'answer', label: 'Answer', x: 200, y: 220 },
  ],
  edges: [
    { from: 'question', to: 'encoder' }, { from: 'encoder', to: 'index' }, { from: 'index', to: 'passages' },
    { from: 'passages', to: 'generator' }, { from: 'question', to: 'generator' }, { from: 'generator', to: 'answer' },
  ],
  load: () => Promise.resolve(null),
  files: () => [],
  note: () => 'The sizes and scores come from the paper (sections and tables named in each step). Nothing on this page was run by the course.',
  steps: (): WalkStep[] => [
    {
      title: 'The question becomes a vector',
      text: 'A BERT-base encoder turns the question into one vector (section 2.2). The paper calls it the query encoder, and it is one of the two parts that training changes (section 2.4).',
      nodes: ['question', 'encoder'],
      edges: [['question', 'encoder']],
    },
    {
      title: 'Search a fixed index of Wikipedia passages',
      text: 'The index holds 21 million passages of 100 words each, cut from a December 2018 Wikipedia dump and stored as vectors (section 3). The closest ones are found by maximum inner product search, which is a nearest-neighbour search (section 2.2).',
      nodes: ['encoder', 'index'],
      edges: [['encoder', 'index']],
    },
    {
      title: 'Keep the top few passages',
      text: 'During training the model keeps the top 5 or 10 passages (section 3). At test time the number is tuned on dev data: Appendix A reports 15 for the token-level model and 50 for the sequence-level model on question answering.',
      nodes: ['index', 'passages'],
      edges: [['index', 'passages']],
    },
    {
      title: 'The generator reads the question and one passage at a time',
      text: 'BART-large, a model of about 400 million parameters, receives the question and a retrieved passage joined into one input and writes the answer (section 2.3). It generates; it does not copy a span out of the passage.',
      nodes: ['question', 'passages', 'generator'],
      edges: [['passages', 'generator'], ['question', 'generator']],
    },
    {
      title: 'Combine the passages: per answer, or per word',
      text: 'RAG-Sequence picks one passage for the whole answer and adds up the results over the top passages. RAG-Token lets each word of the answer draw on a different passage (section 2.1). On Natural Questions, exact match was 44.5 for RAG-Sequence and 44.1 for RAG-Token, against 41.5 for DPR and 34.5 for a closed-book T5-11B (Table 1).',
      nodes: ['generator', 'answer'],
      edges: [['generator', 'answer']],
    },
    {
      title: 'Training changes the question side and the writer, not the index',
      text: 'The retriever and the generator are trained together, with no label saying which passage is right (section 2.4). The passage encoder and the index stay frozen, so the index is never rebuilt during training; the paper swapped in a newer index later without retraining (section 4.5).',
      nodes: ['encoder', 'generator'],
    },
  ],
}
