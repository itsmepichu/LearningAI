# Working on LearningAI

## Workflow
- Work in the main checkout, on the one feature branch, `development`. Merge it to `main` through a pull request.
- Do not create git worktrees or a branch per task, and do not start side sessions with their own worktree.
- The site deploys on Vercel. There is no GitHub Pages integration, so do not refer to it or suggest enabling it.

## Current state
- Course content is complete for all 23 chapters and the capstone.
- Every chapter and the capstone have a workshop page with notes for all four projects and lab scenarios. A topic page shows one project (its `primary` in the manifest, else Harbor).
- Every section has a full chapter check (10–12 choose-the-answer and 8–10 interview questions) that follows the quality rules in `src/content/CLAUDE.md`.
- Every chapter (c1–c23, with c19–c23 in Part V) and the capstone use the topic structure in `src/content/CLAUDE.md`.
- The revamp (phases 0–5) is finished; its plan is archived in `docs/archive/project-revamp/`. Open work is in `ROADMAP.md`.

## Where the rules are
- Content, example projects, topic structure and chapter checks: `src/content/CLAUDE.md`.
- Widgets, Colab guides, 3D scenes, walkthroughs and the legacy widgets: `src/widgets/CLAUDE.md`.
- Before changing anything under `scripts/` that touches content or widgets, read `src/content/CLAUDE.md` or `src/widgets/CLAUDE.md`.

## No tests, no checks
This is a UI-only project with no tests and no automated checks. Do not write tests, validation
scripts, checker rules or CI workflows, and do not run a linter or any test suite.
The one exception is `npm run test`: it compiles the TypeScript and builds the site, to catch a
broken import or malformed JSON. Run it only as the last step before a pull request to `main`, never during the work.
The rules in this file are conventions: follow them by reading and writing carefully.
