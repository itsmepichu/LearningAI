# Phase 3: Lesson and workshop split

- **Effort:** 6–9 days · **Depends on:** phase 1 (and phase 2 by run order) · **Unblocks:** phase 4
- **Decisions applied:** D2 (model B), D3 (Harbor in every lesson), D9 (no tests, no checks)
- **Pull request:** none. Commit on `development`; the owner opens one pull request after all phases are done.
- **Slices (commit groups):** (a) tasks 3.1–3.5 with the new pages live for chapters 1 and 9 only (pilot); (b) rollout to every chapter and tasks 3.6–3.8

## Goal

A lesson shows one project. All four-project work lives on one workshop page per chapter, where the reader picks a project. A new topic needs one note, not four. Nothing already written is deleted or rewritten.

## Why

- The example project is a parameter of almost everything: 664 notes (4 per topic), 92 lab scenarios, 82 of 165 snippets, 27 of 48 widgets, 188 interview questions.
- A reader on one project sees 166 of the 664 notes. The other 498 notes (about 37,000 words) are read only by someone who switches.
- A beginner's first topic ends with four tabs, best-fit stars, a per-visit override banner, dataset downloads and a fit note.
- About a quarter of the Try-it tasks say "open the CSV and count", with no viewer and no named tool.

## Design (decided)

| Layer | Page | Project |
|---|---|---|
| Learn | Topic page: five parts and one "In practice" card | The topic's primary project |
| Apply | Chapter workshop: lab, scenario, Try-it tasks in topic order | The reader's choice, remembered |
| Review | Chapter check, Practice page, flashcards | Unchanged in this phase |

- **Data on a topic page.** Snippets and widgets use the `?project=` parameter if present, otherwise the topic's primary project.
- **From workshop to figure.** A workshop task links to `/<chapter>/<topic>?project=<id>#<figure id>`. The topic then shows a one-line banner ("Example data: Store · Back to the workshop") and runs its figures on that project's data.
- **Project picker.** Removed from topic pages. Shown on the workshop, capstone, chapter check and Practice pages. The saved `project` in `src/store/progress.ts` is the reader's workshop project.
- **Lab.** Moves from the chapter page into the workshop page. The chapter page shows two cards after the topic list: Workshop, then Chapter check. Existing `#lab` links and `lab-<chapter>` ids must still resolve, now to the workshop.
- **Limited fit.** When the chosen project's note for a topic is `limited`, the workshop shows its `fitNote` and offers the best-fit project's task instead.

## Scope

- **In:** primary project per topic, the topic card, the workshop page, authoring rules, a data explorer, authoring tools, the guide and rule files.
- **Out:** rewriting or deleting notes; changing how existing snippets and widgets load data beyond the rule above; questions and quick checks (phase 4); any test or checker rule (D9).

## Tasks

### 3.1 Primary project per topic (D3)

- Add an optional `primary` to a topic in `src/content/manifest.json`; the default is `default` from `src/content/projects.json` (Harbor). Do not put it in the practice files: code reads every key there as a project id.
- Set `primary` on exactly five topics, where Harbor's `fit` is `limited`: `c15-1`, `c15-8`, `c15-10`, `c19-4`, `c20-4`. Choose the project rated `best`; if none, the first rated `good` in the order Store, Bank, Travel.
- Put the resolution and the workshop task list in a plain module, `src/data/workshop.ts`.
- **Accept:** the manifest has `primary` on those five topics only, and each named project has a note for that topic.

### 3.2 Topic page: one card

- In `src/components/Practice.tsx`, replace the tabbed `PracticeBlock` on topic pages with one card for the primary project: In practice, Failure to avoid, Try it, and a link "Do the chapter workshop" to `/<chapter>/workshop#<topic>`.
- Remove from topic pages: the project tabs, the best-fit star, the `pb-peek` banner, `ProjectFitNote` and the dataset list.
- Add the one-line banner for a `?project=` visit (see Design).
- Do not edit topic HTML. `<div data-slot="practice"></div>` stays where it is.
- **Accept:** `Topic.tsx` no longer renders tabs or `ProjectFitNote`; the card names the project and company once.

### 3.3 Chapter workshop page

- Route `/:chapterId/workshop` in `src/main.tsx`, declared before `:chapterId/:topicId` so `workshop` is not read as a topic id (as `check` is today).
- Sections, in order:
  1. project picker (four choices, saved);
  2. the lab (`_lab.html`) with that project's scenario (`_lab` in the practice file, today rendered by `LabVariant`);
  3. tasks: for each topic in chapter order, that project's Try it, with its In practice and Failure to avoid collapsed beneath, and the link that opens the topic's figure with that project's data;
  4. the evidence to keep, and a "Workshop done" control.
- Read the same `src/content/practice/<chapter>.json` files. No note is rewritten or moved.
- "Workshop done" is new state in `src/store/progress.ts`: bump the persist version and add a `migrate` step that keeps every existing field. Read the existing `migrate` function first and follow its pattern; saved reader progress must survive.
- The capstone has no lab; its workshop shows tasks only.
- Follow `src/widgets/CLAUDE.md` for accessibility: 24 px targets, 12 px text floor, colour tokens, reduced motion.
- **Accept:** the route exists; for chapters 1 and 9 every project has a scenario and tasks to show; the `migrate` step returns all earlier fields unchanged.

### 3.4 Authoring rules

- Replace "every topic needs an entry for all four projects" in `src/content/CLAUDE.md` with these conventions (nothing enforces them; D9):
  - a. every chapter and capstone topic has a note for its primary project with `practice`, `failure` and `tryIt`;
  - b. notes for the other projects are optional per topic;
  - c. per chapter and project: a `_lab` scenario when the chapter has a lab, and at least two topics with a `tryIt` and a `fit` other than `limited` (baseline minimum: chapter 4 with Travel, 2 of 6; the capstone has 2 topics and no lab);
  - d. a `limited` note still needs another project rated `best` or `good`, and the practice slot still sits between Code and Primary sources.
- **Accept:** the rules are in `src/content/CLAUDE.md`; a one-off count confirms the baseline content already meets a, c and d.

### 3.5 Data explorer

- One React widget in `src/widgets/data-explorer/`, built on the shared kit: pick a dataset file of the current project; see the first rows and the columns; count rows by a column's values; count rows matching one filter; show the mean of a numeric column.
- Logic in a plain `.ts` module beside the component; the loader takes `(project, read)`; register it lazily in `src/widgets/registry.ts`.
- Embed it on the workshop page and on `/start`. Do not embed it in topic HTML.
- On the workshop page, when a task's text names a dataset file of that project (for example `<code>orders.csv</code>`), add an "Open in the data explorer" link. Detect it from the text; do not edit the notes.
- **Accept:** walk through two "open the file and count" tasks from chapters 1 and 3 against the code and confirm each step is possible in the widget.

### 3.6 Owner review of the pilot, then rollout

- **Owner review:** give the owner the URLs for chapters 1 and 9: two workshop pages and two topic pages, to open in light and dark theme.
- After approval, switch every chapter. The pages render from data, so rollout is removing the pilot condition and reading the chapters with unusual labs.

### 3.7 Authoring tools

- `new:topic` creates one note, for the primary project. `merge_practice` accepts any subset of projects.
- Rule for new work, added to `src/widgets/CLAUDE.md`: a new snippet or widget may be Harbor-only or `neutral`. Existing project-aware ones are left as they are.

### 3.8 Rules, guide and search

- Update `src/content/CLAUDE.md` (Example projects, Topic structure), the "Four example projects" section of `how.html`, the `/start` page and `README.md`.
- A search result for a non-primary project's note opens the workshop, not the topic.

## Review by inspection

- `git diff --stat main -- src/content/practice/` must be empty.
- Report: the five topics with a non-default primary; chapters where a project has fewer than two workshop tasks (none expected).
- Hand-off: ask the owner to open two workshops, two topics, a `?project=` link from a workshop task, and an old `#lab` link.

## Done when

- No topic shows project tabs.
- Every chapter has a workshop for all four projects.
- All 664 existing notes are still in the repo and reachable from a workshop.

## Results

Commits: `33a5541` (slice a: 3.1–3.5, chapters 1 and 9), `b99edd0` (rollout to every chapter), then the 3.7 and 3.8 commit. The owner reviewed the chapter 1 and 9 pilot and approved it. Nothing was built, typechecked or opened in a browser (D9).

| Item | Result |
|---|---|
| Primary project | `primary` in the manifest on exactly `c15-1`, `c15-8`, `c15-10` (Store; Store and Travel are both `best` for the first two, Store comes first in the order; `c15-10` has no `best`, Store is the first `good`) and `c19-4`, `c20-4` (Travel, the only `best`). Every other topic uses Harbor. |
| Topic card | One card for the primary project; tabs, best-fit star, per-visit banner, fit note and dataset list are gone from topic pages. The project picker is hidden on topic pages and shown on the workshop, capstone, chapter check and Practice pages. |
| `?project=` | A topic opened with `?project=<id>` shows a one-line "Example data" banner with a link back to the workshop; snippets and widgets use that project. Without it they use the primary project (the capstone uses the saved project). |
| Workshop | `/<chapter>/workshop` for all 23 chapters and the capstone: picker, lab with that project's scenario, a task per topic (limited or missing notes show the best-fit project's task with a line saying why), data explorer, evidence note and a "Workshop done" control. The chapter page shows a Workshop card and a Chapter check card. |
| Old links | `#lab` and `#lab-<chapter>` on a chapter page redirect to the workshop; the generated `lab-<chapter>` id maps to the workshop. |
| Progress store | Persist version 4 with `workshopDone`; the earlier v1 to v3 steps are unchanged in `migrateEarlier`, and the new `migrate` adds the field without dropping any other. |
| Data explorer | `src/widgets/data-explorer/`: pick a file, first rows and columns, count by a column, count rows matching one filter, mean of a number column, and a box that applies the filter to the other two tools. On `/start` and every workshop; a workshop task that names a dataset file gets an "Open in the data explorer" link. |
| Authoring | Conventions a to d in `src/content/CLAUDE.md`; one-off count: the 664 existing notes already meet a, c and d. `new:topic` makes one note (for `--primary`, default Harbor); `mergePractice` takes any subset and warns when a topic has no primary note. The widget rule is in `src/widgets/CLAUDE.md`. |
| Rules, guide, search | `CLAUDE.md` files, README, `how.html`, `/start` updated. A search result for a non-primary project's note sets that project and opens the workshop at the topic; the capstone sets the project and opens the topic. |
| Review by inspection | `git diff --stat main -- src/content/practice/` shows one change, the Harbor lab scenario in `c1.json` from phase 2 task 2.8; phase 3 edited no note. No chapter has a project with fewer than two usable workshop tasks. |

Known limits:
- A task's "Open the figure" link goes to the topic's first interactive figure; that figure may not read project data.
- The explorer has one filter, so a rule with two conditions takes two steps (filter the first, then look at the second column's counts).
- The data-explorer widget is not in the e2e or axe lists, because of D9.
- The Practice page and chapter check still use the saved project, as designed; phase 4 and later phases build on that.
