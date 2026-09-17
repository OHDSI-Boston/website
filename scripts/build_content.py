#!/usr/bin/env python3
"""Render content.md into the marked regions of docs/index.html.

content.md is a list of blocks. Each block starts with a `## key` line and
runs until the next `#`/`##` heading. `# Heading` lines only group blocks for
the reader and are ignored, as are HTML comments.

docs/index.html marks each editable region:

    <!-- content:key MODE -->...<!-- /content -->

MODE decides how the block's markdown is inserted:
    inline  one paragraph, without its <p> wrapper (headings, ledes, buttons)
    block   full markdown: paragraphs, emphasis, links
    items   a markdown list, without its <ul>/<ol> wrapper (the page keeps
            its own styled list element)

The script rewrites index.html in place and fails loudly if a key is missing
from either side, so a typo cannot silently deploy an empty heading.

Usage:  python3 scripts/build_content.py [--check]
        --check exits 1 if index.html is out of date, without writing.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content.md"
HTML = ROOT / "docs" / "index.html"

MARKER = re.compile(
    r"<!-- content:(?P<key>[a-z0-9-]+) (?P<mode>inline|block|items) -->"
    r"(?P<body>.*?)"
    r"<!-- /content -->",
    re.DOTALL,
)
COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
BLOCK_HEADING = re.compile(r"^## +([a-z0-9-]+) *$")
GROUP_HEADING = re.compile(r"^# ")


class ContentError(Exception):
    pass


def parse_content(text: str) -> dict[str, str]:
    """Split content.md into {key: markdown}."""
    blocks: dict[str, str] = {}
    key: str | None = None
    lines: list[str] = []

    def close() -> None:
        if key is not None:
            blocks[key] = "\n".join(lines).strip()

    for line in COMMENT.sub("", text).splitlines():
        match = BLOCK_HEADING.match(line)
        if match:
            close()
            key = match.group(1)
            if key in blocks:
                raise ContentError(f"content.md: key '{key}' appears twice")
            lines = []
        elif GROUP_HEADING.match(line) or line.startswith("## "):
            if line.startswith("## "):
                raise ContentError(
                    f"content.md: bad key {line[3:].strip()!r} "
                    "(use lowercase letters, digits and hyphens)"
                )
            close()
            key = None
            lines = []
        elif key is not None:
            lines.append(line)
    close()
    return blocks


def render(key: str, mode: str, source: str) -> str:
    if not source:
        raise ContentError(f"content.md: '{key}' is empty")
    html = markdown.markdown(source).strip()

    if mode == "block":
        return html

    if mode == "inline":
        match = re.fullmatch(r"<p>(.*)</p>", html, re.DOTALL)
        if not match or "<p>" in match.group(1):
            raise ContentError(f"content.md: '{key}' must be a single paragraph")
        return match.group(1)

    # items
    match = re.fullmatch(r"<(ul|ol)>\n?(.*?)\n?</\1>", html, re.DOTALL)
    if not match or "<li>" not in match.group(2):
        raise ContentError(f"content.md: '{key}' must be a single list (lines starting with '- ')")
    return match.group(2)


def build(content_text: str, html_text: str) -> str:
    blocks = parse_content(content_text)
    seen: set[str] = set()

    def replace(match: re.Match[str]) -> str:
        key, mode = match.group("key"), match.group("mode")
        if key in seen:
            raise ContentError(f"index.html: marker '{key}' appears twice")
        seen.add(key)
        if key not in blocks:
            raise ContentError(f"content.md: missing '## {key}' (used in index.html)")
        body = render(key, mode, blocks[key])
        if mode != "inline":
            body = f"\n{body}\n"
        return f"<!-- content:{key} {mode} -->{body}<!-- /content -->"

    result = MARKER.sub(replace, html_text)
    unused = sorted(set(blocks) - seen)
    if unused:
        raise ContentError(f"content.md: no place in index.html for: {', '.join(unused)}")
    return result


def main(argv: list[str]) -> int:
    check = "--check" in argv
    try:
        current = HTML.read_text(encoding="utf-8")
        updated = build(CONTENT.read_text(encoding="utf-8"), current)
    except ContentError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    if check:
        if updated != current:
            print("docs/index.html is out of date; run scripts/build_content.py", file=sys.stderr)
            return 1
        return 0
    if updated != current:
        HTML.write_text(updated, encoding="utf-8")
        print("updated docs/index.html")
    else:
        print("docs/index.html already up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
