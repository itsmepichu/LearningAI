# Reader feedback kit

This is feedback from people reading the course, not a software test. The aim is to find where real beginners stop, so the next changes go where they help most.

## Who to invite

- 3 to 5 people who know basic Python and have not read the course. Different backgrounds help: a student, a developer from another field, someone who tried machine learning once and gave up.
- Do not invite anyone who helped write it.
- Each session takes about 90 minutes. One reader per session, in person or on a call with screen sharing.

## Before the session

- Open the live site on the reader's own laptop and a fresh browser profile, so no progress is saved.
- Tell them: "You are testing the course, not yourself. Think aloud. If you get stuck, that is useful, not a failure. I will not help unless you ask."
- Start a timer. Keep this file open and fill in the table for that reader (see the results template below).

## The path

1. `/start` (the page the course opens on). Ask them to say in their own words what the course is and who it is for.
2. Chapter 1, in order. Let them use the quick checks at the end of each topic and the chapter 1 workshop.
3. Topic 2.1, then topic 3.1.

Stop after 90 minutes even if they are not done. Where they got to is a result.

## What to note

Write down what you see, not what you think they meant.

- **Where they stop:** the topic and the sentence or figure where they paused, re-read, or gave up.
- **Terms they look up:** every word they search for, ask about, or hover for a definition.
- **Time per topic:** minutes from opening a topic to marking it studied. The course says "about N min" on each page, so note the difference.
- **Tasks they skip:** figures they did not touch, quick checks they did not answer, the workshop steps they passed over.
- **Where they were wrong:** a quick-check answer they got wrong, and the reason they gave.
- **Where they were pleased:** anything they said "oh, that makes sense" about.

## Five closing questions

Ask these when the session ends. Write the answers down in their words.

1. In one or two sentences, what did you learn in chapter 1?
2. Which part was hardest to follow, and what would have made it easier?
3. Which word or idea did you still not understand when you moved on?
4. Would you carry on to the next chapter tomorrow? What would make you stop?
5. What is one thing you would change first?

## After the sessions

- Fill in one table per reader (below) and keep them in this file, in `docs/reader-feedback-results.md`, or in a copy of it.
- Turn each finding into an item in `ROADMAP.md`: the topic id, what happened, how many readers it affected, and a proposed fix. A finding that two readers share goes first.
- Do not fix things during a session. Read first, then decide.

## Results template

Copy this block once per reader.

```
### Reader N: <first name or initials>

- Background: <one line: study or job, Python experience, any earlier ML reading>
- Date and length: <date>, <minutes>
- Reached: <the last topic they finished>

| Topic | Minutes (course says) | Minutes (reader) | Stopped or re-read at | Terms looked up | Skipped | Quick check (right / wrong) |
|---|---|---|---|---|---|---|
| /start | – | | | | | – |
| 1.1 | | | | | | |
| 1.2 | | | | | | |
| … | | | | | | |
| 2.1 | | | | | | |
| 3.1 | | | | | | |

Closing answers
1. <what they learned in chapter 1>
2. <hardest part>
3. <idea still unclear>
4. <continue tomorrow? what would stop them>
5. <first change>

Findings for ROADMAP.md
- <topic id>: <what happened> → <proposed fix>
```

## Report link

Every topic ends with a "Report a problem" link that opens a prefilled GitHub issue (template: `.github/ISSUE_TEMPLATE/content-problem.yml`). Readers outside these sessions can use it; treat each issue like a finding above.
