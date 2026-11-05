# LearningAI

An Interactive AI Course For My DD: the **Enterprise AI Field Manual**, rebuilt as a front-end-only React app.

18 required chapters take a software engineer from tokens, vectors and gradients through transformers and training, to building, evaluating, securing and operating AI systems at enterprise scale. Every chapter has the same structure:

- three opening panels (what it is, why we study it, where it applies)
- topics with worked examples and diagrams
- an **In practice** block for your chosen **example project**: how the idea applies, the failure to avoid, and a **Try it** exercise on that project's downloadable synthetic dataset
- a lab, and a separate **chapter check** page with choose-the-answer and interview questions for every section

There are four example projects: Harbor (an internal company assistant), an online store, a bank and a travel-booking agent. All are fictional. There is no choice to make up front: you start with Harbor and can switch at any time. When another project suits a topic better, a short note at the end of the topic says so. A course-wide **Practice** page lets you filter questions, draw random sets, review mistakes and run interview drills.

Status: all 18 chapters and the capstone have notes and lab scenarios for all four projects, and every section has a full chapter check: 1,353 choose-the-answer and 1,080 interview questions in all (see [ROADMAP.md](ROADMAP.md)).

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
npm run typecheck
npm run test:unit    # widget logic and scenarios, with Node's built-in test runner (Node 22.18 or later)
```

End-to-end check: build, then run the preview server and the test. The test visits every route, starts every widget, and checks search, progress, the quiz, the theme switch and the 3D widget.

```bash
npx playwright install chromium   # once, to download the test browser
npm run build && (npx vite preview --port 4173 &) && npm run test:e2e
```

Content checks run automatically before `dev` and `build` (`npm run check:content`): they validate the practice notes and chapter checks and write the question counts. Regenerate the synthetic datasets with `npm run datasets`.

Screenshots are written to `tests/out/`. The test uses the Playwright package that is already installed globally. It isn't a project dependency.

## Deploy

The site deploys on Vercel. `.github/workflows/ci.yml` runs the typecheck, unit tests and build on every pull request and every push to `main`.

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
    projects.json          the four example projects and their datasets
    practice/<chapter>.json  In practice, failure, try-it notes and fit, per topic and project
    checks/<chapter>.json  chapter check questions per section (summary.json is generated)
    idmap.json             every content element id -> route (for in-content links)
    search.json            plain text per topic, lazy-loaded by search
    pages/<chapter>/*.html topic bodies, chapter intro/outro, labs
  data/course.ts           typed access to the manifest and routes
  components/              layout, sidebar, search, quiz, HtmlContent renderer
  pages/                   home, chapter, topic, chapter check, practice, guide, progress
  widgets/                 React widgets; registry.ts maps data-widget names to components
  legacy/                  v3 vanilla widgets and the runtime that mounts and cleans them up
  styles/                  content.css (design system and figures), app.css (app shell)
public/datasets/<project>/ synthetic datasets (generated by scripts/make_datasets.py)
scripts/import_legacy.py   one-time importer from the v3 single-file manual
scripts/content-summary.mjs  content checker and question-count summary
tests/e2e.cjs              Playwright smoke test
src/widgets/*/*.test.ts    unit tests beside each widget
```

See [ROADMAP.md](ROADMAP.md) for what comes next and [CLAUDE.md](CLAUDE.md) for authoring conventions.
