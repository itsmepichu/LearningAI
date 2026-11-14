# Roadmap

## Agreed scope

- A pure React (Vite) app with heavy use of 3D and motion, hosted as a static site on Vercel.
- Real models in the browser, on the CPU, as opt-in downloads of tens of MB.
- **What may use a GPU:** study material, such as diagrams, 3D scenes and interactive figures, may use the reader's GPU, and should stay light enough for laptops with integrated graphics. LLM training and other practical GPU work does not run in this project: it goes in step-by-step Google Colab guides.
- Deeper versions of all 18 chapters, plus new chapters.
- **Four example projects you choose between:**
  - Harbor stays.
  - Online store, Bank and Travel booking are added.
  - No choice is needed up front: everyone starts with Harbor and can switch at any time.
  - The project you pick decides which practical content, datasets, labs and experiments you see.
  - When another project suits a topic better, a short note at the end of the topic says so.
- **Chapter checks on their own page:**
  - Questions move out of the chapter page to a separate check page at the end of each chapter.
  - The page is grouped by section (one per topic).
  - Each section has **10–12 choose-the-answer questions** and **8–10 likely interview questions**.
- **A course-wide Practice page** (`/practice`):
  - Filter by chapter, question kind, level and example project.
  - Draw random sets of questions and review earlier mistakes, for interview preparation.

Where a revamp decision (D1 to D9 below) differs from this scope, the decision wins.

## Open work

- **The revamp** (`project_revamp/`, phases 0 to 4 done, run one per session): depth and reader feedback come next. The lesson shows one project, each chapter has a workshop page, every topic ends with a quick check, and an Evidence page and part checkpoints close each part.
- **Paper walkthroughs:** four first (phase 5 of the revamp, D6), more only after reader feedback.
- **Phase 0 leftovers (owner):** delete the six stale branches on `origin` and the folder `.claude/worktrees/happy-ardinghelli-1a1294` (commands in `project_revamp/phase-0-decide-and-tidy.md`, Results).
- **Legacy widgets:** whether to port the v3 blocks left in `src/legacy/widgets.js` (see Open decisions).
- **Colab guides** for a vision-language model (19.2) and logit distillation (20.3): a possible follow-up; both topics run on a CPU today.

Finished phases 1 to 7 and the design notes are in [docs/archive/roadmap-phases-1-7.md](docs/archive/roadmap-phases-1-7.md); the finished UI plan is in [docs/archive/UI_IMPROVEMENTS_PLAN.md](docs/archive/UI_IMPROVEMENTS_PLAN.md).

## Open decisions

1. **Names.** Keep Bazrova, Navakosh Bank and Safarnova, or choose other fictional names (one-file change in `projects.json`).
2. **Legacy widgets.** Whether to port the 59 v3 blocks left in `src/legacy/widgets.js`. They work and are not scheduled.

Decided (14 November 2026, the revamp; see `project_revamp/README.md`):
- **D1 Audience.** "For beginner programmers and students who know basic Python; it ends at building professional AI applications."
- **D2 Practice model B.** One project inside the lesson. The four-project work moves to one workshop page per chapter. All existing notes are kept.
- **D3 Lesson project.** Harbor in every lesson, except the 5 topics where Harbor's fit is `limited` (15.1, 15.8, 15.10, 19.4, 20.4), which use their best-fit project.
- **D4 Question quota for new sections.** At least 6 choose-the-answer (3–5 of them `core`) and at least 4 interview questions. The existing bank is not trimmed.
- **D5 Before you start.** A standalone, required `/start` page. Not a chapter, not a guide section.
- **D6 Paper walkthroughs.** Four first, listed in phase 5. More only after reader feedback.
- **D7 Generated files.** Not committed. Built automatically before dev and build, and after install.
- **D8 Title.** The course is called "LearningAI". The name "Enterprise AI Field Manual" is retired, and "this manual" becomes "this course".
- **D9 No tests, no checks.** No unit, end-to-end or accessibility tests, no CI, no content-rule checker. Existing tests and checker rules are removed in phase 0. The one exception is `npm run test` (compile and build), run once after all six phases are done, before the owner opens the pull request. Content rules stay as written conventions in the `CLAUDE.md` files.

Decided earlier:
- **Pilot review (6 November 2026):** chapters 1–3 against the rollout in chapters 4–18.
  - **Notes:** both lengths are kept. Pilot notes run about 30% longer (In practice: a median of 39 words against 28), and both are concrete and project-specific. The standard is the range they span: about 25–45 words for In practice and Try it, and 12–25 for Failure to avoid.
  - **Question mix:** 10–12 choose-the-answer and 8–10 interview questions per section, with about 3 fundamentals, 3 applied and 2 system design, as built. At least 4 of each section's choose-the-answer questions must be scenario or calculation questions; 75% of the rollout's are plain concept questions.
  - **Quality:** the question bank is fixed before phase 7, so new chapters follow a clean standard. Done in phase 6b; the checker now enforces the rules.
- **Question counts:** 10–12 choose-the-answer and 8–10 interview questions per section.
- **Practice page:** yes, built in phase 2.
- **Project choice:** no up-front choice; Harbor by default, switchable at any time.
- **GPU use:** study visuals may use the reader's GPU; LLM training and practical GPU work go to Google Colab guides.
- **Colab guides:** copyable cells and a downloadable notebook that readers run in their own Colab. The course does not run them in Colab itself.
- **Company names:** fictional only. Real companies' names (for example the proposed Meesho and SBI) cannot carry invented systems, figures and mistakes on a public site.
