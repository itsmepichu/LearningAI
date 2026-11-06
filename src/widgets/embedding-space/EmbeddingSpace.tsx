import { useMemo, useState } from 'react'
import { DataGate, DataSource, Widget, fmt, useProjectData } from '../kit'
import { onRovingKeyDown } from '../../components/common'
import { loadLabelled, type LabelledSet } from '../text-classifier/examples'
import { useCorpusEmbedding } from '../vector-search/useEmbeddings'
import { RealDensePanel } from '../vector-search/RealDensePanel'
import { EMBEDDING_NAME } from '../engines/specs'
import type { Corpus } from '../bm25/corpus'
import type { Project } from '../../data/projects'
import { Scene3D, seriesTone, toneVar } from '../scene3d/Scene3D'
import type { Tone } from '../scene3d/tensor'
import { labelAgreement, pca3, spaceSteps, tfidf, type Vectors } from './space'

const asCorpus = (set: LabelledSet): Corpus => ({
  file: set.file,
  noun: set.noun,
  docs: set.rows.map((r) => ({ id: r.id, title: r.id, body: r.text, text: r.text })),
})

/** 9.3: the project's labelled messages as points, from word counts or, after opting in, real sentence embeddings. */
export default function EmbeddingSpace() {
  const state = useProjectData(loadLabelled)
  return (
    <Widget name="embedding-space">
      <DataGate state={state}>{(set, project) => <Space key={project.id} set={set} project={project} />}</DataGate>
    </Widget>
  )
}

function Space({ set, project }: { set: LabelledSet; project: Project }) {
  const corpus = useMemo(() => asCorpus(set), [set])
  const emb = useCorpusEmbedding(corpus, project.id)
  const [kind, setKind] = useState<'tfidf' | 'dense'>('tfidf')
  const labels = useMemo(() => [...new Set(set.rows.map((r) => r.label))].sort(), [set])
  const labelTones = useMemo(() => new Map<string, Tone>(labels.map((l, i) => [l, seriesTone(i)])), [labels])
  // One example per label to choose from, the first row of each.
  const choices = useMemo(() => labels.map((l) => set.rows.findIndex((r) => r.label === l)), [labels, set])
  const [focus, setFocus] = useState(choices[0])
  const sparse = useMemo(() => tfidf(set.rows.map((r) => r.text)), [set])
  const useDense = kind === 'dense' && !!emb.vectors
  const vectors: Vectors = useDense ? emb.vectors! : sparse.vectors
  const projection = useMemo(() => pca3(vectors), [vectors])
  const agreement = useMemo(() => labelAgreement(vectors, set.rows.map((r) => r.label)), [vectors, set])
  const steps = useMemo(
    () =>
      spaceSteps({
        rows: set.rows, vectors, projection, agreement, focus, labelTones, noun: set.noun, target: set.target,
        kind: useDense ? `the ${EMBEDDING_NAME} embedding model` : 'TF-IDF word counts',
      }),
    [set, vectors, projection, agreement, focus, labelTones, useDense],
  )
  const [step, setStep] = useState(1)
  return (
    <>
      <DataSource project={project} files={[set.file]}>
        {fmt(set.rows.length)} {set.noun}, coloured by {set.target}.
      </DataSource>
      <div className="ctl">
        <div className="seg tabs" role="radiogroup" aria-label="Vectors" onKeyDown={onRovingKeyDown}>
          <button type="button" role="radio" aria-checked={!useDense} tabIndex={!useDense ? 0 : -1} className={!useDense ? 'on' : ''} onClick={() => setKind('tfidf')}>
            Word counts (TF-IDF)
          </button>
          <button type="button" role="radio" aria-checked={useDense} tabIndex={useDense ? 0 : -1} className={useDense ? 'on' : ''} disabled={!emb.vectors} onClick={() => setKind('dense')}>
            Embeddings
          </button>
        </div>
        <div className="seg tabs" role="radiogroup" aria-label="View" onKeyDown={onRovingKeyDown}>
          {['All points', 'One point’s neighbours'].map((t, i) => (
            <button key={t} type="button" role="radio" aria-checked={step === i} tabIndex={step === i ? 0 : -1} className={step === i ? 'on' : ''} onClick={() => setStep(i)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="ctl">
        <label>
          Look closely at{' '}
          <select
            value={focus}
            onChange={(e) => {
              setFocus(+e.target.value)
              setStep(1)
            }}
          >
            {choices.map((i) => (
              <option key={i} value={i}>
                a “{set.rows[i].label}” {set.noun.replace(/s$/, '')}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Scene3D
        steps={steps}
        step={step}
        label={`${set.noun} as points in a vector space, coloured by ${set.target}`}
        legend={
          <>
            {labels.map((l) => (
              <span key={l}>
                <i style={{ background: toneVar(labelTones.get(l)!) }} />
                {l}
              </span>
            ))}
          </>
        }
      />
      <RealDensePanel emb={emb} noun={set.noun} offer={`Place ${project.company}’s ${set.noun} by meaning, with real sentence embeddings`} without="Word counts work without it.">
        <p className="wk-hint">Embeddings are ready: choose Embeddings above to see the same rows placed by a model of meaning instead of shared words.</p>
      </RealDensePanel>
    </>
  )
}
