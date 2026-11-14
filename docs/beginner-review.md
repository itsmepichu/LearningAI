# Beginner-friendliness review

Review of the whole course by reading, 15 November 2026, against D1: "For beginner programmers and students who know basic Python; it ends at building professional AI applications." It is a reading review, not reader data. The reader sessions in `docs/reader-feedback.md` will confirm or overturn it.

## What works for a beginner

- `/start` says who the course is for, what Python is assumed and how to study.
- Each topic follows one order: intuition, mechanism, the numbers (worked arithmetic, no formulas), code, practice, sources.
- One example project per lesson. The four-project work is on the chapter's workshop page, so the lesson is not split four ways.
- Every topic ends with a quick check of core questions; the chapter check and the Practice page hold the rest.
- Simulations and illustrative numbers are labelled, and every topic cites primary sources.

## Changed after the review

| Finding | Change |
|---|---|
| Terms were defined on the glossary page but not where they were first met | Glossary terms are linked automatically on topic pages, with a hover definition (`src/components/autoGlossary.ts`). New entries added for terms with no definition. |
| Long topic titles hid what a topic is about | Short headings in the sidebar and cards, with a "Covers" line for the full scope. |
| Part I still used legacy widgets, the least accessible part of the course | The 18 blocks were rebuilt as React widgets on the shared kit. |
| Famous papers were cited but never explained | Four walkthroughs in Appendix F. |

## Open findings (in `ROADMAP.md`)

1. **Density in Parts IV and V.** Topics there carry more terms per paragraph than Parts I to III. Split the densest, and check them first in reader sessions.
2. **Topic 1.4.** Many ideas in one topic. Consider moving some to a new topic.
3. **Long sentences in Part I.** Several run past 30 words. Shorten them when the topic is next edited.
4. **Missing acronym entries.** NER, IAM, TRL, SDK and CI are used without a glossary entry.

## Not reviewed

- Whether the worked arithmetic is easy to follow for someone who has not seen it before. Only readers can say.
- How long a topic takes a beginner. The study-time figures are estimates.
- The two new Colab guides have not been run (see the phase 5 results).
