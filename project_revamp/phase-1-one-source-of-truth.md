# Phase 1: One source of truth

- **Effort:** 3–4 days · **Depends on:** phase 0 · **Unblocks:** phases 2, 3 and 4 (their bulk edits rely on this tooling)
- **Decisions applied:** D7 (generated files are not committed), D9 (no tests, no checks)
- **Pull request:** none. Commit on `development`; the owner opens one pull request after all phases are done.
- **Slices (commit groups):** (a) tasks 1.1–1.2, (b) tasks 1.3–1.4, (c) tasks 1.5–1.7

## Goal

An author adds a topic by editing four files: the topic HTML, its note, its questions and its snippet. Every list, count and index is generated. Node alone covers day-to-day authoring.

## Why

- Adding one topic touched about 10 files at baseline. Phase 0 removed the two test lists; the rest remain: topic HTML, `manifest.json`, practice JSON, checks JSON, `glossary.json`, `idmap.json`, the snippet module and `search.json`.
- The most-edited data files in git history are registries: `checks/summary.json` (23 commits), `manifest.json` (18), `idmap.json` (16), `search.json` (13).
- Hand-kept counts already drift: topic 2.3 (manifest says 4 figures, the HTML has 3), 11.4 (542 words against about 465), D coverage (1,401 against about 1,666).
- Authoring tools are Python (`content_tools.py`, `refresh_search.py`); the generator is Node. npm scripts call `python3`, which is often missing from the path on Windows, the owner's platform.
- `search.json` (734 KB) is rebuilt only when someone remembers to run a script.

## Scope

- **In:** scripts, generated data, npm scripts, editor support.
- **Out:** topic content, UI, the practice model, and anything D9 forbids (tests, validation rules, CI, lint).

## Target layout

All generated files live in one ignored folder, `src/content/generated/`:

| File | Replaces | Built from |
|---|---|---|
| `topic-stats.json` | `figures`, `interactive`, `words` in `manifest.json` | topic HTML |
| `idmap.json` | `src/content/idmap.json` | element ids in pages, plus `src/content/idmap.extra.json` |
| `search.json` | `src/content/search.json` | topic HTML and the manifest |
| `check-summary.json` | `src/content/checks/summary.json` | the checks files |

One command, `npm run generate` (`scripts/generate.mjs`, which absorbs `content-summary.mjs`), writes all four. It generates only; it validates nothing.

## Tasks

### 1.1 Generate topic counts

- Compute per topic and write `topic-stats.json`. Merge it in `src/data/course.ts`; remove the three fields from `manifest.json`. They are read in `course.ts` (`minutes`, `totals`), `src/pages/Topic.tsx` and `src/pages/Home.tsx`.
- Counting rules: `figures` = `<figure` elements; `interactive` = `data-widget` embeds plus legacy `figure.fig.live` blocks without a `data-widget`; a snippet counts as a figure and an interactive; a walkthrough counts as an interactive only; `words` = text outside `<svg>`, tags stripped.
- Write these rules into `src/content/CLAUDE.md`, replacing "update its counts there".
- **Accept:** a one-off comparison shows the rules reproduce the old manifest value for at least 95% of topics; the hand-off lists every topic whose number changes.

### 1.2 Generate idmap entries

- `idmap.json` (828 entries) maps an element id to a route. It is read by `resolveAnchor` in `course.ts`.
- Generate it from the `id="…"` attributes in the pages plus topic and chapter ids. Entries that cannot be derived move to a small hand-kept `src/content/idmap.extra.json`.
- **Accept:** a one-off comparison shows the generated map contains every baseline entry with the same route. Do not keep the comparison script.

### 1.3 Node-only authoring

- Port `scripts/content_tools.py` (`merge_practice`, `merge_checks`, `revise_checks`, `topic_text`, helpers `M`, `I`, `C`) and `scripts/refresh_search.py` to Node. Python stays for `make_datasets.py` only.
- Keep the tools' behaviour as described in the Python docstrings: next free stable id, identical question text skipped, fixed-seed shuffle for NEW questions only, published questions never reshuffled, `revise` does not change an answer or the number of options.
- The Node shuffle need not reproduce Python's order, because only new questions are shuffled. Use the seeded generators in `src/widgets/kit/random.ts`.
- Preserve JSON formatting (indent, non-ASCII characters, trailing newline) so the ported tools produce no diff on untouched files.
- Make `npm run datasets` find Python on Windows: try `python3`, `python`, then `py -3`.
- **Accept:** running a no-op merge and the search rebuild on the baseline leaves `git status` unchanged. Then delete the two Python files and update the references in the `CLAUDE.md` files.

### 1.4 Generated files out of git (D7)

- Move the four files to `src/content/generated/` and update the imports: `src/data/course.ts`, `src/components/SearchDialog.tsx`, and the glob exclusions in `src/data/checks.ts`.
- `checks/legacy-quiz-map.json` is NOT generated. It stays where it is, committed.
- Run `npm run generate` from `predev`, `prebuild`, `pretest` and `postinstall`, so `npm run test` compiles against fresh generated files. The Vercel build runs `npm run build`, so generation must be Node-only (task 1.3 first).
- Add `src/content/generated/` to `.gitignore` and remove the old files from the index.
- **Accept:** after `npm run generate`, the four files exist and `git status` lists none of them; a search finds no import of an old path.

### 1.5 Scaffold a topic

- `npm run new:topic -- <chapterId> <topicId> "<Title>"` creates: the HTML with the five parts and the practice slot, the manifest entry, note stubs, a check section stub, and a snippet stub in `src/widgets/py-snippet/c<N>.ts`.
- Every stub carries a visible `TODO` so nothing unfinished is published by accident.
- **Accept:** trial with a throwaway topic (`c1-99`): the only files left to edit by hand are the HTML, the note, the questions and the snippet. Revert the trial; do not commit it. Put the list of touched files in the hand-off.

### 1.6 Editor hints for content files

- Add JSON Schemas under `schemas/` for `manifest.json`, `practice/*.json`, `checks/*.json`, `glossary.json` and `projects.json`, for autocompletion and inline hints in the editor. Nothing runs them.
- Do not add a `$schema` key inside the data files: code iterates their keys and would read it as a topic or project. Map schemas by path in `.vscode/settings.json`, and add a short note for JetBrains IDEs in `docs/`.

### 1.7 Editor config

- Add `.editorconfig` matching the current style (indent, line endings, final newline). No formatter, no lint step.

## Review by inspection

- Read `course.ts`, `SearchDialog.tsx` and `checks.ts` after the path changes.
- Hand-off: ask the owner to run `npm install` and open the home page, a topic, search, and a cross-link.

## Done when

- A new topic needs four authored files.
- Python is needed only for `npm run datasets`.
- No generated file is in git.
