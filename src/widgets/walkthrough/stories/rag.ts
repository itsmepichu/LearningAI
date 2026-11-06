/**
 * 9.1: one RAG request end to end, with the selected project's question and documents. The keyword ranking is real
 * (the BM25 engine of 9.3 over the project's dataset); the dense and hybrid rankings and the relevance grades are the
 * hand-made ones of the 9.7 figure, and are labelled as such. Token counts use the 1.4 estimator. Pure.
 */
import type { Project } from '../../../data/projects'
import type { DataReader } from '../../kit'
import { buildIndex, search, tokenize } from '../../bm25/engine.ts'
import { loadCorpus, type Corpus } from '../../bm25/corpus.ts'
import { COMPARE } from '../../retriever-compare/scenarios.ts'
import { estimateTokens } from '../../token-estimator/estimate.ts'
import { short, type Story, type WalkStep } from '../story.ts'

interface HarborPolicy {
  id: string
  access_groups: string[]
  current: boolean
}

export interface RagSeed {
  corpus: Corpus
  question: string
  bm25: { id: string; score: number; matched: string[] }[]
  hybrid: string[]
  grades: Record<string, number>
  /** Harbor only: which documents a support agent may not see, and how many old revisions were left out. */
  harbor?: { hidden: string[]; old: number; group: string }
}

export async function loadRag(p: Project, read: DataReader): Promise<RagSeed> {
  const corpus = await loadCorpus(p, read)
  const sc = COMPARE[p.id]
  const ix = buildIndex(corpus.docs)
  const bm25 = search(ix, sc.query)
    .filter((h) => h.score > 0)
    .slice(0, 5)
    .map((h) => ({ id: corpus.docs[h.index].id, score: h.score, matched: h.matched }))
  let harbor: RagSeed['harbor']
  if (p.id === 'harbor') {
    const raw = await read.json<HarborPolicy[]>('policies.json')
    const group = 'support'
    const hidden = raw.filter((d) => d.current && !d.access_groups.includes(group) && !d.access_groups.includes('all-staff')).map((d) => d.id)
    harbor = { hidden, old: raw.filter((d) => !d.current).length, group }
  }
  return { corpus, question: sc.query, bm25, hybrid: sc.hybrid, grades: sc.grades, harbor }
}

const SYSTEM = 'Answer only from the documents below. Cite each claim with its document id in brackets. If the documents do not answer the question, say so.'

export const RAG: Story<RagSeed> = {
  id: 'rag',
  section: '9.1',
  title: 'One RAG request, end to end',
  nodes: [
    { id: 'user', label: 'Question', x: 60, y: 60 },
    { id: 'rewrite', label: 'Rewrite', x: 190, y: 60 },
    { id: 'retrieve', label: 'Retrieve', x: 320, y: 60 },
    { id: 'filter', label: 'Filter', x: 450, y: 60 },
    { id: 'rerank', label: 'Rerank', x: 580, y: 60 },
    { id: 'assemble', label: 'Assemble', x: 580, y: 200 },
    { id: 'generate', label: 'Generate', x: 450, y: 200 },
    { id: 'check', label: 'Check', x: 320, y: 200 },
    { id: 'answer', label: 'Answer', x: 190, y: 200 },
  ],
  edges: [
    { from: 'user', to: 'rewrite' }, { from: 'rewrite', to: 'retrieve' }, { from: 'retrieve', to: 'filter' }, { from: 'filter', to: 'rerank' },
    { from: 'rerank', to: 'assemble' }, { from: 'assemble', to: 'generate' }, { from: 'generate', to: 'check' }, { from: 'check', to: 'answer' },
  ],
  load: loadRag,
  files: (s) => [s.corpus.file],
  note: (p) =>
    `The keyword ranking and the token counts are computed from ${p.company}’s dataset in your browser. The dense and hybrid rankings and the relevance grades are the hand-made ones from 9.7, and no model writes an answer here: the walkthrough shows what each stage receives and passes on.`,
  steps: (p, s): WalkStep[] => {
    const docOf = (id: string) => s.corpus.docs.find((d) => d.id === id)
    const top = Object.entries(s.grades).sort((a, b) => b[1] - a[1]).map(([id]) => id)
    const kept = s.hybrid.filter((id) => !s.harbor?.hidden.includes(id)).slice(0, 5)
    const reranked = [...kept].sort((a, b) => (s.grades[b] ?? 0) - (s.grades[a] ?? 0))
    const context = reranked.slice(0, 3)
    const contextText = context.map((id) => `[${id}] ${docOf(id)?.title ?? id}: ${docOf(id)?.body ?? ''}`).join('\n')
    const tokens = { system: estimateTokens(SYSTEM), docs: estimateTokens(contextText), question: estimateTokens(s.question) }
    const terms = [...new Set(tokenize(s.question))]
    return [
      {
        title: 'A question arrives',
        text: `A user asks ${p.assistant}: “${s.question}”. The words are everyday ones, not necessarily the words ${p.company}’s ${s.corpus.noun} use, which is why retrieval needs more than one method.`,
        nodes: ['user'],
      },
      {
        title: 'Rewrite it into search terms',
        text: `The request is normalised before search: lower case, stop words dropped, plurals stripped. ${terms.length} terms remain. A production system may also ask a model to rewrite a vague or follow-up question (“what about the annual one?”) into a complete one, using the conversation so far.`,
        nodes: ['rewrite'],
        edges: [['user', 'rewrite']],
        detail: { kind: 'code', label: 'Search terms', text: terms.join(' · ') },
      },
      {
        title: 'Retrieve candidates two ways',
        text: `Keyword search (BM25, run for real over ${s.corpus.docs.length} ${s.corpus.noun}) finds documents that share the question's words. Dense search finds documents with similar meaning, and the two lists are fused into one (hybrid retrieval, 9.5). Here the keyword list is computed; the hybrid list is the hand-made one from the 9.7 figure.`,
        nodes: ['retrieve'],
        edges: [['rewrite', 'retrieve']],
        detail: {
          kind: 'table',
          caption: 'Keyword search, top results (computed)',
          head: ['Document', 'BM25 score', 'Matched terms'],
          rows: s.bm25.length ? s.bm25.map((h) => [h.id, h.score.toFixed(2), h.matched.join(', ')]) : [['none', '0', 'no shared words']],
        },
      },
      {
        title: 'Filter what this user may see',
        text: s.harbor
          ? `Before anything reaches the model, documents this user may not read are removed. For a support agent (group “${s.harbor.group}”), ${s.harbor.hidden.length} current ${p.company} policies are off limits, and ${s.harbor.old} outdated revisions were never indexed. Filtering after generation would be too late: the model would already have read them.`
          : `Before anything reaches the model, documents this user may not read, or that are out of date, are removed by metadata filters. ${p.company}’s ${s.corpus.noun} in this dataset are public to its customers, so nothing is removed here; with per-user data (an account's own orders, cases or bookings) the filter would use the user's identity, never the model's judgement.`,
        nodes: ['filter'],
        edges: [['retrieve', 'filter']],
        detail: s.harbor ? { kind: 'code', label: 'Hidden from this user', text: s.harbor.hidden.join(', ') || 'none' } : undefined,
      },
      {
        title: 'Rerank the survivors',
        text: `A reranker reads the question and each candidate together and scores how well the candidate answers it, which is slower than retrieval but sharper. Here the hand-made relevance grades from 9.7 stand in for its scores: ${top[0]} is the best answer.`,
        nodes: ['rerank'],
        edges: [['filter', 'rerank']],
        detail: {
          kind: 'table',
          caption: 'After reranking (grades from the 9.7 figure, illustrative)',
          head: ['Rank', 'Document', 'Relevance grade'],
          rows: reranked.map((id, i) => [i + 1, `${id}: ${short(docOf(id)?.title ?? '', 40)}`, s.grades[id] ?? 0]),
        },
      },
      {
        title: 'Assemble the context',
        text: `The top three documents go into the prompt with their ids, after the instructions and before the question: about ${tokens.system + tokens.docs + tokens.question} tokens in all (instructions ${tokens.system}, documents ${tokens.docs}, question ${tokens.question}, by the 1.4 estimator). The ids are what make citations checkable later.`,
        nodes: ['assemble'],
        edges: [['rerank', 'assemble']],
        detail: { kind: 'code', label: 'The prompt, in order', text: `${SYSTEM}\n\n${contextText}\n\nQuestion: ${s.question}` },
      },
      {
        title: 'Generate an answer with citations',
        text: `The model writes an answer from the documents and cites them, for example “… [${context[0]}]”. It is asked to say when the documents do not answer the question rather than fill the gap from what it learned in training.`,
        nodes: ['generate'],
        edges: [['assemble', 'generate']],
      },
      {
        title: 'Check before showing it',
        text: `Code, not the model, checks the draft: every cited id must be one of the ${context.length} documents in the prompt (${context.join(', ')}), and an answer with no citation, or one citing a document that was not retrieved, is replaced by an abstention or a hand-off to a person. These checks are cheap and catch the most damaging failures.`,
        nodes: ['check'],
        edges: [['generate', 'check']],
      },
      {
        title: 'Answer, and log what happened',
        text: `The user sees the answer with links to the cited documents. The log keeps the question, the retrieved and filtered ids, the prompt version and the answer, so a bad answer can be traced to the stage that caused it: retrieval missed, the filter hid too much, or the model ignored the context.`,
        nodes: ['answer'],
        edges: [['check', 'answer']],
      },
    ]
  },
}
