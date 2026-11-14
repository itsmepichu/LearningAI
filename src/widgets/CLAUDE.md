# Widgets: rules for authors

These rules cover widgets, Colab guides, 3D scenes, walkthroughs and the legacy widgets. The root `CLAUDE.md` holds the workflow and the no-tests rule.

## Widgets
- New widgets are React components in `src/widgets/<name>/`. Register each one in `src/widgets/registry.ts`, lazily so each gets its own code chunk.
- Embed a widget in content with `<div data-widget="name" data-props='{"k":1}'></div>`.
- Build on the shared kit, `src/widgets/kit/`: `Widget` (the outer element), `Slider`, `KpiRow`, `StepPlayer`, `EventList`, `ScrollRegion`, `ThemeCanvas`, `LineChart`, `BarList`, `StackBar`, `TimeBars`, `Legend`, and `useProjectData` with `DataGate` and `DataSource` for the selected project's dataset.
- Keep logic that can run without a browser in a plain `.ts` module beside the component. File names are case-insensitive on Windows, so do not name it after the component (`saga/events.ts`, not `saga/saga.ts` next to `Saga.tsx`).
- A widget's data loader takes `(project, read)` and uses `read.json` and `read.csv`. Import only types from `../kit` in these modules, and only React components may import its values.
- A new snippet or widget may be Harbor-only or `neutral`; it does not have to carry four projects' data (phase 3). Existing project-aware ones are left as they are. A topic's figures use the topic's primary project, or the project in `?project=` when a workshop task opens them.
- A simulated widget uses the seeded generators in `kit/random.ts`, so the same seed gives the same result.
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
- GPU use: study material (diagrams, 3D scenes, interactive figures) may use the reader's GPU, and should stay usable on laptops with integrated graphics. Do not run LLM training or inference on the reader's GPU. LLM training and other practical GPU work go in a step-by-step Google Colab guide (5.6, 6.7, 13.3, 14.7, 19.2, 20.3).
- Colab guides:
  - Each guide is a `GuideDef` module in `src/widgets/colab-guide/` (`decoding.ts`, `train-gpt.ts`, `qlora.ts`, `vllm-bench.ts`, `vlm.ts`, `distill.ts`), listed in `guides.ts`. Build its steps with `withSetup`, so every guide shares the setup steps, the GPU check as step 4, and the finish step that gives the GPU back.
  - Embed it as `<div data-widget="colab-guide" data-props='{"guide":"<id>"}'>` inside a `figure.fig.colab` (its label says it runs in Colab, not in the browser) with `id="colab-<id>"` and the `Colab · GPU` tag. Link to it from labs and tool cards with `#colab-<id>`.
  - Size it for a free T4: float16, not bfloat16, and models that fit 16 GB. Pin what it installs or clones (a commit, `==` versions), and say in `limits` what the run does and does not show.
  - Put the selected project's data into the code, unless the guide is `neutral`. The reader runs the notebook in their own Colab; the course does not run guides in Colab.
  - Work that needs several GPUs at once (DeepSpeed, Megatron-LM, a full nanochat run) is reading, tagged `Needs external compute`.
- 3D (three.js / @react-three/fiber):
  - Mount only near the viewport.
  - Use `frameloop="demand"` unless animating.
  - Provide a fallback when WebGL is missing and a text description.
  - Use 3D only when the third axis carries data.
  - Build tensor scenes on `src/widgets/scene3d/`: describe the scene as `SceneStep`s in a plain module (cells with values and positions, a title and a text for each step, using the arithmetic and layouts in `tensor.ts`), and draw them with `Scene3D`. It mounts near the viewport, renders on demand, turns with a drag, the arrow keys or buttons (never the scroll wheel), offers a 2D view of the same matrices, and shows each step's text plus the whole figure in words. A tensor keeps its id and cell order across steps, so its cells glide when it is reshaped. A step can also hold `points` (instanced balls), `bars` (boxes, such as stacked memory), `segments` (a graph's edges), `paths`, `notes` and a `table`; the 2D view draws points as a map from above and shows the table, so data that is not a matrix still has a 2D form. Colours are `Tone`s from the theme's tokens, with `series0`–`series5` for categories.
  - Label the numbers honestly: real arithmetic on random weights shows shapes and operations, not what a trained model computes.
- Scroll-driven walkthroughs (`src/widgets/walkthrough/`): a story is a diagram (nodes in a 640 × 300 frame, arrows) and steps, each naming the boxes and arrows it is about, with a plain-text explanation and an optional detail (a code-like snippet or a table). Write each story as a `Story` module in `walkthrough/stories/` that builds its steps from the selected project's data, and list it in `stories.ts`.
  - Embed it as `<div class="walkthru" id="walk-<id>">` with a short lead and `<div data-widget="walkthrough" data-props='{"story":"<id>"}'>`, not inside a `figure.fig`, whose overflow would stop the diagram staying pinned. It counts as interactive, not as a figure.
  - The diagram pins above the steps and follows the step in the middle of the screen. Under 700 px it becomes a strip of stage chips, because the diagram's text would fall below 12 px.
  - Say in the story's `note` which values come from the dataset and which are illustrative.
- The v3 vanilla widgets live in `src/legacy/widgets.js`. Each block is guarded by an element id, and `src/legacy/runtime.ts` cancels its timers and animation frames on unmount. When you rebuild a widget in React, delete its block there.
- Do not add Tailwind or another utility framework without a prefix. The legacy SVG and figure classes (`grid`, `row`, `fill`, `box`, `fig`, `out`, …) would clash with it.
