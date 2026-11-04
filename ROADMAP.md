# Roadmap

## Agreed scope

- A pure React (Vite) app with heavy use of 3D and motion, hosted from this GitHub repository as a static site (GitHub Pages).
- Real models in the browser, as opt-in downloads of tens of MB.
- Deeper versions of all 18 chapters, plus new chapters.
- **Four example projects you choose between:**
  - Harbor stays.
  - Online store, Bank and Travel booking are added.
  - The project you pick decides which practical content, datasets, labs and experiments you see.
  - When another project suits a topic better, a short note at the end of the topic says so.
- **Chapter checks on their own page:**
  - Questions move out of the chapter page to a separate check page at the end of each chapter.
  - The page is grouped by section (one per topic).
  - Each section has choose-the-answer questions and likely interview questions.

---

## Design: example projects

### The four projects

All names are fictional working names. Before the content is written, check that none of them matches a real company, and rename any that does. Scale figures are illustrative.

| Id | Project | Assistant at | Scale (illustrative) | Teaches best |
|---|---|---|---|---|
| `harbor` | **Harbor**: internal company assistant | Tidewell, a software company | 8,000 employees, 1,200 business customers | Per-user document permissions, tenant isolation, approvals, audit |
| `store` | **Online store**: shopping and support assistant | Meridian Market, an online marketplace | ~5M monthly shoppers, 2M product listings, holiday peak ~40× normal traffic | Consumer scale, latency, caching, cost per conversation, product search, images |
| `bank` | **Bank**: customer and dispute-operations assistant | Fernhill Bank, a retail bank | ~3M customers, card disputes, strict audit | Idempotent money movements, evaluation rigour, regulation, fraud and social engineering |
| `travel` | **Travel booking**: trip-planning and booking agent | Skyway Travel, an online travel agency | ~1.5M bookings a month, 9 languages, live fares | Multi-step agents and sagas (book, then cancel or refund), fresh prices, many languages, disruption spikes |

### How selection works

- **Picking a project:**
  - A project picker on the home page ("Choose your example project"), as four cards that each show the company, its scale and what the project teaches best.
  - A compact picker in the top bar, so you can change it anywhere.
- **Your choice is saved in this browser.** Harbor is the default until you choose.
- **What the choice changes:**
  - **In practice** note: the topic applied to your project.
  - **Failure to avoid** note: the most likely mistake in your project.
  - **Try it** steps: what to change in this topic's interactive figure using your project's data, plus a laptop experiment.
  - **Interactive figures that use data** (chunking, BM25, retrieval metrics, memory, saga, cache keys, queueing…) load your project's synthetic dataset.
  - **Chapter lab variant:** the same structure and pass condition, with your project's data and scenario.
  - **Capstone:** "Build *your project*-lite", with milestones in your project's terms.
  - **Interview questions**, where a project framing helps (for example "design the refund flow for Meridian Market").
- **Peeking without switching:** tabs on the In practice block let you read another project's version without changing your default.
- **Deep links:** `?project=store` in the address opens a topic with that project for this visit only, so links and search results can point at a specific project's version.

### Synthetic datasets (one per project, small enough for the browser)

| Project | Dataset |
|---|---|
| Harbor | ~60 policy and product documents with access groups, support tickets, approval requests |
| Online store | ~300 product listings with attributes and some photos, reviews (a few containing injection attempts), orders, the returns policy |
| Bank | ~40 product, fee and dispute-policy documents, ~500 card transactions, dispute cases with outcomes |
| Travel | Fare-rule and change-policy documents, flight and hotel inventory with prices that change, bookings, disruption events |

All the data is invented. It contains no real people, accounts or card numbers.

### Topic fit and the end-of-topic note

Each topic records how well each project fits it: `best`, `good` or `limited`. At the end of every topic, a small note shows:

- **When your project's fit is `limited`:** a highlighted note naming the project or projects that suit the topic better, why, and two buttons.
  > Harbor's documents are mostly text, so there is little to try here. **Online store** (product photos) and **Travel** (passport and boarding-pass scans) give you real images to experiment with.
  > **[Try this topic with Online store]** **[Make Online store my default]**
- **Otherwise:** a one-line "Also explore this topic with: Bank · Travel" with links.

"Try this topic with …" switches only the current topic, using `?project=`. "Make … my default" changes the saved choice.

Planned fit by chapter (★ best, ● good, ○ limited). Each topic can still differ from its chapter's rating.

| Chapter | Harbor | Online store | Bank | Travel |
|---|---|---|---|---|
| 1 AI foundations | ● | ● | ● | ● |
| 2 Maths and toolkit | ● | ★ similarity, recommendations | ● | ● |
| 3 ML fundamentals | ○ | ● demand, click-through | ★ fraud, class imbalance | ● |
| 4 Deep learning | ○ | ★ product images | ● | ● |
| 5 Transformers | ● | ● | ● | ★ token cost across languages |
| 6 Training | ● | ● | ● | ● |
| 7 LLM applications | ★ | ● | ● | ★ structured itinerary extraction |
| 8 Evaluation | ● | ● A/B tests at scale | ★ strict evaluation | ● |
| 9 Retrieval and RAG | ★ permissions | ★ SKU and product search | ● cited policy answers | ● fare rules |
| 10 RAG at scale | ★ permission revocation | ★ millions of listings, fresh stock | ● | ● changing prices |
| 11 Single agents | ● | ● returns | ★ idempotent disputes | ★ booking saga |
| 12 Multi-agent | ● | ● | ● | ★ planner and booking workers |
| 13 Adaptation | ● | ★ brand voice, attribute extraction | ● dispute-reason classifier | ● |
| 14 Inference serving | ● | ★ | ● | ● |
| 15 Millions of users | ○ | ★ holiday peak | ● month-end | ★ disruption spikes |
| 16 Security | ★ permission leaks | ● injection in reviews | ★ social engineering, PII | ● |
| 17 Observability | ● | ★ cost per conversation | ● | ● |
| 18 LLMOps and delivery | ● | ● | ★ approvals, audit | ● |
| New: multimodal | ○ scanned PDFs | ★ product photos | ● cheque and statement images | ★ passport and boarding-pass scans |
| New: distillation and small models | ● | ★ | ● | ● |
| New: cost engineering and FinOps | ● | ★ | ● | ● |
| New: AI product and UX | ● | ★ | ● | ★ |
| New: regulation basics | ● | ● | ★ | ● |

---

## Design: chapter checks

- **A separate page per chapter**, at `/<chapter>/check` (for example `/c5/check`), titled "Chapter 5 check".
  - The chapter page no longer contains a quiz. It ends with the lab and then a card linking to the check.
  - Each topic page ends with a link to its section on the check page ("3 questions and 2 interview questions for 5.3 →").
- **Grouped by section:** one block per topic, in topic order, with a section index at the top.
- **Two kinds of question per section:**

  | Kind | Per section | Format |
  |---|---|---|
  | Choose the answer | 3 (the current 54 chapter questions move to their sections, and more are added) | Single choice or "choose all that apply", each with an explanation of the right answer and why the distractors are wrong |
  | Interview questions | 2–3 | The question; a level (fundamentals, applied, or system design); a hidden "What a strong answer covers" checklist; a likely follow-up question; an optional framing in your example project |

  Example interview question (14.3, system design):
  > *Continuous batching raised throughput but p99 latency got worse. Why, and what would you change?*
  > A strong answer covers: new requests' prefill competes with ongoing decode steps; chunked prefill or a prefill token budget; prefix caching for shared system prompts; measuring time to first token and time between tokens separately.
  > Likely follow-up: how do you choose the batch-size limit?
- **Two modes:**
  - **Practice:** feedback after each answer.
  - **Check:** answer a whole section or chapter, then see the score and review your mistakes.
- **Progress:**
  - Scores are saved per section, and interview questions can be marked "practised".
  - The chapter page shows the check result.
  - The progress page shows check scores next to topics studied.
- **Suggested addition (not part of your request; your call):** a course-wide **Practice** page (`/practice`). You could filter by chapter, learning path, question kind and level, draw "10 random questions", or review earlier mistakes. Useful for interview preparation across the whole course.

---

## Phases

### Phase 1 — Foundation ✅ (merged)

- Vite + React + TypeScript project, React Router, GitHub Pages workflow with a 404 fallback for deep links.
- All v3 content imported, one file per topic:
  - 23 sections (18 chapters, the capstone and four appendices)
  - 143 topics and 54 quiz questions
  - 790 link targets mapped to routes
- All v3 interactive figures running unchanged, through a runtime adapter that cancels their timers and animation frames on unmount.
- App shell:
  - sidebar grouped by part, breadcrumbs, a progress ring, light and dark themes
  - search (`/` or `Ctrl K`), an "On this page" rail, previous and next topic (`[` `]`)
- Pages:
  - home, chapter (topic cards, lab, quiz), topic
  - guide, learning paths, progress heatmap, 404
- First 3D widget: SGD vs momentum vs Adam on a real loss surface (2.3).
- End-to-end test of every route, the widgets, interactions, 3D, mobile and dark mode.
- *At this point the only example is Harbor, and each chapter has a three-question quiz on the chapter page. Phases 2–3 replace both.*

### Phase 2 — Example projects and chapter checks (structure and pilot)

- **Data model:**
  - `src/content/projects.json` for the four profiles.
  - Practice notes per chapter in `src/content/practice/<chapter>.json`, by topic and project: In practice, Failure to avoid, Try it, fit.
  - Questions per chapter in `src/content/checks/<chapter>.json`, by topic.
- **Move the existing Harbor content into the new structure:**
  - Move the 137 Harbor In practice and Failure to avoid notes out of the topic HTML into the practice files.
  - Each topic keeps a placeholder at the same position.
- **Move the existing questions:**
  - Move the 54 questions to their sections.
  - Remove `quiz` from `manifest.json`.
  - Migrate saved answers from the old chapter-level keys to section keys, so learners keep their progress.
- **Build:**
  - the project pickers (home page and top bar)
  - the In practice block with project tabs
  - the end-of-topic project note
  - `?project=` deep links
  - the chapter check page with practice and check modes
  - the "Check this section" link on topic pages
  - check results on the chapter and progress pages
- **Build the four synthetic datasets.**
- **Pilot: chapters 1–3 complete for all four projects**, with full section checks (3 choose-the-answer and 2–3 interview questions per section), so you can review the format before it is rolled out.
- **Update every place listed in the change checklist below**, and extend the end-to-end test.

### Phase 3 — Roll out projects and checks to every chapter

- In practice, Failure to avoid and Try it notes for Online store, Bank and Travel on every remaining topic: chapters 4–18 and the capstone, about 400 notes in all.
- A topic-fit rating for every topic.
- Section checks for every topic: about 400 choose-the-answer and about 300 interview questions.
- Lab variants per project for all 18 chapter labs, and capstone milestones per project.
- Delivered chapter by chapter, each reviewed against the course's standards: simulations labelled as such, illustrative numbers called illustrative, links to official documentation.

### Phase 4 — Rebuild the most-used widgets in React, project-aware

- Port the 30 most important v3 widgets to typed React components, and delete their blocks from `src/legacy/widgets.js`. Start with those that show example data, which load the selected project's dataset:
  - chunking (9.2), BM25 (9.3), retrieval metrics and retriever comparison (9.7)
  - context assembler (7.3), streaming (7.4), memory simulator (7.5, currently Tidewell-specific)
  - saga (11.6), budget (11.7), injection demo (16.2), cache-key builder (16.4)
- Then the others: BPE, attention, HNSW, KV cache, batching, queueing, burn rate…
- Shared widget kit: slider with live value, step-through player, KPI row, theme-aware canvas, chart primitives.
- Storybook entry and a unit test for each rebuilt widget.

### Phase 5 — Real computation in the browser (opt-in downloads)

- **Pyodide** labs: run the Appendix A NumPy lab and chapter exercises in a Web Worker, with graded checks against your project's dataset.
- **Transformers.js**:
  - a real tokenizer comparison (5.1), using the Travel project's 9 languages
  - real sentence embeddings and vector search over your project's documents (9.3–9.5)
  - a small classifier (for example the Bank project's dispute reasons)
- Shown before every download: its size, a progress bar, and caching after the first load.
- Optional WebGPU model chat (WebLLM), with a clear "not supported here" fallback.

### Phase 6 — 3D and scroll-driven walkthroughs

3D only where the third axis carries data:

- Q/K/V tensor blocks and the multi-head split (5.2–5.3)
- exploded transformer block (5.3)
- embedding space using your project's real vectors (9.3)
- HNSW layers (9.4)
- GPU cluster parallelism and ZeRO sharding (6.6)
- paged KV-cache blocks (14.3)
- a globe of regions with failover (15.x)

Each scene has a 2D fallback, a text description and keyboard controls.

Scroll-driven walkthroughs, each told through your selected project:

- one training step
- one RAG request end to end
- the agent loop
- a request through the serving stack

### Phase 7 — Deeper content and new chapters

- **Every topic follows one structure:**
  - Intuition
  - Mechanism
  - Math (KaTeX)
  - Code (runnable)
  - In practice (your project)
  - Failure to avoid
  - Try it
  - Primary sources
- **New chapters**, each written with all four projects and full section checks from the start:
  - multimodal models
  - distillation and small models
  - cost engineering and FinOps
  - AI product and UX patterns
  - regulation basics
- Annotated walkthroughs of about 10 key papers.
- A glossary with hover cards, and flashcards with spaced repetition (FSRS), fed from the check pages.

### Phase 8 — Learning system and hardening

- A prerequisite map (2D/3D graph of topics), filtered by learning path and project.
- A sandbox for your project that grows chapter by chapter.
- The course-wide Practice page, if you approve it.
- Export and import of progress (project choice, studied topics, check scores).
- PWA offline mode, accessibility audit (WCAG 2.1 AA), performance budgets.

---

## Change checklist (phase 2)

Every place that refers to Harbor as the only example, or to the chapter quiz, and must change when phase 2 lands.

**Documentation**
- [x] `ROADMAP.md`: this document.
- [x] `README.md`: describe the four example projects and the chapter check pages as planned.
- [x] `CLAUDE.md`: authoring rules for project notes, topic fit, datasets and section checks.

**Content**
- [ ] `src/content/pages/home/how.html`:
  - Rewrite the section "The running example: Harbor" (`#harbor`) as "Four example projects", with how to choose and switch. Keep the `#harbor` anchor working.
  - Change "Each chapter ends with … a three-question self-check" to the chapter check page.
- [ ] 137 `.ff` blocks in topic pages: move them to `src/content/practice/<chapter>.json` and leave a placeholder.
- [ ] `src/content/pages/capstone/app-c-ms.html`: change "Build Harbor-lite" to "Build *your project*-lite", with per-project milestones and the In practice note moved.
- [ ] `src/content/pages/c7/_lab.html`: change the title "Build a constrained answer service for Harbor" into a project-neutral lab with per-project variants.
- [ ] `src/content/pages/app-d/app-d-cov.html`: change the coverage statement ("an 'In practice · Harbor' scenario … ends with a lab and a self-check") to describe four projects and section checks.
- [ ] `src/content/manifest.json`:
  - remove `quiz`
  - add per-topic `fit`
  - add a `check` summary (question counts) per chapter
- [ ] `src/content/idmap.json`:
  - point `quiz-<chapter>` to `/<chapter>/check`
  - add the check-page section anchors
- [ ] `src/content/search.json`: include practice notes and interview questions, tagged by project.

**App code**
- [ ] `src/main.tsx`:
  - add the `/:chapterId/check` route, placed before `/:chapterId/:topicId` so "check" is not read as a topic id
  - add `/practice` if approved
- [ ] `src/data/course.ts`:
  - replace the `QuizQ` type and `totals.questions` with check types and counts
  - add project types and topic fit
- [ ] `src/store/progress.ts`:
  - add the project choice
  - key check answers by section
  - add "practised" interview questions
  - add a v1 → v2 migration of saved quiz answers
- [ ] `src/components/Quiz.tsx`: replace with the check-page components (section block, choose-the-answer, interview card).
- [ ] `src/pages/Chapter.tsx`: remove the inline quiz; add the check card after the lab; update the "Lab and self-check" link.
- [ ] `src/pages/Topic.tsx`:
  - In practice block with project tabs
  - end-of-topic project note
  - "Check this section" link
  - change the rail link "lab and self-check"
- [ ] `src/pages/Home.tsx`: add the project picker cards; change the "Self-check questions" stat.
- [ ] `src/pages/Misc.tsx`: progress page with check scores per chapter instead of the quiz ring; guide unchanged.
- [ ] `src/components/Layout.tsx`: add the top-bar project picker.
- [ ] `src/components/SearchDialog.tsx`: show the project on search hits from practice notes; deep-link with `?project=`.
- [ ] `src/styles/app.css`: replace the `.quiz2` / `.qq2` styles with check-page and project styles.
- [ ] `src/legacy/widgets.js`: the 7.5 memory simulator uses Tidewell text. It stays as it is until it is rebuilt in phase 4.

**Tests**
- [ ] `tests/e2e.cjs`:
  - replace the quiz selectors (`.qq2`, `.quiz-score`)
  - visit every `/<chapter>/check` route
  - switch projects and check that the practice note and dataset change
  - check the end-of-topic note on a `limited` topic

## Open decisions

1. **Names:** Meridian Market, Fernhill Bank and Skyway Travel are working names; check them against real companies before phase 2 content is written.
2. **Question counts:** 3 choose-the-answer and 2–3 interview questions per section is the plan; adjust after the chapters 1–3 pilot if you like.
3. **Practice page:** build the course-wide `/practice` page or not.
