#!/usr/bin/env python3
"""把源泉圓體（GenSen Rounded 2 TW，SIL OFL 1.1）裁切成網站實際用到的字，輸出 woff2。

在 GitHub Actions 中於 `npx quartz build` 之後執行：
  python3 scripts/subset_fonts.py <otf 資料夾> <public 資料夾>

- 一般字重（R）：收錄網站所有頁面與搜尋索引出現的字。
- 粗體（B）：只收錄標題、粗體、導覽等用到粗體的字，檔案更小。
"""
import html
import json
import pathlib
import re
import sys
from html.parser import HTMLParser

from fontTools import subset

otf_dir = pathlib.Path(sys.argv[1])
public = pathlib.Path(sys.argv[2])
out_dir = public / "static" / "fonts"
out_dir.mkdir(parents=True, exist_ok=True)

BOLD_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "strong", "b", "th", "nav", "summary"}
BOLD_CLASSES = ("site-brand", "topic-name", "callout-title", "page-title", "hero-tags", "pill")

# 一定要收錄的字：ASCII、全形標點、常用符號
BASE = "".join(chr(c) for c in range(0x20, 0x7F))
BASE += "，。、；：？！「」『』（）《》〈〉【】…—～·・＋－＊／％＃＠｜→←↑↓✓✗○●◆■□▲△▼▽☆★"


class Collector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.all = set()
        self.bold = set()
        self.stack = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        cls = dict(attrs).get("class") or ""
        is_bold = tag in BOLD_TAGS or any(c in cls for c in BOLD_CLASSES)
        if tag not in ("br", "img", "meta", "link", "input", "hr", "source", "path", "circle"):
            self.stack.append(is_bold)
        for k, v in attrs:
            if k in ("title", "alt", "aria-label", "placeholder") and v:
                self.all.update(v)

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        if self.stack and tag not in ("br", "img", "meta", "link", "input", "hr"):
            self.stack.pop()

    def handle_data(self, data):
        if self.skip:
            return
        self.all.update(data)
        if any(self.stack):
            self.bold.update(data)


c = Collector()
for f in public.rglob("*.html"):
    c.feed(f.read_text(encoding="utf-8", errors="ignore"))
    c.stack.clear()

# 搜尋索引與 popover 用到的文字
for f in public.rglob("*.json"):
    try:
        c.all.update(html.unescape(json.dumps(json.load(open(f, encoding="utf-8")), ensure_ascii=False)))
    except Exception:  # noqa: BLE001
        pass

all_chars = (c.all | set(BASE)) - set("\n\r\t")
bold_chars = (c.bold | set(BASE)) - set("\n\r\t")


def make(src: str, dst: str, chars: set):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.hinting = False
    font = subset.load_font(str(otf_dir / src), opts)
    sub = subset.Subsetter(opts)
    sub.populate(text="".join(sorted(chars)))
    sub.subset(font)
    subset.save_font(font, str(out_dir / dst), opts)
    size = (out_dir / dst).stat().st_size / 1024
    print(f"{dst}: {len(chars)} 字，{size:.0f} KB")


make("GenSenRounded2TW-R.otf", "gensen-r.woff2", all_chars)
make("GenSenRounded2TW-B.otf", "gensen-b.woff2", bold_chars)
