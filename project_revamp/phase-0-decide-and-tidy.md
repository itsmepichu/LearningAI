# Phase 0: Apply decisions and tidy

- **Effort:** 1–2 days · **Depends on:** nothing · **Unblocks:** every other phase
- **Decisions applied:** D1 (audience), D8 (title), D9 (no tests, no checks)
- **Pull request:** none. Commit on `development`; the owner opens one pull request after all phases are done.

## Goal

State one audience and one course name everywhere, remove every test and automated check, and move finished history out of the files every session has to read.

## Expected state at the start

The working tree is not clean, and that is expected:

- `CLAUDE.md` has an uncommitted edit by the owner (a new Checks section). Keep it as your starting text; do not discard it.
- `project_revamp/` and `.idea/` are untracked.

## Why

- The audience is stated four ways: README and home page say "software engineers", `CLAUDE.md` says "expert AI/ML engineer", the topic rules say "entry-level programmer or student", the project brief says beginners.
- The owner has decided the project carries no tests and no checks (D9). At baseline it has 51 unit-test files, 2 test helpers, a 1,421-line end-to-end test, an accessibility test, a CI workflow and a content checker with about 40 rules.
- Of 92 commits, `ROADMAP.md` changed in 39 and `CLAUDE.md` in 33. `ROADMAP.md` is 50 KB and mostly finished phases. `UI_IMPROVEMENTS_PLAN.md` (33 KB) is fully implemented.
- The repo holds a stale worktree, seven stale branch names, a tracked `.pyc` file and an unignored `.idea/` folder.

## Scope

- **In:** documents, git hygiene, the audience sentence, the course name, two stale lines of home-page copy, removal of tests and checks.
- **Out:** any change to app behaviour or course content, beyond the word "manual" where it names the course.

## Tasks

### 0.1 Record the decisions

- Copy the Decisions table from `project_revamp/README.md` into the "Decided" list of `ROADMAP.md`, dated 14 November 2026.
- **Accept:** `ROADMAP.md` lists D1–D9.

### 0.2 One audience sentence (D1)

- Put the D1 sentence, word for word, in: `README.md` (first paragraph), the hero paragraph in `src/pages/Home.tsx`, the opening of `src/content/pages/home/how.html`, and the Content section of `CLAUDE.md`.
- Remove "An Interactive AI Course For My DD" from `README.md`.
- Keep the rule that every chapter, section and topic is required. In `CLAUDE.md`, "a must-learn for an expert AI/ML engineer" becomes "required; the course takes a beginner to professional AI application building".
- **Accept:** no file describes the reader as a software engineer or expert engineer.

### 0.3 One course name (D8)

- The course is "LearningAI". Replace "Enterprise AI Field Manual" at baseline in: `index.html` (title), `src/components/common.tsx` (document title), `src/components/Layout.tsx` (brand label and small text), `src/pages/Home.tsx` (hero heading), `src/widgets/colab-guide/notebook.ts` (two notebook intro lines), `README.md`.
- Tagline under the name, where one is shown: "AI from foundations to production systems".
- Replace "this manual" and "the manual" with "this course" and "the course" where the words name the course (about 10 places in `src/pages`, `src/components` and `src/content/pages`). Leave "manual" alone where it is the ordinary adjective (for example "manual review").
- **Accept:** `grep -rn "Field Manual" src index.html README.md` returns nothing.

### 0.4 Fix stale home-page copy

- `src/pages/Home.tsx` says "Four parts plus field resources"; the manifest has five parts plus resources. Derive the number from `parts`.
- The eyebrow "23 chapters" is typed. Derive it from `totals.chapters`.
- The home page shows four evidence labels; the guide defines five (`Colab · GPU` is missing, and the home text for the `gpu` tag describes Colab). Make the home list match the guide's five labels and wording.
- **Accept:** no chapter or part count is a string literal in `Home.tsx`; both label lists match.

### 0.5 Remove tests and checks (D9)

Delete:

- every `*.test.ts` under `src/` (51 at baseline: 50 under `src/widgets/`, plus `src/data/flashcards.test.ts`);
- the test helpers `src/widgets/kit/testing.ts` and `src/widgets/scene3d/testing.ts` (imported only by tests at baseline; confirm with a search before deleting);
- the whole `tests/` folder (`e2e.cjs`, `axe.cjs`, `ux-scan.cjs`, `out/`);
- `scripts/check_colab_guides.py` and `scripts/colab-notebooks.ts` (the second only feeds the first);
- `.github/workflows/ci.yml`, and `.github/` if it is then empty.

Change:

- `package.json`: remove the scripts `test:unit`, `test:e2e`, `typecheck` and `check:content`. Add one script, `"test": "tsc --noEmit && npm run build"`. Do not run it in this phase: it runs once, after phase 5, to catch broken imports and malformed JSON before the owner opens the pull request. Remove the dev dependencies `playwright` and `@axe-core/playwright` with `npm uninstall`, so the lock file follows.
- `scripts/content-summary.mjs`: keep only what the app needs, which is writing `src/content/checks/summary.json` (question counts per chapter and section). Remove every validation rule, the warnings, the KaTeX import, the glossary and topic-structure sections, and the non-zero exit. Keep the `predev` and `prebuild` hooks that call it.
- `src/widgets/py-snippet/common.ts`: make the snippet field `check` optional. Leave the existing `check` strings in the 165 snippets as they are; do not write the field for new snippets.
- `.gitignore`: remove the `tests/out` line.
- `README.md`: remove the typecheck, unit-test and end-to-end instructions, the CI sentence and the two test lines in the project layout.
- `CLAUDE.md`: replace the Checks section with the text below; delete every instruction to write, list or run a test (unit test beside each widget, `KIT_WIDGETS`, `WIDGET_PAGES`, e2e worker stubs, the Colab CPU check, `scene3d/testing.ts`, the snippet `check` the unit test runs); reword sentences of the form "the checker refuses X" or "X fails the build" into the plain rule ("Do not X"). The content rules themselves stay.

```markdown
## No tests, no checks
This is a UI-only project with no tests and no automated checks. Do not write tests, validation
scripts, checker rules or CI workflows, and do not run a linter or any test suite.
The one exception is `npm run test`: it compiles the TypeScript and builds the site, to catch a
broken import or malformed JSON. Run it only as the last step before a pull request to `main`, never during the work.
The rules in this file are conventions: follow them by reading and writing carefully.
```

- **Accept:** `git ls-files | grep -E "\.test\.ts$|^tests/|testing\.ts$|check_colab|colab-notebooks|workflows/"` returns nothing; the only such script left in `package.json` is `test`, defined as above; a search of `src` and `scripts` finds no import of a deleted file; `content-summary.mjs` contains no `err(`, `flag(` or `process.exit`.

### 0.6 Archive finished plans

- Create `docs/archive/`. `git mv UI_IMPROVEMENTS_PLAN.md docs/archive/`.
- Move the completed phases (1 to 6b), the phase-7 progress log and "Change checklist (phase 2)" from `ROADMAP.md` to `docs/archive/roadmap-phases-1-7.md`. Move the text; do not rewrite it.
- `ROADMAP.md` keeps: agreed scope (short), the "Decided" list, open work (paper walkthroughs, legacy widgets, Colab guides for 19.2 and 20.3), and a link to `project_revamp/`.
- Fix links in `README.md`.
- **Accept:** `ROADMAP.md` is under 150 lines and no text was lost.

### 0.7 Split CLAUDE.md

- Do this after 0.2, 0.3 and 0.5, so the cleaned text is what moves.
- Root `CLAUDE.md` keeps: Workflow, "No tests, no checks", a five-line current state, and pointers to the nested files.
- `src/content/CLAUDE.md` gets: Content, Example projects, Topic structure, Chapter checks (the course's question pages).
- `src/widgets/CLAUDE.md` gets: Widgets (including engines, Colab guides, 3D, walkthroughs, legacy).
- Move sentences word for word. No rule is dropped or added here.
- A nested `CLAUDE.md` loads only when the agent reads files in that folder. So the root file must say: "Before changing anything under `scripts/` that touches content or widgets, read `src/content/CLAUDE.md` or `src/widgets/CLAUDE.md`."
- **Accept:** every remaining bullet exists in exactly one of the three files; the root file is under 60 lines.

### 0.8 Repository hygiene

- Run `git worktree prune`; remove `.claude/worktrees/happy-ardinghelli-1a1294` if it is still listed.
- `git rm --cached scripts/__pycache__/content_tools.cpython-313.pyc`. Add `__pycache__/`, `*.pyc` and `.idea/` to `.gitignore`.
- Stale branches, all merged into `main` at baseline: local `claude/happy-ardinghelli-1a1294`; on `origin`: `claude/happy-ardinghelli-1a1294`, `phase-1-react-app`, `phase-2-projects-and-checks`, `phase-3-rollout`, `plan-example-projects-and-checks`, `ui-improvements-plan`.
- Local `develop` is 1 commit ahead of `main` (`97c2234`, "Set the working rules: one branch, e2e at the end, no GitHub Pages") and 60 behind.
- **Owner review:** show the branch list with `git branch -a --merged main`, show what `97c2234` changed, and delete only after the owner says yes.
- **Accept:** `git branch -a` shows `main` and `development` (plus anything the owner chose to keep).

### 0.9 Commit the plan folder

- Commit `project_revamp/` on `development` so every later session can read it.

## Review by inspection

- Read the full diff once before the final commit.
- Search for imports of every deleted file.
- Hand-off: ask the owner to open the home page, one topic and one chapter check page.

## Done when

- The root holds three short documents: `README.md`, `CLAUDE.md`, `ROADMAP.md`.
- The D1 sentence appears in four places and the old course name appears nowhere.
- The repository contains no test, no test helper, no CI workflow and no checker rule.

## Results

Commits: `234d20c` (0.1–0.4), `2a88318` (0.5), `1d64057` (0.6), `b479c92` (0.7), `aaf869b` (0.8), `88de249` (0.9). Nothing was built, typechecked or run, as D9 requires.

| Measure | Before | After |
|---|---|---|
| Test files, helpers, `tests/`, CI, Colab check scripts | 51 + 2 + 3 files + 1 workflow + 2 scripts | none (60 files deleted in all) |
| `package.json` scripts | `typecheck`, `check:content`, `test:unit`, `test:e2e` | one `test` (`tsc --noEmit && npm run build`); `playwright` and `@axe-core/playwright` removed from `package.json` and the lock file |
| `scripts/content-summary.mjs` | 200 lines, about 40 rules, exits non-zero | 30 lines: writes `checks/summary.json` only (counts unchanged: 1,794 and 1,312) |
| Root `CLAUDE.md` | 133 lines | 25 lines; `src/content/CLAUDE.md` (72) and `src/widgets/CLAUDE.md` (41) hold the rest word for word |
| `ROADMAP.md` | 500 lines | 60 lines; the rest is in `docs/archive/roadmap-phases-1-7.md` (460 lines, verified no line lost except one `---`) |
| Stale git items | worktree, 8 branch names, tracked `.pyc` | worktree metadata pruned, `.pyc` untracked, local `develop` and local `claude/happy-ardinghelli-1a1294` deleted |

Other changes: `Home.tsx` now derives the chapter count and the part count from the manifest and lists all five evidence labels; the course map and the hero use the D1 sentence; "this manual" became "this course" in 11 files (the Appendix A dataset label is now "The course's own text"); `.label-grid` wraps to fit five labels; the snippet field `check` is optional.

Deferred (needs your machine):
- The six stale branches on `origin` are not deleted: this environment has no SSH access to GitHub. Run: `git push origin --delete claude/happy-ardinghelli-1a1294 phase-1-react-app phase-2-projects-and-checks phase-3-rollout plan-example-projects-and-checks ui-improvements-plan`
- The folder `.claude/worktrees/happy-ardinghelli-1a1294` is half removed (git no longer lists it; the mounted drive is too slow to finish deleting `node_modules`). It is ignored by git. Delete it in Explorer.
- Nothing was pushed. `development` is ahead of `origin/development`.

Notes for later phases:
- The working tree on this machine uses CRLF while the repository stores LF (`core.autocrlf` is on for you). Files edited here are saved with LF; git treats both the same.
- The how.html figure caption still says "Four bands"; it was outside this phase's scope.
