# Working on LearningAI

## Content
- Course structure lives in `src/content/manifest.json`: chapters, topics, quizzes, and each topic's `figures`, `interactive` and `tags`. If you add a figure or widget to a topic, update its counts there.
- A topic body is an HTML fragment at `src/content/pages/<chapter>/<topic-id>.html`. It uses the content design system in `src/styles/content.css`:
  - `figure.fig`, `.box.example|pit|lab`, `.terms`, `.ff` (In practice / Failure to avoid), `.tools`, `.flow` steppers
  - evidence tags: `.tag cpu|real|sim|gpu`
- Write cross-links as `<a href="#c9-3">` or `<a href="#someElementId">`. `HtmlContent` resolves them through `src/content/idmap.json`. Add new link targets to that file.
- Current state: every topic has one Harbor "In practice" / "Failure to avoid" block (`.ff`) inside its HTML. Each chapter has a three-question quiz in `manifest.json` (`quiz`), shown on the chapter page. Phase 2 replaces both; see the next two sections and the change checklist in `ROADMAP.md`.
- `scripts/import_legacy.py` was a one-time import from the v3 single file. Do not re-run it over edited content.
- Keep the course's standards:
  - Label simulations as simulations, and give illustrative numbers as illustrative.
  - Link to official documentation.
  - Say what a lab result does and does not prove.

## Example projects (design agreed; built in phase 2)
- There are four projects, with ids `harbor`, `store`, `bank` and `travel`. Their profiles go in `src/content/projects.json`. Company names and scale figures are fictional and illustrative; say so where they appear.
- Per-topic notes go in `src/content/practice/<chapter>.json`, keyed `topicId -> projectId -> { practice, failure, tryIt, fit }`.
  - Each of `practice`, `failure` and `tryIt` is a short HTML string.
  - `fit` is `best`, `good` or `limited`.
  - Every topic needs an entry for all four projects. Do not write a weak note when a project barely fits a topic: set `fit: "limited"` and keep the note short, and the end-of-topic note will point readers to a better project.
  - "Try it" must say exactly what to change in this topic's interactive figure, or what to run on a laptop, using that project's dataset.
- A topic HTML file marks where the practice block renders with `<div data-slot="practice"></div>`. Do not put project-specific text in topic HTML.
- Synthetic datasets go in `src/content/datasets/<project>/`. They must be invented: no real people, accounts, card numbers or companies.
- Widgets that display example data read the selected project's dataset, rather than hard-coding one domain.

## Chapter checks (design agreed; built in phase 2)
- Each chapter has a separate check page at `/<chapter>/check`. The chapter page shows no quiz, only a link card after the lab.
- Questions go in `src/content/checks/<chapter>.json`, keyed by topic id (one section per topic):
  - `mcq`: 3 per section, `{ q, options, answer (index or array for "choose all"), why, distractors? }`
  - `interview`: 2–3 per section, `{ q, level: "fundamentals" | "applied" | "system-design", covers: [..], followUp, project? }`
- Explain why the right answer is right. Use distractors that are real misconceptions, not filler.
- Write interview questions the way interviewers ask them, with a checklist of what a strong answer covers. Do not write a script to memorise.

## Widgets
- New widgets are React components in `src/widgets/<name>/`. Register each one in `src/widgets/registry.ts`, lazily so each gets its own code chunk.
- Embed a widget in content with `<div data-widget="name" data-props='{"k":1}'></div>`.
- Each widget should:
  - read colours from the CSS tokens (`--accent`, `--sim`, `--signal`, `--ok`, `--bad`, `--ink`, `--muted`, `--surface`, `--sunk`, `--rule`)
  - redraw when `useTheme().version` changes
  - respect reduced motion
- 3D (three.js / @react-three/fiber):
  - Mount only near the viewport.
  - Use `frameloop="demand"` unless animating.
  - Provide a fallback when WebGL is missing and a text description.
  - Use 3D only when the third axis carries data.
- The v3 vanilla widgets live in `src/legacy/widgets.js`. Each block is guarded by an element id, and `src/legacy/runtime.ts` cancels its timers and animation frames on unmount. When you rebuild a widget in React, delete its block there.
- Do not add Tailwind or another utility framework without a prefix. The legacy SVG and figure classes (`grid`, `row`, `fill`, `box`, `fig`, `out`, …) would clash with it.

## Checks before committing
```bash
npm run typecheck
npm run build
```

```bash
npx vite preview --port 4173 &
npm run test:e2e   # must print ALL CHECKS PASSED
```
