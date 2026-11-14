# Phase 4: Review layer and evidence

- **Effort:** 4–6 days · **Depends on:** phase 2 (outcomes) and phase 3 (workshop page, progress-store pattern)
- **Decisions applied:** D4 (quota for new sections), D9 (no tests, no checks)
- **Pull request:** none. Commit on `development`; the owner opens one pull request after all phases are done.
- **Slices (commit groups):** (a) tasks 4.1, 4.3, 4.4 and the core selection for chapters 1–3; (b) core selection for chapters 4–23; (c) tasks 4.5–4.10

Naming: "quick check" and "chapter check" are the course's question pages for readers. They are course content. D9 (no software tests or checks) does not apply to them.

## Goal

A reader can finish a topic with a three-minute quick check. The larger question bank becomes extended practice and levelled interview prep. The reader can see what they have built.

## Why

- A median lesson is about 650 words and carries about 950 words of questions: 164 sections (chapters 1–23; the capstone has none), each with 10–12 choose-the-answer and 8 interview questions.
- The full bank is about 95 hours at 1 minute per choose-the-answer and 3 minutes per interview question.
- 58% of choose-the-answer questions are plain concept recall (1,040 of 1,794).
- 77 system-design interview questions sit in chapters 1–6. Topic 1.1 asks a beginner to design a ticket-routing service.
- The capstone (8 milestones) is the only place the reader builds a whole system, and it comes after 164 topics. Each of the 23 labs names a "Keep as evidence" deliverable, but nothing tracks them.

## Scope

- **In:** a `tier` field, the quick check on topics, interview levels, part review, the Evidence page, part checkpoints, the quota convention.
- **Out:** writing new questions; editing question text, ids, answers or option order; the flashcard scheduler; any test or checker rule (D9).

## Tasks

### 4.1 Tier field

- Add optional `tier: "core" | "extended"` to choose-the-answer questions (`Mcq` in `src/data/checks.ts`). Missing means `extended`.
- Extend the revise tool (ported to Node in phase 1) to set `tier` by id. It must change nothing else in the file.
- Add core counts to the generated `check-summary.json`, and `tier` to the checks schema.
- **Accept:** `git diff` on a checks file shows only added `tier` lines.

### 4.2 Choose the core questions

- For each of the 164 sections pick 3–5 questions that together cover the topic's outcomes (phase 2): one per outcome where possible, short stems, at least one `scenario` or `calculation`.
- Work chapter by chapter with the revise tool. Do not edit text, options, answers or ids.
- **Accept:** `check-summary.json` shows 3–5 core questions in every section; the hand-off has a table of core counts per chapter.

### 4.3 Quick check on the topic page

- Below the topic content and above the "I have studied this topic" button, render the section's `core` questions with the existing components in `src/components/Checks.tsx`, in practice mode (feedback after each answer).
- Save through the same store action as the chapter check (`answer` in `src/store/progress.ts`), so the chapter check shows them answered and a wrong answer adds a flashcard as today.
- Load the chapter's checks file only when the quick check nears the viewport.
- Replace the `SectionCheckLink` text with what is left: "More practice: N extended questions · M interview questions".
- Topics with no questions (the capstone) show no quick check.
- **Accept:** the quick check calls the same `answer` action with the same question ids as the chapter check page.

### 4.4 Chapter check page

- Mark core and extended questions, show core first, and add a "Not answered" filter.

### 4.5 Interview questions by level

- Default view on the chapter check: `fundamentals` and `applied`. `system-design` sits behind an "Interview prep" switch, and is a preset on the Practice page.
- In chapters 1–6 the switch carries the note "Come back to these after Part II." No question is deleted.
- **Accept:** with the switch off, no `system-design` question is rendered.

### 4.6 Part review

- `src/pages/PracticePage.tsx` already reads `?chapters=` and `?mode=`. Add a part preset: 20 mixed questions across the part's chapters, core tier first.
- Link it from the part checkpoint (4.8) and the progress page.

### 4.7 Evidence page

- New page `/evidence`, linked in the sidebar next to Progress. It lists, per chapter, the lab's "Keep as evidence" deliverable and pass condition, then the 8 capstone milestones.
- Take the text during `npm run generate`: the `.ev` block in each `_lab.html` (23 at baseline) and the milestone table in `src/content/pages/capstone/app-c-ms.html`. Do not copy it by hand.
- Each item has a tick box and an optional short note or link, saved in the progress store (version bump and `migrate` step, following the existing pattern). Say on the page that this is stored in this browser only.
- The workshop's "Workshop done" control (phase 3) and the matching lab item here are the same state.
- **Accept:** the generated data holds 23 lab items and 8 milestones.

### 4.8 Part checkpoints

- On the last chapter page of each part, add a "Part checkpoint" card: the part review (4.6), the milestones below, and a link to the Evidence page. Present it as the next required step.

| Part | Checkpoint milestone |
|---|---|
| I (chapters 1–6) | New "Milestone 0": the tiny language model run from chapter 1 plus the six Part I lab deliverables |
| II (chapters 7–9) | Capstone milestones 1 Baseline, 2 Answer service, 3 Better retrieval |
| III (chapters 10–12) | Capstone milestone 4 Durable actions |
| IV (chapters 13–18) | Capstone milestones 5 Adaptation study, 6 Operations, 7 Security, 8 Scale + release |
| V (chapters 19–23) | No new milestone: the part review, then the capstone page |

- Read the chapter references in the capstone text. If a milestone needs a later chapter than its part, move it to that part and say so in the hand-off.
- Milestone 0 is new text on the Evidence page only; do not renumber the capstone's milestones.

### 4.9 Quota convention for sections (D4)

- Replace the old quota text in `src/content/CLAUDE.md` with one convention for every section (nothing enforces it; D9):
  - at least 6 choose-the-answer questions, 3–5 of them `core`;
  - at least one third of the choose-the-answer questions, rounded up, are `scenario` or `calculation` (6 questions need 2; 10–12 need 4, as today);
  - at least 4 interview questions, each with a `followUp`, at most 2 framed in a project.
- All 164 baseline sections already meet these numbers. Existing sections are not trimmed.
- Update the `new:topic` scaffold stubs to these counts.

### 4.10 Guide and rules

- Update `how.html` ("Each chapter ends with"), `/start`, `src/content/CLAUDE.md` (Chapter checks) and `README.md`.

## Review by inspection

- Report: sections with core questions (164); questions whose text, options, answer or id changed (0, from `git diff`); `system-design` questions behind the switch in chapters 1–6 (77 at baseline).
- Hand-off: ask the owner to answer one quick check wrongly and look at the chapter check and flashcards pages, then open `/evidence` and a part checkpoint.

## Done when

- Every topic with questions ends with a quick check of 3–5 questions.
- System-design questions are behind the interview-prep switch.
- The Evidence page lists a reader's kept work, and each part ends with a checkpoint.

## Results

Commits: `a92f9cf` (4.1, 4.3, 4.4), `df4bfdb` to `a8b474f` (4.2, core questions for all 23 chapters), `ece6e15` (4.5 to 4.10). Nothing was built, typechecked or opened in a browser (D9), so type errors are possible; run `npm install` and `npm run dev` first.

| Item | Result |
|---|---|
| Tier (4.1) | `tier: "core"` on `mcq`; missing means extended. `reviseChecks` takes `tier` and inserts one line before `kind`. |
| Core set (4.2) | 811 core questions in all 164 sections, 3–5 per section, each section's set covers its outcomes and includes a `scenario` or `calculation`. |
| Quick check (4.3) | At the end of each topic page, same answers and ids as the chapter check, so a wrong answer joins the flashcards. |
| Chapter check (4.4) | Core first with a Core badge; "Not answered only" filter. |
| Interview levels (4.5) | Chapter check hides `system-design` questions until the "Interview prep" switch is on; chapters 1–6 add "Come back to these after Part II." Practice page: same exclusion plus an "Interview prep preset" (interview drill, system design included). |
| Part review (4.6) | `/practice?part=<id>` draws 20 mixed questions (16 choose-the-answer, 4 interview, chapters in turn, core first, no system design). Linked from each part checkpoint and from the progress page. |
| Evidence page (4.7) | `/evidence`, in the sidebar after Your progress. `npm run generate` writes `evidence.json`: 23 lab items (the `.ev` block of each `_lab.html`) and 8 milestones (the table in `app-c-ms.html`). Ticks and notes are in the progress store (persist version 5, `evidence`, migration keeps all fields). A lab's tick is `workshopDone`. |
| Part checkpoints (4.8) | On the last chapter page of each part (c6, c9, c12, c18, c23). Milestone 0 (tiny language model plus six Part I labs) is in `src/data/evidence.ts`. Part II holds milestones 1–3, Part III milestone 4, Part IV milestones 5–8. |
| Quota (4.9) | D4 convention in `src/content/CLAUDE.md`; `new:topic` writes 6 `mcq` (3 core, 3 scenario or calculation) and 4 interview TODO stubs. |
| Guide (4.10) | `how.html`, `/start`, `src/content/CLAUDE.md`, README updated. |

Review by inspection:
- Sections with core questions: 164 of 164.
- Questions whose text, options, answer or id changed: 0 (every section equals its pre-phase JSON once `tier` is removed).
- `system-design` questions behind the switch in chapters 1–6: 77.
- No milestone moved: the capstone text puts each milestone's chapters inside or before its part. Milestone 3's optional embedding fine-tune uses chapter 13, which is why it is optional.

Core questions per chapter:

| Chapter | Core |
|---|---|
| c1 | 28 |
| c2 | 26 |
| c3 | 29 |
| c4 | 28 |
| c5 | 35 |
| c6 | 35 |
| c7 | 35 |
| c8 | 40 |
| c9 | 35 |
| c10 | 45 |
| c11 | 40 |
| c12 | 40 |
| c13 | 35 |
| c14 | 40 |
| c15 | 50 |
| c16 | 40 |
| c17 | 50 |
| c18 | 35 |
| c19 | 30 |
| c20 | 30 |
| c21 | 30 |
| c22 | 30 |
| c23 | 25 |

Known limits:
- The part review draws 16 + 4 questions from the part's chapters; a part with one chapter's data not loaded yet waits for it.
- Evidence notes are limited to 300 characters; a link is opened only when the note is just a URL.
- The Evidence page and part checkpoint are not in the e2e or axe lists, because of D9.
