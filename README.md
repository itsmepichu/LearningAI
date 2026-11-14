# LearningAI

An interactive AI course, rebuilt as a front-end-only React app. For beginner programmers and students who know basic Python; it ends at building professional AI applications.

23 required chapters take you from tokens, vectors and gradients through transformers and training, to building, evaluating, securing and operating AI systems at enterprise scale, and on to multimodal models, small models, cost, product design and regulation. Every chapter has the same structure:

- three opening panels (what it is, why we study it, where it applies)
- topics with worked examples and diagrams
- an **In practice** card for the topic's example project: how the idea applies, the failure to avoid, and a **Try it** exercise
- a **workshop** page with the chapter lab and a hands-on task for each topic, on the example project you choose, a **quick check** at the end of every topic (3–5 core questions), and a separate **chapter check** page with choose-the-answer and interview questions for every section (system-design questions sit behind an Interview prep switch)

There are four example projects: Harbor (an internal company assistant), an online store, a bank and a travel-booking agent. All are fictional. A lesson shows one project; you choose among the four on a chapter's workshop page, where a data explorer opens the synthetic files. A course-wide **Practice** page lets you filter questions, draw random sets, review mistakes, run interview drills and take a 20-question review at the end of each part. An **Evidence** page lists what to keep from each chapter lab and capstone milestone (ticks and notes stay in this browser).

Status: all 23 chapters and the capstone have a workshop with notes and lab scenarios for all four projects, every section has a full chapter check (1,794 choose-the-answer and 1,312 interview questions in all), and every topic uses the five-part structure with a runnable snippet (see [ROADMAP.md](ROADMAP.md)).

Interactive figures run in the browser. Each one carries an evidence label:

- **Runs in browser**: real computation on this page.
- **Simulation**: illustrative numbers; no model is executed.
- **Laptop · CPU**: you can run it on an ordinary laptop.
- **Colab · GPU**: a step-by-step Google Colab guide (cells to copy, or a notebook to download) that runs on one free Colab GPU. Guides: 5.6 decoding, 6.7 training a small GPT, 13.3 QLoRA fine-tuning and 14.7 vLLM benchmarking.
- **Needs external compute**: you need several GPUs or a cluster, more than one Colab GPU, so the course treats it as reading.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # static site in dist/
npm run preview      # serve dist/ on http://localhost:4173
```

`npm run test` compiles the TypeScript and builds the site once, to catch a broken import or malformed JSON. The project has no other tests and no automated checks; run it only as the last step before a pull request to `main`.

The generated files (topic counts, link targets, search text, question counts) are written automatically before `dev`, `build` and `test`, and after `npm install`; run `npm run generate` to rebuild them. Regenerate the synthetic datasets with `npm run datasets`.

## Deploy

The site deploys on Vercel.

The build copies `index.html` to `404.html` so that deep links such as `/c9/c9-3` work.

## Stack

| Concern | Choice |
|---|---|
| App | React 19, TypeScript, Vite, React Router |
| 3D | three.js + @react-three/fiber + drei, loaded only by the topics that use them |
| Motion | Motion (page and card transitions, with reduced-motion support) |
| Search | MiniSearch over all topic text; the index loads lazily the first time search opens |
| State | Zustand. Study progress, the example project, check answers and interview ratings are saved in `localStorage`, in this browser only. |
| Fonts | IBM Plex Sans / Condensed and JetBrains Mono, self-hosted via Fontsource (work offline) |
| Icons | lucide-react |

## Project layout

```
src/
  content/
    manifest.json          chapters and topics (single source of course structure)
    generated/             built by `npm run generate`, not committed: topic counts, link targets, search text, question counts
    projects.json          the four example projects and their datasets
    practice/<chapter>.json  In practice, failure, try-it notes and fit, per topic and project
    checks/<chapter>.json  chapter check questions per section
    idmap.extra.json       link targets that cannot be derived from the pages
    pages/<chapter>/*.html topic bodies, chapter intro/outro, labs
  data/course.ts           typed access to the manifest and routes
  components/              layout, sidebar, search, quiz, HtmlContent renderer
  pages/                   home, chapter, topic, chapter check, practice, evidence, guide, progress
  widgets/                 React widgets; registry.ts maps data-widget names to components
  legacy/                  v3 vanilla widgets and the runtime that mounts and cleans them up
  styles/                  content.css (design system and figures), app.css (app shell)
public/datasets/<project>/ synthetic datasets (generated by scripts/make_datasets.py)
scripts/import_legacy.py   one-time importer from the v3 single-file manual
scripts/generate.mjs       writes the generated files in src/content/generated/
scripts/content-tools.mjs  authoring tools: merge notes and questions, revise questions
scripts/datasets.mjs       runs make_datasets.py with whichever Python is installed
```

See [ROADMAP.md](ROADMAP.md) for what comes next (finished plans are in [docs/archive/](docs/archive/)) and [CLAUDE.md](CLAUDE.md) for authoring conventions.
