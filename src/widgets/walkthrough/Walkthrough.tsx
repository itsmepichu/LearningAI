import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DataGate, DataSource, ScrollRegion, Widget, useProjectData } from '../kit'
import type { DataReader } from '../kit'
import type { Project } from '../../data/projects'
import { getStory } from './stories'
import type { Story, StoryNode, WalkStep } from './story'
import './walkthrough.css'

const W = 112
const H = 42

/** Where a line from a's centre to b's centre leaves a's box. */
function edgePoint(a: StoryNode, b: StoryNode): [number, number] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.min(dx ? W / 2 / Math.abs(dx) : Infinity, dy ? H / 2 / Math.abs(dy) : Infinity)
  return [a.x + dx * t, a.y + dy * t]
}

function Diagram({ story, step }: { story: Story<unknown>; step: WalkStep }) {
  const byId = new Map(story.nodes.map((n) => [n.id, n]))
  const on = new Set(step.nodes)
  const hot = new Set((step.edges ?? []).map(([a, b]) => `${a}>${b}`))
  return (
    <svg viewBox="0 0 640 300" className="wt-svg" role="img" aria-label={`${story.title}: diagram, now at ${step.title}`}>
      <defs>
        <marker id="wt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="wt-arrowhead" />
        </marker>
        <marker id="wt-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" className="wt-arrowhead on" />
        </marker>
      </defs>
      {story.edges.map((e) => {
        const a = byId.get(e.from)!
        const b = byId.get(e.to)!
        const [x1, y1] = edgePoint(a, b)
        const [x2, y2] = edgePoint(b, a)
        const isOn = hot.has(`${e.from}>${e.to}`)
        return <line key={`${e.from}>${e.to}`} x1={x1} y1={y1} x2={x2} y2={y2} className={'wt-edge' + (isOn ? ' on' : '')} markerEnd={`url(#${isOn ? 'wt-arrow-on' : 'wt-arrow'})`} />
      })}
      {story.nodes.map((n) => (
        <g key={n.id} className={'wt-node' + (on.has(n.id) ? ' on' : '')}>
          <rect x={n.x - W / 2} y={n.y - H / 2} width={W} height={H} rx={8} />
          <text x={n.x} y={n.y + 5} textAnchor="middle">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

/** On narrow screens the diagram would be too small to read, so the stages become a strip of chips instead. */
function Chips({ story, step }: { story: Story<unknown>; step: WalkStep }) {
  const strip = useRef<HTMLOListElement>(null)
  const on = new Set(step.nodes)
  useEffect(() => {
    // Bring the current stage into view inside the strip, without scrolling the page.
    const el = strip.current
    const chip = el?.querySelector<HTMLElement>('.on')
    if (el && chip) el.scrollLeft = chip.offsetLeft - el.clientWidth / 2 + chip.clientWidth / 2
  }, [step])
  return (
    <ol className="wt-chips" ref={strip} aria-hidden="true">
      {story.nodes.map((n) => (
        <li key={n.id} className={on.has(n.id) ? 'on' : ''}>
          {n.label}
        </li>
      ))}
    </ol>
  )
}

/** A scroll-driven walkthrough: `story` picks one from stories.ts. The diagram follows the step in the middle of the screen. */
export default function Walkthrough({ story }: { story?: string }) {
  const def = getStory(story)
  const load = useCallback((p: Project, read: DataReader) => (def ? def.load(p, read) : Promise.resolve(null)), [def])
  const data = useProjectData(load)
  if (!def) return <p role="alert">Unknown walkthrough: {story}</p>
  return (
    <Widget name="walkthrough">
      <DataGate state={data}>{(seed, project) => <Walk key={`${def.id}-${project.id}`} def={def} seed={seed} project={project} />}</DataGate>
    </Widget>
  )
}

function Walk({ def, seed, project }: { def: Story<unknown>; seed: unknown; project: Project }) {
  const steps = useMemo(() => def.steps(project, seed), [def, project, seed])
  const [active, setActive] = useState(0)
  const items = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    // A step is current while it crosses a band in the middle of what the reader can see. On narrow screens the pinned
    // diagram covers the top third, so the band sits lower. The observer reports only changes, so keep the full set.
    const inBand = new Set<number>()
    const narrow = window.matchMedia('(max-width: 700px)').matches
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.i)
          if (e.isIntersecting) inBand.add(i)
          else inBand.delete(i)
        }
        if (inBand.size) setActive(Math.max(...inBand))
      },
      { rootMargin: narrow ? '-40% 0px -50% 0px' : '-55% 0px -35% 0px' },
    )
    items.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [steps])

  const step = steps[Math.min(active, steps.length - 1)]
  return (
    <>
      <DataSource project={project} files={def.files(seed)}>
        {def.title}, told with {project.company}’s data.
      </DataSource>
      <div className="wt">
        <div className="wt-fig">
          <Diagram story={def} step={step} />
          <Chips story={def} step={step} />
          <p className="wt-now" aria-live="polite">
            Step {active + 1} of {steps.length}: {step.title}
          </p>
        </div>
        <ol className="wt-steps">
          {steps.map((s, i) => (
            <li key={s.title} ref={(el) => void (items.current[i] = el)} data-i={i} className={i === active ? 'on' : ''}>
              <p className="wt-h">
                <span className="wt-n" aria-hidden="true">{i + 1}</span>
                <b>{s.title}</b>
              </p>
              <p>{s.text}</p>
              {s.detail?.kind === 'code' && (
                <ScrollRegion label={s.detail.label} className="tw wk-output wt-code">
                  <pre>
                    <code>{s.detail.text}</code>
                  </pre>
                </ScrollRegion>
              )}
              {s.detail?.kind === 'table' && (
                <ScrollRegion label={s.detail.caption} className="tw">
                  <table>
                    <caption>{s.detail.caption}</caption>
                    <thead>
                      <tr>{s.detail.head.map((h, j) => <th key={j} scope="col">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {s.detail.rows.map((r, j) => (
                        <tr key={j}>{r.map((c, k) => (k === 0 ? <th key={k} scope="row">{c}</th> : <td key={k}>{c}</td>))}</tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollRegion>
              )}
            </li>
          ))}
        </ol>
      </div>
      <p className="wk-hint">{def.note(project)}</p>
    </>
  )
}
