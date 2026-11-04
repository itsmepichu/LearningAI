# LearningAI

An Interactive AI Learning Path For My DD: the **Enterprise AI Field Manual**, rebuilt as a front-end-only React app.

18 chapters take a software engineer from tokens, vectors and gradients through transformers and training, to building, evaluating, securing and operating AI systems at enterprise scale. Every chapter has the same structure:

- three opening panels (what it is, why we study it, where it applies)
- topics with worked examples and diagrams
- an "In practice" note and a "Failure to avoid" note for the running example
- a lab and a self-check quiz

Two changes are planned next (see [ROADMAP.md](ROADMAP.md), phases 2–3):

- **Choose your example project.** Harbor (an internal company assistant) stays as one of four projects, alongside an online store, a bank and a travel-booking agent. The project you pick decides which practical notes, datasets, lab variants and experiments you see. When another project suits a topic better, a short note at the end of the topic says so.
- **Chapter check pages.** Questions move off the chapter page onto a separate check page per chapter, grouped by section. Each section has choose-the-answer questions and likely interview questions.

Interactive figures run in the browser. Each one carries an evidence label:

- **Runs in browser**: real computation on this page.
- **Simulation**: illustrative numbers; no model is executed.
- **Laptop · CPU**: you can run it on an ordinary laptop.
- **Needs external compute**: you need a GPU or a cluster.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # static site in dist/
npm run preview      # serve dist/ on http://localhost:4173
npm run typecheck
```

End-to-end check: build, then run the preview server and the test. The test visits every route, starts every widget, and checks search, progress, the quiz, the theme switch and the 3D widget.

```bash
npm run build && (npx vite preview --port 4173 &) && npm run test:e2e
```

Screenshots are written to `tests/out/`. The test uses the Playwright package that is already installed globally. It isn't a project dependency.

## Deploy

`.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/` to GitHub Pages. The site is served under `/<repo-name>/`. To enable it:

1. Open the repository's **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.

The build copies `index.html` to `404.html` so that deep links such as `/c9/c9-3` work on Pages.

## Stack

| Concern | Choice |
|---|---|
| App | React 19, TypeScript, Vite, React Router |
| 3D | three.js + @react-three/fiber + drei, loaded only by the topics that use them |
| Motion | Motion (page and card transitions, with reduced-motion support) |
| Search | MiniSearch over all topic text; the index loads lazily the first time search opens |
| State | Zustand. Study progress and quiz answers are saved in `localStorage`, in this browser only. |
| Fonts | IBM Plex Sans / Condensed and JetBrains Mono, self-hosted via Fontsource (work offline) |
| Icons | lucide-react |

## Project layout

```
src/
  content/
    manifest.json          chapters, topics, quizzes (single source of course structure)
    idmap.json             every content element id -> route (for in-content links)
    search.json            plain text per topic, lazy-loaded by search
    pages/<chapter>/*.html topic bodies, chapter intro/outro, labs
  data/course.ts           typed access to the manifest, routes, learning paths
  components/              layout, sidebar, search, quiz, HtmlContent renderer
  pages/                   home, chapter, topic, guide, paths, progress
  widgets/                 React widgets; registry.ts maps data-widget names to components
  legacy/                  v3 vanilla widgets and the runtime that mounts and cleans them up
  styles/                  content.css (design system and figures), app.css (app shell)
scripts/import_legacy.py   one-time importer from the v3 single-file manual
tests/e2e.cjs              Playwright smoke test
```

See [ROADMAP.md](ROADMAP.md) for what comes next and [CLAUDE.md](CLAUDE.md) for authoring conventions.
