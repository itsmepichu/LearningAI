# LearningAI revamp: agent brief

You are the coding agent for the LearningAI revamp. This file is your starting prompt. Read all of it, then read the one phase file you are asked to run.

## Your job

- The owner runs one phase per session and names it ("Run phase 2"). If no phase is named, run the first phase in the table below whose status is not Done.
- Execute that phase only. Do not start work that belongs to a later phase.
- Every decision is already made (see Decisions). Do not reopen one. If a decision cannot be implemented as written, stop and report why.

## No tests, no checks (D9)

This is a UI-only project and the owner has decided it carries no tests and no automated checks.

- Do not run: the build, the typecheck, any test, any linter, any checker script, any CI job.
- Do not write: unit tests, end-to-end tests, accessibility tests, test helpers, validation scripts, checker rules, CI workflows or lint steps.
- You may run: the project's own generators and authoring tools (`npm run generate`, `npm run new:topic`, the merge and revise tools, `npm run datasets`), `npm install` or `npm uninstall` when a task changes dependencies, and read-only commands such as `grep`, `git diff` and a one-off count.
- Verify by reading. Each task has an **Accept** line; meet it by inspecting the diff, a search or a count. Never add a script to the repository to verify something.
- Nothing is compiled until the end of the revamp, so read every file that imports something you changed.

**One exception: `npm run test`.** It is not a test suite. It compiles the TypeScript and builds the site once (`tsc --noEmit && npm run build`), to catch a broken import or malformed JSON.

- Run it once only: after phase 5 is finished, as the last step of the whole revamp (phase 5, task 5.7).
- Do not run it in phases 0 to 4, and not during phase 5.
- If it fails, fix the cause, whichever phase it came from, and run it again until it passes.
- Do not add anything else to it.

D9 overrides any instruction in `CLAUDE.md` that mentions tests, typecheck, build or the checker. Phase 0 rewrites those instructions.

## Before you change anything

1. Read `CLAUDE.md` at the repository root, and the nested `src/content/CLAUDE.md` and `src/widgets/CLAUDE.md` once phase 0 has created them.
2. Read this file and the phase file.
3. Check that every phase the phase file depends on is Done in the table below. If not, stop.
4. Check that you are on `development`, up to date with `origin`, with a clean tree (phase 0 lists the two exceptions it expects).
5. Post a short plan: the tasks in order and the slices. Then begin. Wait for a reply only when a stop rule applies.

## The project in five lines

- LearningAI is a front-end-only React, TypeScript and Vite app: an interactive AI course, deployed on Vercel.
- Content is data: topic HTML fragments, JSON for structure, notes, questions and glossary, TypeScript modules for runnable Python snippets.
- A Node script runs before `dev` and `build` to generate derived data (question counts today; more after phase 1).
- Four fictional example projects (Harbor, Store, Bank, Travel) with synthetic datasets carry the hands-on work.
- Learner state is stored only in the reader's browser.

## Why this revamp

- **Manageability.** Adding one topic touches about 10 files; the most-edited files in git are registries and planning documents.
- **Audience.** The course was written for working engineers. It is now for beginner programmers and students.
- **Practice.** Every 650-word lesson carries about 1,250 words of practice material, in four project versions, and the example project is threaded through notes, snippets, widgets and questions.

## Decisions (final, made by the owner on 14 November 2026)

| Id | Decision | Applies in |
|---|---|---|
| D1 | **Audience.** Use this sentence, word for word: "For beginner programmers and students who know basic Python; it ends at building professional AI applications." | 0, 2 |
| D2 | **Practice model B.** One project inside the lesson. The four-project work moves to one workshop page per chapter. All existing notes are kept. | 3, 4 |
| D3 | **Lesson project.** Harbor in every lesson, except the 5 topics where Harbor's fit is `limited` (15.1, 15.8, 15.10, 19.4, 20.4), which use their best-fit project. | 3 |
| D4 | **Question quota for new sections.** At least 6 choose-the-answer (3–5 of them `core`) and at least 4 interview questions. The existing bank is not trimmed. | 4 |
| D5 | **Before you start.** A standalone, required `/start` page. Not a chapter, not a guide section. | 2 |
| D6 | **Paper walkthroughs.** Four first, listed in phase 5. More only after reader feedback. | 5 |
| D7 | **Generated files.** Not committed. Built automatically before dev and build, and after install. | 1 |
| D8 | **Title.** The course is called "LearningAI". The name "Enterprise AI Field Manual" is retired, and "this manual" becomes "this course". | 0 |
| D9 | **No tests, no checks.** No unit, end-to-end or accessibility tests, no CI, no content-rule checker. Existing tests and checker rules are removed in phase 0. The one exception is `npm run test` (compile and build), run once after all six phases are done, before the owner opens the pull request. Content rules stay as written conventions in the `CLAUDE.md` files. | all |

## Phases

| # | File | Goal | Effort | Depends on | Status |
|---|---|---|---|---|---|
| 0 | [phase-0-decide-and-tidy.md](phase-0-decide-and-tidy.md) | Apply the audience and title; remove tests and checks; clear finished history | 1–2 days | — | Not started |
| 1 | [phase-1-one-source-of-truth.md](phase-1-one-source-of-truth.md) | A new topic needs four authored files; the rest is generated | 3–4 days | 0 | Not started |
| 2 | [phase-2-beginner-on-ramp.md](phase-2-beginner-on-ramp.md) | A reader with basic Python never meets an unexplained term | 5–7 days | 1 | Not started |
| 3 | [phase-3-lesson-and-workshop.md](phase-3-lesson-and-workshop.md) | One project in the lesson; a workshop page per chapter | 6–9 days | 1 | Not started |
| 4 | [phase-4-review-and-evidence.md](phase-4-review-and-evidence.md) | Quick check per topic, levelled interview prep, an Evidence page | 4–6 days | 2, 3 | Not started |
| 5 | [phase-5-depth-and-feedback.md](phase-5-depth-and-feedback.md) | Get feedback from real beginners, then add depth | 5–8 days | 4 | Not started |

Run order: 0, 1, 2, 3, 4, 5. Effort is an estimate for one person working with a coding agent.

## Rules for every phase

- Work in the main checkout on `development`. No worktrees, no branch per task. Nothing goes to `main` during the revamp.
- Never reuse or renumber a question id. Never reorder the options of a published question. Never change an answer.
- Never change an existing chapter id, topic id or element id. Add, do not rename.
- Never delete or rewrite existing notes or questions unless a task says so explicitly.
- No math formulas in topics. Fictional company names only. Label simulations and illustrative numbers. Link official documentation.
- The course is one required sequence. Do not add learning paths, role-based tracks or wording that makes a topic, page or step optional.
- Do not re-run `scripts/import_legacy.py`.
- When a task changes a rule, update the `CLAUDE.md` file that holds the rule in the same commit.
- Do not add a dependency unless a task names it.

## How to work

- Follow the task order in the phase file. A task is done only when its Accept line is met by inspection.
- Commit per task or per small group of tasks, with a message that names the task ("Phase 1.2: generate idmap entries").
- The phase file lists slices: groups of commits on `development`, done in order. Report at the end of each slice.
- Do not open a pull request. The owner opens one pull request to `main` after all six phases are done and `npm run test` has passed. Ask the owner before pushing `development`.
- Prefer the simplest change that meets the Accept line. Do not add features the task does not ask for.

## Stop rules

Stop and ask the owner when:

- a task would delete a git branch, or anything a reader's saved progress depends on;
- an Accept line cannot be met without breaking a rule above;
- the repository differs clearly from what the phase file describes;
- a phase you depend on is not Done;
- a task says "owner review".

## Hand-off at the end of a phase

1. Set the Status in the table above to Done, with the commit range.
2. Add a "Results" section at the bottom of the phase file: what changed, numbers before and after, anything deferred and why.
3. Update `ROADMAP.md` (open work only).
4. Tell the owner which pages to open in the browser to see the change, and anything you could not confirm by reading.

## Terms

| Term | Meaning |
|---|---|
| Note | One topic's In practice, Failure to avoid and Try it for one project (`src/content/practice/<chapter>.json`) |
| Chapter check | The course's own question pages for readers (`/<chapter>/check`). This is course content, not a software check, and D9 does not touch it |
| Primary project | The single project a topic's lesson shows (phase 3) |
| Workshop | Page per chapter where the reader picks a project and does the lab and Try-it tasks (phase 3) |
| Quick check | 3–5 `core` questions shown to the reader at the end of a topic (phase 4). Course content, not a software check |
| Tier | `core` or `extended`, a field on choose-the-answer questions (phase 4) |
| Evidence page | List of lab deliverables and capstone milestones the reader has kept (phase 4) |
| Generated file | A file a script rebuilds from authored files; never edited by hand, never committed |

## Baseline (branch `development`, commit `860f52a`, 14 November 2026)

| Measure | Value |
|---|---|
| Structure | 5 parts, 23 chapters, capstone, 4 appendices; 172 topics (166 in chapters and capstone) |
| Topic text | about 113,000 words in 200 HTML fragments |
| Question bank | 1,794 choose-the-answer + 1,312 interview, in 164 sections |
| Notes | 664 (166 topics × 4 projects) + 92 lab scenarios (23 chapters × 4) |
| Snippets · widgets | 165 snippets (82 use project data) · 48 registered widgets (27 read the project dataset) |
| Glossary · link targets | 316 terms · 828 `idmap.json` entries |
| Legacy widget blocks in content | 51 (18 on Part I pages) |
| Tests at baseline (removed in phase 0) | 51 unit-test files, 2 test helpers, 3 files in `tests/`, 1 CI workflow |
