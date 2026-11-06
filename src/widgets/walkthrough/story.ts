/**
 * Scroll-driven walkthroughs: one request, or one training step, told stage by stage through the selected project.
 * A story is a diagram (boxes and arrows) and a list of steps; each step names the boxes and arrows it is about, says
 * what happens there in plain text, and can carry a detail: a code-like snippet or a small table of real values from
 * the project's dataset. The component pins the diagram while the reader scrolls through the steps. Pure.
 */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'

export interface StoryNode {
  id: string
  label: string
  /** Centre, in a 640 × 300 diagram. */
  x: number
  y: number
}

export interface StoryEdge {
  from: string
  to: string
}

export type Detail =
  | { kind: 'code'; label: string; text: string }
  | { kind: 'table'; caption: string; head: string[]; rows: (string | number)[][] }

export interface WalkStep {
  title: string
  text: string
  /** The boxes this step is about. */
  nodes: string[]
  /** The arrows it travels along. */
  edges?: [string, string][]
  detail?: Detail
}

export interface Story<S> {
  id: string
  /** The section it belongs to, such as "9.1". */
  section: string
  title: string
  nodes: StoryNode[]
  edges: StoryEdge[]
  load: (p: Project, read: DataReader) => Promise<S>
  steps: (p: Project, seed: S) => WalkStep[]
  /** What the walkthrough is and is not: which values are measured and which are illustrative. */
  note: (p: Project) => string
  /** The dataset files it reads, for the data source line. */
  files: (seed: S) => string[]
}

export const short = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
