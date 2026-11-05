/**
 * The GPU work this course does not run in the browser goes into step-by-step Google Colab guides: cells to copy, and
 * the same code as a notebook to download. This module holds what every guide shares: the step type, the setup and
 * finish steps, and the notebook format. Each guide's own steps live in a module beside it (decoding.ts, train-gpt.ts…),
 * and guides.ts lists them. Plain, so a test can check every notebook and parse its Python.
 */
import type { Project } from '../../data/projects'
import type { DataReader } from '../kit'

export const COLAB_URL = 'https://colab.research.google.com/'
export const COLAB_FAQ = 'https://research.google.com/colaboratory/faq.html'

export interface GuideStep {
  title: string
  /** What to do and why, as plain text. */
  text: string
  /** A code cell to paste and run. Steps without one happen in Colab's menus. */
  code?: string
  /** What the reader should see, so they know the step worked. */
  expect?: string
}

export interface GuideLink {
  label: string
  href: string
}

/** One Colab guide. `S` is what it reads from the selected project's dataset; a neutral guide reads nothing. */
export interface GuideDef<S = unknown> {
  id: string
  /** The section it belongs to, such as "5.6". */
  section: string
  /** The notebook's heading, such as "Decoding on a real GPU". */
  title: string
  /** The downloaded file is `<fileStem>-<project>.ipynb`, or `<fileStem>.ipynb` for a neutral guide. */
  fileStem: string
  /** True when the code is the same for every project. */
  neutral?: boolean
  load: (p: Project, read: DataReader) => Promise<S>
  /** The dataset files the code uses, and a line about what it takes from them. Omitted for a neutral guide. */
  source?: (seed: S) => { files: string[]; note: string }
  steps: (p: Project, seed: S) => GuideStep[]
  /** What the run does and does not show, as plain text. */
  limits: (p: Project) => string
  /** Official pages to read alongside the guide. */
  links: GuideLink[]
}

/** A Python string literal. JSON's escapes are valid Python, and non-ASCII text stays readable. */
export const py = (s: string) => JSON.stringify(s)

// ---- Steps every guide shares --------------------------------------------------------------------------------------

export const OPEN_COLAB: GuideStep = {
  title: 'Open Colab and create a notebook',
  text: 'Go to colab.research.google.com and sign in with a Google account. Choose File, then New notebook. Or download the notebook from this page and choose File, then Upload notebook, which saves you pasting each cell. Colab then warns that the notebook was not written by Google: read the code, then choose Run anyway.',
}

export const TURN_ON_GPU: GuideStep = {
  title: 'Turn on the GPU',
  text: 'Choose Runtime, then Change runtime type. Under Hardware accelerator pick a GPU, such as T4 GPU on the free tier, then Save. The names on offer change over time. If Colab says no GPU is available, try again later: free access is limited and not guaranteed.',
}

export const RUN_A_CELL: GuideStep = {
  title: 'Learn how to run a cell',
  text: 'Choose + Code to add a cell, paste the code in, then press Shift+Enter or the round play button at its left. Run the cells in order, top to bottom. A cell has finished when its play button comes back, and a green tick then appears beside it. Variables stay in memory between cells until the runtime restarts.',
}

/** The first code cell of every guide. With `torch`, it also sets `device` for the cells after it. */
export function checkGpu(torch: boolean): GuideStep {
  return torch
    ? {
        title: 'Check that you have a GPU',
        text: 'The first line lists the GPU, if there is one. The rest shows that PyTorch can use it.',
        code: `!nvidia-smi --query-gpu=name,memory.total --format=csv

import torch
device = "cuda" if torch.cuda.is_available() else "cpu"
print("Using:", device, torch.cuda.get_device_name(0) if device == "cuda" else "(no GPU: go back to step 2)")`,
        expect: 'Using: cuda and the GPU’s name. If it says cpu, go back to step 2. Changing the runtime type clears memory, so run this cell again afterwards.',
      }
    : {
        title: 'Check that you have a GPU',
        text: 'This lists the GPU and its memory. If it fails with "command not found" or lists nothing, there is no GPU: go back to step 2.',
        code: `!nvidia-smi --query-gpu=name,memory.total,compute_cap --format=csv`,
        expect: 'One line with the GPU’s name, such as Tesla T4, its memory and its compute capability (7.5 for a T4).',
      }
}

/** The last step of every guide. `kept` says what the reader should save before the machine is deleted. */
export function finish(kept?: string): GuideStep {
  return {
    title: 'Finish, and give the GPU back',
    text: `${kept ? `${kept} ` : ''}Choose Runtime, then Disconnect and delete runtime, which frees your GPU quota. Your notebook stays in Google Drive, but the machine, the model and every variable are deleted. Idle runtimes are also stopped for you, so a later session starts again from step 4.`,
  }
}

/** The shared opening and closing around a guide's own steps. Step 4 is always the GPU check. */
export function withSetup(body: GuideStep[], opts: { torch: boolean; kept?: string }): GuideStep[] {
  return [OPEN_COLAB, TURN_ON_GPU, RUN_A_CELL, checkGpu(opts.torch), ...body, finish(opts.kept)]
}

// ---- Notebook -------------------------------------------------------------------------------------------------------

const lines = (s: string) => s.split('\n').map((l, i, all) => (i < all.length - 1 ? l + '\n' : l))

/** The steps as a notebook, in the format Colab opens: one text cell per step, then its code. */
export function toNotebook(meta: { title: string; section: string }, p: Pick<Project, 'company'> | null, steps: GuideStep[]): string {
  const about = p
    ? `A guide from the Enterprise AI Field Manual, section ${meta.section}, using ${p.company}, a fictional company with invented data.`
    : `A guide from the Enterprise AI Field Manual, section ${meta.section}.`
  const cells = [
    { cell_type: 'markdown', metadata: {}, source: lines(`# ${meta.title}\n\n${about}\n\nBefore running anything, choose **Runtime, Change runtime type** and pick a GPU.`) },
    ...steps.flatMap((s, i) => [
      { cell_type: 'markdown', metadata: {}, source: lines(`## ${i + 1}. ${s.title}\n\n${s.text}${s.expect ? `\n\n**You should see:** ${s.expect}` : ''}`) },
      ...(s.code ? [{ cell_type: 'code', execution_count: null, metadata: {}, outputs: [], source: lines(s.code) }] : []),
    ]),
  ]
  return (
    JSON.stringify(
      {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: { accelerator: 'GPU', colab: { gpuType: 'T4' }, kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' }, language_info: { name: 'python' } },
        cells: cells.map((c, i) => ({ id: `cell-${i}`, ...c })),
      },
      null,
      1,
    ) + '\n'
  )
}

export function notebookName(g: Pick<GuideDef, 'fileStem' | 'neutral'>, projectId: string) {
  return g.neutral ? `${g.fileStem}.ipynb` : `${g.fileStem}-${projectId}.ipynb`
}
