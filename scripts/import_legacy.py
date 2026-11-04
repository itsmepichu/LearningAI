"""One-time importer: split the v3 single-file manual into per-topic content files.

Usage: python3 scripts/import_legacy.py <path-to-v3-guide-parts-dir>

Writes:
  src/content/manifest.json        chapters, topics, parts, quizzes
  src/content/idmap.json           every element id -> route (for in-content links)
  src/content/pages/<ch>/<id>.html topic bodies, chapter intro/outro, labs
  src/content/pages/home/how.html  "How to use this manual"
  src/content/search.json          plain text per topic (lazy-loaded by search)
  src/legacy/widgets.js            v3 widget code wrapped as a mountable module
"""
import html
import json
import os
import re
import sys

SRC = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("LEGACY_DIR", "")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "src", "content")
PAGES = os.path.join(OUT, "pages")

CH_FILES = [f"{i:02d}-ch{i-1:02d}.html" for i in range(2, 20)] + ["20-appendix.html"]
PARTS = [
    ("p1", "Part I", "Understand", ["c1", "c2", "c3", "c4", "c5", "c6"]),
    ("p2", "Part II", "Build and evaluate", ["c7", "c8", "c9"]),
    ("p3", "Part III", "Scale knowledge and agents", ["c10", "c11", "c12"]),
    ("p4", "Part IV", "Adapt and operate", ["c13", "c14", "c15", "c16", "c17", "c18"]),
    ("res", "Field resources", "Capstone and appendices", ["capstone", "app-a", "app-b", "app-d", "app-e"]),
]


def read(name):
    with open(os.path.join(SRC, name), encoding="utf-8") as f:
        return f.read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text.strip() + "\n")


def strip_tags(s):
    s = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def balanced_block(s, start, tag):
    """Return end index of the element that opens at `start` (handles nesting)."""
    depth, i = 0, start
    rx = re.compile(rf"<{tag}\b|</{tag}>")
    for m in rx.finditer(s, start):
        depth += 1 if m.group(0) != f"</{tag}>" else -1
        if depth == 0:
            return m.end()
    raise ValueError("unbalanced " + tag)


def sections(s):
    out, pos = [], 0
    while True:
        i = s.find('<section class="chapter', pos)
        if i < 0:
            return out
        j = balanced_block(s, i, "section")
        out.append(s[i:j])
        pos = j


def parse_quiz(q_html):
    qs = []
    for fs in re.findall(r'<fieldset class="qq"[\s\S]*?</fieldset>', q_html):
        a = int(re.search(r'data-a="(\d+)"', fs).group(1))
        legend = strip_tags(re.search(r"<legend>([\s\S]*?)</legend>", fs).group(1))
        legend = re.sub(r"^\d+\.\s*", "", legend)
        opts = [strip_tags(x) for x in re.findall(r'<label><input[^>]*>([\s\S]*?)</label>', fs)]
        why = strip_tags(re.search(r'<div class="qfb" hidden><b></b>([\s\S]*?)</div>', fs).group(1))
        qs.append({"q": legend, "options": opts, "answer": a, "why": why})
    return qs


def main():
    if not SRC or not os.path.isdir(SRC):
        sys.exit("pass the v3 guide parts directory")
    manifest = {"parts": [], "chapters": []}
    idmap, search = {}, []
    part_of = {c: p[0] for p in PARTS for c in p[3]}

    # ---- intro ("how to use") ----
    intro = read("01-intro.html")
    i = intro.find('<section class="read" id="how">')
    j = balanced_block(intro, i, "section")
    how = intro[i:j]
    how = re.sub(r'<h3 class="sub-h">Jump to a chapter</h3>\s*<div class="mapgrid" id="mapgrid"></div>', "", how)
    how = re.sub(r'^<section[^>]*>\s*<h2[^>]*>.*?</h2>', "", how, flags=re.S)
    how = re.sub(r"</section>\s*$", "", how)
    write(os.path.join(PAGES, "home", "how.html"), how)
    for m in re.finditer(r'\bid="([^"]+)"', how):
        idmap[m.group(1)] = "/guide#" + m.group(1)
    idmap["how"] = "/guide"

    for fname in CH_FILES:
        for sec in sections(read(fname)):
            cid = re.search(r'id="([^"]+)"', sec).group(1)
            kind = "appendix" if "appx" in sec[:60] else ("capstone" if cid == "capstone" else "chapter")
            head = re.search(r'<header class="ch-head">([\s\S]*?)</header>', sec).group(1)
            num = strip_tags(re.search(r'<span class="ch-num">([\s\S]*?)</span>', head).group(1))
            title = strip_tags(re.search(r"<h2>([\s\S]*?)</h2>", head).group(1))
            lm = re.search(r'<p class="lede">([\s\S]*?)</p>', head)
            lede = lm.group(1).strip() if lm else ""
            body = sec[sec.find("</header>") + 9 : sec.rfind("</section>")]

            www = {}
            wm = re.search(r'<div class="www">([\s\S]*?)<nav class="chips-nav"[\s\S]*?</nav>\s*</div>', body) or \
                 re.search(r'<div class="www">([\s\S]*?)</div>\s*(?=<article|<figure|<p|<div)', body)
            if wm:
                for key, label in (("what", "What it is"), ("why", "Why we study it"), ("where", "Where it applies")):
                    mm = re.search(rf"<h4>{label}</h4>([\s\S]*?)</div>", wm.group(1))
                    if mm:
                        www[key] = mm.group(1).strip()
                body = body.replace(wm.group(0), "")

            # chapter tail: lab, quiz, done button
            lab_html, quiz = "", []
            lm2 = re.search(r'<div class="chlab" id="lab-[^"]+">', body)
            if lm2:
                e = balanced_block(body, lm2.start(), "div")
                lab_html = body[lm2.start():e]
                body = body[:lm2.start()] + body[e:]
            qm = re.search(r'<div class="quiz" id="quiz-[^"]+">', body)
            if qm:
                e = balanced_block(body, qm.start(), "div")
                quiz = parse_quiz(body[qm.start():e])
                body = body[:qm.start()] + body[e:]
            body = re.sub(r'<div class="chdone">[\s\S]*?</div>', "", body)

            topics = []
            arts = list(re.finditer(r'<article class="topic" id="([^"]+)">', body))
            intro_html = body[: arts[0].start()] if arts else body
            outro_html = ""
            for k, am in enumerate(arts):
                tid = am.group(1)
                e = balanced_block(body, am.start(), "article")
                art = body[am.start():e]
                if k == len(arts) - 1:
                    outro_html = body[e:]
                h3 = re.search(r"<h3>([\s\S]*?)</h3>", art)
                tnm = re.search(r'<span class="tn">([\s\S]*?)</span>', h3.group(1))
                tn = strip_tags(tnm.group(1)) if tnm else ""
                ttl = strip_tags(h3.group(1).replace(tnm.group(0), "") if tnm else h3.group(1))
                inner = art[h3.end(): art.rfind("</article>")]
                tags = sorted(set(re.findall(r'class="tag (cpu|real|sim|gpu)"', inner)))
                figs = len(re.findall(r"<figure", inner))
                live = len(re.findall(r'<figure class="fig[^"]*\blive\b|<figure class="fig[^"]*\bflow\b', inner))
                # step-through flows and figures with controls count as interactive
                ctrl = len(re.findall(r'<figure[^>]*>(?:(?!</figure>)[\s\S])*?(?:<input|<button|<select)', inner))
                text = strip_tags(inner)
                topics.append({
                    "id": tid, "tn": tn, "title": ttl, "tags": tags, "figures": figs,
                    "interactive": max(live, ctrl), "words": len(text.split()),
                })
                write(os.path.join(PAGES, cid, tid + ".html"), inner)
                route = f"/{cid}/{tid}"
                idmap[tid] = route
                for m in re.finditer(r'\bid="([^"]+)"', inner):
                    idmap.setdefault(m.group(1), route + "#" + m.group(1))
                search.append({"id": tid, "ch": cid, "tn": tn, "title": ttl, "text": text})

            if intro_html.strip():
                write(os.path.join(PAGES, cid, "_intro.html"), intro_html)
            if outro_html.strip():
                write(os.path.join(PAGES, cid, "_outro.html"), outro_html)
            if lab_html:
                write(os.path.join(PAGES, cid, "_lab.html"), lab_html)
            idmap[cid] = "/" + cid
            idmap["lab-" + cid] = "/" + cid + "#lab"
            idmap["quiz-" + cid] = "/" + cid + "#quiz"
            manifest["chapters"].append({
                "id": cid, "num": num, "title": title, "lede": lede, "kind": kind,
                "part": part_of.get(cid, "res"), "www": www, "topics": topics,
                "hasIntro": bool(intro_html.strip()), "hasOutro": bool(outro_html.strip()),
                "hasLab": bool(lab_html), "quiz": quiz,
            })

    for pid, label, sub, chs in PARTS:
        manifest["parts"].append({"id": pid, "label": label, "title": sub, "chapters": chs})

    write(os.path.join(OUT, "manifest.json"), json.dumps(manifest, ensure_ascii=False, indent=1))
    write(os.path.join(OUT, "idmap.json"), json.dumps(idmap, ensure_ascii=False))
    write(os.path.join(OUT, "search.json"), json.dumps(search, ensure_ascii=False))
    build_legacy_widgets()
    n = sum(len(c["topics"]) for c in manifest["chapters"])
    print(f"chapters={len(manifest['chapters'])} topics={n} ids={len(idmap)}")


def build_legacy_widgets():
    """Wrap the v3 widget scripts into one function that mounts into the current page.

    Every v3 widget is a guarded IIFE (`if(!$('id'))return`), so running all of them
    on a topic page only activates the widgets present. Timers, animation frames and
    window/document listeners are routed through a runtime object so they can be
    cleared when the page unmounts.
    """
    core = read("90-js-core.html")
    parts = [core] + [read(f) for f in ("91-js-b.html", "92-js-c.html", "93-js-d.html")]
    code = "\n".join(re.sub(r"</?script>", "", p) for p in parts)
    code = code.replace("</main></div>", "")
    # drop page-level features the React shell now owns
    for name in ("theme toggle", "table of contents, map, scroll spy", "chapter self-check quizzes"):
        code = re.sub(r"/\* ===== " + re.escape(name) + r" ===== \*/[\s\S]*?(?=/\* =====|\Z)", "", code)
    code = code.replace('document.documentElement.classList.add("js");', "")
    # global theme listeners are owned by the runtime
    code = re.sub(r"try\{matchMedia\('\(prefers-color-scheme: dark\)'\)\.addEventListener\('change',rerender\)\}catch\(e\)\{\}", "", code)
    code = re.sub(r"new MutationObserver\(rerender\)\.observe\([^;]*;", "", code)
    # document-wide queries become root-scoped
    code = code.replace("document.querySelectorAll(", "ROOT.querySelectorAll(")
    # isolate each widget block so one failure cannot stop the rest
    blocks = re.split(r"(?=/\* ===== )", code)
    wrapped = []
    for b in blocks:
        if b.startswith("/* ===== shared helpers") or not b.strip():
            wrapped.append(b)
        else:
            title = re.match(r"/\* ===== (.*?) ===== \*/", b)
            label = title.group(1) if title else "block"
            wrapped.append("try{\n" + b + "\n}catch(e){console.error(" + json.dumps("legacy widget: " + label) + ",e)}\n")
    code = "".join(wrapped)
    header = (
        "/* eslint-disable */\n// @ts-nocheck\n"
        "/* Generated by scripts/import_legacy.py from the v3 single-file manual. Do not edit by hand:\n"
        "   port a widget to React (src/widgets) and delete its block instead. */\n"
        "export function mountLegacy(ROOT, rt) {\n"
        "const {setTimeout, setInterval, requestAnimationFrame} = rt;\n"
        "rt.rerender = () => rerender();\n"
    )
    footer = "\n}\n"
    write(os.path.join(ROOT, "src", "legacy", "widgets.js"), header + code + footer)


if __name__ == "__main__":
    main()
