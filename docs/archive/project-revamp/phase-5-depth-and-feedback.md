# Phase 5: Depth and feedback

- **Effort:** 5–8 days, then ongoing · **Depends on:** phase 4
- **Decisions applied:** D6 (four paper walkthroughs first), D9 (no tests, no checks)
- **Pull request:** none. Commit on `development`; the owner opens one pull request after all phases are done.
- **Slices (commit groups):** one per task; task 5.4 in groups of 3–5 widgets

## Goal

Find out where real beginners stop, then add the remaining depth from the old roadmap in the order that helps beginners most.

## Why

- Nobody outside the project has read the course. Progress is stored only in the reader's browser, so there is no usage data.
- 51 legacy widget blocks remain in topic HTML, served by `src/legacy/widgets.js` (820 lines). 18 are on Part I pages, which beginners meet first: chapter 2 (5), 3 (1), 4 (3), 5 (4), 6 (5).
- The old roadmap still lists paper walkthroughs and two follow-up Colab guides: a vision-language model (19.2) and logit distillation (20.3).

## Scope

- **In:** a reader-feedback kit, a report link, four paper walkthroughs, Part I legacy widgets, two Colab guides, closing the revamp.
- **Out:** analytics or any server; new chapters; legacy widgets outside Part I; more than four papers; any test or checker rule (D9).

## Tasks

### 5.1 Reader-feedback kit

This is feedback from people reading the course, not a software test.

- Write `docs/reader-feedback.md`:
  - who to invite: 3–5 beginners who know basic Python;
  - the path: `/start`, chapter 1 with its quick checks and workshop, then topics 2.1 and 3.1;
  - what to note: where they stop, which terms they look up, time per topic, which tasks they skip;
  - five closing questions.
- Add a results template with one table per reader.
- **Owner review:** only the owner can run the sessions. Hand over the kit and go on with the other tasks.
- When results arrive: turn each finding into an item in `ROADMAP.md` with the topic id and a proposed fix.
- **Accept:** kit and template exist; every returned finding is an open item.

### 5.2 "Report a problem" link

- Find the repository's visibility with `gh repo view itsmepichu/LearningAI --json visibility`.
- If public: add a link at the end of each topic that opens a new GitHub issue prefilled with the topic id, title and page URL, and add `.github/ISSUE_TEMPLATE/content-problem.yml`.
- If private, or if the command cannot run: add the issue template only, skip the link, and say so in the hand-off.
- No tracking and no network call from the page itself.

### 5.3 Four paper walkthroughs (D6)

- Papers, all already cited in the topics' Primary sources:

| Paper | Link |
|---|---|
| Vaswani et al. (2017), Attention Is All You Need | `https://arxiv.org/abs/1706.03762` |
| Brown et al. (2020), Language Models are Few-Shot Learners | `https://arxiv.org/abs/2005.14165` |
| Lewis et al. (2020), Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks | `https://arxiv.org/abs/2005.11401` |
| Liu et al. (2023), Lost in the Middle | `https://arxiv.org/abs/2307.03172` |

- Placement: a new appendix with id `app-f`, "Paper walkthroughs", one topic per paper. Existing appendix ids do not change; appendices do not count towards progress totals.
- Each walkthrough: plain words, no formulas; what problem the paper set out to solve; its method in steps; its main result with the numbers the paper reports; what it does and does not show; where the course uses the idea (cross-links to the topics that cite it); a link to the paper.
- Read the paper itself before writing. Tie every claim to a section, table or figure of the paper. Do not state a number you have not read in the paper.
- Use a `Story` in `src/widgets/walkthrough/stories/` where the method is a sequence of steps; plain topic HTML otherwise.
- Add a link to the walkthrough from each topic that cites the paper.
- **Accept:** four topics exist under `app-f`, each with the six parts above and a link to its paper.

### 5.4 Legacy widgets on Part I pages

- Port the 18 legacy blocks on chapters 2–6 to React, following `src/widgets/CLAUDE.md`: build on the kit, logic in a plain `.ts` module, lazy registration, colour tokens, reduced motion, 24 px targets, honest labels.
- Before porting one, look for a registered React widget that already covers it. If one does, swap the embed and delete the block.
- After each port, delete the widget's block from `src/legacy/widgets.js`.
- Leave the other 33 blocks as they are.
- **Accept:** no page in chapters 1–6 contains a legacy `.wid` block. Hand-off: list each ported widget and its page for the owner to open.

### 5.5 Two Colab guides

- Add guides for 19.2 (a vision-language model) and 20.3 (logit distillation) as `GuideDef` modules in `src/widgets/colab-guide/`, built with `withSetup`, sized for a free T4, with pinned installs and a `limits` text.
- These guides are not executed by anyone before they ship (D9). Say so in the hand-off and ask the owner to run each one once in Colab.
- **Accept:** both guides are listed in `guides.ts` and embedded with the `Colab · GPU` tag.

### 5.6 Close the revamp

- When every phase is Done, move `project_revamp/` to `docs/archive/project-revamp/`.
- Leave `ROADMAP.md` with open work only, and add a short "How to add a topic" section that matches the final tooling.

### 5.7 Final run before deployment

- Do this last, after tasks 5.1–5.6 and only when phases 0–4 are Done.
- Run `npm run test` once. It compiles the TypeScript and builds the site (`tsc --noEmit && npm run build`). This is the only time it runs in the whole revamp.
- It checks the work of all six phases at once. If it fails, fix the cause wherever it is, including code from an earlier phase, and run it again until it passes. Keep each fix as its own commit, named after the phase it repairs.
- Do not open a pull request. Tell the owner the run passed; the owner opens the pull request to `main`, and Vercel deploys from there.
- **Accept:** `npm run test` exits without an error on the final commit.

## Review by inspection

- Hand-off: the pages with ported widgets, the four walkthroughs, the two guides.

## Done when

- `npm run test` has passed (task 5.7) and the owner has the hand-off.
- The reader-feedback kit is with the owner, and any returned findings are open items in `ROADMAP.md`.
- Part I is free of legacy widgets.
- The four paper walkthroughs and the two Colab guides are published.

## Results

Done 15 November 2026 on `development`. Commits: 5a reader-feedback kit and report link; 5b Part I widgets; 5c paper walkthroughs; 5d Colab guides; 5e close-out.

- **5.1 Reader-feedback kit:** `docs/reader-feedback.md` (who to invite, the path, what to note, a results template). The owner still has to run the 3–5 reader sessions. Findings go into `ROADMAP.md` as open items.
- **5.2 Report a problem:** a link on every topic page opens a prefilled GitHub issue (`.github/ISSUE_TEMPLATE/content-problem.yml`, `src/components/ReportProblem.tsx`).
- **5.3 Paper walkthroughs:** Appendix F, four pages: Attention Is All You Need, GPT-3, RAG and Lost in the Middle. Two have scroll-driven walkthroughs (`paper-transformer`, `paper-rag`). Linked from ten citing topics.
- **5.4 Legacy widgets:** the 18 blocks on Part I pages are React widgets (vectors, bayes-grid, confidence-interval, cross-entropy, laptop-fit, overfit, neuron, nn-playground, lr-schedule, shape-tracer, generation, decoding, context-cost, scaling-calc, pipeline-bubble, data-parallel, zero-calc, bigram-lm) on 14 pages; `.wid` is gone from chapters 1–6. 33 legacy `.wid` embeds remain on pages in chapters 7–18 (51 before).
- **5.5 Colab guides:** 19.2 (`vlm.ts`, Qwen2-VL-2B in float16) and 20.3 (`distill.ts`, Qwen3-1.7B to Qwen3-0.6B logit distillation). Neither has been run in Colab by anyone. The owner should run each once on a free T4 and fix any install or API drift. Installs use bounded ranges (`transformers>=4.56,<5`, `peft>=0.17,<1`), not `==` pins, because PyPI could not be reached while writing them. Pin exact versions after the first good run.
- **5.6 Close:** this folder moved to `docs/archive/project-revamp/`; `ROADMAP.md` lists open work only and has a "How to add a topic" section.
- **Beginner review:** `docs/beginner-review.md`.
- **5.7:** see the commit log for the `npm run test` run and any repair commits.
