# Phase 2: Beginner on-ramp

- **Effort:** 5–7 days · **Depends on:** phase 1
- **Decisions applied:** D1 (audience), D5 (`/start` page), D8 (course name), D9 (no tests, no checks)
- **Pull request:** none. Commit on `development`; the owner opens one pull request after all phases are done.
- **Slices (commit groups):** (a) pages and rendering: tasks 2.1, 2.2, the rendering part of 2.3, 2.7, 2.9; (b) content for chapters 1–7: tasks 2.3–2.6 and 2.8; (c) the same content tasks for the other chapters

## Goal

A reader who knows basic Python can start at page one, knows what is expected, never meets an unexplained term, and runs something in chapter 1.

## Why

- No topic states a prerequisite. The guide's one-time setup installs PyTorch, transformers, FAISS and Ollama before chapter 1.
- 208 uses of glossary terms come before the topic that teaches them (text match): 30 in chapter 1, 16 in 2, 15 in 3, 14 in 4, 13 in 5, 8 in 6, 19 in 7. Topic 1.2 uses attention, backpropagation, RNN, pretraining and RLHF, taught in chapters 4–6.
- Topic 1.1 uses TF-IDF, logistic regression and BERT, which have no glossary entry, and gradient boosting, which has one but is not linked.
- No topic says what the reader can do afterwards, and none ends with a recap.
- 94 of 172 topic titles list three or more concepts; 36 are longer than nine words.
- 37 formula symbols remain in 9 topics although the rule is "no formulas".
- 38 theory topics come before chapter 7. Chapter 1's lab is on paper and asks for "tasks from your own work", which a student does not have.

## Scope

- **In:** the start page, setup placement, outcomes, early-term links, formula symbols, short titles, the chapter 1 lab, the home page.
- **Out:** splitting or rewriting lessons, the practice block (phase 3), questions (phase 4), any checker rule or test (D9).

## Tasks

### 2.1 The `/start` page (D5)

- Route `/start`, content in `src/content/pages/home/start.html`, rendered like the guide (`Guide` in `src/pages/Misc.tsx`). Link it in the sidebar above the guide.
- It is required reading. Do not call it optional. It has no notes, questions or snippet, and it does not count as a topic.
- Content, in plain words:
  1. who the course is for (the D1 sentence) and what it ends with;
  2. what you need: variables, lists, dictionaries, loops, functions and reading a file in Python; a terminal from Part II on;
  3. ten self-check questions on those basics for the reader, each answer revealed with `<details>`; no saved state;
  4. where to learn a missing basic: the official Python tutorial, `https://docs.python.org/3/tutorial/`;
  5. how a topic works (the five parts), how to run a snippet in the browser, how to open a dataset;
  6. time: total and per part, computed with `minutes()` from `src/data/course.ts`, not typed.
- **Accept:** linked from the home page and the sidebar; no formulas; one `h1` and no skipped heading level.

### 2.2 Just-in-time setup

- `src/content/pages/home/how.html` has a "Your laptop setup (do this once)" block that installs everything.
- Replace it with a short table: tool, what it is for, the chapter that first needs it.
- Move each install command to the lab or topic that first uses it (find first use by searching the pages for `ollama`, `torch`, `transformers`, `faiss`, `sentence-transformers`, `bm25s`).
- Part I should need a browser only. List any Part I lab that still needs a local install in the hand-off.
- **Accept:** no install command appears before the chapter that first needs it.

### 2.3 Outcomes and recap

- Add `outcomes` (2–3 strings) to every chapter and capstone topic in `src/content/manifest.json`, and to the `Topic` type in `src/data/course.ts`. Each starts with a verb, has at most 14 words, and is traceable to the topic's text.
- Render them in `src/pages/Topic.tsx`: at the top ("After this topic you can") and as a recap list above the "I have studied this topic" button. A topic without outcomes renders neither.
- Write each outcome so one question can cover it; phase 4 maps quick-check questions to outcomes.
- Add `outcomes` to the manifest schema, the `new:topic` scaffold and the rules in `src/content/CLAUDE.md`.
- **Accept:** a count shows 166 topics with 2–3 outcomes.

### 2.4 Link early terms

- A glossary term used before the topic that teaches it must be explained where it appears. This is a one-time content pass plus a written rule; there is no checker.
- Find the cases with a throwaway search: for each glossary entry (term or alias, 4 or more characters), list the topics that come before its teaching topic in manifest order and contain it outside `<svg>`, `<code>` and `<pre>`. Do not add the search to the repository.
- For each real case, add `<a class="gl" href="#gl-<id>">` at the first use in that part of the topic, or reword in plain words. Skip everyday uses of a word ("pay attention", "a vector of change"). Existing rule: mark a term once per part.
- Order: chapters 1–7 first (115 matches at baseline), then the rest (93).
- Add the rule to `src/content/CLAUDE.md`: "A term used before its teaching topic carries a glossary link or is replaced by plain words."
- **Accept:** rerunning the throwaway search leaves only everyday uses; list those in the hand-off.

### 2.5 Glossary gaps in Part I

- Add entries for TF-IDF, logistic regression and BERT. Set `topic` to the topic that teaches each; if none does, replace the term in 1.1 with a plain-words description instead of adding an entry. Link gradient boosting in 1.1.
- Sweep chapters 1–6 for other technical terms with no entry. Add up to 30; list the rest in the hand-off.
- **Accept:** every new entry has `term`, `def` and a `topic` that exists in the manifest.

### 2.6 Formula symbols

- Occurrences of Σ ∑ √ ‖ ∂ ∇ ∫ ∏ outside SVG at baseline: 4.1 (16), 2.1 (10), 2.4 (3), 2.3 (2), 5.2 (2), 9.3, 9.5, 9.7, 10.9 (1 each).
- Rewrite each as words plus worked arithmetic. Keep the meaning identical. Read the questions in the matching `checks/<chapter>.json` to confirm they are still answerable from the text; do not edit the questions.
- Add to `src/content/CLAUDE.md`: "No formula symbols outside code."
- **Accept:** a search for those symbols outside `<svg>`, `<code>` and `<pre>` returns nothing.

### 2.7 Short display titles

- Add an optional `short` (at most 6 words) to every topic whose title has more than nine words or lists three or more concepts.
- Use `short` in the sidebar, the pager, the step-dot tooltips and search results. The page heading keeps the full title. Ids, numbers and `title` do not change.
- **Accept:** every such topic has a `short` of at most 6 words.

### 2.8 An early hands-on result in chapter 1

- Appendix A (`src/content/pages/app-a/app-a-run.html`) holds a `py-lab` that trains a tiny language model. Do not move it or change its ids.
- At the top of the chapter 1 lab (`src/content/pages/c1/_lab.html`), add a first step that sends the reader to that lab with a cross-link, and says what the result does and does not prove.
- Reword the lab so the example project's scenario is the default and "tasks from your own work" is the alternative for readers who have a job.
- **Accept:** the chapter 1 lab's first step is a real computation the reader runs.

### 2.9 Home page for beginners

- Hero: the name "LearningAI", the D1 sentence, and total study time computed from `minutes()`.
- Show per-chapter time on the chapter cards.
- A reader with no progress gets "Start here" (the `/start` page) as the main button; a returning reader keeps "Continue".
- Do not describe any chapter, part or page as optional.

## Review by inspection

- Report: early-term cases fixed and left, formula symbols remaining (0), topics with outcomes (166), topics with `short`.
- Hand-off: ask the owner to open `/start`, the home page, topics 1.1, 2.1 and 4.1, and the chapter 1 lab.

## Done when

- Early terms are linked or reworded, and no formula symbol remains outside code.
- Every chapter and capstone topic has outcomes.
- Chapter 1 ends with something the reader ran; Part I needs no local install.

## Results

Commits: `ca9b606` (2a: 2.1, 2.2, 2.3 rendering, 2.7, 2.9), `3d8400c` (2.6), `39e3662` (2.4), `8043f95` (2.5), `82ee79d` (2.8), `bd41592` (2.3 content). Nothing was built, typechecked or opened in a browser (D9); the generator and scripts were run with Node and Python only.

| Measure | Before | After |
|---|---|---|
| Start page | none | `/start` (required, not a topic): audience, prerequisites, ten Python self-check questions, how a topic works, study time per part computed from `minutes()`; linked from the sidebar, the home page and the guide |
| Setup | one install block before chapter 1 | a tools table in the guide; install commands moved to topics 2.1, 2.5, 3.2, 4.4, 4.6, 5.5, 7.4 and 17.2 |
| Topics with outcomes | 0 | 166 of 166, 2–3 each, shown at the top of the topic and as a recap |
| Topics with a `short` title | 0 | 107 (every title over nine words or with three or more concepts; none over six words) |
| Early glossary uses | 196 found by the throwaway search (208 at baseline by the plan's count) | 124 linked in 68 topics; 74 left (see below) |
| Glossary entries | 316 | 346 (TF-IDF, logistic regression and BERT, plus 27 more taught in chapters 2–6) |
| Formula symbols outside code | 37 in 9 topics | 0 |
| Chapter 1 lab | on paper, "tasks from your own work" | step 1 runs the Appendix A tiny language model; the project scenario is the default |

Early uses left unlinked (the throwaway search is not in the repository):
- **Everyday words that matched an alias:** "provider" (28, an API provider, not the AI Act role), "step" and "batch" for epoch (10), "Zero" for ZeRO (6), "workflow" (4), "trace" (4), "queue" (2), "vector" in "support vector machines", "precision" for numeric precision, "agent" in reinforcement learning, "chargeback", "streaming" for dataset streaming.
- **Source titles:** BERT in "Sentence-BERT" and a tokenizer widget name, Scaling Laws (2), autograd (2), ReAct, Red teaming, Semantic conventions, right to erasure.
- **Other meaning:** "canary" for planted test strings (3), "transformer" in "pre-transformer", risk tier in a figure label.

Glossary gaps from chapters 1–6 not added (the cap was 30): bias, variance, warm-up, one-hot, sparse, alignment, policy (reinforcement learning), the training loss, embedding table, and a few more everyday-technical words.

Part I labs and topics that still need a local install (Part I is not browser-only): 2.1 (NumPy), 2.5 and the chapter 2 lab (pandas, matplotlib, JupyterLab), 3.2 (scikit-learn), 4.4 (sentence-transformers), 4.6 (PyTorch), 5.5 (transformers) and 6.7 (nanoGPT: torch and others). Each has its install line at the first use. Making Part I fully browser-only would mean moving these laptop labs to the browser snippets; not done, as the plan only asks to list them.

Other changes: `generate.mjs` indexes the ids on `/start`; the search index now shows a topic's `short` title and keeps the full title in the searchable text; the manifest schema, the `new:topic` scaffold and `src/content/CLAUDE.md` carry the new fields and the three rules (outcomes, early terms, no formula symbols).

Known limits:
- `/start` says "Download the data file from the card"; phase 3 replaces the topic cards, so its data section needs updating then (it is on the phase 3 list).
- Outcomes were written from each topic's opening, headings and its chapter-check questions, not a line-by-line read of every topic; read a few against the text.
- The 10 self-check answers on `/start` are not saved or scored.
