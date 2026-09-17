"""Tests for build_content.py.  Run: python3 -m unittest discover scripts"""

import unittest

from build_content import ContentError, build, parse_content

PAGE = (
    "<h1><!-- content:title inline -->old<!-- /content --></h1>\n"
    "<div><!-- content:body block -->old<!-- /content --></div>\n"
    '<ul class="tags"><!-- content:tags items -->old<!-- /content --></ul>\n'
)
CONTENT_OK = """<!-- a comment with ## fake-key inside -->
# Group heading, ignored

## title
Hello **world**

## body
First paragraph with a [link](https://example.org).

Second paragraph.

## tags
- One
- Two
"""


class BuildTests(unittest.TestCase):
    def test_renders_each_mode(self):
        out = build(CONTENT_OK, PAGE)
        self.assertIn("<h1><!-- content:title inline -->Hello <strong>world</strong><!-- /content --></h1>", out)
        self.assertIn('<p>First paragraph with a <a href="https://example.org">link</a>.</p>\n<p>Second paragraph.</p>', out)
        self.assertIn('<ul class="tags"><!-- content:tags items -->\n<li>One</li>\n<li>Two</li>\n<!-- /content --></ul>', out)

    def test_idempotent(self):
        once = build(CONTENT_OK, PAGE)
        self.assertEqual(build(CONTENT_OK, once), once)

    def test_comments_and_groups_ignored(self):
        self.assertEqual(sorted(parse_content(CONTENT_OK)), ["body", "tags", "title"])

    def assertFails(self, content, page, fragment):
        with self.assertRaises(ContentError) as ctx:
            build(content, page)
        self.assertIn(fragment, str(ctx.exception))

    def test_missing_key(self):
        self.assertFails(CONTENT_OK.replace("## tags", "## other"), PAGE, "missing '## tags'")

    def test_unused_key(self):
        self.assertFails(CONTENT_OK + "\n## extra\nText\n", PAGE, "no place in index.html for: extra")

    def test_duplicate_key(self):
        self.assertFails(CONTENT_OK + "\n## title\nAgain\n", PAGE, "appears twice")

    def test_duplicate_marker(self):
        self.assertFails(CONTENT_OK, PAGE + PAGE, "marker 'title' appears twice")

    def test_empty_block(self):
        self.assertFails(CONTENT_OK.replace("Hello **world**", ""), PAGE, "'title' is empty")

    def test_inline_rejects_two_paragraphs(self):
        self.assertFails(CONTENT_OK.replace("Hello **world**", "One\n\nTwo"), PAGE, "single paragraph")

    def test_items_rejects_prose(self):
        self.assertFails(CONTENT_OK.replace("- One\n- Two", "Not a list"), PAGE, "single list")

    def test_bad_key_name(self):
        self.assertFails(CONTENT_OK.replace("## title", "## Title Case"), PAGE, "bad key")

    def test_html_is_escaped_ampersand(self):
        out = build(CONTENT_OK.replace("Hello **world**", "Data & methods"), PAGE)
        self.assertIn("Data &amp; methods", out)


if __name__ == "__main__":
    unittest.main()
