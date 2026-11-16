#!/usr/bin/env python3
"""檢查知識庫內容：雙向連結目標是否存在、frontmatter 是否完整、latest.json 是否有效。

用法：python3 scripts/check_content.py
有問題時以非 0 結束並列出問題。
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
problems = []

files = [p for p in CONTENT.rglob("*.md")]
names = {p.stem for p in files}
paths = {str(p.relative_to(CONTENT).with_suffix("")) for p in files}
aliases = set()

fm_re = re.compile(r"^---\n(.*?)\n---\n", re.S)
for p in files:
    text = p.read_text(encoding="utf-8")
    m = fm_re.match(text)
    if not m:
        problems.append(f"{p.relative_to(ROOT)}：缺少 frontmatter")
        continue
    fm = m.group(1)
    if not re.search(r"^title:", fm, re.M):
        problems.append(f"{p.relative_to(ROOT)}：缺少 title")
    am = re.search(r"^aliases:\s*\[(.*?)\]", fm, re.M)
    if am:
        aliases.update(a.strip().strip("'\"") for a in am.group(1).split(",") if a.strip())

link_re = re.compile(r"(?<!!)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]")
for p in files:
    text = p.read_text(encoding="utf-8")
    # 略過程式碼區塊中的範例
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    for target in link_re.findall(text):
        t = target.strip()
        if t in names or t in paths or t in aliases or t.rstrip("/") in paths:
            continue
        problems.append(f"{p.relative_to(ROOT)}：連結 [[{t}]] 找不到對應的頁面")

latest = ROOT / "site-extra" / "line" / "latest.json"
try:
    data = json.loads(latest.read_text(encoding="utf-8"))
    for k in ("date", "url", "text"):
        if k not in data:
            problems.append(f"latest.json 缺少 {k}")
    if data.get("text") and len(data["text"]) > 4900:
        problems.append("latest.json 的 text 超過 4900 字元")
except Exception as e:  # noqa: BLE001
    problems.append(f"latest.json 無法解析：{e}")

if problems:
    print("❌ 發現問題：")
    for x in problems:
        print(" -", x)
    sys.exit(1)
print(f"✅ 檢查通過：{len(files)} 個頁面，連結皆有效")
