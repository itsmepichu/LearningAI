"""Authoring helpers for practice notes and chapter checks.

Write content as Python in a batch module, then merge it into the JSON files:

    from content_tools import M, I, F, A, S, C, merge_practice, merge_checks
    merge_practice("c4", {"c4-1": {"store": dict(practice=..., failure=..., tryIt=..., fit="good", fitNote=...)}, "_lab": {...}})
    merge_checks({"c4-1": dict(mcq=[M(...), ...], interview=[I(...), ...])})

Then run `node scripts/content-summary.mjs` to validate.

Rules enforced here (see CLAUDE.md):
  * Existing notes are updated field by field; Harbor's existing practice and failure are kept.
  * New questions get the next free stable id in their section; an identical question text is skipped.
  * New multiple-choice options are shuffled with a seed derived from the question id, so the right
    answer's position varies. Published questions are never reshuffled (saved answers are indices).
"""
import hashlib
import json
import os
import random
import re

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "content")
PROJECTS = ("harbor", "store", "bank", "travel")
F, A, S = "fundamentals", "applied", "system-design"


def C(s):
    """Inline code."""
    return f"<code>{s}</code>"


def M(q, options, answer, why, distractors=None, kind="concept"):
    d = dict(q=q, options=options, answer=answer, why=why, kind=kind)
    if distractors:
        d["distractors"] = distractors
    return d


def I(q, level, covers, followUp=None, project=None):
    d = dict(q=q, level=level, covers=covers)
    if followUp:
        d["followUp"] = followUp
    if project:
        d["project"] = project
    return d


def _shuffle(q, salt=0):
    n = len(q["options"])
    r = random.Random(int(hashlib.sha256(f"{q['id']}:{salt}".encode()).hexdigest(), 16))
    perm = list(range(n))
    r.shuffle(perm)
    inv = {old: new for new, old in enumerate(perm)}
    q["options"] = [q["options"][perm[i]] for i in range(n)]
    if "distractors" in q:
        q["distractors"] = [q["distractors"][perm[i]] for i in range(n)]
    q["answer"] = sorted(inv[a] for a in q["answer"]) if isinstance(q["answer"], list) else inv[q["answer"]]


def _max_share(qs):
    pos = [q["answer"] for q in qs if isinstance(q["answer"], int)]
    return max(pos.count(i) for i in range(4)) / len(pos) if pos else 0


def merge_practice(chapter, data):
    path = os.path.join(ROOT, "practice", f"{chapter}.json")
    cur = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
    for tid, byp in data.items():
        if tid == "_lab":
            cur.setdefault("_lab", {}).update(byp)
            continue
        if tid not in cur:
            cur[tid] = {}
        for pid, note in byp.items():
            assert pid in PROJECTS, pid
            base = cur[tid].get(pid, {})
            base.update(note)
            assert base.get("practice") and base.get("failure"), (tid, pid, "needs practice and failure")
            for k in ("practice", "failure", "tryIt", "fitNote"):
                stray = re.sub(r"\{(company|assistant)\}", "", base.get(k, "") or "")
                assert "{" not in stray and "}" not in stray, (tid, pid, k, "stray brace")
            cur[tid][pid] = base
        cur[tid] = {k: cur[tid][k] for k in PROJECTS if k in cur[tid]}
    json.dump(cur, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return {t: len(v) for t, v in cur.items()}


def merge_checks(Q):
    out = {}
    for tid, sec in Q.items():
        ch = tid.split("-")[0]
        path = os.path.join(ROOT, "checks", f"{ch}.json")
        data = json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}
        cur = data.setdefault(tid, {})
        cur.setdefault("mcq", [])
        cur.setdefault("interview", [])
        known = {q["q"] for q in cur["mcq"]} | {q["q"] for q in cur["interview"]}
        new = []
        for kind, key, letter in (("mcq", "mcq", "m"), ("interview", "interview", "i")):
            for q in sec.get(key, []):
                if q["q"] in known:
                    continue
                nums = [int(m.group(1)) for x in cur[key] if (m := re.match(re.escape(tid) + "-" + letter + r"(\d+)$", x["id"]))]
                q = {"id": f"{tid}-{letter}{max(nums, default=0) + 1:02d}", **q}
                cur[key].append(q)
                if kind == "mcq":
                    new.append(q)
        for q in new:
            _shuffle(q)
        salt = 0
        while new and _max_share(cur["mcq"]) > 0.5 and salt < 20:
            salt += 1
            for q in new:
                _shuffle(q, salt)
        for q in cur["mcq"]:
            if "distractors" in q:
                right = set(q["answer"] if isinstance(q["answer"], list) else [q["answer"]])
                for i, d in enumerate(q["distractors"]):
                    assert (i in right) == (d == ""), (q["id"], "distractor misaligned at option", i)
        json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        out[tid] = (len(cur["mcq"]), len(cur["interview"]))
    return out


def topic_text(chapter, topic):
    """Plain text of a topic page, for reading while writing questions."""
    import html as h
    s = open(os.path.join(ROOT, "pages", chapter, f"{topic}.html"), encoding="utf-8").read()
    s = re.sub(r"<svg[\s\S]*?</svg>", " ", s)
    s = re.sub(r"<pre>[\s\S]*?</pre>", " [code] ", s)
    s = re.sub(r"</(p|li|h4|h5|div|figcaption|tr)>", "\n", s)
    s = h.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"\n\s*\n+", "\n", re.sub(r"[ \t]+", " ", s)).strip()
