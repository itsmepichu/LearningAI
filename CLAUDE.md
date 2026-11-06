# Working on LearningAI

## Workflow
- Work in the main checkout, on the one feature branch, `development`. Merge it to `main` through a pull request.
- Do not create git worktrees or a branch per task, and do not start side sessions with their own worktree.
- The site deploys on Vercel. There is no GitHub Pages integration, so do not refer to it or suggest enabling it.

## Content
- Course structure lives in `src/content/manifest.json`: chapters, topics, and each topic's `figures`, `interactive` and `tags`. If you add a figure or widget to a topic, update its counts there.
- A topic body is an HTML fragment at `src/content/pages/<chapter>/<topic-id>.html`. It uses the content design system in `src/styles/content.css`:
  - `figure.fig`, `.box.example|pit|lab`, `.terms`, `.tools`, `.flow` steppers
  - evidence tags: `.tag cpu|real|sim|gpu`
- `HtmlContent` rebuilds heading levels into a valid outline when it renders a fragment, and marks a changed heading with `as-hN`, where N is its level in the file. When you style a content heading, style `hN` and `.as-hN` alike.
- Write cross-links as `<a href="#c9-3">` or `<a href="#someElementId">`. `HtmlContent` resolves them through `src/content/idmap.json`. Add new link targets to that file.
- Current state (phase 6b done, phase 7 started): every chapter and the capstone have notes for all four projects and lab scenarios, and every section has a full chapter check (10–12 choose-the-answer and 8–10 interview questions) that passes the quality rules. Chapters 1–10 use the topic structure below; the other chapters follow, two or three per pull request.
- Write new notes and questions with `scripts/content_tools.py` (`merge_practice`, `merge_checks`): it assigns stable ids, shuffles new options with a fixed seed and checks distractor alignment.
- `node scripts/content-summary.mjs` (run automatically before `dev` and `build`) validates the practice and check files and writes `src/content/checks/summary.json`. Fix every error it reports; treat its warnings as review items. Its quality rules (follow-ups, wrong-option explanations, length giveaways, scenario share, duplicate questions) are errors, so a question that breaks one fails the build.
- Edit published questions with `content_tools.revise_checks(chapter, edits)`: it changes text, options, explanations, kind or follow-up by id, and refuses to change an answer or the number of options.
- `scripts/import_legacy.py` was a one-time import from the v3 single file. Do not re-run it over edited content.
- After editing topic HTML, run `python3 scripts/refresh_search.py`, which rebuilds the search text in `src/content/search.json` from the pages.
- The course is one required sequence: every chapter, section and topic is a must-learn for an expert AI/ML engineer. Do not add learning paths, role-based tracks or wording that makes a topic optional.
- Progress totals count the chapters and the capstone (`courseTopics` in `src/data/course.ts`), not the appendices.
- Keep the course's standards:
  - Label simulations as simulations, and give illustrative numbers as illustrative.
  - Link to official documentation.
  - Say what a lab result does and does not prove.

## Example projects
- There are four projects, with ids `harbor`, `store`, `bank` and `travel`. Their profiles go in `src/content/projects.json`.
  - Company names must be fictional. Never use a real company's name, because the notes invent internal systems, figures and mistakes.
  - Scale figures are illustrative; say so where they appear.
- There is no up-front project choice. Harbor is the default; readers switch from the top bar, the In practice tabs or the end-of-topic note.
- Per-topic notes go in `src/content/practice/<chapter>.json`, keyed `topicId -> projectId -> { practice, failure, tryIt, fit, fitNote }`.
  - Each of `practice`, `failure` and `tryIt` is a short HTML string: about 25–45 words for In practice and Try it, 12–25 for Failure to avoid (the range chapters 1–18 already use). Write the company and assistant as `{company}` and `{assistant}`, so names live only in `projects.json` (Harbor's existing notes name Harbor directly).
  - `fit` is `best`, `good` or `limited`. `fitNote` is a short phrase on why the project suits the topic; the end-of-topic note shows it when the reader's project is `limited`. A `limited` topic needs at least one other project rated `best` or `good`.
  - A chapter's `_lab` key holds `projectId -> { scenario }`: an HTML scenario for doing the chapter lab with that project.
  - Every topic needs an entry for all four projects. Do not write a weak note when a project barely fits a topic: set `fit: "limited"` and keep the note short, and the end-of-topic note will point readers to a better project.
  - "Try it" must say exactly what to change in this topic's interactive figure, or what to run on a laptop, using that project's dataset.
- A topic HTML file marks where the practice block renders with `<div data-slot="practice"></div>`. Do not put project-specific text in topic HTML.
- Synthetic datasets live in `public/datasets/<project>/` (served and downloadable), generated by `npm run datasets` (`scripts/make_datasets.py`, seeded). Edit the generator, not the files. Data must be invented: no real people, accounts, card numbers or companies. Describe each file's fields and traps in `projects.json`.
- Widgets that display example data read the selected project's dataset, rather than hard-coding one domain.

## Topic structure (phase 7)
- A restructured topic is five parts, in this order, with the practice block between Code and Primary sources:
  ```html
  <section class="tp tp-intuition" id="<topic>-intuition"><h3 data-n="1">Intuition</h3> … </section>
  <section class="tp tp-mechanism" id="<topic>-mechanism"><h3 data-n="2">Mechanism</h3> … </section>
  <section class="tp tp-math" id="<topic>-math"><h3 data-n="3">The numbers</h3> … </section>
  <section class="tp tp-code" id="<topic>-code"><h3 data-n="4">Code</h3> … </section>
  <div data-slot="practice"></div>
  <section class="tp tp-sources" id="<topic>-sources"><h3 data-n="5">Primary sources</h3><ol><li><a href="…">…</a> <small>what it is for</small></li></ol></section>
  ```
  - Intuition: plain words and an analogy, no formulas. Mechanism: how it works, with the topic's existing figures. The numbers: plain words and small worked examples with real numbers, written so an entry-level programmer or student can follow; no formulas. Code: a runnable snippet (CPU) or a Colab guide (GPU), with a line on what to change; laptop labs (`.box.lab`) go here too, not in Mechanism. Primary sources: at least 2 links to papers or official documentation, each with a `<small>` on why it is there.
  - Restructure a whole chapter at once: the checker refuses a chapter in which only some topics are structured.
- Do not use math formulas in topics (the owner's decision, 6 November 2026). Explain with words, small tables and worked arithmetic such as `240 ÷ 100 = 2.4`; the checker refuses `class="math"`. KaTeX support (`src/components/math.ts`) stays in the code but is unused.
- Glossary terms live in `src/content/glossary.json` (`id -> { term, def, topic, aliases? }`; `topic` is the topic that teaches it). Mark a term in topic HTML with `<a class="gl" href="#gl-<id>">`: it shows the definition on hover or focus and opens `/glossary#gl-<id>`. Mark a term once per part, not every mention. The checker refuses links to unknown terms and entries with unknown topics.
- Runnable snippets: each chapter's snippets live in `src/widgets/py-snippet/c<N>.ts` and are merged in `snippets.ts`; shared data helpers (`projectMessages`, `projectLabelled`, `projectDocs`, `projectTable`, `NUMBER_COLUMNS`) are in `common.ts`. Each snippet holds its code, what it shows and does not show (`proves`), a `build(project, read)` that writes the selected project's data into its files (or `neutral`), and a `check` the unit test runs after it. Embed with `<figure class="fig live" id="snip-<id>"><div class="stage"><div data-widget="py-snippet" data-props='{"snippet":"<id>"}'></div></div><figcaption>…</figcaption></figure>`, add `snip-<id>` to `idmap.json`, count it in the manifest as a figure and an interactive, and add it to `KIT_WIDGETS` (`neutral` when it reads no data). Snippets use only the Python standard library and NumPy.
- Flashcards (`/flashcards`) are chapter-check questions scheduled with FSRS (`src/data/flashcards.ts`). A wrong choose-the-answer, or "Missed it" on an interview question, adds the card; "Add to flashcards" adds any other. Cards are keyed by question id, which is one more reason never to reuse or renumber ids.

## Chapter checks
- Each chapter has a separate check page at `/<chapter>/check`. The chapter page shows no quiz, only a link card after the lab.
- Questions go in `src/content/checks/<chapter>.json`, keyed by topic id (one section per topic):
  - `mcq`: 10–12 per section, `{ id, q, options, answer (index or array for "choose all"), why, distractors, kind: "concept" | "calculation" | "scenario" }`
  - `interview`: 8–10 per section, `{ id, q, level: "fundamentals" | "applied" | "system-design", covers: [..], followUp, project? }`
    - Aim for about 3 fundamentals, 3–4 applied and 2–3 system design per section.
    - At most 2 per section are framed in a project (`project` set).
  - `id` is stable (for example `c5-3-m07`, `c5-3-i04`), because saved answers and Practice-page history are keyed by it. Never reuse or renumber ids.
- Every question must be traceable to its topic's content or a cited primary source. Avoid near-duplicates within and across sections.
- The course-wide Practice page (`/practice`) reads the same files, loading only the chapters its filters select.
- Explain why the right answer is right. Use distractors that are real misconceptions, not filler, and explain each one in `distractors` (aligned with `options`, `""` for right answers). Every question needs them.
- Do not let length give the answer away: write wrong options as specific and as long as the right one. The checker flags a right answer at least 1.4 times the wrong options' average length.
- At least 4 of a section's choose-the-answer questions are `scenario` or `calculation`, not plain recall.
- Every interview question has a `followUp`: the question an interviewer would ask next.
- Vary the position of the right answer. Shuffle options with a fixed seed when adding questions; the checker warns when more than half of a section's answers share a position. Never reorder options of a question that is already published, because saved answers are option indices.
- Write interview questions the way interviewers ask them, with a checklist of what a strong answer covers. Do not write a script to memorise.

## Widgets
- New widgets are React components in `src/widgets/<name>/`. Register each one in `src/widgets/registry.ts`, lazily so each gets its own code chunk.
- Embed a widget in content with `<div data-widget="name" data-props='{"k":1}'></div>`.
- Build on the shared kit, `src/widgets/kit/`: `Widget` (the outer element), `Slider`, `KpiRow`, `StepPlayer`, `EventList`, `ScrollRegion`, `ThemeCanvas`, `LineChart`, `BarList`, `StackBar`, `TimeBars`, `Legend`, and `useProjectData` with `DataGate` and `DataSource` for the selected project's dataset.
- Keep logic that can run without a browser in a plain `.ts` module beside the component. File names are case-insensitive on Windows, so do not name it after the component (`saga/events.ts`, not `saga/saga.ts` next to `Saga.tsx`).
- A widget's data loader takes `(project, read)` and uses `read.json` and `read.csv`, so a test can give it the real dataset from disk. Import only types from `../kit` in these modules, and only React components may import its values.
- Give each new widget a `<name>.test.ts` beside it, using `node:test`: test its logic, and check its scenarios against the datasets with `kit/testing.ts`. Tests, and any value import between these plain modules, use the `.ts` extension, because Node runs them directly. Do not add a test runner or Storybook.
- Add each new widget to `KIT_WIDGETS` in `tests/e2e.cjs` with a check of what it does, and its page to `WIDGET_PAGES` in `tests/axe.cjs`. Mark it `neutral` there if it shows no example data.
- A simulated widget uses the seeded generators in `kit/random.ts`, so the same seed gives the same result and a test can assert on it.
- Never plot two scales on one axis. Use two charts, as the throughput and burn-rate widgets do.
- Each widget should:
  - read colours from the CSS tokens (`--accent`, `--sim`, `--signal`, `--ok`, `--bad`, `--ink`, `--muted`, `--surface`, `--sunk`, `--rule`)
  - redraw when `useTheme().version` changes
  - respect reduced motion
  - meet the 24 px target minimum and the 12 px text floor (`--fs-2xs`)
  - use the colour tokens for text, which pass AA contrast, and not dim text with opacity
- Heavy computation is opt-in, through the download gate in the kit (`gateFor`, `useGate`, `DownloadGate`). List each download and its measured size in `src/widgets/engines/specs.ts`, and pin its version.
  - Load runtimes and models in a Web Worker (`src/widgets/engines/`), from a pinned URL. Nothing may download or start before the reader opts in.
  - Say what each real result does and does not prove, and keep labels accurate about whether a figure is showing real results or an illustration.
  - Tests and e2e never download a model. Test the logic with small fixtures. e2e stubs `Worker` and tells each engine apart by the worker's name.
- GPU use: study material (diagrams, 3D scenes, interactive figures) may use the reader's GPU, and should stay usable on laptops with integrated graphics. Do not run LLM training or inference on the reader's GPU. LLM training and other practical GPU work go in a step-by-step Google Colab guide (5.6, 6.7, 13.3, 14.7).
- Colab guides:
  - Each guide is a `GuideDef` module in `src/widgets/colab-guide/` (`decoding.ts`, `train-gpt.ts`, `qlora.ts`, `vllm-bench.ts`), listed in `guides.ts`. Build its steps with `withSetup`, so every guide shares the setup steps, the GPU check as step 4, and the finish step that gives the GPU back.
  - Embed it as `<div data-widget="colab-guide" data-props='{"guide":"<id>"}'>` inside a `figure.fig.colab` (its label says it runs in Colab, not in the browser) with `id="colab-<id>"` (add it to `idmap.json`) and the `Colab · GPU` tag. Link to it from labs and tool cards with `#colab-<id>`.
  - Size it for a free T4: float16, not bfloat16, and models that fit 16 GB. Pin what it installs or clones (a commit, `==` versions), and say in `limits` what the run does and does not show.
  - Put the selected project's data into the code, unless the guide is `neutral`. The reader runs the notebook in their own Colab; the course does not run guides in Colab.
  - Before a guide ships, run its code on a CPU: `node scripts/colab-notebooks.ts /tmp/nb`, then `python scripts/check_colab_guides.py /tmp/nb` in an environment with torch, transformers, peft, accelerate, tokenizers, tiktoken, numpy, matplotlib and openai. It uses tiny stand-ins (a tiny local model, nanoGPT at tiny size, a mock vLLM); add one for anything a CPU cannot run.
  - Work that needs several GPUs at once (DeepSpeed, Megatron-LM, a full nanochat run) is reading, tagged `Needs external compute`.
- 3D (three.js / @react-three/fiber):
  - Mount only near the viewport.
  - Use `frameloop="demand"` unless animating.
  - Provide a fallback when WebGL is missing and a text description.
  - Use 3D only when the third axis carries data.
  - Build tensor scenes on `src/widgets/scene3d/`: describe the scene as `SceneStep`s in a plain module (cells with values and positions, a title and a text for each step, using the arithmetic and layouts in `tensor.ts`), and draw them with `Scene3D`. It mounts near the viewport, renders on demand, turns with a drag, the arrow keys or buttons (never the scroll wheel), offers a 2D view of the same matrices, and shows each step's text plus the whole figure in words. A tensor keeps its id and cell order across steps, so its cells glide when it is reshaped; `scene3d/testing.ts` checks that. A step can also hold `points` (instanced balls), `bars` (boxes, such as stacked memory), `segments` (a graph's edges), `paths`, `notes` and a `table`; the 2D view draws points as a map from above and shows the table, so data that is not a matrix still has a 2D form. Colours are `Tone`s from the theme's tokens, with `series0`–`series5` for categories.
  - Label the numbers honestly: real arithmetic on random weights shows shapes and operations, not what a trained model computes.
- Scroll-driven walkthroughs (`src/widgets/walkthrough/`): a story is a diagram (nodes in a 640 × 300 frame, arrows) and steps, each naming the boxes and arrows it is about, with a plain-text explanation and an optional detail (a code-like snippet or a table). Write each story as a `Story` module in `walkthrough/stories/` that builds its steps from the selected project's data, and list it in `stories.ts`.
  - Embed it as `<div class="walkthru" id="walk-<id>">` with a short lead and `<div data-widget="walkthrough" data-props='{"story":"<id>"}'>`, not inside a `figure.fig`, whose overflow would stop the diagram staying pinned. Count it as interactive in the manifest, not as a figure.
  - The diagram pins above the steps and follows the step in the middle of the screen. Under 700 px it becomes a strip of stage chips, because the diagram's text would fall below 12 px.
  - Say in the story's `note` which values come from the dataset and which are illustrative.
- The v3 vanilla widgets live in `src/legacy/widgets.js`. Each block is guarded by an element id, and `src/legacy/runtime.ts` cancels its timers and animation frames on unmount. When you rebuild a widget in React, delete its block there.
- Do not add Tailwind or another utility framework without a prefix. The legacy SVG and figure classes (`grid`, `row`, `fill`, `box`, `fig`, `out`, …) would clash with it.

## Checks
Before each commit:

```bash
npm run typecheck
npm run test:unit
npm run build
```

Run the end-to-end test only when the owner asks for it. It takes several minutes, so run it in the background when asked.

```bash
npx vite preview --port 4173 &
npm run test:e2e   # must print ALL CHECKS PASSED; includes the axe check in tests/axe.cjs
```
