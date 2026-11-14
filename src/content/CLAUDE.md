# Course content: rules for authors

These rules cover the course content: topics, example projects, notes, glossary, snippets and chapter checks. The root `CLAUDE.md` holds the workflow and the no-tests rule.

## Content
- Course structure lives in `src/content/manifest.json`: chapters, topics, and each topic's `tags`. A topic's `figures`, `interactive` and `words` are not kept there: `npm run generate` counts them from the HTML into `src/content/generated/topic-stats.json`. Counting rules: `figures` is the number of `<figure>` elements; `interactive` is the number of `data-widget` embeds plus the legacy figures without one (class `live` or `flow`, or holding an input, button or select); a snippet counts as a figure and an interactive; a walkthrough counts as an interactive only; `words` is the text outside `<svg>`, tags stripped.
- A topic body is an HTML fragment at `src/content/pages/<chapter>/<topic-id>.html`. It uses the content design system in `src/styles/content.css`:
  - `figure.fig`, `.box.example|pit|lab`, `.terms`, `.tools`, `.flow` steppers
  - evidence tags: `.tag cpu|real|sim|gpu`
- `HtmlContent` rebuilds heading levels into a valid outline when it renders a fragment, and marks a changed heading with `as-hN`, where N is its level in the file. When you style a content heading, style `hN` and `.as-hN` alike.
- Write cross-links as `<a href="#c9-3">` or `<a href="#someElementId">`. `HtmlContent` resolves them through `src/content/generated/idmap.json`, which `npm run generate` builds from the `id` attributes in the pages. To make a link target, give the element an `id`. A target that cannot be derived goes in `src/content/idmap.extra.json`.
- Write new notes and questions with `scripts/content-tools.mjs` (`mergePractice`, `mergeChecks`; helpers `M`, `I`, `C`, `topicText`): write a batch module, run it with `node`, do not commit it. It assigns stable ids, shuffles only the new options with a seed taken from the question id, and checks distractor alignment. It needs Node 22.18 or later. Python is needed only for `npm run datasets`.
- `npm run generate` (run automatically before `dev`, `build` and `test`, and after `npm install`) writes the generated files in `src/content/generated/`, which are not committed: topic counts, link targets, search text and the question counts per chapter and section (`check-summary.json`). It validates nothing. The quality rules (follow-ups, wrong-option explanations, length giveaways, scenario share, duplicate questions) are conventions: every question must follow each one.
- Edit published questions with `reviseChecks(chapter, edits)` from `scripts/content-tools.mjs`: it changes text, options, explanations, kind or follow-up by id, and refuses to change an answer or the number of options.
- `scripts/import_legacy.py` was a one-time import from the v3 single file. Do not re-run it over edited content.
- The search text is generated from the pages. Do not edit or commit anything in `src/content/generated/`.
- Audience: For beginner programmers and students who know basic Python; it ends at building professional AI applications.
- The course is one required sequence: every chapter, section and topic is required; the course takes a beginner to professional AI application building. Do not add learning paths, role-based tracks or wording that makes a topic optional.
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
  - Restructure a whole chapter at once: do not leave a chapter in which only some topics are structured.
- Do not use math formulas in topics (the owner's decision, 6 November 2026). Explain with words, small tables and worked arithmetic such as `240 ÷ 100 = 2.4`; do not use `class="math"`. KaTeX support (`src/components/math.ts`) stays in the code but is unused. No formula symbols outside code: write "the square root of", "add up" and "the length of" in words, with the arithmetic, instead of Σ, √, ‖, ∂, ∇, ∫ or ∏.
- Glossary terms live in `src/content/glossary.json` (`id -> { term, def, topic, aliases? }`; `topic` is the topic that teaches it). Mark a term in topic HTML with `<a class="gl" href="#gl-<id>">`: it shows the definition on hover or focus and opens `/glossary#gl-<id>`. Mark a term once per part, not every mention. Do not link to unknown terms or add entries with unknown topics.
- Runnable snippets: each chapter's snippets live in `src/widgets/py-snippet/c<N>.ts` and are merged in `snippets.ts`; shared data helpers (`projectMessages`, `projectLabelled`, `projectDocs`, `projectTable`, `NUMBER_COLUMNS`) are in `common.ts`. Each snippet holds its code, what it shows and does not show (`proves`), a `build(project, read)` that writes the selected project's data into its files (or `neutral`). Do not write a `check` for a new snippet (the field is optional and the older snippets keep theirs). Embed with `<figure class="fig live" id="snip-<id>"><div class="stage"><div data-widget="py-snippet" data-props='{"snippet":"<id>"}'></div></div><figcaption>…</figcaption></figure>`. It counts as a figure and an interactive, and its link target comes from its `id`. Snippets use only the Python standard library and NumPy.
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
- Do not let length give the answer away: write wrong options as specific and as long as the right one. Do not make a right answer 1.4 times the wrong options' average length or more.
- At least 4 of a section's choose-the-answer questions are `scenario` or `calculation`, not plain recall.
- Every interview question has a `followUp`: the question an interviewer would ask next.
- Vary the position of the right answer. Shuffle options with a fixed seed when adding questions; do not let more than half of a section's answers share a position. Never reorder options of a question that is already published, because saved answers are option indices.
- Write interview questions the way interviewers ask them, with a checklist of what a strong answer covers. Do not write a script to memorise.
