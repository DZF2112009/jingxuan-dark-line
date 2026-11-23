# -*- coding: utf-8 -*-
"""把 src/ 下的 HTML + CSS + JS + 图片打包成单文件 index.html。"""
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, "src")
OUT = os.path.join(BASE, "index.html")

html = open(os.path.join(SRC, "index.html"), encoding="utf-8").read()
css = open(os.path.join(SRC, "style.css"), encoding="utf-8").read()
assets = open(os.path.join(SRC, "assets.js"), encoding="utf-8").read()
game = open(os.path.join(SRC, "game.js"), encoding="utf-8").read()

assert "</style>" not in css
assert "</script" not in assets.lower()
assert "</script" not in game.lower()

html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + css + "\n</style>")
html = html.replace('<script src="assets.js"></script>', "<script>\n" + assets + "\n</script>")
html = html.replace('<script src="game.js"></script>', "<script>\n" + game + "\n</script>")

open(OUT, "w", encoding="utf-8").write(html)
print("bundled ->", OUT, os.path.getsize(OUT), "bytes")
