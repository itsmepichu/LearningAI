# Roadmap

Agreed scope:

- A pure React (Vite) app with heavy use of 3D and motion.
- Hosted from this GitHub repository as a static site.
- Real models in the browser, as opt-in downloads of tens of MB.
- Deeper versions of all 18 chapters, plus new chapters.

## Phase 1 — Foundation ✅

- Vite + React + TypeScript project, React Router, GitHub Pages workflow with a 404 fallback for deep links.
- All v3 content imported, one file per topic:
  - 23 sections (18 chapters, the capstone and four appendices)
  - 143 topics and 54 quiz questions
  - 790 link targets mapped to routes
- All v3 interactive figures running unchanged. A runtime adapter starts them on their topic page and cancels their timers and animation frames when you leave.
- App shell:
  - sidebar grouped by part, breadcrumbs, a progress ring, light and dark themes
  - search with `/` or `Ctrl K`
  - an "On this page" rail
  - previous and next topic with `[` and `]`
- Pages:
  - home (course map and learning paths)
  - chapter (topic cards, lab, quiz)
  - topic (reading time, evidence labels, studied toggle)
  - guide, learning paths, a progress heatmap, 404
- First 3D widget: **SGD vs momentum vs Adam on a real loss surface** (topic 2.3).
- End-to-end test: 171 routes, 24 widget start checks, interactions, 3D, mobile and dark mode.

## Phase 2 — Rebuild the most-used widgets in React

- Port the 30 most important v3 widgets to typed React components, and delete their blocks from `src/legacy/widgets.js`. For example:
  - BPE
  - attention
  - BM25
  - HNSW
  - KV cache
  - batching
  - queueing
  - burn rate
- Shared widget kit: slider with live value, step-through player, KPI row, theme-aware canvas, chart primitives.
- Storybook entry and a unit test for each rebuilt widget.

## Phase 3 — Real computation in the browser (opt-in downloads)

- **Pyodide** labs: run the Appendix A NumPy lab and chapter exercises in a Web Worker, with graded checks.
- **Transformers.js**:
  - a real tokenizer comparison (5.1)
  - real sentence embeddings and vector search over the Harbor documents (9.3–9.5)
  - a small classifier
- Shown before every download: its size, a progress bar, and caching after the first load.
- Optional WebGPU model chat (WebLLM), with a clear "not supported here" fallback.

## Phase 4 — 3D and scroll-driven walkthroughs

3D only where the third axis carries data:

- Q/K/V tensor blocks and the multi-head split (5.2–5.3)
- exploded transformer block with the residual stream (5.3)
- embedding space with real vectors (9.3)
- HNSW layers with the greedy search path (9.4)
- GPU cluster parallelism and ZeRO sharding (6.6)
- paged KV-cache blocks (14.3)
- a globe of regions with failover (15.x)

Each scene has a 2D fallback, a text description and keyboard controls.

Scroll-driven walkthroughs for:

- one training step
- one RAG request end to end
- the agent loop
- a request through the serving stack

## Phase 5 — Deeper content and new chapters

- Every topic follows one structure:
  - Intuition
  - Mechanism
  - Math (KaTeX)
  - Code (runnable)
  - Harbor in production
  - Failure to avoid
  - Self-check
  - Primary sources
- New chapters:
  - multimodal models (vision, audio, documents)
  - distillation and small models
  - LLM cost engineering and FinOps
  - AI product and UX patterns
  - regulation basics (EU AI Act, model and data governance)
- Annotated walkthroughs of about 10 key papers.
- A glossary with hover cards, and flashcards with spaced repetition (FSRS).

## Phase 6 — Learning system and hardening

- A prerequisite map (2D/3D graph of all topics) that filters by learning path.
- A Harbor sandbox that grows chapter by chapter.
- Export and import of progress.
- PWA offline mode.
- Accessibility audit (WCAG 2.1 AA).
- Performance budgets: a smaller main bundle, and Motion loaded lazily.
