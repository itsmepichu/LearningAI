"""Rebuild the text of src/content/search.json from the topic pages as they are now.

search.json was first written by the one-time v3 importer, so edits to a topic's HTML do not reach search until this
runs. It keeps each entry's id, chapter, number and title, and replaces only its text, extracted the same way the
importer did. Topics added to the manifest since then get a new entry, in manifest order, and entries for topics no
longer in the manifest are dropped. Run it after editing topic HTML: python3 scripts/refresh_search.py
"""

import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "src", "content")


def strip_tags(s):
    s = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def main():
    path = os.path.join(CONTENT, "search.json")
    with open(path, encoding="utf-8") as f:
        entries = json.load(f)
    with open(os.path.join(CONTENT, "manifest.json"), encoding="utf-8") as f:
        manifest = json.load(f)
    by_id = {e["id"]: e for e in entries}
    ordered, added = [], 0
    for c in manifest["chapters"]:
        for t in c["topics"]:
            if t["id"] not in by_id:
                by_id[t["id"]] = {"id": t["id"], "ch": c["id"], "tn": t["tn"], "title": t["title"], "text": ""}
                added += 1
            ordered.append(by_id[t["id"]])
    entries = ordered
    changed = 0
    for e in entries:
        with open(os.path.join(CONTENT, "pages", e["ch"], e["id"] + ".html"), encoding="utf-8") as f:
            text = strip_tags(f.read())
        if text != e["text"]:
            e["text"] = text
            changed += 1
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(entries, ensure_ascii=False) + "\n")
    print(f"search.json: {changed} of {len(entries)} topics updated, {added} added")


if __name__ == "__main__":
    main()
