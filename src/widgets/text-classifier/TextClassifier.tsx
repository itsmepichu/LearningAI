import { useEffect, useId, useMemo, useState } from 'react'
import { BarList, DataGate, DataSource, KpiRow, ScrollRegion, SERIES, Slider, Widget, fmt, pct, useProjectData } from '../kit'
import { EMBEDDING_NAME } from '../engines/specs'
import { LANGUAGE_NAMES } from '../tokenizer-compare/samples'
import { RealDensePanel } from '../vector-search/RealDensePanel'
import { embedQuery, useCorpusEmbedding, type CorpusEmbedding } from '../vector-search/useEmbeddings'
import type { Corpus } from '../bm25/corpus'
import { loadLabelled, type LabelledSet } from './examples'
import { accuracyBy, evaluate, majorityBaseline, predict, predictProba, stratifiedSplit, type Model } from './softmax'

const SEED = 11

/** The widget reuses the corpus embedding path, so its rows take the corpus shape. */
const asCorpus = (set: LabelledSet): Corpus => ({
  file: set.file,
  noun: set.noun,
  docs: set.rows.map((r) => ({ id: r.id, title: r.id, body: r.text, text: r.text })),
})

function Trained({ set, emb, vectors }: { set: LabelledSet; emb: CorpusEmbedding; vectors: number[][] }) {
  const id = useId()
  const [share, setShare] = useState(70)
  const [model, setModel] = useState<{ key: string; model: Model } | null>(null)
  const [text, setText] = useState(set.tryText)
  const [tried, setTried] = useState<{ text: string; vector: number[] } | null>(null)
  useEffect(() => setText(set.tryText), [set])
  const labels = useMemo(() => set.rows.map((r) => r.label), [set])
  const split = useMemo(() => stratifiedSplit(labels, share / 100, SEED), [labels, share])
  const key = `${set.file}:${share}`
  useEffect(() => {
    let live = true
    emb.gate
      .call<Model>('trainSoftmax', { x: split.train.map((i) => vectors[i]), y: split.train.map((i) => labels[i]) })
      .then(
        (m) => {
          if (live) setModel({ key, model: m })
        },
        () => {
          // A stopped worker shows as the gate's own state.
        },
      )
    return () => {
      live = false
    }
  }, [emb.gate, split, vectors, labels, key])
  useEffect(() => {
    const t = text.trim()
    if (!t) return
    let live = true
    const timer = setTimeout(() => {
      embedQuery(emb.gate, t).then(
        (vector) => {
          if (live) setTried({ text: t, vector })
        },
        () => {
          // Keeps the last answer out; the text check below hides it.
        },
      )
    }, 250)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [text, emb.gate])
  const m = model?.key === key ? model.model : null
  const report = useMemo(() => {
    if (!m) return null
    const truth = split.test.map((i) => labels[i])
    const said = split.test.map((i) => predict(m, vectors[i]))
    return {
      truth,
      evaluation: evaluate(truth, said),
      baseline: majorityBaseline(split.train.map((i) => labels[i]), truth),
      languages: accuracyBy(split.test.map((i) => set.rows[i].language), truth, said),
    }
  }, [m, split, labels, vectors, set])
  if (!m || !report) return <p role="status">Training on {fmt(split.train.length)} examples…</p>
  const { evaluation: e, baseline, languages } = report
  const beat = e.accuracy > baseline.accuracy
  const probs = tried && tried.text === text.trim() ? predictProba(m, tried.vector) : null
  return (
    <>
      <Slider label="Share of rows used to train" value={share} min={10} max={90} step={10} onChange={setShare} format={(v) => `${v}%`} />
      <KpiRow
        items={[
          { label: `test accuracy, ${fmt(split.test.length)} held-out rows`, value: pct(e.accuracy), tone: beat ? 'ok' : 'bad' },
          { label: `always answering “${baseline.label}”`, value: pct(baseline.accuracy) },
          { label: 'macro F1', value: fmt(e.macroF1, 3) },
          { label: 'training rows', value: fmt(split.train.length) },
        ]}
      />
      <ScrollRegion label="Precision and recall for each class">
        <table>
          <thead>
            <tr>
              <th>{set.target}</th>
              <th>Test rows</th>
              <th>Precision</th>
              <th>Recall</th>
              <th>F1</th>
            </tr>
          </thead>
          <tbody>
            {e.classes.map((c) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                <td>{fmt(c.support)}</td>
                <td>{pct(c.precision)}</td>
                <td>{pct(c.recall)}</td>
                <td>{fmt(c.f1, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <ScrollRegion label="Accuracy for each language">
        <table>
          <thead>
            <tr>
              <th>Language</th>
              <th>Test rows</th>
              <th>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {languages.map((l) => (
              <tr key={l.group}>
                <td>{LANGUAGE_NAMES[l.group] ?? l.group}</td>
                <td>{fmt(l.n)}</td>
                <td>{pct(l.accuracy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
      <label htmlFor={id} className="wk-q-in">
        Try your own text
        <textarea id={id} value={text} rows={2} onChange={(ev) => setText(ev.target.value)} />
      </label>
      {probs && <BarList max={1} items={m.classes.map((c, i) => ({ label: c, value: probs[i], text: pct(probs[i]), color: SERIES[0] }))} />}
      <p className="wk-hint">
        <b>A real model on invented data.</b> Everything here ran on this device: {EMBEDDING_NAME} turned each row into a vector and a softmax layer was trained on the vectors. This dataset’s text comes from a few templates, so a high score says the templates are easy, not that this would work on real messages. The embedding model was trained mostly on English, which can show in the language table, though small groups give noisy figures, and the probabilities are not calibrated (3.5). A real result needs real, time-split data.{' '}
        <a href="https://huggingface.co/docs/transformers.js/pipelines" target="_blank" rel="noreferrer">
          Transformers.js pipelines
        </a>
        .
      </p>
    </>
  )
}

export default function TextClassifier() {
  const state = useProjectData(loadLabelled)
  const corpus = useMemo(() => (state.data ? asCorpus(state.data) : null), [state.data])
  const emb = useCorpusEmbedding(corpus, state.project.id)
  return (
    <Widget name="text-classifier">
      <DataGate state={state}>
        {(set, project) => (
          <>
            <DataSource project={project} files={[set.file]}>
              {fmt(set.rows.length)} {set.noun}, labelled by {set.target}.
            </DataSource>
            <RealDensePanel emb={emb} noun={set.noun} offer={`Train a small classifier on ${project.company}’s ${set.noun}`} without="The rest of this page works without it.">
              {emb.vectors && <Trained set={set} emb={emb} vectors={emb.vectors} />}
            </RealDensePanel>
          </>
        )}
      </DataGate>
    </Widget>
  )
}
